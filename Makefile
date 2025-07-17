# ────────────────────────────────────────────────────────────────────────────
# Markdown Manager — Makefile
# ────────────────────────────────────────────────────────────────────────────

# Colors
RED    := \033[0;31m
GREEN  := \033[0;32m
YELLOW := \033[1;33m
BLUE   := \033[0;34m
NC     := \033[0m

# ────────────────────────────────────────────────────────────────────────────
# ENV DETECTION
# ────────────────────────────────────────────────────────────────────────────

HOST_DEV    := Danbian
HOSTNAME    := $(shell hostname)



ifeq ($(HOSTNAME),$(HOST_DEV))
REMOTE_USER_HOST :=
DEPLOY_BASE      := /var/www/littledan.com
BACKEND_BASE     := /opt/markdown-manager-api/
else
REMOTE_USER_HOST := dlittle@10.0.1.51
DEPLOY_BASE      := /var/www/littledan.com
BACKEND_BASE     := /opt/markdown-manager-api
endif

ifeq ($(OS),Windows_NT)
SHELL				 := pwsh.exe
.SHELLFLAGS := -NoLogo -NoProfile -NonInteractive -Command wsl

DETECTED_OS := Windows
COPY_CMD     := rsync -azhr --delete --no-perms --no-times --no-group --progress
SSH_CMD      := ssh

else
DETECTED_OS := $(shell uname -s)
COPY_CMD     := rsync -azhr --delete --no-perms --no-times --no-group --progress
SSH_CMD      := ssh
SHELL				 := /bin/sh
endif


# ────────────────────────────────────────────────────────────────────────────
# PATHS & PORTS
# ────────────────────────────────────────────────────────────────────────────

FRONTEND_DIR   := frontend
FRONT_DIST_DIR := $(if $(wildcard /home/dlittle/ramcache),/home/dlittle/ramcache/markdown-manager/dist,frontend/dist)
BACKEND_DIR    := backend

FRONTEND_PORT      := 3000
BACKEND_DEV_PORT   := 8000
BACKEND_PROD_PORT  := 8000

# Database path on prod
PROD_DB_PATH := $(BACKEND_BASE)/markdown_manager.db

# ────────────────────────────────────────────────────────────────────────────
# PHONY TARGETS
# ────────────────────────────────────────────────────────────────────────────

.PHONY: help quality install clean build dev dev-frontend dev-backend test
.PHONY: migrate migrate-create db-backup db-restore status stop
.PHONY: deploy deploy-front deploy-back deploy-nginx

# ────────────────────────────────────────────────────────────────────────────
help: ## Show this help
	@echo "Markdown Manager — Available Commands:"
	@echo ""
	@echo "$(BLUE)Quality & Linting:$(NC)"
	@awk 'BEGIN {FS = ":.*##"} /^quality|install|clean|build/ { printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)
	@echo ""
	@echo "$(BLUE)Build & Development:$(NC)"
	@awk 'BEGIN {FS = ":.*##"} /^dev|dev-frontend|dev-backend/ { printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)
	@echo ""
	@echo "$(BLUE)Database:$(NC)"
	@awk 'BEGIN {FS = ":.*##"} /^migrate|db-backup|db-restore/ { printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)
	@echo ""
	@echo "$(BLUE)Deployment:$(NC)"
	@awk 'BEGIN {FS = ":.*##"} /^deploy/ { printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)
	@echo ""
	@echo "$(BLUE)Utilities:$(NC)"
	@awk 'BEGIN {FS = ":.*##"} /^test|status|stop/ { printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

# ────────────────────────────────────────────────────────────────────────────
quality: ## Run pre-commit hooks
	@echo "$(YELLOW)🔍 Running pre-commit hooks...$(NC)"
	cd $(BACKEND_DIR) && poetry run pre-commit run --all-files
	@echo "$(GREEN)✅ Quality checks complete$(NC)"

install: ## Install frontend + backend deps
	@echo "$(YELLOW)📦 Installing dependencies...$(NC)"
	cd $(FRONTEND_DIR) && npm install
	cd $(BACKEND_DIR)    && poetry lock && poetry install
	@echo "$(GREEN)✅ All dependencies installed$(NC)"

clean: ## Clean build artifacts
	@./scripts/clean.sh $(FRONT_DIST_DIR) $(BACKEND_DIR)

build: clean ## Build production assets
	@./scripts/build.sh $(FRONTEND_DIR)

# ────────────────────────────────────────────────────────────────────────────
dev: ## Start frontend & backend dev servers
	@echo "$(YELLOW)🚀 Starting dev servers...$(NC)"
	@$(MAKE) --no-print-directory -j2 dev-frontend dev-backend

dev-frontend: ## Frontend dev server
ifeq ($(DETECTED_OS),Windows)
	@cd $(FRONTEND_DIR) && npm run serve -- --port $(FRONTEND_PORT)
else
	@docker info > /dev/null 2>&1 || (echo "$(RED)❌ Docker not running$(NC)" && exit 1)
	cd $(FRONTEND_DIR) && docker compose up --build -d frontend
endif

dev-backend: ## Backend dev server
	@docker info > /dev/null 2>&1 || (echo "$(RED)❌ Docker not running$(NC)" && exit 1)
	cd $(BACKEND_DIR) && docker compose up --build -d backend

# ────────────────────────────────────────────────────────────────────────────
test: ## Run pytest
	@echo "$(YELLOW)🧪 Running tests...$(NC)"
	cd $(BACKEND_DIR) && poetry run pytest
	@echo "$(GREEN)✅ Tests complete$(NC)"

status: ## Check dev server status
	@echo "$(YELLOW)📊 Dev Server Status$(NC)"
	@echo -n " - Frontend (port $(FRONTEND_PORT)): " && \
	(lsof -ti:$(FRONTEND_PORT) > /dev/null && echo "$(GREEN)✔" || echo "$(RED)✖")
	@echo -n " - Backend  (port $(BACKEND_DEV_PORT)): " && \
	(lsof -ti:$(BACKEND_DEV_PORT) > /dev/null && echo "$(GREEN)✔" || echo "$(RED)✖")

stop: ## Stop dev servers
	@echo "$(YELLOW)🛑 Stopping dev servers...$(NC)"
	@$(MAKE) --no-print-directory stop-frontend stop-backend

stop-frontend:
ifeq ($(DETECTED_OS),Windows)
	@npx kill-port $(FRONTEND_PORT)
else
	@docker compose stop frontend || true
endif

stop-backend:
ifeq ($(DETECTED_OS),Windows)
	@docker compose stop backend || true
else
	@docker compose stop backend || true
endif

# ────────────────────────────────────────────────────────────────────────────
migrate: ## Run DB migrations
	@echo "$(YELLOW)🔄 Migrating DB...$(NC)"
	cd $(BACKEND_DIR) && poetry run alembic upgrade head
	@echo "$(GREEN)✅ Migrations complete$(NC)"

migrate-create: ## Create new migration: make migrate-create MESSAGE="desc"
	@if [ -z "$(MESSAGE)" ]; then \
	 echo "$(RED)❌ Provide MESSAGE, e.g. make migrate-create MESSAGE=\"desc\"$(NC)"; \
	 exit 1; \
	fi
	cd $(BACKEND_DIR) && poetry run alembic revision --autogenerate -m "$(MESSAGE)"
	@echo "$(GREEN)✅ Migration created$(NC)"

db-backup: ## Backup prod DB locally
	@if [ -f "$(BACKEND_DIR)/markdown_manager.db" ]; then \
	 cp $(BACKEND_DIR)/markdown_manager.db $(BACKEND_DIR)/markdown_manager.db.backup.$$(date +%Y%m%d_%H%M%S); \
	 echo "$(GREEN)✅ Backup created$(NC)"; \
	else echo "$(YELLOW)⚠️ No local DB to back up$(NC)"; \
	fi

db-restore: ## Restore from backup: make db-restore BACKUP=filename
	@if [ -z "$(BACKUP)" ]; then \
	 echo "$(RED)❌ Provide BACKUP filename$(NC)"; exit 1; \
	fi
	@if [ -f "$(BACKEND_DIR)/$(BACKUP)" ]; then \
	 cp $(BACKEND_DIR)/$(BACKUP) $(BACKEND_DIR)/markdown_manager.db; \
	 echo "$(GREEN)✅ Restored from $(BACKUP)$(NC)"; \
	else echo "$(RED)❌ Backup not found$(NC)"; exit 1; \
	fi

# ────────────────────────────────────────────────────────────────────────────
deploy: build deploy-front deploy-back
#deploy-nginx ## Build + full deploy

deploy-front: build ## Sync frontend dist
	@./scripts/deploy-frontend.sh $(FRONT_DIST_DIR) $(REMOTE_USER_HOST) $(DEPLOY_BASE)

deploy-back: ## Sync backend + migrations + restart
	./scripts/deploy-backend.sh $(BACKEND_DIR) $(REMOTE_USER_HOST) $(BACKEND_BASE)

deploy-nginx: ## Sync nginx config + reload
	@echo "$(YELLOW)🔧 Deploying nginx configs$(NC)"
	$(COPY_CMD) nginx/sites-available/* $(REMOTE_USER_HOST):/tmp/
	$(SSH_CMD) $(REMOTE_USER_HOST) "\
	sudo cp /tmp/* /etc/nginx/sites-available/ && \
	sudo nginx -t && \
	sudo systemctl reload nginx \
	"

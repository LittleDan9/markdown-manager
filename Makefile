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
COPY_CMD     := rsync -azhr --delete --no-perms --no-times --no-group --progress wsl
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
EXPORT_DIR     := export-service

FRONTEND_PORT      := 3000
BACKEND_DEV_PORT   := 8000
BACKEND_PROD_PORT  := 8000


# Production environment file path
PROD_ENV_FILE := /etc/markdown-manager.env

# ────────────────────────────────────────────────────────────────────────────
# PHONY TARGETS
# ────────────────────────────────────────────────────────────────────────────

.PHONY: help quality install clean build dev dev-frontend dev-backend test test-backend status stop
.PHONY: deploy deploy-front deploy-back deploy-nginx deploy-nginx-frontend deploy-nginx-api deploy-nginx-all
.PHONY: deploy-backend-only deploy-export-only deploy-lint-only deploy-spell-check-only
.PHONY: deploy-build-only deploy-remote-only deploy-cleanup-only deploy-infra-only
.PHONY: backup-db restore-db backup-restore-cycle

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
	@echo "$(BLUE)Deployment - Full:$(NC)"
	@awk 'BEGIN {FS = ":.*##"} /^deploy[^-]|^deploy-front|^deploy-back|^deploy-nginx[^-]/ { printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)
	@echo ""
	@echo "$(BLUE)Deployment - Individual Services:$(NC)"
	@awk 'BEGIN {FS = ":.*##"} /^deploy-.*-only/ && !/deploy-(build|remote|cleanup|infra)-only/ { printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)
	@echo ""
	@echo "$(BLUE)Deployment - Phases:$(NC)"
	@awk 'BEGIN {FS = ":.*##"} /^deploy-(build|remote|cleanup|infra)-only/ { printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)
	@echo ""
	@echo "$(BLUE)Deployment - Nginx:$(NC)"
	@awk 'BEGIN {FS = ":.*##"} /^deploy-nginx-/ { printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)
	@echo ""
	@echo "$(BLUE)Utilities:$(NC)"
	@awk 'BEGIN {FS = ":.*##"} /^test|test-backend|status|stop/ { printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)
	@echo ""
	@echo "$(BLUE)Database Operations:$(NC)"
	@awk 'BEGIN {FS = ":.*##"} /^backup-db|restore-db/ { printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

# ────────────────────────────────────────────────────────────────────────────
quality: ## Run pre-commit hooks
	@echo "$(YELLOW)🔍 Running pre-commit hooks...$(NC)"
	cd $(BACKEND_DIR) && poetry run pre-commit run --all-files
	@echo "$(GREEN)✅ Quality checks complete$(NC)"

install: ## Install frontend + backend deps
	@./scripts/install.sh $(FRONTEND_DIR) $(BACKEND_DIR) $(EXPORT_DIR)

clean: ## Clean build artifacts
	@./scripts/clean.sh $(FRONT_DIST_DIR) $(BACKEND_DIR)

build-playwright-base: ## Build the Playwright base image
	@echo "$(YELLOW)🏗️ Building Playwright base image...$(NC)"
	cd $(EXPORT_DIR) && docker build -f playwright-base.Dockerfile -t markdown-manager/playwright-base:latest .
	@echo "$(GREEN)✅ Playwright base image built$(NC)"

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
test: ## Run backend (pytest with coverage) and frontend (Jest) tests
	@echo "$(YELLOW)🧪 Running backend tests with coverage...$(NC)"
	cd $(BACKEND_DIR) && ./scripts/test-coverage.sh
	@echo "$(YELLOW)🧪 Running frontend tests...$(NC)"
	cd $(FRONTEND_DIR) && npm test
	@echo "$(GREEN)✅ All tests complete$(NC)"

test-backend: ## Run backend tests with coverage
	@echo "$(YELLOW)🧪 Running backend tests with coverage...$(NC)"
	cd $(BACKEND_DIR) && ./scripts/test-coverage.sh
	@echo "$(GREEN)✅ Backend tests complete$(NC)"

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
deploy: deploy-front deploy-back

deploy-front: build ## Build and deploy frontend (includes nginx config)
	@./scripts/deploy-frontend.sh $(FRONT_DIST_DIR) $(REMOTE_USER_HOST) $(DEPLOY_BASE)
	@./scripts/deploy-nginx.sh deploy_frontend $(REMOTE_USER_HOST)

deploy-back: ## Deploy backend services (includes nginx config)
	@./scripts/deploy-backend.sh $(BACKEND_DIR) export-service markdown-lint-service spell-check-service $(REMOTE_USER_HOST) 5000

# Nginx-only deployment targets
deploy-nginx-frontend: ## Deploy only frontend nginx config
	@./scripts/deploy-nginx.sh deploy_frontend $(REMOTE_USER_HOST)

deploy-nginx-api: ## Deploy only API nginx config
	@./scripts/deploy-nginx.sh deploy_api $(REMOTE_USER_HOST)

deploy-nginx-all: ## Deploy all nginx configs
	@./scripts/deploy-nginx.sh deploy_all $(REMOTE_USER_HOST)

deploy-nginx: deploy-nginx-all ## Alias for deploy-nginx-all

# Individual service deployment targets
deploy-backend-only: ## Deploy only the main backend API service
	@./scripts/deploy-backend.sh $(BACKEND_DIR) export-service markdown-lint-service spell-check-service $(REMOTE_USER_HOST) 5000 backend

deploy-export-only: ## Deploy only the export service
	@./scripts/deploy-backend.sh $(BACKEND_DIR) export-service markdown-lint-service spell-check-service $(REMOTE_USER_HOST) 5000 export

deploy-lint-only: ## Deploy only the markdown lint service
	@./scripts/deploy-backend.sh $(BACKEND_DIR) export-service markdown-lint-service spell-check-service $(REMOTE_USER_HOST) 5000 lint

deploy-spell-check-only: ## Deploy only the spell check service
	@./scripts/deploy-backend.sh $(BACKEND_DIR) export-service markdown-lint-service spell-check-service $(REMOTE_USER_HOST) 5000 spell-check

# Deployment phase targets
deploy-infra-only: ## Setup deployment infrastructure (SSH tunnels, registry)
	@./scripts/deploy-backend.sh $(BACKEND_DIR) export-service markdown-lint-service spell-check-service $(REMOTE_USER_HOST) 5000 infra

deploy-build-only: ## Build and push images to registry only
	@./scripts/deploy-backend.sh $(BACKEND_DIR) export-service markdown-lint-service spell-check-service $(REMOTE_USER_HOST) 5000 build

deploy-remote-only: ## Deploy to remote servers only (assumes images exist)
	@./scripts/deploy-backend.sh $(BACKEND_DIR) export-service markdown-lint-service spell-check-service $(REMOTE_USER_HOST) 5000 remote

deploy-cleanup-only: ## Run cleanup operations only
	@./scripts/deploy-backend.sh $(BACKEND_DIR) export-service markdown-lint-service spell-check-service $(REMOTE_USER_HOST) 5000 cleanup

# ────────────────────────────────────────────────────────────────────────────
# DATABASE OPERATIONS
# ────────────────────────────────────────────────────────────────────────────

backup-db: ## Backup production database to JSON
	@./scripts/backup-db.sh $(REMOTE_USER_HOST)

restore-db: ## Restore database from backup file (requires BACKUP_FILE=path)
ifndef BACKUP_FILE
	@echo "$(RED)❌ Missing BACKUP_FILE variable. Usage: make restore-db BACKUP_FILE=backups/file.json$(NC)"
	@exit 1
endif
	@./scripts/restore-db.sh $(REMOTE_USER_HOST) $(BACKUP_FILE)

backup-restore-cycle: ## Run backup then restore in sequence
	@./scripts/backup-restore-cycle.sh $(REMOTE_USER_HOST)

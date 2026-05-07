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

UI_DIR              := services/ui
FRONT_DIST_DIR       := $(if $(wildcard /home/dlittle/ramcache),/home/dlittle/ramcache/markdown-manager/dist,services/ui/dist)
BACKEND_DIR          := services/backend
LINT_DIR             := services/linting
SPELL_CHECK_DIR      := services/spell-check
CONSUMER_DIR         := services/event-consumer
EVENT_PUBLISHER_DIR  := services/event-publisher
PLATFORM_DIR         ?= ../platform-manager

# Auto-detect certs overlay for corporate SSL inspection environments
CERTS_FILE := docker-compose.certs.yml
COMPOSE_FILES := $(if $(wildcard $(CERTS_FILE)),-f docker-compose.yml -f $(CERTS_FILE),)

FRONTEND_PORT      := 3000
BACKEND_DEV_PORT   := 8000
BACKEND_PROD_PORT  := 8000


# Production environment file path
PROD_ENV_FILE := /etc/markdown-manager.env

# ────────────────────────────────────────────────────────────────────────────
# PHONY TARGETS
# ────────────────────────────────────────────────────────────────────────────

.PHONY: help quality install clean build dev dev-frontend dev-backend test test-backend status stop
.PHONY: deploy deploy-update deploy-bootstrap deploy-nginx deploy-status deploy-logs
.PHONY: deploy-db-backup deploy-db-migrate deploy-dry-run sync-locks
.PHONY: deploy-infra deploy-rollback ensure-platform ensure-db
.PHONY: backup-db restore-db backup-restore-cycle

# ────────────────────────────────────────────────────────────────────────────
help: ## Show this help
	@echo "Markdown Manager — Available Commands:"
	@echo ""
	@echo "$(BLUE)Quality & Build:$(NC)"
	@awk 'BEGIN {FS = ":.*##"} /^quality|install|clean|build/ { printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)
	@echo ""
	@echo "$(BLUE)Development:$(NC)"
	@awk 'BEGIN {FS = ":.*##"} /^dev|dev-frontend|dev-backend/ { printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)
	@echo ""
	@echo "$(BLUE)Deployment:$(NC)"
	@awk 'BEGIN {FS = ":.*##"} /^deploy/ { printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)
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
	@./scripts/install.sh $(UI_DIR) $(BACKEND_DIR)

clean: ## Clean build artifacts
	@./scripts/clean.sh $(FRONT_DIST_DIR) $(BACKEND_DIR)

build: ## Build production assets
	@./scripts/build.sh $(UI_DIR)

# ────────────────────────────────────────────────────────────────────────────
ensure-platform: ## Ensure shared platform infrastructure is running
	@echo "$(YELLOW)🔧 Ensuring platform shared services are running...$(NC)"
	@$(MAKE) --no-print-directory -C $(PLATFORM_DIR) dev
	@echo "$(GREEN)✅ Platform services ready$(NC)"

ensure-db: ensure-platform ## Ensure markdown_manager database exists in shared PostgreSQL
	@DB_EXISTS=$$(docker exec platform-db-1 psql -U postgres -tAc \
		"SELECT 1 FROM pg_database WHERE datname = 'markdown_manager';" 2>/dev/null || true); \
	if [ "$$DB_EXISTS" != "1" ]; then \
		echo "$(YELLOW)📦 Provisioning markdown_manager database...$(NC)"; \
		$(MAKE) --no-print-directory -C $(PLATFORM_DIR) provision-db-mm; \
		echo "$(GREEN)✅ Database provisioned$(NC)"; \
	fi

dev: ensure-db ## Start frontend & backend dev servers
	@echo "$(YELLOW)🚀 Starting dev servers...$(NC)"
	docker compose $(COMPOSE_FILES) up --build -d backend frontend
	@echo "$(GREEN)✅ Dev servers started$(NC)"

dev-frontend: ## Frontend dev server
ifeq ($(DETECTED_OS),Windows)
	@cd $(UI_DIR) && npm run serve -- --port $(FRONTEND_PORT)
else
	@docker info > /dev/null 2>&1 || (echo "$(RED)❌ Docker not running$(NC)" && exit 1)
	docker compose $(COMPOSE_FILES) up --build -d frontend
endif

dev-backend: ## Backend dev server
	@docker info > /dev/null 2>&1 || (echo "$(RED)❌ Docker not running$(NC)" && exit 1)
	docker compose $(COMPOSE_FILES) up --build -d backend

# ────────────────────────────────────────────────────────────────────────────
test: ## Run backend (pytest with coverage) and frontend (Jest) tests
	@echo "$(YELLOW)🧪 Running backend tests with coverage...$(NC)"
	cd $(BACKEND_DIR) && poetry run pytest --cov=app --cov-report=html --cov-report=term-missing
	@echo "$(YELLOW)🧪 Running frontend tests...$(NC)"
	cd $(UI_DIR) && npm test
	@echo "$(GREEN)✅ All tests complete$(NC)"

test-backend: ## Run backend tests with coverage
	@echo "$(YELLOW)🧪 Running backend tests with coverage...$(NC)"
	cd $(BACKEND_DIR) && poetry run pytest --cov=app --cov-report=html --cov-report=term-missing
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
# DEPLOYMENT (Docker Compose + Ansible)
# ────────────────────────────────────────────────────────────────────────────
# Usage:
#   make deploy                      # Full deploy (bootstrap + app + nginx)
#   make deploy-update               # App update only (blue/green swap)
#   make deploy HOST=192.168.1.50    # Deploy to a different host
#   make deploy-bootstrap            # First-time server setup only
#   make deploy-nginx                # Update host nginx config only
#   make deploy-infra                # Deploy platform-manager infra stack
#   make deploy-rollback             # Revert to previous blue/green slot
#   make deploy-status               # Check container health (both slots)
#   make deploy-logs                 # Tail production logs
#   make deploy-db-migrate           # Run database migrations
#   make deploy-db-backup            # Backup production database
#   make deploy-dry-run              # Ansible dry run

# Ansible extra vars for host override
DEPLOY_HOST_ARGS := $(if $(HOST),-e target_ip=$(HOST),)

sync-locks: ## Regenerate all lock files to match manifests
	@echo "$(YELLOW)Syncing lock files...$(NC)"
	@cd $(UI_DIR) && npm install --package-lock-only --silent 2>&1 | tail -1
	@cd $(LINT_DIR) && npm install --package-lock-only --silent 2>&1 | tail -1
	@cd $(SPELL_CHECK_DIR) && npm install --package-lock-only --silent 2>&1 | tail -1
	@cd $(BACKEND_DIR) && poetry lock --quiet 2>/dev/null
	@cd $(EVENT_PUBLISHER_DIR) && poetry lock --quiet 2>/dev/null
	@cd $(CONSUMER_DIR) && poetry lock --quiet 2>/dev/null
	@echo "$(GREEN)Lock files synced$(NC)"

deploy: sync-locks ## Deploy all services (bootstrap + app + nginx)
	@echo "$(BLUE)Starting Markdown Manager Deployment$(NC)"
	@./scripts/setup-ansible.sh
	@cd deployment && ansible-playbook -i inventory.yml deploy.yml -v --diff -K $(DEPLOY_HOST_ARGS)

deploy-update: sync-locks ## Deploy app update only (skip bootstrap)
	@echo "$(BLUE)Deploying application update$(NC)"
	@./scripts/setup-ansible.sh
	@cd deployment && ansible-playbook -i inventory.yml deploy.yml --tags deploy -v --diff $(DEPLOY_HOST_ARGS)
	@echo "$(GREEN)Deploy completed at $$(date '+%Y-%m-%d %H:%M:%S')$(NC)"

deploy-bootstrap: ## First-time server setup (Docker, UFW, dirs)
	@./scripts/setup-ansible.sh
	@cd deployment && ansible-playbook -i inventory.yml deploy.yml --tags bootstrap -v --diff -K $(DEPLOY_HOST_ARGS)

deploy-nginx: ## Update host nginx configuration only
	@./scripts/setup-ansible.sh
	@cd deployment && ansible-playbook -i inventory.yml deploy.yml --tags nginx -v --diff -K $(DEPLOY_HOST_ARGS)

deploy-infra: ## Deploy shared infrastructure (platform-manager)
	@echo "$(BLUE)Updating shared infrastructure stack$(NC)"
	@$(SSH_CMD) $(if $(HOST),dlittle@$(HOST),$(REMOTE_USER_HOST)) \
		"cd /opt/platform-manager && ./scripts/deploy-infra.sh"

deploy-rollback: ## Revert to previous blue/green deployment slot
	@echo "$(YELLOW)Rolling back to previous deployment slot$(NC)"
	@$(SSH_CMD) $(if $(HOST),dlittle@$(HOST),$(REMOTE_USER_HOST)) \
		"cd /opt/markdown-manager && ./scripts/deploy-blue-green.sh --rollback"
	@echo "$(GREEN)Rollback completed at $$(date '+%Y-%m-%d %H:%M:%S')$(NC)"

deploy-status: ## Check production container status and health
	@echo "$(BLUE)Checking production status$(NC)"
	@$(SSH_CMD) $(if $(HOST),dlittle@$(HOST),$(REMOTE_USER_HOST)) \
		"cd /opt/markdown-manager && echo '=== Active Slot ===' && cat .deploy-slot 2>/dev/null || echo 'unknown' && echo '' && echo '=== Infrastructure (platform) ===' && docker compose -p platform ps 2>/dev/null && echo '' && SLOT=\$$(cat .deploy-slot 2>/dev/null || echo blue) && echo \"=== Application (mm-\$$SLOT) ===\" && docker compose -p mm-\$$SLOT -f docker-compose.app.yml --env-file deployment/production.env ps 2>/dev/null && echo '' && echo '=== Health Check ===' && curl -sf http://localhost:8080/api/health || echo 'Health check failed'"

deploy-logs: ## Tail production container logs (active slot)
	@$(SSH_CMD) $(if $(HOST),dlittle@$(HOST),$(REMOTE_USER_HOST)) \
		"cd /opt/markdown-manager && SLOT=\$$(cat .deploy-slot 2>/dev/null || echo blue) && docker compose -p mm-\$$SLOT -f docker-compose.app.yml --env-file deployment/production.env logs -f --tail=50"

deploy-logs-service: ## Tail logs for a specific service (usage: make deploy-logs-service SVC=backend)
	@$(SSH_CMD) $(if $(HOST),dlittle@$(HOST),$(REMOTE_USER_HOST)) \
		"cd /opt/markdown-manager && SLOT=\$$(cat .deploy-slot 2>/dev/null || echo blue) && docker compose -p mm-\$$SLOT -f docker-compose.app.yml --env-file deployment/production.env logs -f --tail=100 $(SVC)"

deploy-logs-errors: ## Tail only ERROR-level logs from active slot
	@$(SSH_CMD) $(if $(HOST),dlittle@$(HOST),$(REMOTE_USER_HOST)) \
		"cd /opt/markdown-manager && SLOT=\$$(cat .deploy-slot 2>/dev/null || echo blue) && docker compose -p mm-\$$SLOT -f docker-compose.app.yml --env-file deployment/production.env logs -f --tail=200 2>&1 | grep --line-buffered ERROR"

deploy-db-migrate: ## Run database migrations in production
	@$(SSH_CMD) $(if $(HOST),dlittle@$(HOST),$(REMOTE_USER_HOST)) \
		"cd /opt/markdown-manager && SLOT=\$$(cat .deploy-slot 2>/dev/null || echo blue) && docker compose -p mm-\$$SLOT -f docker-compose.app.yml --env-file deployment/production.env exec -T backend /markdown-manager/.venv/bin/alembic upgrade head"

deploy-db-backup: ## Backup production database
	@echo "$(BLUE)Backing up production database$(NC)"
	@$(SSH_CMD) $(if $(HOST),dlittle@$(HOST),$(REMOTE_USER_HOST)) \
		"docker exec platform-db-1 pg_dump -U markdown_manager markdown_manager" \
		> backups/db-backup-$$(date +%Y%m%d-%H%M%S).sql
	@echo "$(GREEN)Backup saved to backups/$(NC)"

deploy-dry-run: ## Run Ansible deployment in check mode (dry run)
	@./scripts/setup-ansible.sh
	@cd deployment && ansible-playbook -i inventory.yml deploy.yml --check --diff -K $(DEPLOY_HOST_ARGS)

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

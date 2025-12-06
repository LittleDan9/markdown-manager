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
EXPORT_DIR           := services/export
LINT_DIR             := services/linting
SPELL_CHECK_DIR      := services/spell-check
CONSUMER_DIR         := services/event-consumer
EVENT_PUBLISHER_DIR  := services/event-publisher

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
.PHONY: deploy-backend-only deploy-export-only deploy-lint-only deploy-spell-check-only deploy-consumer-only
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
	@echo "$(BLUE)Deployment - Ansible (Production):$(NC)"
	@awk 'BEGIN {FS = ":.*##"} /^deploy[^-]|^deploy-dry-run/ { printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)
	@echo ""
	@echo "$(BLUE)Deployment - Individual Services:$(NC)"
	@awk 'BEGIN {FS = ":.*##"} /^deploy-.*/ && !/^deploy[^-]/ && !/deploy-dry-run/ { printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)
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
	@./scripts/install.sh $(UI_DIR) $(BACKEND_DIR) $(EXPORT_DIR)

clean: ## Clean build artifacts
	@./scripts/clean.sh $(FRONT_DIST_DIR) $(BACKEND_DIR)

build: ## Build production assets
	@./scripts/build.sh $(UI_DIR)

# ────────────────────────────────────────────────────────────────────────────
dev: ## Start frontend & backend dev servers
	@echo "$(YELLOW)🚀 Starting dev servers...$(NC)"
	@$(MAKE) --no-print-directory -j2 dev-frontend dev-backend

dev-frontend: ## Frontend dev server
ifeq ($(DETECTED_OS),Windows)
	@cd $(UI_DIR) && npm run serve -- --port $(FRONTEND_PORT)
else
	@docker info > /dev/null 2>&1 || (echo "$(RED)❌ Docker not running$(NC)" && exit 1)
	cd $(UI_DIR) && docker compose up --build -d frontend
endif

dev-backend: ## Backend dev server
	@docker info > /dev/null 2>&1 || (echo "$(RED)❌ Docker not running$(NC)" && exit 1)
	cd $(BACKEND_DIR) && docker compose up --build -d backend

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
# LEGACY SHELL SCRIPT DEPLOYMENT SYSTEM REMOVED
# ────────────────────────────────────────────────────────────────────────────
# 
# The old shell script deployment system has been replaced with Ansible.
# 
# OLD TARGETS REMOVED:
#   deploy, deploy-front, deploy-back, deploy-nginx-*, deploy-*-only, etc.
# 
# NEW ANSIBLE TARGETS:
#   make deploy              # Deploy all services
#   make deploy-backend      # Deploy backend only  
#   make deploy-export       # Deploy export only
#   make deploy-linting      # Deploy linting only
#   make deploy-spell-check  # Deploy spell-check only
#   etc.
# 
# Benefits of Ansible deployment:
# - Proper error detection and health validation
# - Configuration-driven deployment 
# - Mature orchestration with rollback capabilities
# - No more "convoluted" shell scripts
# 
# Migration complete: deployment/MIGRATION-COMPLETE.md

# ────────────────────────────────────────────────────────────────────────────
# ANSIBLE DEPLOYMENT (New System)
# ────────────────────────────────────────────────────────────────────────────

deploy: ## Deploy all services using Ansible (native)
	@./scripts/setup-ansible.sh
	@cd deployment && ansible-playbook -i inventory.yml deploy.yml

deploy-backend: ## Deploy only backend service using Ansible
	@./scripts/setup-ansible.sh
	@cd deployment && ansible-playbook -i inventory.yml deploy.yml --tags backend -e deploy_service=backend

deploy-export: ## Deploy only export service using Ansible
	@./scripts/setup-ansible.sh
	@cd deployment && ansible-playbook -i inventory.yml deploy.yml --tags export -e deploy_service=export

deploy-lint: ## Deploy only lint service using Ansible
	@./scripts/setup-ansible.sh
	@cd deployment && ansible-playbook -i inventory.yml deploy.yml --tags lint -e deploy_service=lint

deploy-linting-consumer: ## Deploy only linting event consumer using Ansible
	@./scripts/setup-ansible.sh
	@cd deployment && ansible-playbook -i inventory.yml deploy.yml --tags linting-consumer

deploy-spell-check: ## Deploy only spell-check service using Ansible
	@./scripts/setup-ansible.sh
	@cd deployment && ansible-playbook -i inventory.yml deploy.yml --tags spell-check

deploy-spell-check-consumer: ## Deploy only spell-check event consumer using Ansible
	@./scripts/setup-ansible.sh
	@cd deployment && ansible-playbook -i inventory.yml deploy.yml --tags spell-check-consumer

deploy-event-publisher: ## Deploy only event-publisher service using Ansible
	@./scripts/setup-ansible.sh
	@cd deployment && ansible-playbook -i inventory.yml deploy.yml --tags event-publisher

deploy-redis: ## Deploy only Redis service using Ansible
	@./scripts/setup-ansible.sh
	@cd deployment && ansible-playbook -i inventory.yml deploy.yml --tags redis

deploy-cleanup-legacy: ## Clean up legacy shell script deployment artifacts
	@echo "⚠️  WARNING: This will remove legacy deployment artifacts!"
	@echo "Make sure you have backups before continuing."
	@./deployment/cleanup-legacy.sh

deploy-infra: ## Setup infrastructure only using Ansible
	@./scripts/setup-ansible.sh
	@cd deployment && ansible-playbook -i inventory.yml deploy.yml --tags infra

deploy-nginx: ## Update nginx configuration only using Ansible
	@./scripts/setup-ansible.sh
	@cd deployment && ansible-playbook -i inventory.yml deploy.yml --tags nginx

deploy-ui: ## Build and deploy UI static files
	@echo "$(YELLOW)🔨 Building UI...$(NC)"
	@cd $(UI_DIR) && npm install && npm run build:clean
	@echo "$(YELLOW)📤 Deploying UI files...$(NC)"
ifeq ($(REMOTE_USER_HOST),)
	@sudo mkdir -p $(DEPLOY_BASE)
	@sudo $(COPY_CMD) $(FRONT_DIST_DIR)/ $(DEPLOY_BASE)/
	@sudo chown -R www-data:www-data $(DEPLOY_BASE)
else
	@$(SSH_CMD) -i ~/.ssh/id_danbian $(REMOTE_USER_HOST) "sudo mkdir -p $(DEPLOY_BASE) && sudo chown -R dlittle:dlittle $(DEPLOY_BASE)"
	@$(COPY_CMD) $(FRONT_DIST_DIR)/ $(REMOTE_USER_HOST):$(DEPLOY_BASE)/
	@$(SSH_CMD) -i ~/.ssh/id_danbian $(REMOTE_USER_HOST) "sudo chown -R www-data:www-data $(DEPLOY_BASE)"
endif
	@echo "$(GREEN)✅ UI deployed successfully$(NC)"

deploy-cleanup: ## Run cleanup operations using Ansible
	@./scripts/setup-ansible.sh
	@cd deployment && ansible-playbook -i inventory.yml deploy.yml --tags cleanup

deploy-dry-run: ## Run Ansible deployment in check mode (dry run)
	@./scripts/setup-ansible.sh
	@cd deployment && ansible-playbook -i inventory.yml deploy.yml --check --diff

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

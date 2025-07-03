# Markdown Manager - Makefile
# Simple build and deployment automation

# Colors for output
RED := \033[0;31m
GREEN := \033[0;32m
YELLOW := \033[1;33m
BLUE := \033[0;34m
NC := \033[0m # No Color

# Configuration
FRONTEND_PORT := 3000
BACKEND_DEV_PORT := 8001
BACKEND_PROD_PORT := 8000

# Deployment configuration
HOSTNAME := $(shell hostname)
BACKEND_DIR := backend
PRODUCTION_DB_PATH := /opt/markdown-manager-api/markdown_manager.db
ifeq ($(HOSTNAME),Danbian)
    DEPLOY_TARGET := /var/www/littledan.com/
    BACKEND_DEPLOY_TARGET := /opt/markdown-manager-api/
    DEPLOY_METHOD := local
else
    DEPLOY_TARGET := dlittle@10.0.1.51:/var/www/littledan.com/
    BACKEND_DEPLOY_TARGET := dlittle@10.0.1.51:/opt/markdown-manager-api/
    DEPLOY_METHOD := remote
endif

.PHONY: help install clean build dev dev-frontend dev-backend deploy deploy-local deploy-remote deploy-backend-local deploy-backend-remote migrate migrate-create test db-backup db-restore

# Default target
help: ## Show this help message
	@echo "Markdown Manager - Available Commands:"
	@echo ""
	@echo "$(BLUE)Build & Development:$(NC)"
	@awk 'BEGIN {FS = ":.*##"; printf ""} /^(install|clean|build|dev|dev-frontend|dev-backend):.*##/ { printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)
	@echo ""
	@echo "$(BLUE)Database Management:$(NC)"
	@awk 'BEGIN {FS = ":.*##"; printf ""} /^(migrate|migrate-create|db-backup|db-restore):.*##/ { printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)
	@echo ""
	@echo "$(BLUE)Deployment:$(NC)"
	@awk 'BEGIN {FS = ":.*##"; printf ""} /^(deploy|deploy-local|deploy-remote|deploy-frontend-only):.*##/ { printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)
	@echo ""
	@echo "$(BLUE)Utilities:$(NC)"
	@awk 'BEGIN {FS = ":.*##"; printf ""} /^(test|status|stop|logs):.*##/ { printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

install: ## Install all dependencies (frontend + backend)
	@echo "$(YELLOW)📦 Installing dependencies...$(NC)"
	@echo "$(BLUE)Frontend dependencies:$(NC)"
	cd frontend && npm install
	@echo "$(BLUE)Backend dependencies:$(NC)"
	cd backend && poetry install
	@echo "$(GREEN)✅ All dependencies installed$(NC)"

clean: ## Clean build artifacts and caches
	@echo "$(YELLOW)🧹 Cleaning build artifacts...$(NC)"
	rm -rf dist/
	rm -rf frontend/dist/
	rm -rf frontend/node_modules/.cache/
	cd backend && poetry run python -c "import shutil; shutil.rmtree('__pycache__', ignore_errors=True)"
	@echo "$(GREEN)✅ Clean complete$(NC)"

build: clean ## Build production assets
	@echo "$(YELLOW)🔨 Building production assets...$(NC)"
	cd frontend && npm run build
	@echo "$(GREEN)✅ Build complete$(NC)"

dev: ## Start both frontend and backend dev servers
	@echo "$(YELLOW)🚀 Starting development servers...$(NC)"
	@echo "$(BLUE)Frontend: http://localhost:$(FRONTEND_PORT)$(NC)"
	@echo "$(BLUE)Backend API: http://localhost:$(BACKEND_DEV_PORT)$(NC)"
	@echo "$(BLUE)API Docs: http://localhost:$(BACKEND_DEV_PORT)/docs$(NC)"
	@echo "$(YELLOW)Press Ctrl+C to stop both servers$(NC)"
	@echo ""
	@$(MAKE) -j2 dev-frontend dev-backend

dev-frontend: ## Start only frontend dev server
	@echo "$(BLUE)🌐 Starting frontend dev server on port $(FRONTEND_PORT)...$(NC)"
	cd frontend && npm run serve -- --port $(FRONTEND_PORT)

dev-backend: ## Start only backend dev server
	@echo "$(BLUE)⚡ Starting backend dev server on port $(BACKEND_DEV_PORT)...$(NC)"
	cd backend && poetry run uvicorn app.main:app --reload --host 0.0.0.0 --port $(BACKEND_DEV_PORT)

deploy: build deploy-$(DEPLOY_METHOD) ## Build and deploy to production (frontend + backend with migrations)

deploy-local: ## Deploy to local production server
	@echo "$(YELLOW)🚀 Deploying locally to $(DEPLOY_TARGET)...$(NC)"
	@echo "$(BLUE)Deploying frontend...$(NC)"
	rsync -r --no-perms --no-times --no-group --progress frontend/dist/ $(DEPLOY_TARGET)
	@if [ -f "$(DEPLOY_TARGET)/index.html" ]; then \
		echo -e "$(GREEN)✅ Frontend deployment verified$(NC)"; \
	else \
		echo -e "$(RED)❌ Frontend deployment verification failed$(NC)"; \
		exit 1; \
	fi
	@echo "$(BLUE)Deploying backend...$(NC)"
	@$(MAKE) deploy-backend-local
	@echo "$(GREEN)🎉 Local deployment complete!$(NC)"

deploy-remote: ## Deploy to remote production server
	@echo "$(YELLOW)🚀 Deploying remotely to $(DEPLOY_TARGET)...$(NC)"
	@echo "$(BLUE)Deploying frontend...$(NC)"
	rsync -r --no-perms --no-times --no-group --progress frontend/dist/ $(DEPLOY_TARGET)
	@echo "$(BLUE)Deploying backend...$(NC)"
	@$(MAKE) deploy-backend-remote
	@echo "$(GREEN)🎉 Remote deployment complete!$(NC)"

deploy-backend-local: ## Deploy backend locally with database migrations
	@echo "$(YELLOW)📦 Deploying backend locally...$(NC)"
	# Create backend directory if it doesn't exist
	mkdir -p $(BACKEND_DEPLOY_TARGET)
	# Backup existing database if it exists
	@if [ -f "$(PRODUCTION_DB_PATH)" ]; then \
		echo "$(BLUE)Backing up existing database...$(NC)"; \
		cp $(PRODUCTION_DB_PATH) $(PRODUCTION_DB_PATH).backup.$$(date +%Y%m%d_%H%M%S); \
	fi
	# Deploy backend code (excluding database)
	rsync -r --no-perms --no-times --no-group --progress \
		--exclude='markdown_manager.db' \
		--exclude='__pycache__' \
		--exclude='.pytest_cache' \
		--exclude='.venv' \
		$(BACKEND_DIR)/ $(BACKEND_DEPLOY_TARGET)
	# Run database migrations
	@echo "$(BLUE)Running database migrations...$(NC)"
	cd $(BACKEND_DEPLOY_TARGET) && poetry run alembic upgrade head
	@echo "$(GREEN)✅ Backend deployment with migrations complete$(NC)"

deploy-backend-remote: ## Deploy backend remotely with database migrations
	@echo "$(YELLOW)📦 Deploying backend remotely...$(NC)"
	# Create backend directory if it doesn't exist
	ssh $(shell echo $(BACKEND_DEPLOY_TARGET) | cut -d: -f1) "mkdir -p $(shell echo $(BACKEND_DEPLOY_TARGET) | cut -d: -f2)"
	# Backup existing database if it exists
	ssh $(shell echo $(BACKEND_DEPLOY_TARGET) | cut -d: -f1) \
		"if [ -f '$(shell echo $(BACKEND_DEPLOY_TARGET) | cut -d: -f2)/markdown_manager.db' ]; then \
			echo 'Backing up existing database...'; \
			cp $(shell echo $(BACKEND_DEPLOY_TARGET) | cut -d: -f2)/markdown_manager.db \
			   $(shell echo $(BACKEND_DEPLOY_TARGET) | cut -d: -f2)/markdown_manager.db.backup.\$$(date +%Y%m%d_%H%M%S); \
		fi"
	# Deploy backend code (excluding database)
	rsync -r --no-perms --no-times --no-group --progress \
		--exclude='markdown_manager.db' \
		--exclude='__pycache__' \
		--exclude='.pytest_cache' \
		--exclude='.venv' \
		$(BACKEND_DIR)/ $(BACKEND_DEPLOY_TARGET)
	# Run database migrations
	@echo "$(BLUE)Running database migrations...$(NC)"
	ssh $(shell echo $(BACKEND_DEPLOY_TARGET) | cut -d: -f1) \
		"cd $(shell echo $(BACKEND_DEPLOY_TARGET) | cut -d: -f2) && poetry run alembic upgrade head"
	@echo "$(GREEN)✅ Backend deployment with migrations complete$(NC)"

backend-prod: ## Start backend in production mode
	@echo "$(BLUE)🔧 Starting backend in production mode on port $(BACKEND_PROD_PORT)...$(NC)"
	cd backend && poetry run uvicorn app.main:app --host 127.0.0.1 --port $(BACKEND_PROD_PORT)

test: ## Run tests
	@echo "$(YELLOW)🧪 Running tests...$(NC)"
	cd backend && poetry run pytest
	@echo "$(GREEN)✅ Tests complete$(NC)"

status: ## Show development server status
	@echo "$(YELLOW)📊 Development Server Status:$(NC)"
	@echo "$(BLUE)Frontend (port $(FRONTEND_PORT)):$(NC)"
	@if lsof -ti:$(FRONTEND_PORT) > /dev/null 2>&1; then \
		echo "$(GREEN)  ✅ Running$(NC)"; \
	else \
		echo "$(RED)  ❌ Not running$(NC)"; \
	fi
	@echo "$(BLUE)Backend (port $(BACKEND_DEV_PORT)):$(NC)"
	@if lsof -ti:$(BACKEND_DEV_PORT) > /dev/null 2>&1; then \
		echo "$(GREEN)  ✅ Running$(NC)"; \
	else \
		echo "$(RED)  ❌ Not running$(NC)"; \
	fi

stop: ## Stop all development servers
	@echo "$(YELLOW)🛑 Stopping development servers...$(NC)"
	@pid=$$(lsof -tiTCP:$(FRONTEND_PORT) -sTCP:LISTEN) ; \
	if [ -n "$$pid" ] ; then \
	  echo "$(BLUE)Stopping frontend server on port $(FRONTEND_PORT)...$(NC)" ; \
	  kill -TERM $$pid && \
	    echo "$(GREEN)  ✅ Frontend server stopped$(NC)" ; \
	else \
	  echo "$(YELLOW)  ℹ️  Frontend server not running$(NC)" ; \
	fi

	@pid=$$(lsof -tiTCP:$(BACKEND_DEV_PORT) -sTCP:LISTEN) ; \
	if [ -n "$$pid" ] ; then \
	  echo "$(BLUE)Stopping backend server on port $(BACKEND_DEV_PORT)...$(NC)" ; \
	  kill -TERM $$pid && \
	    echo "$(GREEN)  ✅ Backend server stopped$(NC)" ; \
	else \
	  echo "$(YELLOW)  ℹ️  Backend server not running$(NC)" ; \
	fi


# Advanced targets
dev-debug: ## Start dev servers with debug output
	@echo "$(YELLOW)🐛 Starting development servers in debug mode...$(NC)"
	@$(MAKE) dev VERBOSE=1

logs: ## Show recent logs (if using systemd for production)
	@echo "$(YELLOW)📜 Recent logs:$(NC)"
	@echo "$(BLUE)System logs for markdown-manager:$(NC)"
	-journalctl -u markdown-manager --lines=20 --no-pager

migrate: ## Run database migrations
	@echo "$(YELLOW)🔄 Running database migrations...$(NC)"
	cd backend && poetry run alembic upgrade head
	@echo "$(GREEN)✅ Migrations complete$(NC)"

migrate-create: ## Create a new migration (usage: make migrate-create MESSAGE="description")
	@echo "$(YELLOW)📝 Creating new migration...$(NC)"
	@if [ -z "$(MESSAGE)" ]; then \
		echo "$(RED)❌ Please provide a MESSAGE: make migrate-create MESSAGE='your description'$(NC)"; \
		exit 1; \
	fi
	cd backend && poetry run alembic revision --autogenerate -m "$(MESSAGE)"
	@echo "$(GREEN)✅ Migration created$(NC)"

db-backup: ## Backup the database
	@echo "$(YELLOW)💾 Creating database backup...$(NC)"
	@if [ -f "backend/markdown_manager.db" ]; then \
		cp backend/markdown_manager.db backend/markdown_manager.db.backup.$$(date +%Y%m%d_%H%M%S); \
		echo "$(GREEN)✅ Database backed up$(NC)"; \
	else \
		echo "$(YELLOW)⚠️  No database found to backup$(NC)"; \
	fi

db-restore: ## Restore database from backup (usage: make db-restore BACKUP=filename)
	@echo "$(YELLOW)🔄 Restoring database...$(NC)"
	@if [ -z "$(BACKUP)" ]; then \
		echo "$(RED)❌ Please provide a BACKUP filename: make db-restore BACKUP=markdown_manager.db.backup.20231201_120000$(NC)"; \
		exit 1; \
	fi
	@if [ -f "backend/$(BACKUP)" ]; then \
		cp backend/$(BACKUP) backend/markdown_manager.db; \
		echo "$(GREEN)✅ Database restored from $(BACKUP)$(NC)"; \
	else \
		echo "$(RED)❌ Backup file backend/$(BACKUP) not found$(NC)"; \
		exit 1; \
	fi

deploy-frontend-only: ## Deploy only frontend (skip backend)
	@echo "$(YELLOW)🌐 Deploying frontend only...$(NC)"
	cd frontend && npm run build
	rsync -r --no-perms --no-times --no-group --progress frontend/dist/ $(DEPLOY_TARGET)
	@echo "$(GREEN)✅ Frontend-only deployment complete$(NC)"

# Cleanup nginx references
cleanup-nginx: ## Remove obsolete nginx configuration
	@echo "$(YELLOW)🧹 Cleaning up obsolete nginx configuration...$(NC)"
	rm -f nginx/sites-available/localhost-dev
	@echo "$(GREEN)✅ Nginx cleanup complete$(NC)"

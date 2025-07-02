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
ifeq ($(HOSTNAME),Danbian)
    DEPLOY_TARGET := /var/www/littledan.com/
    DEPLOY_METHOD := local
else
    DEPLOY_TARGET := dlittle@10.0.1.51:/var/www/littledan.com/
    DEPLOY_METHOD := remote
endif

.PHONY: help install clean build dev dev-frontend dev-backend deploy deploy-local deploy-remote test

# Default target
help: ## Show this help message
	@echo "Markdown Manager - Available Commands:"
	@echo ""
	@awk 'BEGIN {FS = ":.*##"; printf "Usage:\n  make \033[36m<target>\033[0m\n\nTargets:\n"} /^[a-zA-Z_-]+:.*##/ { printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

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

deploy: build deploy-$(DEPLOY_METHOD) ## Build and deploy to production

deploy-local: ## Deploy to local production server
	@echo "$(YELLOW)🚀 Deploying locally to $(DEPLOY_TARGET)...$(NC)"
	rsync -r --no-perms --no-times --no-group --progress frontend/dist/ $(DEPLOY_TARGET)
	@if [ -f "$(DEPLOY_TARGET)/index.html" ]; then \
		echo -e "$(GREEN)✅ Local deployment verified$(NC)"; \
	else \
		echo -e "$(RED)❌ Deployment verification failed$(NC)"; \
		exit 1; \
	fi
	@echo "$(GREEN)🎉 Local deployment complete!$(NC)"

deploy-remote: ## Deploy to remote production server
	@echo "$(YELLOW)🚀 Deploying remotely to $(DEPLOY_TARGET)...$(NC)"
	rsync -r --no-perms --no-times --no-group --progress frontend/dist/ $(DEPLOY_TARGET)
	@echo "$(GREEN)🎉 Remote deployment complete!$(NC)"

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
	@if lsof -ti:$(FRONTEND_PORT) > /dev/null 2>&1; then \
		kill $(shell lsof -ti:$(FRONTEND_PORT)) && echo "$(GREEN)  ✅ Frontend server stopped$(NC)"; \
	fi
	@if lsof -ti:$(BACKEND_DEV_PORT) > /dev/null 2>&1; then \
		kill $(shell lsof -ti:$(BACKEND_DEV_PORT)) && echo "$(GREEN)  ✅ Backend server stopped$(NC)"; \
	fi

# Advanced targets
dev-debug: ## Start dev servers with debug output
	@echo "$(YELLOW)🐛 Starting development servers in debug mode...$(NC)"
	@$(MAKE) dev VERBOSE=1

logs: ## Show recent logs (if using systemd for production)
	@echo "$(YELLOW)📜 Recent logs:$(NC)"
	@echo "$(BLUE)System logs for markdown-manager:$(NC)"
	-journalctl -u markdown-manager --lines=20 --no-pager

# Cleanup nginx references
cleanup-nginx: ## Remove obsolete nginx configuration
	@echo "$(YELLOW)🧹 Cleaning up obsolete nginx configuration...$(NC)"
	rm -f nginx/sites-available/localhost-dev
	@echo "$(GREEN)✅ Nginx cleanup complete$(NC)"

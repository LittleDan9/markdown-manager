#!/bin/bash

# Development script for Markdown Manager
# Usage: ./dev.sh [options]
# Options:
#   -n, --no-nginx          Use webpack dev server instead of nginx localhost
#   -i, --incremental       Use incremental builds (default)
#   --no-incremental        Disable incremental builds
#   -e, --env ENV           Environment (for compatibility, not used)
#   -h, --help              Show this help message
#
# Examples:
#   ./dev.sh                    # nginx localhost with incremental builds
#   ./dev.sh -n                 # webpack dev server
#   ./dev.sh -i                 # nginx localhost with incremental builds
#   ./dev.sh -n --no-incremental # webpack dev server, no incremental builds

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration - Parse arguments
USE_NGINX_LOCALHOST=true
INCREMENTAL_BUILD=true

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--env)
            # Environment argument (for compatibility, but not used in dev.sh)
            shift # past argument
            shift # past value
            ;;
        -n|--no-nginx)
            USE_NGINX_LOCALHOST=false
            shift # past argument
            ;;
        -i|--incremental)
            INCREMENTAL_BUILD=true
            shift # past argument
            ;;
        --no-incremental)
            INCREMENTAL_BUILD=false
            shift # past argument
            ;;
        false)
            # Legacy support: first arg as false means no nginx
            USE_NGINX_LOCALHOST=false
            shift # past argument
            ;;
        true)
            # Legacy support: first arg as true means use nginx
            USE_NGINX_LOCALHOST=true
            shift # past argument
            ;;
        -h|--help)
            echo "Development script for Markdown Manager"
            echo "Usage: ./dev.sh [options]"
            echo ""
            echo "Options:"
            echo "  -n, --no-nginx          Use webpack dev server instead of nginx localhost"
            echo "  -i, --incremental       Use incremental builds (default)"
            echo "  --no-incremental        Disable incremental builds"
            echo "  -e, --env ENV           Environment (for compatibility, not used)"
            echo "  -h, --help              Show this help message"
            echo ""
            echo "Examples:"
            echo "  ./dev.sh                    # nginx localhost with incremental builds"
            echo "  ./dev.sh -n                 # webpack dev server"
            echo "  ./dev.sh -i                 # nginx localhost with incremental builds"
            echo "  ./dev.sh -n --no-incremental # webpack dev server, no incremental builds"
            exit 0
            ;;
        *)
            echo "Unknown option $1"
            exit 1
            ;;
    esac
done

echo -e "${YELLOW}🚀 Starting Markdown Manager development environment...${NC}"

if [ "$USE_NGINX_LOCALHOST" = "true" ]; then
    echo -e "${BLUE}🌐 Using nginx localhost deployment${NC}"
else
    echo -e "${BLUE}🔧 Using webpack dev server${NC}"
fi

# Function to start backend
start_backend() {
    # Check if backend is already running on port 8000
    if netstat -tlnp 2>/dev/null | grep -q :8000; then
        echo -e "${BLUE}🔗 Backend already running on port 8000${NC}"
        if [ "$USE_NGINX_LOCALHOST" = "true" ]; then
            echo -e "${BLUE}ℹ️  Using existing backend service (nginx mode)${NC}"
            return
        else
            echo -e "${YELLOW}⚠️  Port 8000 in use. Please stop the existing backend or use a different port${NC}"
            return 1
        fi
    fi
    
    echo -e "${YELLOW}🐍 Starting FastAPI backend...${NC}"
    cd backend
    if [ ! -d ".venv" ]; then
        echo -e "${YELLOW}📦 Installing backend dependencies...${NC}"
        poetry install
    fi
    poetry run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
    BACKEND_PID=$!
    cd ..
    echo -e "${GREEN}✅ Backend started (PID: $BACKEND_PID)${NC}"
}

# Function to deploy to nginx localhost
deploy_to_nginx() {
    echo -e "${YELLOW}🌐 Deploying to nginx localhost...${NC}"
    
    # Deploy with incremental build if requested
    if [ "$INCREMENTAL_BUILD" = "true" ]; then
        ./deploy/deploy.sh dev false false true
    else
        ./deploy/deploy.sh dev
    fi
}

# Function to start frontend with webpack dev server
start_frontend_webpack() {
    echo -e "${YELLOW}🖥️  Starting frontend development server...${NC}"
    cd frontend
    if [ ! -d "node_modules" ]; then
        echo -e "${YELLOW}📦 Installing frontend dependencies...${NC}"
        npm install
    fi
    npm run serve &
    FRONTEND_PID=$!
    cd ..
    echo -e "${GREEN}✅ Frontend started (PID: $FRONTEND_PID)${NC}"
}

# Function to start frontend file watcher for nginx
start_frontend_watcher() {
    echo -e "${YELLOW}👀 Starting frontend file watcher...${NC}"
    cd frontend
    if [ ! -d "node_modules" ]; then
        echo -e "${YELLOW}📦 Installing frontend dependencies...${NC}"
        npm install
    fi
    
    # Start webpack in watch mode for automatic rebuilding
    npm run build:dev:incremental &
    WATCHER_PID=$!
    cd ..
    echo -e "${GREEN}✅ Frontend watcher started (PID: $WATCHER_PID)${NC}"
}

# Trap to cleanup on exit
cleanup() {
    echo -e "${YELLOW}🛑 Stopping development servers...${NC}"
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
    fi
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null || true
    fi
    if [ ! -z "$WATCHER_PID" ]; then
        kill $WATCHER_PID 2>/dev/null || true
    fi
    echo -e "${GREEN}✅ Development servers stopped${NC}"
}

trap cleanup EXIT

# Start backend first
start_backend

# Choose frontend deployment method
if [ "$USE_NGINX_LOCALHOST" = "true" ]; then
    # Deploy to nginx and start file watcher
    deploy_to_nginx
    start_frontend_watcher
    
    echo -e "${GREEN}🎉 Development environment ready!${NC}"
    echo -e "${BLUE}📱 Frontend URLs:${NC}"
    echo -e "${BLUE}   • http://localhost (local access)${NC}"
    echo -e "${BLUE}   • http://10.0.1.51 (network access)${NC}"
    echo -e "${BLUE}   • http://danbian (network access)${NC}"
    echo -e "${GREEN}🔗 Backend: http://localhost:8000${NC}"
    echo -e "${GREEN}📚 API Docs: http://localhost:8000/docs${NC}"
    echo -e "${BLUE}ℹ️  Dev Info: http://10.0.1.51/dev-info${NC}"
    echo -e "${YELLOW}🔄 File watcher active - changes will auto-rebuild${NC}"
else
    # Use webpack dev server
    start_frontend_webpack
    
    echo -e "${GREEN}🎉 Development environment ready!${NC}"
    echo -e "${GREEN}📱 Frontend: http://localhost:8080${NC}"
    echo -e "${GREEN}🔗 Backend: http://localhost:8000${NC}"
    echo -e "${GREEN}📚 API Docs: http://localhost:8000/docs${NC}"
fi

echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"

# Wait for user to stop
wait

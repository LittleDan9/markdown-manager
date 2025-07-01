#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🚀 Starting Markdown Manager development environment...${NC}"

# Function to start backend
start_backend() {
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

# Function to start frontend
start_frontend() {
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

# Trap to cleanup on exit
cleanup() {
    echo -e "${YELLOW}🛑 Stopping development servers...${NC}"
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
    fi
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null || true
    fi
    echo -e "${GREEN}✅ Development servers stopped${NC}"
}

trap cleanup EXIT

# Start both services
start_backend
start_frontend

echo -e "${GREEN}🎉 Development environment ready!${NC}"
echo -e "${GREEN}📱 Frontend: http://localhost:8080${NC}"
echo -e "${GREEN}🔗 Backend: http://localhost:8000${NC}"
echo -e "${GREEN}📚 API Docs: http://localhost:8000/docs${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"

# Wait for user to stop
wait

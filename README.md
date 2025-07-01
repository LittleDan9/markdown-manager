# Markdown Manager

A modern markdown editor with Mermaid diagram support, featuring a Vue.js frontend and FastAPI backend.

## 🏗️ Project Structure

```bash
markdown-manager/
├── frontend/          # Vue.js frontend application
├── backend/           # FastAPI backend application
├── nginx/             # Nginx configuration
├── deploy/            # Deployment scripts and configs
├── package.json       # Root package.json for convenience scripts
└── README.md          # This file
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Python 3.11+
- Poetry for Python dependency management

### Installation

```bash
# Install all dependencies
npm run install

# Or install individually:
npm run frontend:install
npm run backend:install
```

### Development

```bash
# Start frontend development server
npm run dev:frontend

# Start backend development server (in another terminal)
npm run dev:backend
```

### Production Deployment

```bash
# Full deployment (builds frontend, deploys backend, updates nginx)
npm run deploy

# Deploy only frontend (skip backend)
npm run deploy:frontend-only

# Deploy without rebuilding
npm run deploy:skip-build
```

## 📁 Component Details

### Frontend (`/frontend`)

- Vue.js application with markdown editor
- Mermaid diagram support
- Bootstrap Icons
- Monaco Editor for code editing

### Backend (`/backend`)

- FastAPI application
- Poetry for dependency management
- Health check endpoint at `/api/v1/health-check`
- Uvicorn ASGI server

### Nginx (`/nginx`)

- Reverse proxy configuration
- Static file serving for frontend
- API routing to backend
- SSL/TLS termination
- **Bot blocking and security features**:
  - User-Agent based bot blocking (200+ patterns)
  - Rate limiting per IP and endpoint type
  - Security headers (CSP, HSTS, etc.)
  - Path-based blocking for sensitive areas
  - Connection limiting per IP

### Deployment (`/deploy`)

- Automated deployment scripts
- Systemd service configuration
- Environment-specific configurations

## 🛡️ Security & Bot Blocking

This project includes comprehensive bot blocking and security measures:

### Features

- **Bot Detection**: Blocks 200+ known bot patterns including scrapers, crawlers, and security scanners
- **Rate Limiting**: Different limits for API, static assets, and general requests
- **Security Headers**: CSP, HSTS, X-Frame-Options, and more
- **Path Protection**: Blocks access to sensitive files and common attack vectors
- **Real-time Monitoring**: Dedicated logging and analysis tools

### Monitoring Bot Traffic

```bash
# Analyze bot activity (last 24 hours)
./scripts/bot-analysis.sh

# Monitor blocked requests in real-time
sudo tail -f /var/log/nginx/access.log | grep ' 444 '

# Test bot blocking configuration
./scripts/test-bot-blocking.sh
```

### Configuration

- Bot patterns: `nginx/conf.d/bot-blocking.conf`
- Rate limits: `nginx/conf.d/rate-limiting.conf`
- Security headers: `nginx/conf.d/security.conf`

For detailed information, see [BOT_BLOCKING_GUIDE.md](BOT_BLOCKING_GUIDE.md).

## 🔧 Configuration

### Backend Environment Variables

- `API_V1_STR`: API version prefix (default: "/api/v1")
- `PROJECT_NAME`: Project name for documentation
- `DEBUG`: Debug mode (default: False)
- `HOST`: Server host (default: "0.0.0.0")
- `PORT`: Server port (default: 8000)

## 📚 API Documentation

When running the backend, visit:

- API Docs: `http://localhost:8000/docs`
- Health Check: `http://localhost:8000/api/v1/health-check`

## 🛠️ Development Workflow

1. Make changes to frontend or backend
2. Test locally using development servers
3. Build and deploy using the deployment scripts
4. Monitor logs and service status

## 📦 Available Scripts

### Root Level

- `npm run install` - Install all dependencies
- `npm run build` - Build frontend
- `npm run deploy` - Full production deployment
- `npm run dev:frontend` - Start frontend dev server
- `npm run dev:backend` - Start backend dev server

### Frontend Specific

- `npm run frontend:install` - Install frontend dependencies
- `npm run frontend:build` - Build frontend for production
- `npm run frontend:dev` - Start frontend dev server

### Backend Specific

- `npm run backend:install` - Install backend dependencies
- `npm run backend:dev` - Start backend dev server
- `npm run backend:prod` - Start backend in production mode

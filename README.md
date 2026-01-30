# Markdown Manager

A sophisticated web-based markdown editor with advanced document management, real-time collaboration features, and professional-grade export capabilities. Built with modern microservices architecture for scalability and performance.

## 🚀 Features

### Core Editor

- **Monaco Editor Integration**: Professional code editing experience with syntax highlighting
- **Real-time Preview**: Live markdown rendering with Mermaid diagram support
- **Spell Check & Grammar**: Advanced writing assistance with custom dictionary support
- **Markdown Linting**: Automated style checking and formatting suggestions
- **Multi-document Management**: Tabbed interface with workspace sessions

### Diagram & Export Capabilities

- **Mermaid Diagrams**: Native support for flowcharts, sequence diagrams, and more
- **Advanced Export Service**: High-quality PDF, SVG, and PNG generation
- **Draw.io Integration**: Convert Mermaid diagrams to Draw.io format with quality assessment
- **Icon Libraries**: Extensive Azure, AWS, and custom icon integration

### Professional Features

- **Document Templates**: Smart snippets and reusable content blocks
- **Cross-document Search**: Semantic search across your entire workspace
- **Git Integration**: Version control with visual diff viewer

## 🏗️ Architecture

The application follows a modern microservices architecture with Nginx as the central reverse proxy:

```text
                            ┌─────────────────┐
                            │      Nginx      │ ← Entry Point
                            │ Reverse Proxy   │   (Port 80)
                            │                 │
                            └─────────┬───────┘
                                      │
        ┌─────────────────────────────┼─────────────────────────────┐
        │                             │                             │
        ▼                             ▼                             ▼
┌─────────────────┐          ┌─────────────────┐          ┌─────────────────┐
│   Frontend      │          │   Backend API   │          │  Export Service │
│   (React)       │          │   (FastAPI)     │          │   (Python)      │
│   Port: 3000    │          │   Port: 8000    │◄─────────┤   Port: 8001    │
│                 │          │                 │          │                 │
│ Routes:         │          │ Routes:         │          │ Routes:         │
│ / (all pages)   │          │ /api/*          │          │ /api/export/*   │
└─────────────────┘          └─────────┬───────┘          └─────────────────┘
                                       │
                                       ▼
                                       │
        ┌──────────────────────────────┼──────────────────────────────┐
        │                              │                              │
        ▼                              ▼                              ▼
┌─────────────────┐          ┌─────────────────┐          ┌─────────────────┐
│   PostgreSQL    │          │ Markdown Lint   │          │  Spell Check    │
│   Database      │          │ Service (Node)  │          │ Service (Node)  │
│   Port: 5432    │          │ Port: 8002      │          │ Port: 8003      │
└─────────────────┘          └─────────────────┘          └─────────────────┘

                             ┌─────────────────┐
                             │    Storage      │
                             │   (Filesystem)  │
                             │ /documents      │
                             └─────────────────┘
```

**Request Flow:**

1. **User** → `http://localhost` → **Nginx** (Port 80)
2. **Nginx** routes requests:
   - `/` → **Frontend** (Port 3000)
   - `/api/*` → **Backend API** (Port 8000)
   - `/api/export/*` → **Export Service** (Port 8001)
3. **Backend** connects to:
   - **PostgreSQL** (Port 5432) for data persistence
   - **Markdown Lint Service** (Port 8002) for style checking
   - **Spell Check Service** (Port 8003) for grammar checking
   - **Filesystem Storage** for document files

### Services Overview

- **Frontend**: Modern React application with Monaco editor integration
- **Backend API**: FastAPI-based REST API with PostgreSQL persistence
- **Export Service**: Specialized document and diagram conversion service
- **Markdown Lint Service**: Node.js service for markdown style checking
- **Spell Check Service**: Advanced grammar and spell checking service
- **Nginx**: Production-ready reverse proxy with SSL termination

## 🚦 Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for development)
- Python 3.11+ (for development)
- Make (for build automation)

### Development Setup

1. **Clone and Install**

   ```bash
   git clone <repository-url>
   cd markdown-manager
   make install
   ```

2. **Start Development Environment**

   ```bash
   make dev
   ```

   This starts both frontend (port 3000) and backend services.

3. **Check Status**

   ```bash
   make status
   ```

4. **Access the Application**
   - Frontend: <http://localhost> (via Nginx)
   - Backend API: <http://localhost/api/> (via Nginx)
   - API Documentation: <http://localhost/api/docs> (via Nginx)
   - Export Service: <http://localhost/api/export/> (via Nginx)

   *Direct service endpoints (for development debugging):*
   - Frontend: <http://localhost:3000>
   - Backend API: <http://localhost:8000>
   - Export Service: <http://localhost:8001>
   - Markdown Lint Service: <http://localhost:8002>
   - Spell Check Service: <http://localhost:8003>

### Production Deployment

The application uses a mature Ansible-based deployment system that ensures services are actually operational before marking deployment as successful.

```bash
# Deploy all services with health validation
make deploy-ansible

# Deploy individual services
make deploy-ansible-backend      # Backend API service
make deploy-ansible-export       # Export service  
make deploy-ansible-linting      # Linting service
make deploy-ansible-spell-check  # Spell check service

# Dry run (check what would be deployed)
make deploy-ansible-dry-run
```

**Key Features:**
- 🔍 **Health validation** - Services must pass health checks to be marked successful
- 🛠️ **Auto-installation** - Ansible automatically installed if needed
- 📊 **Proper error detection** - No more silent failures
- 🔄 **Rollback capabilities** - Mature deployment orchestration

For detailed deployment information, see [deployment documentation](deployment/).

## 📚 Documentation

- **[Development Guide](docs/development/)** - Local development setup and workflows
- **[Deployment Guide](docs/deployment/)** - Production deployment and configuration
- **[Export Service Guide](services/export/README.md)** - Document and diagram export capabilities
- **[Backend API](services/backend/README.md)** - FastAPI backend service documentation

## 🛠️ Development

### Available Commands

```bash
# Development
make dev              # Start frontend & backend dev servers
make dev-frontend     # Frontend only
make dev-backend      # Backend only

# Building & Testing
make build            # Build production assets
make test             # Run all tests
make test-backend     # Backend tests with coverage
make quality          # Run linting and quality checks

# Deployment (Production)
make deploy-ansible              # All services with health validation
make deploy-ansible-backend      # Backend service only
make deploy-ansible-export       # Export service only
make deploy-ansible-dry-run      # Check deployment without changes

# Utilities
make status           # Check development server status
make stop             # Stop all development servers
make clean            # Clean build artifacts
```

### Project Structure

```text
services/
├── backend/                 # FastAPI backend service
│   ├── app/                 # Application code
│   ├── migrations/          # Database migrations
│   └── tests/               # Backend tests
├── ui/                      # React frontend application
│   ├── src/                 # Source code
│   ├── public/              # Static assets
│   └── webpack.config.js    # Build configuration
├── export/                  # Document export microservice
├── linting/                 # Markdown linting service
├── spell-check/             # Spell checking service
├── event-consumer/          # Event consumer framework
└── event-publisher/         # Event publishing service

Infrastructure:
├── nginx/                   # Nginx configuration
├── scripts/                 # Build and utility scripts
├── deployment/              # Ansible deployment system
└── docs/                    # Documentation
```

## 🔧 Configuration

### Environment Variables

Key configuration options:

- `NODE_ENV`: Development/production mode
- `DATABASE_URL`: PostgreSQL connection string
- `ICON_SERVICE_URL`: Icon service endpoint
- `SPELL_CHECK_PORT`: Spell check service port

See individual service README files for complete configuration options.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and add tests
4. Run quality checks: `make quality`
5. Commit your changes: `git commit -m 'Add amazing feature'`
6. Push to the branch: `git push origin feature/amazing-feature`
7. Open a Pull Request

## 📄 License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Monaco Editor](https://microsoft.github.io/monaco-editor/) for the excellent code editing experience
- [Mermaid](https://mermaid-js.github.io/) for diagram rendering capabilities
- [FastAPI](https://fastapi.tiangolo.com/) for the high-performance backend framework
- [React](https://reactjs.org/) for the modern frontend framework

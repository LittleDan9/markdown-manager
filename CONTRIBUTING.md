# Contributing to Markdown Manager

## Prerequisites

- **Docker** and **Docker Compose** (required for all services)
- **Node.js 24+** (for frontend development)
- **Python 3.11+** with **Poetry** (for backend development)
- **Git**

## Getting Started

```bash
# Clone the repository
git clone <repo-url>
cd markdown-manager

# Install dependencies
make install

# Start all services
make dev

# Verify everything is running
make status
```

The app runs at `http://localhost/` via nginx reverse proxy.

## Development Workflow

### Running Services

```bash
make dev              # Start both frontend and backend
make dev-frontend     # Start frontend only (Docker)
make dev-backend      # Start backend only (Docker)
make stop             # Stop all services
make status           # Check service status
```

> **Important:** Always use Docker Compose for running services. Never run services directly with `npm start` or `uvicorn`.

### Running Tests

```bash
make test             # Run all tests (backend + frontend)
make test-backend     # Run backend tests with coverage
```

Backend tests use pytest with coverage. Coverage threshold is configured at 55% in `services/backend/pyproject.toml`.

Frontend tests use Jest. Run them directly:
```bash
cd services/ui && npm test
cd services/ui && npm run test:coverage
```

### Code Quality

```bash
make quality          # Run pre-commit hooks (linting, formatting)
```

- **Backend:** Ruff for linting/formatting (configured in `pyproject.toml`)
- **Frontend:** ESLint with React/hooks plugins (configured in `.eslintrc`)

## Project Structure

```
services/
  backend/        # FastAPI REST API (Python)
  ui/             # React SPA (JavaScript)
  embedding/      # Vector embedding service (Python)
  export/         # PDF/diagram export service (Python)
  linting/        # Markdown lint service (Node.js)
  spell-check/    # Spell check service (Node.js)
  event-consumer/ # Redis Streams consumer (Python)
  event-publisher/ # Outbox relay publisher (Python)
packages/
  events-core/    # Shared event schemas
```

See [docs/development/README.md](docs/development/README.md) for detailed architecture documentation.

## Making Changes

### Branch Naming

Use descriptive branch names:
- `feat/short-description` — New features
- `fix/short-description` — Bug fixes
- `chore/short-description` — Maintenance/cleanup

### Commit Messages

Follow conventional commits format:
```
type: short description

Optional longer description.
```

Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `style`, `perf`

### Pull Requests

1. Create a feature branch from `main`
2. Make your changes
3. Run `make test` to ensure tests pass
4. Run `make quality` for lint/format checks
5. Push and open a PR with a clear description

## Environment Configuration

- **Development:** Copy `.env.example` to `.env` and configure
- **Production:** See `deployment/production.env.template`
- **Documentation:** See [docs/deployment/environment.md](docs/deployment/environment.md) for variable reference

## Copilot Instructions

This project uses VS Code Copilot instruction files in `.github/instructions/` for AI-assisted development. These provide domain-specific context when editing files matching their `applyTo` patterns.

## Deployment

See [docs/deployment/README.md](docs/deployment/README.md) for production deployment documentation.

Available deploy commands:
```bash
make deploy           # Full deployment
make deploy-update    # Update existing deployment
make deploy-dry-run   # Preview deployment changes
make deploy-status    # Check remote status
```

# Markdown Manager API

FastAPI backend for the Markdown Manager application.

## Development Setup

1. Install Poetry if you haven't already:
   ```bash
   curl -sSL https://install.python-poetry.org | python3 -
   ```

2. Install dependencies:
   ```bash
   poetry install
   ```

3. Run the development server:
   ```bash
   poetry run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

## API Endpoints

- `GET /api/v1/health-check` - Health check endpoint

## Deployment

The API is deployed using uvicorn with systemd service management.

## Configuration

Configuration is handled through environment variables:
- `API_V1_STR`: API version prefix (default: "/api/v1")
- `PROJECT_NAME`: Project name for documentation
- `DEBUG`: Debug mode (default: False)

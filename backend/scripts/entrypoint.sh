#!/bin/bash
set -e

echo "Running database migrations..."
/markdown-manager/.venv/bin/alembic upgrade head

echo "Starting uvicorn server..."
exec /markdown-manager/.venv/bin/uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
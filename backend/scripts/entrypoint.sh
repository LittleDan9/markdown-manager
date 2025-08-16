#!/usr/bin/env bash
set -Eeuo pipefail

# If DATABASE_URL is provided, parse it for connection testing
# Otherwise fall back to individual DB_* variables
if [[ -n "${DATABASE_URL:-}" ]]; then
    echo "Using DATABASE_URL for database connection"
    # Parse DATABASE_URL to extract host and port for connectivity check
    # Example: postgresql+asyncpg://user:pass@host:port/dbname
    DB_HOST=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
    DB_PORT=$(echo "$DATABASE_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    
    # Fallback if parsing fails
    DB_HOST="${DB_HOST:-db}"
    DB_PORT="${DB_PORT:-5432}"
else
    echo "Using individual DB_* environment variables"
    DB_HOST="${DB_HOST:-db}"
    DB_PORT="${DB_PORT:-5432}"
    DB_NAME="${DB_NAME:-${POSTGRES_DB:-markdown_manager}}"
    DB_USER="${DB_USER:-${POSTGRES_USER:-postgres}}"
fi

ALEMBIC_BIN="${ALEMBIC_BIN:-/markdown-manager/.venv/bin/alembic}"
UVICORN_BIN="${UVICORN_BIN:-/markdown-manager/.venv/bin/uvicorn}"
APP_IMPORT="${APP_IMPORT:-app.main:app}"
PORT="${PORT:-8000}"
HOST="${HOST:-0.0.0.0}"

echo "Waiting for Postgres TCP at ${DB_HOST}:${DB_PORT} ..."
python - <<'PY'
import os, socket, time, sys
host = os.getenv("DB_HOST","db")
port = int(os.getenv("DB_PORT","5432"))

# If DATABASE_URL is set, try to parse host/port from it
database_url = os.getenv("DATABASE_URL")
if database_url:
    import re
    # Parse DATABASE_URL for host and port
    # Example: postgresql+asyncpg://user:pass@host:port/dbname
    match = re.search(r'@([^:]+):(\d+)/', database_url)
    if match:
        host = match.group(1)
        port = int(match.group(2))
        print(f"Parsed from DATABASE_URL: {host}:{port}")

print(f"Testing connection to {host}:{port}")
deadline = time.time() + 60
while True:
    try:
        with socket.create_connection((host, port), timeout=2):
            print(f"Successfully connected to {host}:{port}")
            break
    except OSError as e:
        if time.time() > deadline:
            print(f"Postgres not reachable at {host}:{port} after 60s. Error: {e}", file=sys.stderr)
            sys.exit(1)
        time.sleep(1)
PY

echo "Running database migrations (with retries)..."
for attempt in 1 2 3 4 5; do
  if "${ALEMBIC_BIN}" upgrade head; then
    echo "Migrations complete."; break
  fi
  delay=$(( 2 ** (attempt - 1) ))
  echo "Alembic failed (attempt ${attempt}); retrying in ${delay}s..."
  sleep "${delay}"
  if [[ "${attempt}" -eq 5 ]]; then
    echo "Alembic failed after ${attempt} attempts, exiting." >&2
    exit 1
  fi
done

echo "Starting uvicorn server..."
exec "${UVICORN_BIN}" "${APP_IMPORT}" --reload --host "${HOST}" --port "${PORT}"

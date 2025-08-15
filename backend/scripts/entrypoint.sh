#!/usr/bin/env bash
set -Eeuo pipefail

DB_HOST="${DB_HOST:-db}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-${POSTGRES_DB:-markdown_manager}}"
DB_USER="${DB_USER:-${POSTGRES_USER:-postgres}}"

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
deadline = time.time() + 60
while True:
    try:
        with socket.create_connection((host, port), timeout=2):
            break
    except OSError:
        if time.time() > deadline:
            print(f"Postgres not reachable at {host}:{port} after 60s", file=sys.stderr)
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

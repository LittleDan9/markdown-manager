#!/bin/sh
/markdown-manager/.venv/bin/alembic upgrade head
exec /markdown-manager/.venv/bin/uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
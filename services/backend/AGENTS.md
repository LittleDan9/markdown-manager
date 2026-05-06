# Backend — FastAPI + SQLAlchemy

## Stack

- **FastAPI** with **Uvicorn** ASGI server
- **SQLAlchemy** 2.0 async with **asyncpg** (PostgreSQL + pgvector)
- **Pydantic** v2 for request/response schemas
- **pydantic-settings** for configuration via environment variables
- **Alembic** for database migrations (auto-run on startup via Docker entrypoint)

## Application Setup

- Entry point: `app/app_factory.py` — `create_app()` factory with lifespan handler
- Config: `app/configs/settings.py` — `BaseSettings` reads env vars
- Database: `app/database.py` — async engine + session factory; `get_db()` dependency
- Auth: `app/core/auth.py` — `get_current_user` (JWT), `verify_cross_app_token`
- Migrations: `migrations/` — auto-run `alembic upgrade head` on container start

## Key Directories

- `routers/` — resource routers + `auth/`, `admin/`, `documents/`, `github/` sub-packages
- `models/` — SQLAlchemy 2.0 models
- `schemas/` — Pydantic v2 schemas
- `services/` — Business services (search, storage, collab, GitHub, icons, etc.)
- `crud/` — CRUD utilities
- `configs/` — app settings

## Cross-App Services

- `services/tm_client.py` — HTTP client to TM backend (AI providers)
- `services/event_consumer_backend.py` — Redis Streams consumer (`ai.provider.v1`, `ai.usage.v1`)
- `services/ai_usage_publisher.py` — Publishes daily usage stats every 5 minutes
- `services/usage_recorder.py` — Records per-request usage + daily rollup
- `routers/cross_app.py` — Endpoints exposed for TM (`/api/cross-app/*`)
- `routers/ai_provider_sync.py` — User-facing sync UI backend (`/api/ai-provider-sync/*`)
- `routers/ai_usage.py` — Usage aggregation API (`/api/ai-usage/*`)

## Alembic Migration Chain

Current HEAD: **`a7b8c9d0e1f2`** (55 migrations, hash-based IDs)

Convention: Alembic auto-generates hex-based revision IDs. Always set `down_revision` to the
current HEAD before creating a new migration. Verify with the chain validation script below.

### Recent Migrations (tail of chain)

| # | Revision | Description |
|---|----------|-------------|
| 50 | `e1f2a3b4c5d6` | Merge icon enrichment and org name |
| 51 | `ca131637e68b` | Add syntax theme settings |
| 52 | `f7a8b9c0d1e2` | Add summary and cached context to chat |
| 53 | `e5f6a7b8c9d0` | Add remote_ai_providers table (cross-app sync) |
| 54 | `f6a7b8c9d0e1` | Add chat_token_usage table |
| 55 | `a7b8c9d0e1f2` | Add ai_usage_daily + remote_ai_usage_daily tables |

### Validate Migration Chain

Run from `services/backend/migrations/versions/`:

```bash
python3 << 'SCRIPT'
import os, re
from collections import Counter

revs = {}
for f in sorted(os.listdir('.')):
    if not f.endswith('.py') or f.startswith('__'):
        continue
    content = open(f).read()
    m = re.search(r"^revision[:\s].*?=\s*['\"](\w+)['\"]", content, re.MULTILINE)
    if not m:
        continue
    rev = m.group(1)
    t = re.search(r"down_revision.*?=\s*\(\s*['\"](\w+)['\"].*?['\"](\w+)['\"]", content, re.DOTALL)
    if t:
        down = (t.group(1), t.group(2))
    else:
        d = re.search(r"down_revision.*?=\s*['\"](\w+)['\"]", content)
        down = d.group(1) if d else None
    revs[f] = (rev, down)

all_revs = {r for f, (r, d) in revs.items()}
all_downs = set()
for f, (rev, down) in revs.items():
    if isinstance(down, tuple):
        all_downs.update(down)
    elif down:
        all_downs.add(down)

heads = all_revs - all_downs
print(f"HEAD(s): {heads}")

rev_list = [r for f, (r, d) in revs.items()]
dupes = [r for r, c in Counter(rev_list).items() if c > 1]
if dupes:
    print(f"ERROR: Duplicate IDs: {dupes}")
else:
    print("OK: No duplicate revision IDs")

if len(heads) > 1:
    print("ERROR: Multiple heads detected — needs a merge migration")
SCRIPT
```

See `.github/instructions/` for detailed patterns per subsystem.

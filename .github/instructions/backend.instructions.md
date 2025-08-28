# AI Agent Backend Guidelines
applyTo: "backend/**/*"

---

# FastAPI + SQLAlchemy + Alembic + Poetry

When writing or reviewing backend code in this repository, AI agents must follow these rules:

1. **RESTful Endpoints**
   - Use intuitive resource-based routes (`GET /users/{id}`, `POST /users/{id}/activate`).
   - Match URL paths to HTTP verbs.

2. **Dependency Injection**
   - Share logic (DB sessions, auth, settings) via `Depends`.
   - Avoid duplicate boilerplate.

3. **Pydantic v2 Models**
   - Define request/response schemas with Pydantic.
   - Reuse base models via inheritance/generics.

4. **Repositories for Data Access**
   - Wrap SQLAlchemy queries in repository/service classes.
   - Keep ORM logic isolated for testing and flexibility.

5. **Alembic Migrations**
   - Use `alembic revision --autogenerate`.
   - Keep migrations small, review generated code, include downgrade logic.

6. **Async SQLAlchemy Sessions**
   - Use `async with` sessions.
   - Commit/rollback in finally, close cleanly.

7. **Configuration**
   - Store config in environment variables.
   - Load with a central Pydantic `Settings` class.

8. **Dependencies**
   - Use Poetry v2.3+ (`poetry add/remove`, never edit pyproject.toml).
   - Commit `poetry.lock` for reproducibility.

9. **Documentation**
   - Add docstrings, summaries, and titles for OpenAPI auto-docs.

10. **Testing**
    - Use pytest with fixtures + factories.
    - Mock external calls, ensure test isolation.

11. **Development**
    - Always run backend via Docker Compose (`docker-compose up -d backend`).
    - Python virtual environment is located on container at `/markdown-manager/.venv`
    - Never run raw `uvicorn` except for import testing.
    - Access backend through docker nginx instance at api.localhost:80
    - Uvicorn is set to watch files and hot reload, no need to restart container.

12. **Production DB Access**
    - Use SSH tunnels for connections (see `scripts/db-functions.sh`).
    - Use `make backup-db` and `make restore-db` for backups.

13. **API Endpoints**
    - New endpoints must be implemented at root (not `/api/...`).
    - Endpoints should never require a trailing `/`

14. **Debugging / Troubleshooting**
    - Run `docker compose ps` and `docker compose logs <service>`.
    - Frequent issues: port conflicts, crashes, CORS, DB connection failures.
    - Postgresql can be piped to cat `| cat` to avoid pagers.

15. **Best Practices**
    - Verify APIs with `curl` (include user agent).
    - Use hot reload for code changes.
    - Check browser console before escalating issues.

> AI Agents must enforce maintainability, readability, and DRY code while keeping APIs intuitive.

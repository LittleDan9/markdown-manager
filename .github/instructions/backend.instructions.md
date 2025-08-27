---
applyTo: 'backend/**/*'
---

# Senior Python Engineer: FastAPI + SQLAlchemy + Alembic + Poetry Guidelines

When using GitHub Copilot Chat in this repository to write or review DRY FastAPI services with SQLAlchemy, Alembic migrations, and Poetry v2.3+ for dependency management, always adhere to these principles:

1. **Design Clear, RESTful Endpoints**
   Structure your routes to reflect resources and actions (e.g., `GET /users/{id}`, `POST /users/{id}/activate`). Keep URL paths intuitive and consistent with HTTP methods.

2. **Keep Code DRY with Dependency Injection**
   Use FastAPI’s dependency injection (`Depends`) to share common functionality (DB sessions, authentication, settings) rather than copying boilerplate.

3. **Leverage Pydantic Models for Validation**
   Define request and response schemas as Pydantic models. Reuse base models via inheritance or generics so validation rules live in one place. All implementation should conform to Pydantic's v2 standards.

4. **Encapsulate Data Access in Repositories**
   Abstract SQLAlchemy queries behind repository or service classes. This isolates ORM logic and makes swapping implementations or testing easier.

5. **Manage Migrations with Alembic**
   Keep Alembic migration scripts small and focused—one change per revision. Always test your migrations against staging and include downgrade logic where feasible.

6. **Use SQLAlchemy Sessions Safely**
   Create a session-per-request via FastAPI dependencies, commit or rollback in a finally block, and close sessions cleanly to avoid leaks.

7. **Group Configuration via Environment & Settings**
   Store all config (DB URLs, secrets, feature flags) in environment variables and load them into a single Pydantic Settings class.

8. **Pin & Isolate Dependencies with Poetry**
   Use Poetry v2.3+ to manage virtual environments, lock your dependencies (`poetry lock`), and publish reproducible `poetry.lock` files. Never edit `pyproject.toml` manually—use `poetry add`/`remove`.

9. **Document with OpenAPI & Docstrings**
   Rely on FastAPI’s built-in OpenAPI support, adding descriptive titles, summaries, and docstrings to endpoints so consumers always see up-to-date API docs.

10. **Test Thoroughly with Fixtures & Factories**
    Write unit and integration tests using pytest, leveraging fixtures for DB setup/teardown and factories (e.g., Factory Boy) for test data. Mock external calls and ensure tests run in isolation.

11. **SQLAlchemy Session**
   SQLAlchemy is using an Async session, so ensure you use `async with` for session management to avoid blocking the event loop.

12. **Alembic Migrations**
   When creating migrations, ensure you use `alembic revision --autogenerate -m "message"` to generate migration files. Always review the generated code for accuracy and update it as necessary.

13. **Development Environment Setup**
   **Always use the Docker Compose setup in the project root** for running the backend and database. Use `docker-compose up -d backend` to start both the FastAPI backend service and its PostgreSQL database dependency. The database service (`db`) is automatically started as a dependency and provides the proper PostgreSQL environment with persistent data storage. Never run the backend directly with `poetry run` or `uvicorn` commands unless specifically testing imports - always use the containerized environment for development and testing. Use `poetry run` to execute python commands locally within the backend folder.

14. **Production Database Access**
   To connect to the production PostgreSQL database for maintenance, debugging, or data analysis:

   - **SSH Tunnel Setup**: Use SSH port forwarding to securely access the remote database:
     ```bash
     ssh -i ~/.ssh/id_danbian -L 15432:10.0.1.51:5432 dlittle@10.0.1.51
     ```

   - **Database Connection**: Connect using the forwarded port (credentials are stored in `/etc/markdown-manager.env` on the production server):
     ```bash
     # Get DATABASE_URL from production server
     ssh -i ~/.ssh/id_danbian dlittle@10.0.1.51 "sudo grep '^DATABASE_URL=' /etc/markdown-manager.env"

     # Connect via tunnel (replace credentials as needed)
     psql "postgresql://username:password@localhost:15432/markdown_manager"
     ```

   - **Using Database Scripts**: The `scripts/db-functions.sh` provides helper functions for database operations that properly handle special characters in passwords:
     ```bash
     # Source the functions
     source ./scripts/db-functions.sh

     # Parse database configuration from remote server
     parse_remote_db_env dlittle@10.0.1.51

     # Setup SSH tunnel
     setup_port_forward dlittle@10.0.1.51

     # Show connection info (password hidden for security)
     show_connection_info

     # Connect to database directly
     connect_to_db

     # Or capture connection URL for scripts (never run without capturing!)
     DB_URL=$(get_local_db_url)
     psql "$DB_URL"

     # Clean up when done
     cleanup_port_forward

     # Show all available functions
     show_db_usage
     ```

   - **Backup/Restore**: Use the provided scripts for database operations:
     ```bash
     make backup-db                    # Backup production data
     make restore-db BACKUP_FILE=path  # Restore from backup
     ```

   **Security Note**: Never commit database credentials to version control. Production credentials are stored securely in `/etc/markdown-manager.env` on the server and accessed via SSH with key-based authentication. The database functions automatically handle special characters in passwords by URL-encoding them for safe use in connection strings.

   ## ⚙️ Backend Development

### API Testing
```bash
curl -X POST http://localhost:8000/auth/register   -H "Content-Type: application/json"   -d '{"email": "test@example.com", "password": "test123"}'

curl -H "Authorization: Bearer <token>" http://localhost:8000/documents/
```

### Database
```bash
docker compose exec db psql -U postgres -d markdown_manager
docker compose exec backend alembic upgrade head
docker compose exec backend alembic history
```

---

## 📌 Common Tasks

- Backend env vars → `backend/.env`
- Code changes → Auto-reload for frontend/backend, restart needed for PDF service
- Debug flow:
  1. `docker compose ps`
  2. `docker compose logs <service>`
  3. Test endpoints
  4. Browser console check
  5. Verify DB connectivity
  6. Do not tail or follow logs

---

## 🧩 Troubleshooting

### Frequent Issues
1. Port conflicts (3000, 8000, 8001, 5432, 80)
2. Container crashes → check logs
3. DB connection failures → ensure healthy DB
4. Node version mismatches → check compatibility
5. CORS issues → bypass nginx
6. Use psql to query the database in development directly against the docker instance
7. Postgres will use a pager, so always pipe to cat.

### Resets
```bash
docker compose down -v   # full reset (removes data)
docker compose restart   # soft reset
```

---

## ✅ Best Practices for AI Agents & Contributors

1. Always run `docker compose ps` first
2. Use direct ports for debugging
3. Check logs immediately after issues
4. Use browser console test functions
5. Use `curl` for API verification  - Always include a valid user agent
6. Rely on hot reload for most code changes

---

> Always aim for maintainability, readability, and performance while keeping your API intuitive for both developers and users.

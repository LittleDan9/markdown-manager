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
   Define request and response schemas as Pydantic models. Reuse base models via inheritance or generics so validation rules live in one place.

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

> Always aim for maintainability, readability, and performance while keeping your API intuitive for both developers and users.

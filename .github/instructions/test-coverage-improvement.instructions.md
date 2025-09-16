---
applyTo: "**/*"
description: "Comprehensive instructions for AI agents to improve test coverage efficiently with focus on high-value quick wins"
---

# Test Coverage Improvement Instructions for AI Agents

## 🎯 **Current Status & Objectives**

**Baseline Coverage**: 31.50% (as of September 15, 2025)
**Target Coverage**: 55.0% (required threshold)
**Gap to Close**: +23.5%

**Current Test Status**: ✅ **100% unit tests passing** (89/89 tests)
**Infrastructure Status**: ✅ **Robust foundation established**

---

## 🏗️ **Test Infrastructure Overview**

### **Directory Structure**
```
backend/tests/
├── conftest.py                    # Global pytest configuration
├── fixtures/
│   ├── database.py               # Database session fixtures
│   ├── application.py            # FastAPI app fixtures
│   └── data.py                   # Test data factories
├── unit/
│   ├── services/                 # Service layer tests (✅ 100% passing)
│   └── test_schemas.py           # Pydantic schema tests (✅ 100% passing)
├── integration/                  # End-to-end workflow tests
└── e2e/                         # Full application tests
```

### **Test Execution Commands**
```bash
# Full unit test suite with coverage
cd backend && poetry run pytest tests/unit/ --cov=app --cov-report=html --cov-report=term

# Run specific test categories
poetry run pytest tests/unit/services/ -v                    # Service tests
poetry run pytest tests/unit/test_schemas.py -v              # Schema tests
poetry run pytest tests/integration/ -v                      # Integration tests

# Coverage-only run (faster for iteration)
poetry run pytest tests/unit/ --cov=app --cov-report=term --tb=no --quiet

# Debug specific failing test
poetry run pytest tests/unit/path/to/test.py::TestClass::test_method -v --tb=short

# Watch mode for development
poetry run pytest tests/unit/ --cov=app -f                   # Requires pytest-watch
```

### **Environment & Database Configuration**

**Key Environment Variables** (set in `conftest.py`):
```python
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"
os.environ["ALEMBIC_USE_SQLITE"] = "true"
os.environ["MARKDOWN_STORAGE_ROOT"] = "/tmp/pytest-storage"
os.environ["GITHUB_CLIENT_ID"] = "test_client_id"
os.environ["GITHUB_CLIENT_SECRET"] = "test_client_secret"
```

**Database Test Pattern**:
- **Unit Tests**: In-memory SQLite with sync sessions
- **Integration Tests**: In-memory SQLite with async sessions
- **E2E Tests**: PostgreSQL test database (Docker required)

### **Fixture Architecture**

**Core Fixtures** (auto-imported via `pytest_plugins`):
```python
# Database fixtures
@pytest.fixture
async def async_db_session() -> AsyncSession:
    """For integration tests requiring async DB operations."""

@pytest.fixture
def sync_db_session():
    """For unit tests with sync DB operations."""

# Application fixtures
@pytest.fixture
async def client():
    """Async HTTP client with dependency overrides."""

# Data fixtures
@pytest.fixture
def test_user_data() -> Dict[str, Any]:
    """Standard test user data factory."""

@pytest.fixture
def temp_storage() -> Path:
    """Temporary filesystem storage for service tests."""
```

---

## 🎯 **Five Strategic Directives for High-Impact Coverage Gains**

### **🚀 Directive 1: Core Exception & Error Handling Coverage**
**Impact**: 0% → 80% for critical error paths
**Effort**: Low
**Files**: `app/core/exceptions.py`, error handling in services

**Implementation Strategy**:
```python
# Example: tests/unit/core/test_exceptions.py
import pytest
from app.core.exceptions import DocumentNotFoundError, AuthenticationError

class TestExceptions:
    def test_document_not_found_error_creation(self):
        """Test DocumentNotFoundError with proper message and status."""
        error = DocumentNotFoundError("Document 123 not found")
        assert str(error) == "Document 123 not found"
        assert error.status_code == 404

    def test_authentication_error_with_details(self):
        """Test AuthenticationError with additional context."""
        error = AuthenticationError("Invalid token", details={"reason": "expired"})
        assert error.details["reason"] == "expired"
```

**Mocking Pattern for Error Scenarios**:
```python
@pytest.mark.asyncio
async def test_service_handles_database_error(mock_service):
    """Test service gracefully handles database errors."""
    with patch('app.database.get_session') as mock_session:
        mock_session.side_effect = DatabaseError("Connection failed")

        with pytest.raises(ServiceUnavailableError):
            await mock_service.perform_operation()
```

**Coverage Boost**: +8% total coverage (18 statements @ 100% vs 0%)

---

### **🔐 Directive 2: Authentication & Authorization Testing**
**Impact**: 17% → 60% for auth flows
**Effort**: Medium
**Files**: `app/routers/auth/`, `app/core/auth.py`

**Implementation Strategy**:

**Test Structure**:
```python
# tests/unit/routers/test_auth_endpoints.py
class TestAuthEndpoints:
    @pytest.mark.asyncio
    async def test_register_success(self, client, test_user_data):
        """Test successful user registration."""
        response = await client.post("/auth/register", json=test_user_data)
        assert response.status_code == 200
        assert "access_token" in response.json()

    @pytest.mark.asyncio
    async def test_register_duplicate_email(self, client, test_user_data):
        """Test registration with existing email fails."""
        # Create first user
        await client.post("/auth/register", json=test_user_data)

        # Attempt duplicate registration
        response = await client.post("/auth/register", json=test_user_data)
        assert response.status_code == 400
        assert "already exists" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_login_invalid_credentials(self, client):
        """Test login with invalid credentials."""
        response = await client.post("/auth/login", json={
            "email": "nonexistent@example.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
```

**Authentication Helper Fixture**:
```python
@pytest.fixture
async def authenticated_headers(client, test_user_data):
    """Create user and return authorization headers."""
    # Register user
    register_response = await client.post("/auth/register", json=test_user_data)
    token = register_response.json()["access_token"]

    return {"Authorization": f"Bearer {token}"}
```

**Key Test Areas**:
- Registration validation (email format, password strength)
- Login/logout flows
- Token generation and validation
- Protected endpoint access
- Password reset workflows

**Coverage Boost**: +12% total coverage (121 statements @ 60% vs 17%)

---

### **📄 Directive 3: Document CRUD Operations Testing**
**Impact**: 11% → 50% for core document functionality
**Effort**: Medium
**Files**: `app/crud/document.py`, `app/routers/documents/`

**Implementation Strategy**:

**Mock Dependencies Pattern**:
```python
# tests/unit/crud/test_document_crud.py
from unittest.mock import AsyncMock, patch, MagicMock

class TestDocumentCrud:
    @pytest.fixture
    def mock_db_session(self):
        """Mock database session for CRUD tests."""
        session = AsyncMock()
        session.execute = AsyncMock()
        session.commit = AsyncMock()
        session.refresh = AsyncMock()
        return session

    @pytest.fixture
    def mock_user_storage(self):
        """Mock user storage service for document operations."""
        storage = AsyncMock()
        storage.write_document = AsyncMock(return_value=True)
        storage.read_document = AsyncMock(return_value="# Test Content")
        storage.delete_document = AsyncMock(return_value=True)
        return storage

    @pytest.mark.asyncio
    async def test_create_document_success(self, mock_db_session, mock_user_storage):
        """Test successful document creation."""
        from app.crud.document import create_document

        with patch('app.crud.document.get_user_storage_service', return_value=mock_user_storage):
            document_data = {
                "name": "test.md",
                "category_id": 1,
                "folder_path": "/",
                "content": "# Test"
            }

            result = await create_document(
                db=mock_db_session,
                user_id=1,
                document_data=document_data
            )

            # Verify storage service called
            mock_user_storage.write_document.assert_called_once()

            # Verify database operations
            mock_db_session.execute.assert_called()
            mock_db_session.commit.assert_called_once()
```

**Router Testing Pattern**:
```python
# tests/unit/routers/test_document_endpoints.py
class TestDocumentEndpoints:
    @pytest.mark.asyncio
    async def test_create_document_endpoint(self, client, authenticated_headers):
        """Test document creation endpoint."""
        document_data = {
            "name": "new-document.md",
            "category_id": 1,
            "folder_path": "/projects",
            "content": "# New Document\nContent here"
        }

        response = await client.post(
            "/documents/",
            json=document_data,
            headers=authenticated_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "new-document.md"
        assert "id" in data

    @pytest.mark.asyncio
    async def test_get_document_not_found(self, client, authenticated_headers):
        """Test retrieving non-existent document."""
        response = await client.get(
            "/documents/99999",
            headers=authenticated_headers
        )

        assert response.status_code == 404
```

**Coverage Boost**: +15% total coverage (251 statements @ 50% vs 11%)

---

### **🔗 Directive 4: GitHub Integration Core Testing**
**Impact**: 8% → 40% for GitHub services
**Effort**: High (but strategic focus on high-value functions)
**Files**: `app/services/github/`, `app/routers/github/`

**Mock GitHub API Pattern**:
```python
# tests/unit/services/github/test_github_api.py
class TestGitHubAPI:
    @pytest.fixture
    def mock_github_client(self):
        """Mock GitHub API client."""
        client = AsyncMock()
        client.get_user = AsyncMock()
        client.get_repos = AsyncMock()
        client.get_file_content = AsyncMock()
        return client

    @pytest.mark.asyncio
    async def test_fetch_user_repositories(self, mock_github_client):
        """Test fetching user repositories from GitHub."""
        # Mock API response
        mock_github_client.get_repos.return_value = [
            {"name": "repo1", "full_name": "user/repo1", "clone_url": "..."},
            {"name": "repo2", "full_name": "user/repo2", "clone_url": "..."}
        ]

        from app.services.github.api import GitHubAPIService

        with patch('app.services.github.api.GitHubAPIService._get_client', return_value=mock_github_client):
            service = GitHubAPIService("fake_token")
            repos = await service.get_user_repositories()

            assert len(repos) == 2
            assert repos[0]["name"] == "repo1"
            mock_github_client.get_repos.assert_called_once()

    @pytest.mark.asyncio
    async def test_github_api_rate_limit_handling(self, mock_github_client):
        """Test handling of GitHub API rate limits."""
        from app.services.github.api import GitHubAPIError

        # Mock rate limit error
        mock_github_client.get_user.side_effect = GitHubAPIError("Rate limit exceeded")

        from app.services.github.api import GitHubAPIService

        with patch('app.services.github.api.GitHubAPIService._get_client', return_value=mock_github_client):
            service = GitHubAPIService("fake_token")

            with pytest.raises(GitHubAPIError, match="Rate limit exceeded"):
                await service.get_user_info()
```

**Focus Areas for Quick Wins**:
1. **GitHub API client mocking**: Test API response handling without real calls
2. **Repository cloning logic**: Mock git operations, test path handling
3. **Sync status tracking**: Test status updates and conflict resolution
4. **Authentication flow**: Test OAuth token handling

**Strategic Implementation**:
```python
# Test only the coordination logic, mock external dependencies
class TestGitHubFilesystem:
    @pytest.mark.asyncio
    async def test_clone_repository_success(self, temp_storage):
        """Test repository cloning with mocked git operations."""
        from app.services.github.filesystem import GitHubFilesystemService

        with patch('app.services.storage.git.operations.clone_repository') as mock_clone:
            mock_clone.return_value = True

            service = GitHubFilesystemService()
            result = await service.clone_repository_for_account(
                user_id=1,
                account_id=1,
                repo_name="test-repo",
                clone_url="https://github.com/user/test-repo.git"
            )

            assert result is True
            mock_clone.assert_called_once()
```

**Coverage Boost**: +10% total coverage (targeting high-impact functions)

---

### **📊 Directive 5: Router Endpoint Integration Testing**
**Impact**: 12-48% → 60% for API endpoints
**Effort**: Medium
**Files**: `app/routers/`, HTTP layer testing

**Comprehensive Endpoint Testing Strategy**:
```python
# tests/integration/test_api_endpoints.py
class TestAPIEndpoints:
    """Integration tests for main API endpoints."""

    @pytest.mark.asyncio
    async def test_categories_crud_workflow(self, client, authenticated_headers):
        """Test complete category CRUD workflow."""
        # Create category
        create_data = {"name": "Test Category"}
        create_response = await client.post(
            "/categories/",
            json=create_data,
            headers=authenticated_headers
        )
        assert create_response.status_code == 200
        category_id = create_response.json()["id"]

        # Read category
        get_response = await client.get(
            f"/categories/{category_id}",
            headers=authenticated_headers
        )
        assert get_response.status_code == 200
        assert get_response.json()["name"] == "Test Category"

        # Update category
        update_data = {"name": "Updated Category"}
        update_response = await client.put(
            f"/categories/{category_id}",
            json=update_data,
            headers=authenticated_headers
        )
        assert update_response.status_code == 200

        # Delete category
        delete_response = await client.delete(
            f"/categories/{category_id}",
            headers=authenticated_headers
        )
        assert delete_response.status_code == 200

    @pytest.mark.asyncio
    async def test_document_upload_and_retrieval(self, client, authenticated_headers):
        """Test document upload and retrieval workflow."""
        # Test file upload
        files = {"file": ("test.md", "# Test Content", "text/markdown")}
        response = await client.post(
            "/documents/upload",
            files=files,
            headers=authenticated_headers
        )
        assert response.status_code == 200

        document_id = response.json()["id"]

        # Test content retrieval
        content_response = await client.get(
            f"/documents/{document_id}/content",
            headers=authenticated_headers
        )
        assert content_response.status_code == 200
        assert "Test Content" in content_response.text
```

**Error Handling Test Pattern**:
```python
class TestErrorHandling:
    @pytest.mark.asyncio
    async def test_unauthorized_access(self, client):
        """Test endpoints require proper authentication."""
        response = await client.get("/documents/")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_forbidden_access_other_user_data(self, client):
        """Test users cannot access other users' data."""
        # Create two users with separate auth tokens
        # Test user A cannot access user B's documents
        pass

    @pytest.mark.asyncio
    async def test_validation_errors(self, client, authenticated_headers):
        """Test request validation error handling."""
        invalid_data = {"name": ""}  # Empty name should fail
        response = await client.post(
            "/categories/",
            json=invalid_data,
            headers=authenticated_headers
        )
        assert response.status_code == 422
        assert "validation error" in response.json()["detail"][0]["type"]
```

**Coverage Boost**: +8% total coverage (multiple router files improved)

---

## 🛠️ **Advanced Mocking Patterns & Best Practices**

### **Delegation-Aware Mocking (Proven Pattern)**
**Problem**: Services delegate to specialized modules; mocking service methods doesn't work.
**Solution**: Mock the actual implementation functions.

```python
# ❌ Wrong: Mocks the service facade
with patch.object(git_service, 'run_git_command') as mock_method:
    # This won't work - method delegates to another module

# ✅ Right: Mocks the actual implementation
with patch('app.services.storage.git.operations.run_git_command') as mock_impl:
    # This works - patches the actual function being called
```

**Service Architecture Understanding**:
```
GitService (coordination)
    └── delegates to app.services.storage.git.operations.run_git_command()

UserStorageService (coordination)
    ├── delegates to UserDirectoryService.get_user_directory()
    ├── delegates to UserDocumentService.write_document()
    └── delegates to GitService.commit_changes()
```

### **Database Mocking Strategies**

**For Unit Tests (Fast)**:
```python
@pytest.fixture
def mock_db_session():
    """Mock database session for unit tests."""
    session = AsyncMock()
    session.execute = AsyncMock()
    session.commit = AsyncMock()
    session.rollback = AsyncMock()

    # Mock query results
    mock_result = MagicMock()
    mock_result.scalar_one_or_none = AsyncMock(return_value=None)
    session.execute.return_value = mock_result

    return session
```

**For Integration Tests (Real DB)**:
```python
@pytest.fixture
async def real_db_session(async_db_session):
    """Use real database for integration tests."""
    # This fixture provides a real SQLite in-memory session
    # from fixtures/database.py
    return async_db_session
```

### **Filesystem Mocking for Storage Tests**

**Temp Storage Pattern** (from successful service tests):
```python
@pytest.fixture
def temp_storage():
    """Create isolated temporary filesystem for tests."""
    temp_dir = Path(tempfile.mkdtemp())

    # Override storage root environment variable
    original_root = os.environ.get('MARKDOWN_STORAGE_ROOT')
    os.environ['MARKDOWN_STORAGE_ROOT'] = str(temp_dir)

    yield temp_dir

    # Cleanup
    if original_root is not None:
        os.environ['MARKDOWN_STORAGE_ROOT'] = original_root
    else:
        os.environ.pop('MARKDOWN_STORAGE_ROOT', None)
    shutil.rmtree(temp_dir)
```

**Directory Service Mocking**:
```python
@pytest.fixture
def mock_directory_service(temp_storage):
    """Mock directory service to return temp storage paths."""
    with patch('app.services.storage.user.directory.get_user_directory') as mock_user_dir, \
         patch('app.services.storage.user.directory.get_local_directory') as mock_local_dir, \
         patch('app.services.storage.user.directory.get_github_directory') as mock_github_dir:

        mock_user_dir.return_value = temp_storage / "1"
        mock_local_dir.return_value = temp_storage / "1" / "local"
        mock_github_dir.return_value = temp_storage / "1" / "github"

        yield {
            'user_dir': mock_user_dir,
            'local_dir': mock_local_dir,
            'github_dir': mock_github_dir
        }
```

---

## 📋 **Implementation Checklist & Quality Gates**

### **Before Starting New Test Category**:
- [ ] Identify specific coverage gaps using `--cov-report=html`
- [ ] Check existing fixtures in `tests/fixtures/` for reusable components
- [ ] Understand service delegation patterns (review working unit tests)
- [ ] Set up proper mocking strategy (delegation-aware vs integration)

### **During Test Development**:
- [ ] Run tests frequently: `poetry run pytest path/to/test.py -v`
- [ ] Check coverage impact: `poetry run pytest tests/unit/ --cov=app --cov-report=term`
- [ ] Ensure isolation: tests should not depend on external services
- [ ] Follow naming convention: `test_[function]_[scenario]_[expected_result]`

### **Quality Gates**:
- [ ] All new tests pass consistently
- [ ] No test duplication (check existing test coverage)
- [ ] Mocks target correct implementation (not facades)
- [ ] Tests are isolated and can run in any order
- [ ] Coverage improvement measurable (aim for +5% per directive)

### **Success Metrics**:
- **Directive 1**: Core exceptions 0% → 80% (+2% total)
- **Directive 2**: Auth flows 17% → 60% (+5% total)
- **Directive 3**: Document CRUD 11% → 50% (+10% total)
- **Directive 4**: GitHub services 8% → 40% (+5% total)
- **Directive 5**: Router endpoints 12-48% → 60% (+5% total)

**Combined Target**: 31.5% → 55%+ total coverage

---

## 🚨 **Common Pitfalls & Solutions**

### **Pitfall 1: Mocking Service Facades Instead of Implementation**
```python
# ❌ This fails because GitService delegates
with patch.object(git_service, 'commit_changes'):
    pass

# ✅ This works because it patches actual implementation
with patch('app.services.storage.git.operations.commit_changes'):
    pass
```

### **Pitfall 2: Test Dependencies on External Services**
```python
# ❌ Test depends on real GitHub API
async def test_github_sync():
    result = await github_service.sync_repository("real-repo")

# ✅ Test uses mocked GitHub API
async def test_github_sync(mock_github_client):
    with patch('github_service.get_client', return_value=mock_github_client):
        result = await github_service.sync_repository("test-repo")
```

### **Pitfall 3: Inconsistent Temporary Storage**
```python
# ❌ Different paths in mocks vs service
mock_get_user_directory.return_value = "/tmp/user1"
# But service uses /tmp/pytest-storage/user1

# ✅ Consistent temp storage usage
mock_get_user_directory.return_value = temp_storage / "user1"
```

### **Pitfall 4: Testing Implementation Details**
```python
# ❌ Tests internal method calls
def test_document_creation_calls_correct_methods():
    service.create_document()
    assert service._internal_method.called

# ✅ Tests behavior and outcomes
def test_document_creation_returns_document_with_id():
    doc = service.create_document(data)
    assert doc.id is not None
    assert doc.name == data["name"]
```

---

## 🔄 **Coverage Monitoring & Iteration**

### **Continuous Coverage Tracking**:
```bash
# Generate coverage badge/report for monitoring
poetry run pytest tests/unit/ --cov=app --cov-report=html --cov-fail-under=55

# Coverage diff tracking (between iterations)
poetry run pytest tests/unit/ --cov=app --cov-report=term | grep "TOTAL"
```

### **Coverage Hotspots (Prioritize These)**:
1. **app/crud/document.py**: 251 statements @ 11% → biggest impact
2. **app/routers/documents/crud.py**: 139 statements @ 14% → high value
3. **app/routers/auth/login.py**: 121 statements @ 17% → auth critical
4. **app/services/github/filesystem.py**: 246 statements @ 8% → integration key

### **Iteration Strategy**:
1. **Week 1**: Directive 1 (Exceptions) + Directive 2 (Auth) → ~38% coverage
2. **Week 2**: Directive 3 (Document CRUD) → ~48% coverage
3. **Week 3**: Directive 4 (GitHub Integration) → ~53% coverage
4. **Week 4**: Directive 5 (Router Endpoints) → ~58% coverage ✅

---

## 📚 **References & Resources**

### **Existing Working Examples**:
- `tests/unit/services/test_git_service.py`: Delegation-aware mocking pattern
- `tests/unit/services/test_user_storage_service.py`: Temp storage integration
- `tests/fixtures/data.py`: Test data factory patterns
- `tests/conftest.py`: Global configuration and fixture setup

### **Key Documentation**:
- **pytest-asyncio**: Async test execution patterns
- **SQLAlchemy testing**: Database session management
- **FastAPI testing**: HTTP client and dependency overrides
- **unittest.mock**: Advanced mocking strategies

### **Coverage Analysis Tools**:
```bash
# HTML coverage report (detailed file-by-file view)
poetry run pytest tests/unit/ --cov=app --cov-report=html
open htmlcov/index.html

# Terminal coverage summary
poetry run pytest tests/unit/ --cov=app --cov-report=term-missing

# Coverage by specific module
poetry run pytest tests/unit/ --cov=app.routers --cov-report=term
```

---

🎯 **End Goal**: Achieve 55%+ test coverage through strategic, high-impact testing of core application functionality while maintaining 100% test pass rate and robust mocking infrastructure.

**Key Success Factor**: Focus on testing *behavior and outcomes* rather than implementation details, using the proven delegation-aware mocking patterns established in the service layer tests.
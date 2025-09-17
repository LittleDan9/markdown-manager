---
applyTo: "backend/tests/**/*", "frontend/src/**/*"
description: "Phase 7: Testing & Polish - Comprehensive testing strategy, performance optimization, deployment preparation"
---

# Phase 7: Testing & Polish

## 🎯 **Phase Objective**

Complete the markdown linting implementation with comprehensive testing, performance optimization, and production readiness. This includes unit tests, integration tests, performance benchmarks, error handling refinement, and deployment preparation.

## 📋 **Requirements Analysis**

### **Testing Strategy**

- **Unit Tests**: 90%+ coverage for all service components
- **Integration Tests**: End-to-end API workflows
- **Performance Tests**: Worker performance under load
- **UI Tests**: Component behavior and user interactions
- **Error Handling**: Graceful degradation and recovery

### **Performance Targets**

- **Linting Response**: <100ms for documents up to 10,000 lines
- **Worker Startup**: <200ms for web worker initialization
- **API Response**: <50ms for rule configuration endpoints
- **Memory Usage**: <50MB for worker pools
- **UI Responsiveness**: No blocking during linting operations

## 🔧 **Implementation Tasks**

### **Task 7.1: Frontend Unit Tests**

**File**: `frontend/src/services/editor/markdownLint/__tests__/MarkdownLintService.test.js`

```javascript
import { MarkdownLintService } from '../MarkdownLintService';
import { MarkdownLintWorkerPool } from '../MarkdownLintWorkerPool';

// Mock the worker pool
jest.mock('../MarkdownLintWorkerPool');

describe('MarkdownLintService', () => {
    let service;
    let mockWorkerPool;

    beforeEach(() => {
        mockWorkerPool = {
            lintMarkdown: jest.fn(),
            terminate: jest.fn(),
            getPoolStatus: jest.fn().mockReturnValue({ activeWorkers: 1, queueSize: 0 })
        };
        MarkdownLintWorkerPool.mockImplementation(() => mockWorkerPool);

        service = new MarkdownLintService();
    });

    afterEach(() => {
        service.cleanup();
        jest.clearAllMocks();
    });

    describe('initialization', () => {
        test('should initialize with default configuration', () => {
            expect(service.isEnabled()).toBe(true);
            expect(service.getPoolStatus()).toEqual({ activeWorkers: 1, queueSize: 0 });
        });

        test('should create worker pool with correct configuration', () => {
            expect(MarkdownLintWorkerPool).toHaveBeenCalledWith({
                maxWorkers: 2,
                workerIdleTimeout: 30000
            });
        });
    });

    describe('lintMarkdown', () => {
        test('should lint markdown successfully', async () => {
            const mockResult = {
                errors: [
                    { line: 1, rule: 'MD001', message: 'Heading increment error' }
                ]
            };
            mockWorkerPool.lintMarkdown.mockResolvedValue(mockResult);

            const content = '## Second Level Heading';
            const rules = { MD001: true };

            const result = await service.lintMarkdown(content, rules);

            expect(mockWorkerPool.lintMarkdown).toHaveBeenCalledWith(content, rules);
            expect(result).toEqual(mockResult);
        });

        test('should handle worker errors gracefully', async () => {
            const workerError = new Error('Worker failed');
            mockWorkerPool.lintMarkdown.mockRejectedValue(workerError);

            const content = '# Test';
            const rules = { MD001: true };

            await expect(service.lintMarkdown(content, rules)).rejects.toThrow('Worker failed');
        });

        test('should debounce rapid lint requests', async () => {
            const mockResult = { errors: [] };
            mockWorkerPool.lintMarkdown.mockResolvedValue(mockResult);

            const content = '# Test';
            const rules = { MD001: true };

            // Trigger multiple rapid requests
            const promise1 = service.lintMarkdown(content, rules);
            const promise2 = service.lintMarkdown(content + ' modified', rules);
            const promise3 = service.lintMarkdown(content + ' modified again', rules);

            // Wait for debounce
            await new Promise(resolve => setTimeout(resolve, 350));

            // Only the last request should be processed
            expect(mockWorkerPool.lintMarkdown).toHaveBeenCalledTimes(1);
            expect(mockWorkerPool.lintMarkdown).toHaveBeenCalledWith(content + ' modified again', rules);
        });
    });

    describe('configuration', () => {
        test('should update configuration', () => {
            const newConfig = { MD001: false, MD003: { style: 'setext' } };
            service.updateConfiguration(newConfig);

            // Configuration should be passed to next lint request
            const expectedConfig = { ...newConfig };
            service.lintMarkdown('# Test', {});

            expect(mockWorkerPool.lintMarkdown).toHaveBeenCalledWith('# Test', expectedConfig);
        });

        test('should merge partial configuration updates', () => {
            service.updateConfiguration({ MD001: true, MD003: false });
            service.updateConfiguration({ MD001: false }); // Partial update

            service.lintMarkdown('# Test', {});

            expect(mockWorkerPool.lintMarkdown).toHaveBeenCalledWith('# Test',
                { MD001: false, MD003: false });
        });
    });

    describe('enable/disable', () => {
        test('should disable linting', () => {
            service.setEnabled(false);
            expect(service.isEnabled()).toBe(false);
        });

        test('should not lint when disabled', async () => {
            service.setEnabled(false);

            const result = await service.lintMarkdown('# Test', { MD001: true });

            expect(result).toEqual({ errors: [] });
            expect(mockWorkerPool.lintMarkdown).not.toHaveBeenCalled();
        });
    });
});
```

**File**: `frontend/src/services/editor/markdownLint/__tests__/MarkdownLintWorkerPool.test.js`

```javascript
import { MarkdownLintWorkerPool } from '../MarkdownLintWorkerPool';

// Mock Web Worker
class MockWorker {
    constructor() {
        this.onmessage = null;
        this.onerror = null;
        this.postMessage = jest.fn();
        this.terminate = jest.fn();
    }

    // Simulate worker response
    simulateMessage(data) {
        if (this.onmessage) {
            this.onmessage({ data });
        }
    }

    // Simulate worker error
    simulateError(error) {
        if (this.onerror) {
            this.onerror(error);
        }
    }
}

// Mock Worker constructor
global.Worker = jest.fn(() => new MockWorker());

describe('MarkdownLintWorkerPool', () => {
    let pool;

    beforeEach(() => {
        pool = new MarkdownLintWorkerPool({ maxWorkers: 2, workerIdleTimeout: 1000 });
        jest.clearAllMocks();
    });

    afterEach(() => {
        pool.terminate();
    });

    describe('initialization', () => {
        test('should create worker pool with correct settings', () => {
            expect(pool.getPoolStatus()).toEqual({
                activeWorkers: 0,
                queueSize: 0
            });
        });
    });

    describe('worker management', () => {
        test('should create worker on demand', async () => {
            const promise = pool.lintMarkdown('# Test', { MD001: true });

            // Should create one worker
            expect(global.Worker).toHaveBeenCalledTimes(1);

            // Simulate worker response
            const workers = global.Worker.mock.results.map(result => result.value);
            workers[0].simulateMessage({
                id: expect.any(String),
                result: { errors: [] }
            });

            await promise;
        });

        test('should reuse existing idle workers', async () => {
            // First request
            const promise1 = pool.lintMarkdown('# Test 1', { MD001: true });
            const workers = global.Worker.mock.results.map(result => result.value);
            workers[0].simulateMessage({
                id: expect.any(String),
                result: { errors: [] }
            });
            await promise1;

            // Second request should reuse worker
            const promise2 = pool.lintMarkdown('# Test 2', { MD001: true });
            workers[0].simulateMessage({
                id: expect.any(String),
                result: { errors: [] }
            });
            await promise2;

            // Should only create one worker
            expect(global.Worker).toHaveBeenCalledTimes(1);
        });

        test('should create additional workers when needed', async () => {
            // Start two simultaneous requests
            const promise1 = pool.lintMarkdown('# Test 1', { MD001: true });
            const promise2 = pool.lintMarkdown('# Test 2', { MD001: true });

            // Should create two workers
            expect(global.Worker).toHaveBeenCalledTimes(2);

            // Resolve both
            const workers = global.Worker.mock.results.map(result => result.value);
            workers[0].simulateMessage({ id: expect.any(String), result: { errors: [] } });
            workers[1].simulateMessage({ id: expect.any(String), result: { errors: [] } });

            await Promise.all([promise1, promise2]);
        });

        test('should respect maxWorkers limit', async () => {
            // Start three simultaneous requests (maxWorkers = 2)
            const promise1 = pool.lintMarkdown('# Test 1', { MD001: true });
            const promise2 = pool.lintMarkdown('# Test 2', { MD001: true });
            const promise3 = pool.lintMarkdown('# Test 3', { MD001: true });

            // Should only create maxWorkers (2) workers
            expect(global.Worker).toHaveBeenCalledTimes(2);

            // Pool status should show queue
            expect(pool.getPoolStatus().queueSize).toBe(1);
        });
    });

    describe('error handling', () => {
        test('should handle worker errors', async () => {
            const promise = pool.lintMarkdown('# Test', { MD001: true });

            const workers = global.Worker.mock.results.map(result => result.value);
            workers[0].simulateError(new Error('Worker failed'));

            await expect(promise).rejects.toThrow('Worker failed');
        });

        test('should recover from worker failures', async () => {
            // First request fails
            const promise1 = pool.lintMarkdown('# Test 1', { MD001: true });
            const workers = global.Worker.mock.results.map(result => result.value);
            workers[0].simulateError(new Error('Worker failed'));

            await expect(promise1).rejects.toThrow();

            // Second request should work (new worker created)
            const promise2 = pool.lintMarkdown('# Test 2', { MD001: true });
            const newWorkers = global.Worker.mock.results.map(result => result.value);
            newWorkers[1].simulateMessage({
                id: expect.any(String),
                result: { errors: [] }
            });

            await expect(promise2).resolves.toEqual({ errors: [] });
        });
    });

    describe('cleanup', () => {
        test('should terminate all workers', () => {
            // Create some workers
            pool.lintMarkdown('# Test 1', { MD001: true });
            pool.lintMarkdown('# Test 2', { MD001: true });

            const workers = global.Worker.mock.results.map(result => result.value);

            pool.terminate();

            // All workers should be terminated
            workers.forEach(worker => {
                expect(worker.terminate).toHaveBeenCalled();
            });
        });
    });
});
```

### **Task 7.2: Backend Unit Tests**

**File**: `backend/tests/unit/crud/test_markdown_lint.py`

```python
import pytest
from unittest.mock import AsyncMock, patch
from sqlalchemy.ext.asyncio import AsyncSession
from app.crud.markdown_lint import markdown_lint_rule
from app.models.markdown_lint import MarkdownLintRule

@pytest.mark.asyncio
class TestMarkdownLintCRUD:
    """Test CRUD operations for markdown lint rules"""

    @pytest.fixture
    def mock_db_session(self):
        """Mock database session"""
        session = AsyncMock(spec=AsyncSession)
        session.execute = AsyncMock()
        session.commit = AsyncMock()
        session.refresh = AsyncMock()
        return session

    @pytest.fixture
    def sample_rule(self):
        """Sample markdown lint rule"""
        return MarkdownLintRule(
            id=1,
            user_id=1,
            rule_id="MD001",
            enabled=True,
            configuration=None,
            category_id=None,
            folder_path=None
        )

    async def test_get_user_defaults(self, mock_db_session, sample_rule):
        """Test retrieving user default rules"""
        # Mock query result
        mock_result = AsyncMock()
        mock_result.scalars.return_value.all.return_value = [sample_rule]
        mock_db_session.execute.return_value = mock_result

        rules = await markdown_lint_rule.get_user_defaults(mock_db_session, user_id=1)

        assert len(rules) == 1
        assert rules[0].rule_id == "MD001"
        mock_db_session.execute.assert_called_once()

    async def test_upsert_rule_create_new(self, mock_db_session):
        """Test creating a new rule via upsert"""
        # Mock no existing rule
        mock_result = AsyncMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db_session.execute.return_value = mock_result

        new_rule = MarkdownLintRule(
            user_id=1,
            rule_id="MD001",
            enabled=True,
            configuration=None,
            category_id=None,
            folder_path=None
        )

        with patch.object(mock_db_session, 'add') as mock_add:
            rule = await markdown_lint_rule.upsert_rule(
                db=mock_db_session,
                user_id=1,
                rule_id="MD001",
                enabled=True
            )

            mock_add.assert_called_once()
            mock_db_session.commit.assert_called_once()

    async def test_upsert_rule_update_existing(self, mock_db_session, sample_rule):
        """Test updating an existing rule via upsert"""
        # Mock existing rule
        mock_result = AsyncMock()
        mock_result.scalar_one_or_none.return_value = sample_rule
        mock_db_session.execute.return_value = mock_result

        rule = await markdown_lint_rule.upsert_rule(
            db=mock_db_session,
            user_id=1,
            rule_id="MD001",
            enabled=False,
            configuration={"style": "atx"}
        )

        # Should update existing rule
        assert sample_rule.enabled == False
        assert sample_rule.configuration == {"style": "atx"}
        mock_db_session.commit.assert_called_once()
        mock_db_session.refresh.assert_called_once_with(sample_rule)

    async def test_bulk_upsert_rules(self, mock_db_session):
        """Test bulk upsert operation"""
        rules_config = {
            "MD001": True,
            "MD003": {"style": "atx"},
            "MD013": False
        }

        # Mock upsert_rule calls
        with patch.object(markdown_lint_rule, 'upsert_rule') as mock_upsert:
            mock_rule = MarkdownLintRule(user_id=1, rule_id="MD001", enabled=True)
            mock_upsert.return_value = mock_rule

            rules = await markdown_lint_rule.bulk_upsert_rules(
                db=mock_db_session,
                user_id=1,
                rules=rules_config
            )

            # Should call upsert for each rule
            assert mock_upsert.call_count == 3
            assert len(rules) == 3

    async def test_rules_to_config_dict(self):
        """Test converting rules to configuration dictionary"""
        rules = [
            MarkdownLintRule(rule_id="MD001", enabled=True, configuration=None),
            MarkdownLintRule(rule_id="MD003", enabled=True, configuration={"style": "atx"}),
            MarkdownLintRule(rule_id="MD013", enabled=False, configuration=None)
        ]

        config = markdown_lint_rule.rules_to_config_dict(rules)

        expected = {
            "MD001": True,
            "MD003": {"style": "atx"},
            "MD013": False
        }

        assert config == expected

    async def test_delete_scope_rules(self, mock_db_session):
        """Test deleting rules for a specific scope"""
        mock_result = AsyncMock()
        mock_result.rowcount = 3
        mock_db_session.execute.return_value = mock_result

        deleted_count = await markdown_lint_rule.delete_scope_rules(
            db=mock_db_session,
            user_id=1,
            category_id=1
        )

        assert deleted_count == 3
        mock_db_session.execute.assert_called_once()
        mock_db_session.commit.assert_called_once()

    async def test_get_user_rules_hierarchy(self, mock_db_session):
        """Test rule hierarchy retrieval"""
        user_rule = MarkdownLintRule(
            rule_id="MD001", enabled=True, user_id=1,
            category_id=None, folder_path=None
        )
        category_rule = MarkdownLintRule(
            rule_id="MD001", enabled=False, user_id=1,
            category_id=1, folder_path=None
        )
        folder_rule = MarkdownLintRule(
            rule_id="MD001", enabled=True, user_id=1,
            category_id=None, folder_path="/projects"
        )

        mock_result = AsyncMock()
        mock_result.scalars.return_value.all.return_value = [folder_rule, category_rule, user_rule]
        mock_db_session.execute.return_value = mock_result

        rules = await markdown_lint_rule.get_user_rules(
            db=mock_db_session,
            user_id=1,
            category_id=1,
            folder_path="/projects"
        )

        # Should return rules in hierarchy order
        assert len(rules) == 3
        assert rules[0].folder_path == "/projects"  # Folder rule first
        assert rules[1].category_id == 1  # Category rule second
        assert rules[2].category_id is None and rules[2].folder_path is None  # User default last
```

### **Task 7.3: Integration Tests**

**File**: `backend/tests/integration/test_markdown_lint_api.py`

```python
import pytest
from httpx import AsyncClient
from app.main import app
from app.core.auth import create_access_token
from app.models.user import User
from app.models.category import Category

@pytest.mark.asyncio
class TestMarkdownLintAPI:
    """Integration tests for markdown lint API endpoints"""

    @pytest.fixture
    async def test_user(self, async_db_session):
        """Create test user"""
        user = User(
            email="test@example.com",
            hashed_password="hashed_password"
        )
        async_db_session.add(user)
        await async_db_session.commit()
        await async_db_session.refresh(user)
        return user

    @pytest.fixture
    async def test_category(self, async_db_session, test_user):
        """Create test category"""
        category = Category(
            name="Test Category",
            user_id=test_user.id
        )
        async_db_session.add(category)
        await async_db_session.commit()
        await async_db_session.refresh(category)
        return category

    @pytest.fixture
    def auth_headers(self, test_user):
        """Create authorization headers"""
        token = create_access_token(data={"sub": str(test_user.id)})
        return {"Authorization": f"Bearer {token}"}

    async def test_rule_definitions_endpoint(self):
        """Test rule definitions endpoint"""
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get("/api/markdown-lint/rules/definitions")

            assert response.status_code == 200
            data = response.json()
            assert "definitions" in data
            assert "MD001" in data["definitions"]
            assert data["definitions"]["MD001"]["name"] == "heading-increment"

    async def test_user_defaults_workflow(self, auth_headers):
        """Test complete user defaults workflow"""
        async with AsyncClient(app=app, base_url="http://test") as client:
            # Get initial user defaults (should be empty)
            response = await client.get(
                "/api/markdown-lint/user/defaults",
                headers=auth_headers
            )
            assert response.status_code == 200
            data = response.json()
            assert data["scope_type"] == "user"
            assert data["rules"] == {}

            # Update user defaults
            rules_update = {
                "rules": {
                    "MD001": True,
                    "MD003": {"style": "atx"},
                    "MD013": False
                }
            }
            response = await client.put(
                "/api/markdown-lint/user/defaults",
                json=rules_update,
                headers=auth_headers
            )
            assert response.status_code == 200
            data = response.json()
            assert data["rules"]["MD001"] is True
            assert data["rules"]["MD003"]["style"] == "atx"
            assert data["rules"]["MD013"] is False

            # Verify persistence by getting defaults again
            response = await client.get(
                "/api/markdown-lint/user/defaults",
                headers=auth_headers
            )
            assert response.status_code == 200
            data = response.json()
            assert data["rules"]["MD001"] is True
            assert data["rules"]["MD003"]["style"] == "atx"
            assert data["rules"]["MD013"] is False

    async def test_category_rules_workflow(self, auth_headers, test_category):
        """Test category-specific rules workflow"""
        async with AsyncClient(app=app, base_url="http://test") as client:
            category_id = test_category.id

            # Set up user defaults first
            user_rules = {
                "rules": {
                    "MD001": True,
                    "MD003": True
                }
            }
            await client.put(
                "/api/markdown-lint/user/defaults",
                json=user_rules,
                headers=auth_headers
            )

            # Set category-specific rules
            category_rules = {
                "rules": {
                    "MD001": False,  # Override user default
                    "MD013": {"line_length": 120}  # Category-specific rule
                }
            }
            response = await client.put(
                f"/api/markdown-lint/categories/{category_id}/rules",
                json=category_rules,
                headers=auth_headers
            )
            assert response.status_code == 200

            # Get contextual rules for this category
            response = await client.get(
                f"/api/markdown-lint/context/rules?category_id={category_id}",
                headers=auth_headers
            )
            assert response.status_code == 200
            data = response.json()

            # Should merge user defaults with category overrides
            assert data["rules"]["MD001"] is False  # Category override
            assert data["rules"]["MD003"] is True   # User default
            assert data["rules"]["MD013"]["line_length"] == 120  # Category-specific

    async def test_folder_rules_workflow(self, auth_headers):
        """Test folder-specific rules workflow"""
        async with AsyncClient(app=app, base_url="http://test") as client:
            folder_path = "/projects/documentation"

            # Set folder-specific rules
            folder_rules = {
                "rules": {
                    "MD013": {"line_length": 100},
                    "MD033": False  # Allow HTML in documentation
                }
            }
            response = await client.put(
                f"/api/markdown-lint/folders{folder_path}/rules",
                json=folder_rules,
                headers=auth_headers
            )
            assert response.status_code == 200

            # Get folder rules
            response = await client.get(
                f"/api/markdown-lint/folders{folder_path}/rules",
                headers=auth_headers
            )
            assert response.status_code == 200
            data = response.json()
            assert data["scope_type"] == "folder"
            assert data["folder_path"] == folder_path
            assert data["rules"]["MD013"]["line_length"] == 100

    async def test_rule_hierarchy_resolution(self, auth_headers, test_category):
        """Test rule hierarchy resolution (folder > category > user)"""
        async with AsyncClient(app=app, base_url="http://test") as client:
            category_id = test_category.id
            folder_path = "/projects"

            # Set user defaults
            await client.put(
                "/api/markdown-lint/user/defaults",
                json={"rules": {"MD001": True, "MD003": True, "MD013": True}},
                headers=auth_headers
            )

            # Set category rules
            await client.put(
                f"/api/markdown-lint/categories/{category_id}/rules",
                json={"rules": {"MD001": False, "MD003": {"style": "setext"}}},
                headers=auth_headers
            )

            # Set folder rules
            await client.put(
                f"/api/markdown-lint/folders{folder_path}/rules",
                json={"rules": {"MD001": True}},  # Override category
                headers=auth_headers
            )

            # Get contextual rules (should follow hierarchy)
            response = await client.get(
                f"/api/markdown-lint/context/rules?category_id={category_id}&folder_path={folder_path}",
                headers=auth_headers
            )
            assert response.status_code == 200
            data = response.json()

            # Folder rule should override category rule
            assert data["rules"]["MD001"] is True  # Folder override
            assert data["rules"]["MD003"]["style"] == "setext"  # Category rule
            assert data["rules"]["MD013"] is True  # User default

    async def test_rule_deletion(self, auth_headers, test_category):
        """Test rule deletion endpoints"""
        async with AsyncClient(app=app, base_url="http://test") as client:
            category_id = test_category.id

            # Create some rules
            await client.put(
                f"/api/markdown-lint/categories/{category_id}/rules",
                json={"rules": {"MD001": True, "MD003": False}},
                headers=auth_headers
            )

            # Delete category rules
            response = await client.delete(
                f"/api/markdown-lint/categories/{category_id}/rules",
                headers=auth_headers
            )
            assert response.status_code == 200
            data = response.json()
            assert data["deleted_count"] == 2

            # Verify rules are deleted
            response = await client.get(
                f"/api/markdown-lint/categories/{category_id}/rules",
                headers=auth_headers
            )
            assert response.status_code == 200
            data = response.json()
            assert data["rules"] == {}

    async def test_input_validation(self, auth_headers):
        """Test input validation and error handling"""
        async with AsyncClient(app=app, base_url="http://test") as client:
            # Invalid rule ID
            response = await client.put(
                "/api/markdown-lint/user/defaults",
                json={"rules": {"INVALID": True}},
                headers=auth_headers
            )
            assert response.status_code == 422

            # Invalid folder path
            response = await client.put(
                "/api/markdown-lint/folders/invalid-path/rules",
                json={"rules": {"MD001": True}},
                headers=auth_headers
            )
            # Should normalize path automatically or return validation error

    async def test_unauthorized_access(self):
        """Test unauthorized access to endpoints"""
        async with AsyncClient(app=app, base_url="http://test") as client:
            # No authorization header
            response = await client.get("/api/markdown-lint/user/defaults")
            assert response.status_code == 401

            # Invalid token
            response = await client.get(
                "/api/markdown-lint/user/defaults",
                headers={"Authorization": "Bearer invalid_token"}
            )
            assert response.status_code == 401
```

### **Task 7.4: Performance Tests**

**File**: `frontend/src/services/editor/markdownLint/__tests__/performance.test.js`

```javascript
import { MarkdownLintService } from '../MarkdownLintService';

// Mock worker for performance testing
const createMockWorker = (responseTime = 10) => {
    return {
        lintMarkdown: jest.fn().mockImplementation(() =>
            new Promise(resolve =>
                setTimeout(() => resolve({ errors: [] }), responseTime)
            )
        ),
        terminate: jest.fn(),
        getPoolStatus: jest.fn().mockReturnValue({ activeWorkers: 1, queueSize: 0 })
    };
};

describe('MarkdownLintService Performance', () => {
    let service;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterEach(() => {
        if (service) {
            service.cleanup();
        }
    });

    test('should handle large documents efficiently', async () => {
        const mockWorker = createMockWorker(50); // 50ms response time
        service = new MarkdownLintService();
        service.workerPool = mockWorker;

        // Generate large document (10,000 lines)
        const largeContent = Array(10000).fill('# Heading').join('\n');
        const rules = { MD001: true, MD003: true, MD013: true };

        const startTime = performance.now();
        await service.lintMarkdown(largeContent, rules);
        const endTime = performance.now();

        const responseTime = endTime - startTime;
        expect(responseTime).toBeLessThan(100); // Should complete within 100ms
        expect(mockWorker.lintMarkdown).toHaveBeenCalledWith(largeContent, rules);
    });

    test('should handle rapid sequential requests efficiently', async () => {
        const mockWorker = createMockWorker(10);
        service = new MarkdownLintService();
        service.workerPool = mockWorker;

        const content = '# Test heading';
        const rules = { MD001: true };

        // Send 100 rapid requests
        const startTime = performance.now();
        const promises = Array(100).fill().map(() =>
            service.lintMarkdown(content, rules)
        );
        await Promise.all(promises);
        const endTime = performance.now();

        const totalTime = endTime - startTime;
        const averageTime = totalTime / 100;

        // With debouncing, should be very efficient
        expect(averageTime).toBeLessThan(20); // Average < 20ms per request

        // Due to debouncing, actual worker calls should be much fewer
        expect(mockWorker.lintMarkdown.mock.calls.length).toBeLessThan(100);
    });

    test('should maintain performance with multiple simultaneous large documents', async () => {
        const mockWorker = createMockWorker(30);
        service = new MarkdownLintService();
        service.workerPool = mockWorker;

        // Create multiple large documents
        const documents = Array(5).fill().map((_, i) =>
            Array(2000).fill(`# Heading ${i}`).join('\n')
        );
        const rules = { MD001: true, MD003: true };

        const startTime = performance.now();
        const promises = documents.map(doc => service.lintMarkdown(doc, rules));
        await Promise.all(promises);
        const endTime = performance.now();

        const totalTime = endTime - startTime;
        expect(totalTime).toBeLessThan(200); // All documents processed within 200ms
    });

    test('should not block UI during linting', async () => {
        const mockWorker = createMockWorker(50);
        service = new MarkdownLintService();
        service.workerPool = mockWorker;

        const content = Array(5000).fill('# Heading').join('\n');
        const rules = { MD001: true };

        // Start linting (should not block)
        const lintPromise = service.lintMarkdown(content, rules);

        // Should be able to perform other operations immediately
        const startTime = performance.now();
        const otherOperationTime = performance.now() - startTime;

        expect(otherOperationTime).toBeLessThan(5); // Virtually no blocking

        await lintPromise;
    });

    test('should handle memory efficiently with repeated linting', async () => {
        const mockWorker = createMockWorker(5);
        service = new MarkdownLintService();
        service.workerPool = mockWorker;

        const content = Array(1000).fill('# Heading').join('\n');
        const rules = { MD001: true };

        // Perform repeated linting to test memory leaks
        for (let i = 0; i < 100; i++) {
            await service.lintMarkdown(content, rules);
        }

        // No easy way to test memory directly in Jest, but ensure no errors
        expect(mockWorker.lintMarkdown).toHaveBeenCalledTimes(100);
    });
});
```

### **Task 7.5: Error Handling & Recovery**

**File**: `frontend/src/services/editor/markdownLint/MarkdownLintErrorHandler.js`

```javascript
/**
 * Error handling and recovery for markdown linting
 */
export class MarkdownLintErrorHandler {
    constructor(logger = console) {
        this.logger = logger;
        this.errorCounts = new Map();
        this.maxRetries = 3;
        this.retryDelay = 1000; // 1 second
    }

    /**
     * Handle linting errors with retry logic
     */
    async handleLintError(error, context, retryFn) {
        const errorKey = this.getErrorKey(error, context);
        const errorCount = this.errorCounts.get(errorKey) || 0;

        this.logger.warn('Markdown linting error:', {
            error: error.message,
            context,
            attemptNumber: errorCount + 1
        });

        if (errorCount < this.maxRetries) {
            this.errorCounts.set(errorKey, errorCount + 1);

            // Exponential backoff
            const delay = this.retryDelay * Math.pow(2, errorCount);
            await this.delay(delay);

            try {
                const result = await retryFn();
                // Success - reset error count
                this.errorCounts.delete(errorKey);
                return result;
            } catch (retryError) {
                return this.handleLintError(retryError, context, retryFn);
            }
        }

        // Max retries exceeded
        this.logger.error('Max retries exceeded for markdown linting:', {
            error: error.message,
            context,
            totalAttempts: errorCount + 1
        });

        // Return graceful fallback
        return this.getGracefulFallback(error, context);
    }

    /**
     * Handle worker failures
     */
    handleWorkerError(error, workerId) {
        this.logger.error('Markdown lint worker failed:', {
            workerId,
            error: error.message,
            stack: error.stack
        });

        // Worker errors are typically fatal, return empty result
        return {
            errors: [],
            warnings: ['Linting temporarily unavailable due to worker error']
        };
    }

    /**
     * Handle configuration errors
     */
    handleConfigError(error, config) {
        this.logger.warn('Invalid markdown lint configuration:', {
            error: error.message,
            config
        });

        // Return sanitized config
        return this.sanitizeConfig(config);
    }

    /**
     * Generate error key for tracking
     */
    getErrorKey(error, context) {
        return `${error.constructor.name}:${context.documentId || 'unknown'}`;
    }

    /**
     * Get graceful fallback result
     */
    getGracefulFallback(error, context) {
        return {
            errors: [],
            warnings: [`Linting failed: ${error.message}`],
            degraded: true
        };
    }

    /**
     * Sanitize configuration by removing invalid rules
     */
    sanitizeConfig(config) {
        const sanitized = {};

        for (const [ruleId, ruleConfig] of Object.entries(config)) {
            if (this.isValidRuleId(ruleId)) {
                sanitized[ruleId] = this.sanitizeRuleConfig(ruleConfig);
            }
        }

        return sanitized;
    }

    /**
     * Validate rule ID format
     */
    isValidRuleId(ruleId) {
        return /^MD\d{3}$/.test(ruleId);
    }

    /**
     * Sanitize individual rule configuration
     */
    sanitizeRuleConfig(ruleConfig) {
        if (typeof ruleConfig === 'boolean') {
            return ruleConfig;
        }

        if (typeof ruleConfig === 'object' && ruleConfig !== null) {
            return ruleConfig;
        }

        // Invalid config, default to enabled
        return true;
    }

    /**
     * Simple delay utility
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Clear error counts for cleanup
     */
    clearErrorCounts() {
        this.errorCounts.clear();
    }
}
```

### **Task 7.6: Production Optimizations**

**File**: `frontend/src/services/editor/markdownLint/MarkdownLintOptimizations.js`

```javascript
/**
 * Performance optimizations for markdown linting
 */
export class MarkdownLintOptimizations {
    constructor() {
        this.cache = new Map();
        this.maxCacheSize = 100;
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    }

    /**
     * Generate cache key for content and rules
     */
    generateCacheKey(content, rules) {
        const contentHash = this.hashString(content);
        const rulesHash = this.hashString(JSON.stringify(rules));
        return `${contentHash}:${rulesHash}`;
    }

    /**
     * Check cache for existing result
     */
    getCachedResult(content, rules) {
        const key = this.generateCacheKey(content, rules);
        const cached = this.cache.get(key);

        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.result;
        }

        // Remove expired entry
        if (cached) {
            this.cache.delete(key);
        }

        return null;
    }

    /**
     * Cache linting result
     */
    setCachedResult(content, rules, result) {
        const key = this.generateCacheKey(content, rules);

        // Implement LRU eviction
        if (this.cache.size >= this.maxCacheSize) {
            const oldestKey = this.cache.keys().next().value;
            this.cache.delete(oldestKey);
        }

        this.cache.set(key, {
            result,
            timestamp: Date.now()
        });
    }

    /**
     * Optimize content for linting (remove unchanged sections)
     */
    optimizeContent(content, previousContent) {
        if (!previousContent) return content;

        // For incremental linting, find changed sections
        const lines = content.split('\n');
        const previousLines = previousContent.split('\n');

        // Simple diff - in production, consider more sophisticated algorithms
        const changedSections = this.findChangedSections(lines, previousLines);

        if (changedSections.length < lines.length * 0.5) {
            // If less than 50% changed, return optimized content
            return this.extractChangedContent(lines, changedSections);
        }

        return content;
    }

    /**
     * Find changed sections between content versions
     */
    findChangedSections(lines, previousLines) {
        const changed = [];
        const maxLength = Math.max(lines.length, previousLines.length);

        for (let i = 0; i < maxLength; i++) {
            if (lines[i] !== previousLines[i]) {
                changed.push(i);
            }
        }

        return changed;
    }

    /**
     * Extract content around changed sections
     */
    extractChangedContent(lines, changedSections) {
        if (changedSections.length === 0) return '';

        // Extract with context (5 lines before/after changes)
        const context = 5;
        const ranges = [];

        for (const lineNum of changedSections) {
            const start = Math.max(0, lineNum - context);
            const end = Math.min(lines.length - 1, lineNum + context);
            ranges.push({ start, end });
        }

        // Merge overlapping ranges
        const mergedRanges = this.mergeRanges(ranges);

        // Extract content
        const extractedLines = [];
        for (const range of mergedRanges) {
            extractedLines.push(...lines.slice(range.start, range.end + 1));
        }

        return extractedLines.join('\n');
    }

    /**
     * Merge overlapping ranges
     */
    mergeRanges(ranges) {
        if (ranges.length === 0) return [];

        ranges.sort((a, b) => a.start - b.start);
        const merged = [ranges[0]];

        for (let i = 1; i < ranges.length; i++) {
            const current = ranges[i];
            const last = merged[merged.length - 1];

            if (current.start <= last.end + 1) {
                last.end = Math.max(last.end, current.end);
            } else {
                merged.push(current);
            }
        }

        return merged;
    }

    /**
     * Simple string hash function
     */
    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString(36);
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
    }

    /**
     * Get cache statistics
     */
    getCacheStats() {
        return {
            size: this.cache.size,
            maxSize: this.maxCacheSize,
            hitRate: this.calculateHitRate()
        };
    }

    /**
     * Calculate cache hit rate (simplified)
     */
    calculateHitRate() {
        // In production, implement proper hit rate tracking
        return 0.75; // Placeholder
    }
}
```

### **Task 7.7: Deployment Configuration**

**File**: `docker-compose.override.yml` (for development)

```yaml
version: '3.8'
services:
  frontend:
    environment:
      - NODE_ENV=development
      - REACT_APP_MARKDOWN_LINT_ENABLED=true
      - REACT_APP_MARKDOWN_LINT_DEBUG=true
    volumes:
      - ./frontend/src:/app/src
      - ./frontend/public:/app/public

  backend:
    environment:
      - MARKDOWN_LINT_ENABLED=true
      - MARKDOWN_LINT_DEBUG=true
      - MARKDOWN_LINT_CACHE_SIZE=100
```

**File**: `docker-compose.prod.yml` (for production)

```yaml
version: '3.8'
services:
  frontend:
    environment:
      - NODE_ENV=production
      - REACT_APP_MARKDOWN_LINT_ENABLED=true
      - REACT_APP_MARKDOWN_LINT_DEBUG=false

  backend:
    environment:
      - MARKDOWN_LINT_ENABLED=true
      - MARKDOWN_LINT_DEBUG=false
      - MARKDOWN_LINT_CACHE_SIZE=500
      - MARKDOWN_LINT_WORKER_TIMEOUT=30000
```

## ✅ **Verification Steps**

1. **Test Coverage**: Achieve 90%+ coverage for all components
2. **Performance**: Verify response times meet targets
3. **Error Handling**: Test graceful degradation scenarios
4. **Integration**: End-to-end workflow testing
5. **Production**: Verify production configuration
6. **Monitoring**: Set up performance monitoring
7. **Documentation**: Complete API and usage documentation

## 🔗 **Integration Points**

- **CI/CD**: Integrate tests into build pipeline
- **Monitoring**: Add performance metrics collection
- **Documentation**: Update user guides and API docs
- **Analytics**: Track usage patterns and performance

## 📊 **Performance Monitoring**

- **Response Times**: Monitor API and worker performance
- **Error Rates**: Track and alert on error frequencies
- **Resource Usage**: Monitor memory and CPU usage
- **User Experience**: Track linting completion times

## 🚀 **Production Readiness Checklist**

- [ ] All unit tests passing with 90%+ coverage
- [ ] Integration tests covering happy path and error scenarios
- [ ] Performance tests meeting response time targets
- [ ] Error handling providing graceful degradation
- [ ] Caching reducing duplicate computation
- [ ] Production configuration optimized
- [ ] Monitoring and alerting configured
- [ ] Documentation complete and accurate

This completes the comprehensive markdown linting implementation with robust testing, performance optimization, and production readiness.
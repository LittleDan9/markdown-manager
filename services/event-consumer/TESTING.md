# Consumer Service Testing Framework

## Overview

The consumer service testing framework provides **base-level tests** that are executed with **service-specific configurations** to validate each consumer service implementation. This approach ensures consistent testing across all consumer services while allowing for service-specific validation.

## Architecture

### Base-Level Testing
- **Location**: `consumer-service-base/tests/`
- **Purpose**: Core test suite that validates consumer functionality
- **Reusability**: Same tests run for all consumer services
- **Coverage**: Configuration, event processing, Redis integration, database operations

### Service-Level Execution
- **Location**: Each service has a `run_tests.py` script
- **Purpose**: Execute base tests with service-specific configuration
- **Isolation**: Each service tests its own domain-specific handlers
- **Validation**: Confirms service-specific behavior works correctly

## Test Structure

```
consumer-service-base/
├── tests/
│   ├── conftest.py                    # Test fixtures and configuration
│   ├── test_config.py                 # Configuration and handler discovery tests
│   ├── test_event_processing.py       # Event processing and database tests
│   ├── test_redis_integration.py      # Redis stream consumption tests
│   └── docker_test_runner.py          # Docker-based integration tests
├── pyproject.toml                     # pytest configuration and dependencies
└── README.md

markdown-lint-service/
└── run_tests.py                       # Linting service test runner

spell-check-service/
└── run_tests.py                       # Spell-checking service test runner
```

## Test Categories

### 1. Unit Tests (`@pytest.mark.unit`)
- Configuration loading and validation
- Event handler discovery and mapping
- Domain-specific handler name generation
- Error handling for invalid configurations

### 2. Integration Tests (`@pytest.mark.integration`)
- Complete event processing workflows
- Database operations and projections
- Idempotency guarantees
- Transaction rollback on errors

### 3. Redis Tests (`@pytest.mark.redis`)
- Redis stream consumption
- Consumer group management
- Multi-topic consumption
- Message acknowledgment
- Connection error handling

### 4. Database Tests (`@pytest.mark.database`)
- Schema creation and management
- Event ledger operations
- Identity projection updates
- Data consistency validation

## Running Tests

### Local Development

#### Run All Tests for a Service
```bash
# Linting service
cd markdown-lint-service
python run_tests.py

# Spell-checking service
cd spell-check-service
python run_tests.py
```

#### Run Specific Test Categories
```bash
cd consumer-service-base

# Unit tests only
pytest tests/ -m unit

# Integration tests only
pytest tests/ -m integration

# Redis tests only
pytest tests/ -m redis

# Database tests only
pytest tests/ -m database
```

#### Run Tests for Specific Service Configuration
```bash
cd consumer-service-base

# Test with linting configuration
PYTEST_CURRENT_SERVICE=linting pytest tests/ -k linting

# Test with spell-checking configuration
PYTEST_CURRENT_SERVICE=spell_checking pytest tests/ -k spell_checking
```

### Docker Integration Tests

#### Run Individual Service Tests
```bash
cd consumer-service-base
python tests/docker_test_runner.py linting
python tests/docker_test_runner.py spell_checking
```

#### Run All Service Tests
```bash
cd consumer-service-base
python tests/docker_test_runner.py
```

## Test Configuration

### Service-Specific Fixtures

Each service can override test fixtures for customized testing:

```python
# In service-specific test files
@pytest.fixture
def service_config():
    """Override base config for this service."""
    return {
        "service": {
            "name": "my-service-consumer",
            "domain": "my_domain",
            "schema": "my_schema"
        },
        "redis": {"url": "redis://localhost:6379/15"},
        "consumer_group": "my_group",
        "topics": ["identity.user.v1"]
    }
```

### Multi-Service Testing

The framework supports parametrized testing across multiple service configurations:

```python
@pytest.fixture(params=["linting", "spell_checking"])
def multi_service_consumer(request, redis_client, database_manager):
    """Test with multiple service configurations."""
    # Automatically tests both services
```

## Test Data

### Event Fixtures

Standard event fixtures are provided for testing:

- `sample_user_created_event` - User creation event
- `sample_user_updated_event` - User update event
- `sample_user_disabled_event` - User disable event

### Database Fixtures

- `test_database` - In-memory SQLite database with schema-specific tables
- `database_manager` - Configured database manager instance
- `redis_client` - Redis client with test database and cleanup

## Coverage and Reporting

### Coverage Configuration
```toml
[tool.pytest.ini_options]
addopts = "--cov=app --cov-report=term-missing --cov-report=html"
```

### Service-Specific Coverage
```bash
# Linting service coverage
cd markdown-lint-service
python run_tests.py
# Report: consumer-service-base/coverage/linting/index.html

# Spell-checking service coverage
cd spell-check-service
python run_tests.py
# Report: consumer-service-base/coverage/spell_checking/index.html
```

## Continuous Integration

### GitHub Actions Integration
```yaml
name: Consumer Service Tests

on: [push, pull_request]

jobs:
  test-consumer-services:
    runs-on: ubuntu-latest

    strategy:
      matrix:
        service: [linting, spell_checking]

    steps:
      - uses: actions/checkout@v3

      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: |
          cd consumer-service-base
          pip install poetry
          poetry install

      - name: Start Redis
        uses: supercharge/redis-github-action@1.4.0

      - name: Run tests
        run: |
          cd consumer-service-base
          python tests/docker_test_runner.py ${{ matrix.service }}
```

## Adding New Consumer Services

### 1. Create Service Test Runner
```python
#!/usr/bin/env python3
"""Test runner for new-service consumer."""
import os
import sys
import subprocess
import json
from pathlib import Path

# Add consumer-service-base to Python path
BASE_DIR = Path(__file__).parent.parent / "consumer-service-base"
sys.path.insert(0, str(BASE_DIR))

def main():
    """Run tests for new-service consumer."""
    # Configure for your service
    config = {
        "service": {
            "name": "new-service-consumer",
            "domain": "new_domain",
            "schema": "new_schema"
        },
        "redis": {"url": "redis://localhost:6379/15"},
        "consumer_group": "new_group",
        "topics": ["identity.user.v1"]
    }

    # Run tests with service configuration
    # ... (similar to existing test runners)

if __name__ == "__main__":
    sys.exit(main())
```

### 2. Update Docker Test Runner
```python
# Add to docker_test_runner.py
async def run_new_service_tests() -> int:
    """Run tests for new service in Docker environment."""
    config = {
        "service": {
            "name": "new-service-consumer",
            "domain": "new_domain",
            "schema": "new_schema"
        },
        # ... rest of config
    }

    env = DockerTestEnvironment("new_service", config)

    try:
        await env.start()
        return await env.run_tests()
    finally:
        await env.stop()
```

### 3. Add Service-Specific Test Methods
Ensure your consumer service implements the required handler methods:
- `handle_{domain}_user_created`
- `handle_{domain}_user_updated`
- `handle_{domain}_user_disabled`

## Benefits

### ✅ Consistent Testing
- Same test suite validates all consumer services
- Consistent test patterns and coverage
- Reduced test code duplication

### ✅ Service Isolation
- Each service tests with its own configuration
- Domain-specific handler validation
- Independent test execution

### ✅ Comprehensive Coverage
- Unit tests for configuration and discovery
- Integration tests for complete workflows
- Redis and database integration validation
- Error handling and edge cases

### ✅ Easy Maintenance
- Single location for core test logic
- Service-specific runners are lightweight
- Easy to add new consumer services

### ✅ CI/CD Integration
- Docker-based test environments
- Parallel service testing
- Comprehensive reporting and coverage

This testing framework ensures that all consumer services are thoroughly validated while maintaining consistency and reducing maintenance overhead.
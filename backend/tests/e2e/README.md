# Production E2E Tests

This directory contains comprehensive end-to-end tests for the Markdown Manager production API. These tests validate the complete user workflow including authentication, CRUD operations, and specialized services.

## Overview

The E2E test suite:
- ✅ **Registers test users** automatically
- ✅ **Authenticates** and obtains bearer tokens
- ✅ **Tests complete workflows** (documents, categories, dictionary)
- ✅ **Validates performance** and response times
- ✅ **Tests specialized services** (PDF generation, syntax highlighting)
- ✅ **Cleans up test data** automatically
- ✅ **Runs against production** safely

## Quick Start

### Run All Tests

```bash
cd backend
python tests/e2e/run_e2e_tests.py
# or using poetry
poetry run python tests/e2e/run_e2e_tests.py
```

### Run Specific Test Categories

```bash
# Document operations only
cd backend && python tests/e2e/run_e2e_tests.py --test TestProductionDocuments

# Authentication workflow only
cd backend && python tests/e2e/run_e2e_tests.py --test TestProductionAuthentication

# Performance tests only
cd backend && python tests/e2e/run_e2e_tests.py --test TestProductionPerformance
```

### Run with Custom Environment

```bash
# Test against staging
cd backend && E2E_BASE_URL=https://staging-api.example.com python tests/e2e/run_e2e_tests.py

# Disable cleanup for debugging
cd backend && E2E_CLEANUP=false python tests/e2e/run_e2e_tests.py --verbose
```

## Test Structure

```
tests/e2e/
├── conftest.py                     # E2E test configuration and fixtures
├── run_e2e_tests.py               # Test runner script
├── test_production.py             # Core production tests
├── test_specialized_services.py   # PDF and syntax highlighting tests
└── utils/
    ├── production_client.py        # HTTP client utilities
    └── data_generators.py         # Test data generation
```

## Test Categories

### 1. Authentication Tests (`TestProductionAuthentication`)
- User registration workflow
- Login and token generation
- Duplicate registration handling
- Invalid credential handling

### 2. Document Tests (`TestProductionDocuments`)
- Complete CRUD operations
- Multiple document creation
- Large document handling
- Unicode and special characters
- Performance validation

### 3. Category Tests (`TestProductionCategories`)
- Category CRUD operations
- Document-category associations
- Category management workflow

### 4. Dictionary Tests (`TestProductionDictionary`)
- Dictionary entry CRUD
- Definition management
- Search and filtering

### 5. Specialized Services (`TestProductionPDFService`, `TestProductionSyntaxHighlighting`)
- PDF generation from markdown
- Syntax highlighting for multiple languages
- Error handling and edge cases
- Performance testing

### 6. Performance Tests (`TestProductionPerformance`)
- Concurrent request handling
- Response time validation
- Load testing scenarios
- Error handling validation

### 7. Security Tests (`TestProductionSecurity`)
- Authentication requirement validation
- CORS header verification
- Access control testing

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `E2E_BASE_URL` | `https://api.littledan.com` | API base URL |
| `E2E_FRONTEND_ORIGIN` | `https://littledan.com` | Frontend origin for CORS |
| `E2E_TIMEOUT` | `30` | Request timeout (seconds) |
| `E2E_CLEANUP` | `true` | Enable automatic cleanup |

### Test Configuration

The tests automatically:
1. Generate unique test user credentials
2. Register test users via API
3. Authenticate and obtain bearer tokens
4. Create test data with unique identifiers
5. Run comprehensive validation tests
6. Clean up all test data (if enabled)

## Safety Features

### Automatic Cleanup
- All test data includes unique identifiers
- Test users are automatically deleted after testing
- Documents, categories, and dictionary entries are cleaned up
- Cleanup can be disabled for debugging (`E2E_CLEANUP=false`)

### Production Safety
- Uses standard API endpoints (no special test endpoints)
- Test data is clearly marked with `e2e-test` prefixes
- Unique UUIDs prevent conflicts with real data
- Comprehensive error handling prevents data corruption

### Isolation
- Each test creates fresh test data
- No shared state between tests
- Database transactions ensure atomicity
- Test failures don't affect other tests

## Performance Expectations

The tests validate that the production API meets these performance criteria:

- **Average Response Time**: < 1.0 seconds
- **Maximum Response Time**: < 3.0 seconds
- **PDF Generation**: < 10 seconds
- **Syntax Highlighting**: < 5.0 seconds
- **Concurrent Requests**: Successfully handle 5+ concurrent operations

## Error Handling

The test suite validates proper error responses:
- **404** for non-existent resources
- **401** for unauthenticated requests
- **400/422** for invalid data
- **Rate limiting** responses when applicable

## Running Individual Tests

### Using pytest directly
```bash
cd backend

# Run all E2E tests
pytest tests/e2e/ -v -m e2e

# Run specific test file
pytest tests/e2e/test_production.py -v

# Run specific test method
pytest tests/e2e/test_production.py::TestProductionDocuments::test_document_crud_workflow -v

# Run with detailed output
pytest tests/e2e/ -v -s --tb=long
```

### Using the test runner
```bash
# Equivalent pytest commands through the runner
python tests/e2e/run_e2e_tests.py --test "document_crud"
python tests/e2e/run_e2e_tests.py --verbose
```

## Debugging Failed Tests

### Enable Verbose Output
```bash
python tests/e2e/run_e2e_tests.py --verbose
```

### Disable Cleanup
```bash
E2E_CLEANUP=false python tests/e2e/run_e2e_tests.py
```

### Check API Connectivity
```bash
curl -H "User-Agent: Mozilla/5.0" https://api.littledan.com/health
```

### View Test Reports
```bash
# Generate detailed JSON report
python tests/e2e/run_e2e_tests.py --report detailed_report.json
```

## Integration with CI/CD

### Example GitHub Actions
```yaml
name: E2E Production Tests
on:
  schedule:
    - cron: '0 */6 * * *'  # Every 6 hours
  workflow_dispatch:

jobs:
  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      - name: Install dependencies
        run: |
          cd backend
          pip install -r requirements.txt
      - name: Run E2E Tests
        run: |
          cd backend
          python tests/e2e/run_e2e_tests.py --report e2e_report.json
      - name: Upload Report
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: e2e-test-report
          path: backend/e2e_report.json
```

## Extending the Test Suite

### Adding New Test Classes
1. Create test file in `tests/e2e/`
2. Import fixtures from `conftest.py`
3. Use `@pytest.mark.e2e` and `@pytest.mark.asyncio`
4. Follow existing patterns for data generation and cleanup

### Adding New Fixtures
Add to `tests/e2e/conftest.py`:
```python
@pytest.fixture
def my_test_data():
    return generate_my_test_data()
```

### Adding New Utilities
Add to `tests/e2e/utils/`:
- `production_client.py` for HTTP utilities
- `data_generators.py` for test data generation

## Best Practices

1. **Use Unique Identifiers**: All test data should include UUIDs
2. **Clean Up**: Always clean up test data in fixtures/teardown
3. **Validate Schemas**: Use validation functions for response schemas
4. **Test Performance**: Include timing assertions for critical operations
5. **Handle Errors**: Test both success and failure scenarios
6. **Be Specific**: Use descriptive test names and assertions

## Troubleshooting

### Common Issues

**Connection Timeout**
- Check API URL in `E2E_BASE_URL`
- Verify API server is running
- Check network connectivity

**Authentication Failures**
- Verify registration endpoint is working
- Check if user already exists (cleanup failed)
- Validate API authentication flow

**Test Data Conflicts**
- Ensure `E2E_CLEANUP=true`
- Check for leftover test data from previous runs
- Verify unique ID generation

**Performance Test Failures**
- API may be under heavy load
- Adjust timeout values if needed
- Check server resource usage

### Getting Help

- Check test output logs for detailed error messages
- Run with `--verbose` for full stack traces
- Use `E2E_CLEANUP=false` to inspect test data
- Verify API health endpoint is responding

#!/bin/bash

# Test runner script for Draw.io export service
# Phase 3 implementation - comprehensive testing

echo "🧪 Draw.io Export Service - Test Suite Runner"
echo "============================================="

# Set environment variables for testing
export TESTING=true
export ICON_SERVICE_URL=http://localhost:8000
export DRAWIO_VERSION=24.7.5
export DRAWIO_QUALITY_THRESHOLD=60.0

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Setting up test environment...${NC}"

# Check if Poetry is available
if ! command -v poetry &> /dev/null; then
    echo -e "${RED}❌ Poetry not found. Please install Poetry first.${NC}"
    exit 1
fi

# Install dependencies
echo -e "${BLUE}📦 Installing test dependencies...${NC}"
poetry install --with dev

echo -e "${BLUE}🏃 Running test suite...${NC}"
echo

# Run different test categories
echo -e "${YELLOW}📋 Test Categories:${NC}"
echo "  • Unit Tests: Core service functionality"
echo "  • Integration Tests: API endpoints and workflows"
echo "  • Performance Tests: Load and timing validation"
echo "  • Edge Cases: Error handling and boundary conditions"
echo

# Run unit tests first
echo -e "${BLUE}🔬 Running Unit Tests...${NC}"
poetry run pytest tests/test_mermaid_drawio_service.py tests/test_drawio_quality_service.py -v -m unit --cov=app/services --cov-report=term-missing

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Unit tests failed${NC}"
    exit 1
fi

echo
echo -e "${BLUE}🔗 Running Integration Tests...${NC}"
poetry run pytest tests/test_drawio_router.py -v -m integration --cov=app/routers --cov-report=term-missing

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Integration tests failed${NC}"
    exit 1
fi

echo
echo -e "${BLUE}⚡ Running Performance Tests...${NC}"
poetry run pytest tests/test_performance_and_edge_cases.py -v -m performance --cov-append

if [ $? -ne 0 ]; then
    echo -e "${YELLOW}⚠️  Some performance tests failed (this may be acceptable)${NC}"
fi

echo
echo -e "${BLUE}🎯 Running Edge Case Tests...${NC}"
poetry run pytest tests/test_performance_and_edge_cases.py -v -m "not performance" --cov-append

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Edge case tests failed${NC}"
    exit 1
fi

echo
echo -e "${BLUE}📊 Running Full Test Suite with Coverage...${NC}"
poetry run pytest tests/ --cov=app --cov-report=html --cov-report=term-missing --cov-fail-under=80

TEST_RESULT=$?

echo
echo -e "${BLUE}📈 Test Results Summary${NC}"
echo "======================="

if [ $TEST_RESULT -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed successfully!${NC}"
    echo -e "${GREEN}✅ Coverage targets met${NC}"

    # Display test metrics
    echo
    echo -e "${BLUE}📋 Test Metrics:${NC}"
    echo "  • Unit Tests: $(poetry run pytest tests/test_mermaid_drawio_service.py tests/test_drawio_quality_service.py --collect-only -q | grep -c 'test')"
    echo "  • Integration Tests: $(poetry run pytest tests/test_drawio_router.py --collect-only -q | grep -c 'test')"
    echo "  • Performance Tests: $(poetry run pytest tests/test_performance_and_edge_cases.py -m performance --collect-only -q | grep -c 'test')"
    echo "  • Edge Case Tests: $(poetry run pytest tests/test_performance_and_edge_cases.py -m 'not performance' --collect-only -q | grep -c 'test')"

    echo
    echo -e "${GREEN}🎉 Phase 3 Testing Implementation: COMPLETE${NC}"
    echo -e "${GREEN}📁 Coverage report available at: htmlcov/index.html${NC}"

else
    echo -e "${RED}❌ Some tests failed or coverage targets not met${NC}"
    echo -e "${YELLOW}📁 Check coverage report at: htmlcov/index.html${NC}"
    echo -e "${YELLOW}📄 Review test output above for details${NC}"
fi

echo
echo -e "${BLUE}💡 Next Steps:${NC}"
echo "  • Review coverage report for any gaps"
echo "  • Add additional tests for uncovered code paths"
echo "  • Consider adding integration tests with real icon service"
echo "  • Run performance tests on production-like environment"

exit $TEST_RESULT
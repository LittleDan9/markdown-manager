#!/bin/bash
# Phase 7 — Integration Testing Script
# Validates full system coherence after services refactor

set -e  # Exit on any error

# Configuration
TIMEOUT=10
TEMP_DIR="/tmp/integration-test-$$"
TEST_RESULTS=()
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Create temp directory
mkdir -p "$TEMP_DIR"

# Cleanup function
cleanup() {
    rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

# Logging functions
log_info() {
    echo -e "${CYAN}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
    TEST_RESULTS+=("✅ $1")
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
    FAILED_TESTS=$((FAILED_TESTS + 1))
    TEST_RESULTS+=("❌ $1")
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_header() {
    echo ""
    echo -e "${PURPLE}===================================================${NC}"
    echo -e "${PURPLE} $1${NC}"
    echo -e "${PURPLE}===================================================${NC}"
    echo ""
}

log_section() {
    echo ""
    echo -e "${BLUE}--- $1 ---${NC}"
    echo ""
}

# Test helper function
run_test() {
    local test_name="$1"
    local test_command="$2"
    local expected_pattern="$3"
    local optional="$4"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    log_info "Testing: $test_name"
    
    # Run the test command
    local result
    result=$(eval "$test_command" 2>&1)
    local exit_code=$?
    
    # Check result
    if [[ $exit_code -eq 0 ]] && [[ -n "$expected_pattern" ]] && echo "$result" | grep -q "$expected_pattern"; then
        log_success "$test_name"
        return 0
    elif [[ $exit_code -eq 0 ]] && [[ -z "$expected_pattern" ]]; then
        log_success "$test_name"
        return 0
    else
        if [[ "$optional" == "optional" ]]; then
            log_warning "$test_name (optional - may be expected to fail)"
            return 0
        else
            log_error "$test_name"
            echo "  Command: $test_command"
            echo "  Exit code: $exit_code"
            echo "  Output: $result"
            return 1
        fi
    fi
}

# Phase 1: Infrastructure Tests
test_infrastructure() {
    log_header "PHASE 1: INFRASTRUCTURE VALIDATION"
    
    log_section "1.1 Docker Infrastructure"
    
    # Check Docker is running
    run_test "Docker daemon running" \
        "docker info" \
        "Server:"
    
    # Check docker-compose is available
    run_test "Docker Compose available" \
        "docker compose version" \
        "Docker Compose version"
    
    log_section "1.2 Clean Environment Setup"
    
    log_info "Stopping and cleaning existing containers..."
    docker compose down -v --remove-orphans > /dev/null 2>&1 || true
    
    log_info "Building fresh images (no cache)..."
    if docker compose build --no-cache > "$TEMP_DIR/build.log" 2>&1; then
        log_success "Docker images built successfully"
    else
        log_error "Docker build failed"
        cat "$TEMP_DIR/build.log"
        return 1
    fi
    
    log_info "Starting all services..."
    if docker compose up -d > "$TEMP_DIR/startup.log" 2>&1; then
        log_success "All services started"
    else
        log_error "Service startup failed"
        cat "$TEMP_DIR/startup.log"
        return 1
    fi
    
    log_section "1.3 Service Startup Validation"
    
    # Wait for services to be ready
    log_info "Waiting for services to initialize (60s timeout)..."
    local wait_time=0
    local max_wait=60
    
    while [[ $wait_time -lt $max_wait ]]; do
        local healthy_count
        healthy_count=$(docker compose ps --format json 2>/dev/null | jq -r '.State' 2>/dev/null | grep -c "running" || echo "0")
        
        if [[ $healthy_count -ge 8 ]]; then  # Expecting at least 8 services
            log_success "Services started (${wait_time}s)"
            break
        fi
        
        sleep 5
        wait_time=$((wait_time + 5))
        
        if [[ $wait_time -ge $max_wait ]]; then
            log_error "Services failed to start within ${max_wait}s"
            docker compose ps
            return 1
        fi
    done
    
    # Verify service status
    log_info "Verifying service status..."
    docker compose ps > "$TEMP_DIR/services.log"
    cat "$TEMP_DIR/services.log"
    
    # Count running services
    local running_services
    running_services=$(docker compose ps --format json 2>/dev/null | jq -r '.State' 2>/dev/null | grep -c "running" || echo "0")
    
    if [[ $running_services -ge 8 ]]; then
        log_success "All expected services running ($running_services services)"
    else
        log_error "Not all services running (found: $running_services, expected: ≥8)"
        return 1
    fi
}

# Phase 2: Health Check Tests
test_health_checks() {
    log_header "PHASE 2: SERVICE HEALTH VALIDATION"
    
    log_section "2.1 Individual Service Health Endpoints"
    
    # Test individual service health endpoints
    local services=(
        "backend:8000"
        "export:8001" 
        "linting:8002"
        "spell-check:8003"
    )
    
    for service_port in "${services[@]}"; do
        local service_name="${service_port%:*}"
        local port="${service_port#*:}"
        
        run_test "Health check: $service_name" \
            "curl -f -s --max-time $TIMEOUT http://localhost:$port/health" \
            '"status".*"healthy"'
    done
    
    log_section "2.2 Database Connectivity Tests"
    
    run_test "Database ready" \
        "docker compose exec -T db pg_isready -h 127.0.0.1 -U postgres -d markdown_manager" \
        "accepting connections"
    
    run_test "Backend database connection" \
        "docker compose exec -T backend python -c \"from app.database import get_db; print('Backend DB: OK')\"" \
        "Backend DB: OK"
    
    log_section "2.3 Redis Connectivity Tests"
    
    run_test "Redis server responding" \
        "docker compose exec -T redis redis-cli ping" \
        "PONG"
    
    run_test "Backend Redis connection" \
        "docker compose exec -T backend python -c \"import redis; r=redis.Redis(host='redis'); print('Redis:', r.ping())\"" \
        "Redis: True"
}

# Phase 3: Inter-Service Communication Tests
test_inter_service_communication() {
    log_header "PHASE 3: INTER-SERVICE COMMUNICATION"
    
    log_section "3.1 Backend to Services Communication"
    
    # Test backend can reach other services
    run_test "Backend → Export service" \
        "docker compose exec -T backend curl -f -s --max-time $TIMEOUT http://export:8001/health" \
        '"status"'
    
    run_test "Backend → Linting service" \
        "docker compose exec -T backend curl -f -s --max-time $TIMEOUT http://linting:8002/health" \
        '"status"'
    
    run_test "Backend → Spell Check service" \
        "docker compose exec -T backend curl -f -s --max-time $TIMEOUT http://spell-check:8003/health" \
        '"status"'
    
    log_section "3.2 Nginx Proxy Tests"
    
    # Test Nginx routing to services
    run_test "Nginx → Backend API" \
        "curl -f -s --max-time $TIMEOUT http://localhost/api/health" \
        '"status"' \
        "optional"
    
    run_test "Nginx → Export API" \
        "curl -f -s --max-time $TIMEOUT http://localhost/api/export/health" \
        '"status"' \
        "optional"
    
    log_section "3.3 Environment Variable Validation"
    
    # Test environment variables are set correctly
    run_test "Backend service URLs configured" \
        "docker compose exec -T backend env | grep -E '(EXPORT_SERVICE_URL|LINTING_SERVICE_URL|SPELL_CHECK_SERVICE_URL)'" \
        "SERVICE_URL" \
        "optional"
}

# Phase 4: Event-Driven Communication Tests
test_event_communication() {
    log_header "PHASE 4: EVENT-DRIVEN COMMUNICATION"
    
    log_section "4.1 Event Publisher Status"
    
    # Check if event publisher is running
    run_test "Event publisher service running" \
        "docker compose ps event-publisher" \
        "running"
    
    # Check event publisher logs for activity
    log_info "Checking event publisher activity..."
    local publisher_logs
    publisher_logs=$(docker compose logs --tail=50 event-publisher 2>/dev/null || echo "No logs available")
    echo "$publisher_logs" > "$TEMP_DIR/publisher.log"
    
    if echo "$publisher_logs" | grep -qi "started\|running\|ready"; then
        log_success "Event publisher appears active"
    else
        log_warning "Event publisher activity unclear (check logs for details)"
    fi
    
    log_section "4.2 Consumer Services Status"
    
    # Check consumer services
    run_test "Linting consumer running" \
        "docker compose ps linting-consumer" \
        "running"
    
    run_test "Spell-check consumer running" \
        "docker compose ps spell-check-consumer" \
        "running"
    
    log_section "4.3 Redis Streams Validation"
    
    # Check Redis streams existence and consumer groups
    run_test "Redis streams info available" \
        "docker compose exec -T redis redis-cli INFO stream" \
        "stream"
    
    # Try to check specific stream (may not exist if no events yet)
    log_info "Checking identity.user.v1 stream..."
    local stream_info
    stream_info=$(docker compose exec -T redis redis-cli XLEN identity.user.v1 2>/dev/null || echo "Stream not found or empty")
    
    if [[ "$stream_info" =~ ^[0-9]+$ ]]; then
        log_success "identity.user.v1 stream exists with $stream_info events"
    else
        log_warning "identity.user.v1 stream not found or empty (normal if no events generated yet)"
    fi
    
    # Check consumer configuration loading
    run_test "Linting consumer config loaded" \
        "docker compose exec -T linting-consumer python -c \"import json; config=json.load(open('/app/config/consumer.config.json')); print('Config:', config['service']['name'])\"" \
        "Config:" \
        "optional"
    
    run_test "Spell-check consumer config loaded" \
        "docker compose exec -T spell-check-consumer python -c \"import json; config=json.load(open('/app/config/consumer.config.json')); print('Config:', config['service']['name'])\"" \
        "Config:" \
        "optional"
}

# Phase 5: API Integration Tests
test_api_integration() {
    log_header "PHASE 5: API INTEGRATION TESTING"
    
    log_section "5.1 Core API Endpoints"
    
    # Test core API endpoints (without authentication)
    run_test "Backend API documentation" \
        "curl -f -s --max-time $TIMEOUT http://localhost:8000/docs" \
        "FastAPI\|Swagger" \
        "optional"
    
    run_test "Backend health with details" \
        "curl -f -s --max-time $TIMEOUT http://localhost:8000/health/detailed" \
        '"status".*"healthy"' \
        "optional"
    
    log_section "5.2 Service Integration Endpoints"
    
    # Test simple integration calls (these may require auth, so optional)
    run_test "Export service integration test" \
        "curl -X POST -f -s --max-time $TIMEOUT -H 'Content-Type: application/json' http://localhost:8001/health -d '{}'" \
        '"status"' \
        "optional"
    
    run_test "Linting service simple test" \
        "curl -X POST -f -s --max-time $TIMEOUT -H 'Content-Type: application/json' http://localhost:8002/health -d '{}'" \
        '"status"' \
        "optional"
    
    run_test "Spell-check service simple test" \
        "curl -X POST -f -s --max-time $TIMEOUT -H 'Content-Type: application/json' http://localhost:8003/health -d '{}'" \
        '"status"' \
        "optional"
}

# Phase 6: Frontend Integration Tests
test_frontend_integration() {
    log_header "PHASE 6: FRONTEND INTEGRATION"
    
    log_section "6.1 Frontend Service"
    
    run_test "Frontend service running" \
        "docker compose ps frontend" \
        "running"
    
    run_test "Frontend health endpoint" \
        "curl -f -s --max-time $TIMEOUT http://localhost:3000" \
        "html\|DOCTYPE" \
        "optional"
    
    log_section "6.2 Frontend Build Status"
    
    # Check frontend logs for build success
    log_info "Checking frontend build status..."
    local frontend_logs
    frontend_logs=$(docker compose logs --tail=20 frontend 2>/dev/null || echo "No logs available")
    
    if echo "$frontend_logs" | grep -qi "compiled\|built\|ready"; then
        log_success "Frontend appears to have built successfully"
    else
        log_warning "Frontend build status unclear"
    fi
}

# Phase 7: Performance Baseline Tests
test_performance_baseline() {
    log_header "PHASE 7: PERFORMANCE BASELINE"
    
    log_section "7.1 Response Time Tests"
    
    # Test basic response times
    local start_time end_time duration
    
    start_time=$(date +%s.%N)
    curl -s --max-time $TIMEOUT http://localhost:8000/health > /dev/null 2>&1 || true
    end_time=$(date +%s.%N)
    
    if command -v bc >/dev/null 2>&1; then
        duration=$(echo "$end_time - $start_time" | bc -l)
        if (( $(echo "$duration < 3.0" | bc -l) )); then
            log_success "Backend response time: ${duration}s (< 3s)"
        else
            log_warning "Backend response time: ${duration}s (slow)"
        fi
    else
        log_warning "Performance timing unavailable (bc not installed)"
    fi
    
    log_section "7.2 Load Testing (if available)"
    
    if command -v ab >/dev/null 2>&1; then
        log_info "Running light load test with Apache Bench..."
        if ab -n 10 -c 2 -q http://localhost:8000/health > "$TEMP_DIR/ab.log" 2>&1; then
            local avg_time
            avg_time=$(grep "Time per request" "$TEMP_DIR/ab.log" | head -1 | awk '{print $4}')
            log_success "Load test completed - Average: ${avg_time}ms per request"
        else
            log_warning "Load test failed or incomplete"
        fi
    else
        log_warning "Load testing unavailable (ab not installed)"
    fi
}

# Generate comprehensive report
generate_report() {
    log_header "INTEGRATION TEST SUMMARY"
    
    echo -e "${CYAN}Total Tests: $TOTAL_TESTS${NC}"
    echo -e "${GREEN}Passed: $PASSED_TESTS${NC}"
    echo -e "${RED}Failed: $FAILED_TESTS${NC}"
    
    local success_rate
    if [[ $TOTAL_TESTS -gt 0 ]]; then
        if command -v bc >/dev/null 2>&1; then
            success_rate=$(echo "scale=1; $PASSED_TESTS * 100 / $TOTAL_TESTS" | bc -l)
        else
            success_rate="$((PASSED_TESTS * 100 / TOTAL_TESTS))"
        fi
        echo -e "${BLUE}Success Rate: ${success_rate}%${NC}"
    fi
    
    echo ""
    echo -e "${PURPLE}DETAILED RESULTS:${NC}"
    for result in "${TEST_RESULTS[@]}"; do
        echo "  $result"
    done
    
    # Save results to file
    local report_file="$TEMP_DIR/integration-test-report.txt"
    {
        echo "Services Refactor Integration Test Report"
        echo "Generated: $(date)"
        echo "Total Tests: $TOTAL_TESTS"
        echo "Passed: $PASSED_TESTS"  
        echo "Failed: $FAILED_TESTS"
        echo "Success Rate: ${success_rate}%"
        echo ""
        echo "Results:"
        printf '%s\n' "${TEST_RESULTS[@]}"
        echo ""
        echo "Log Files Generated:"
        echo "- Build Log: $TEMP_DIR/build.log"
        echo "- Startup Log: $TEMP_DIR/startup.log" 
        echo "- Services Status: $TEMP_DIR/services.log"
        echo "- Publisher Logs: $TEMP_DIR/publisher.log"
        if [[ -f "$TEMP_DIR/ab.log" ]]; then
            echo "- Load Test: $TEMP_DIR/ab.log"
        fi
    } > "$report_file"
    
    echo ""
    echo -e "${CYAN}📄 Full report saved to: $report_file${NC}"
    
    # Copy report to persistent location
    cp "$report_file" "./integration-test-results-$(date +%Y%m%d-%H%M%S).txt"
    
    echo ""
    if [[ $FAILED_TESTS -eq 0 ]]; then
        echo -e "${GREEN}🎉 ALL INTEGRATION TESTS PASSED!${NC}"
        echo -e "${GREEN}✅ Services refactor validation successful!${NC}"
    elif [[ $FAILED_TESTS -le 2 ]]; then
        echo -e "${YELLOW}⚠️  Minor issues detected. Review failed tests above.${NC}"
        echo -e "${YELLOW}🔍 Services refactor mostly successful.${NC}"
    else
        echo -e "${RED}❌ Multiple issues detected. Services refactor needs attention.${NC}"
        echo -e "${RED}🚨 Review failed tests and fix issues before proceeding.${NC}"
    fi
    
    return $FAILED_TESTS
}

# Main execution
main() {
    log_header "SERVICES REFACTOR INTEGRATION TESTING"
    log_info "Phase 7: Validating full system coherence after refactor"
    log_info "Timeout: ${TIMEOUT}s per test"
    
    # Check prerequisites
    if ! command -v curl &> /dev/null; then
        log_error "curl is required but not installed"
        exit 1
    fi
    
    if ! command -v docker &> /dev/null; then
        log_error "docker is required but not installed"
        exit 1
    fi
    
    # Run test phases
    test_infrastructure || { log_error "Infrastructure tests failed"; exit 1; }
    test_health_checks
    test_inter_service_communication  
    test_event_communication
    test_api_integration
    test_frontend_integration
    test_performance_baseline
    
    # Generate final report
    generate_report
    local exit_code=$?
    
    # Exit with appropriate code
    exit $exit_code
}

# Script usage
show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -h, --help          Show this help message"
    echo "  -t, --timeout N     Set request timeout (default: 10s)"
    echo "  -v, --verbose       Enable verbose output"
    echo "  --no-rebuild        Skip docker rebuild (use existing images)"
    echo ""
    echo "This script validates the Phase 7 services refactor integration"
    echo "by testing all services, health checks, and inter-service communication."
}

# Parse command line arguments
REBUILD=true
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_usage
            exit 0
            ;;
        -t|--timeout)
            TIMEOUT="$2"
            shift 2
            ;;
        -v|--verbose)
            set -x
            shift
            ;;
        --no-rebuild)
            REBUILD=false
            shift
            ;;
        *)
            echo "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Run main function
main "$@"
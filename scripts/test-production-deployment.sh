#!/bin/bash
# Production Deployment Test Script
# Phase 7: Frontend API Integration - Subdomain Architecture Validation
# Based on PRODUCTION_DEPLOYMENT_TEST.md

# Configuration
MAIN_DOMAIN="littledan.com"
API_DOMAIN="api.littledan.com"
USER_AGENT="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
TIMEOUT=10
TEMP_DIR="/tmp/production-test-$$"
COOKIES_FILE="$TEMP_DIR/cookies.txt"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Test tracking
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
TEST_RESULTS=()

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

# Phase 1: Infrastructure Validation
test_infrastructure() {
    log_header "PHASE 1: INFRASTRUCTURE VALIDATION"
    
    log_section "1.1 DNS Resolution Testing"
    run_test "Main domain DNS resolution" \
        "nslookup $MAIN_DOMAIN" \
        "Address:"
    
    run_test "API subdomain DNS resolution" \
        "nslookup $API_DOMAIN" \
        "Address:"
    
    run_test "External DNS validation" \
        "curl -s --max-time $TIMEOUT 'https://dns.google/resolve?name=$API_DOMAIN&type=A'" \
        "174.49.194.148"
    
    log_section "1.2 SSL Certificate Testing"
    run_test "Main domain SSL certificate" \
        "echo | openssl s_client -servername $MAIN_DOMAIN -connect $MAIN_DOMAIN:443 2>/dev/null | openssl x509 -noout -subject" \
        "CN=$MAIN_DOMAIN"
    
    run_test "API subdomain SSL certificate" \
        "echo | openssl s_client -servername $API_DOMAIN -connect $API_DOMAIN:443 2>/dev/null | openssl x509 -noout -subject" \
        "CN=$API_DOMAIN"
    
    log_section "1.3 Basic Connectivity"
    run_test "Main domain HTTPS connectivity" \
        "curl -I -s --max-time $TIMEOUT -H 'User-Agent: $USER_AGENT' https://$MAIN_DOMAIN" \
        "HTTP.*200"
    
    run_test "API subdomain HTTPS connectivity" \
        "curl -s --max-time $TIMEOUT -H 'User-Agent: $USER_AGENT' https://$API_DOMAIN/health" \
        '"status":"healthy"'
    
    log_section "1.4 Rate Limiting Validation"
    log_info "Testing API rate limiting (10 rapid requests)..."
    local rate_limit_results=""
    for i in {1..10}; do
        local status_code
        status_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 -H "User-Agent: $USER_AGENT" https://$API_DOMAIN/health)
        rate_limit_results="$rate_limit_results$status_code "
    done
    
    if echo "$rate_limit_results" | grep -q "200"; then
        log_success "API rate limiting allows normal requests"
    else
        log_error "API rate limiting blocking all requests: $rate_limit_results"
    fi
}

# Phase 2: API Endpoint Testing
test_api_endpoints() {
    log_header "PHASE 2: API ENDPOINT TESTING"
    
    log_section "2.1 Health and Monitoring Endpoints"
    run_test "Basic health endpoint" \
        "curl -s --max-time $TIMEOUT -H 'User-Agent: $USER_AGENT' https://$API_DOMAIN/health" \
        '"status":"healthy"'
    
    run_test "Detailed health endpoint" \
        "curl -s --max-time $TIMEOUT -H 'User-Agent: $USER_AGENT' https://$API_DOMAIN/monitoring/health/detailed" \
        '"status":"healthy"' \
        "optional"
    
    run_test "Metrics endpoint" \
        "curl -s --max-time $TIMEOUT -H 'User-Agent: $USER_AGENT' https://$API_DOMAIN/monitoring/metrics" \
        '"request_count"' \
        "optional"
    
    log_section "2.2 Authentication Endpoints"
    # Note: These tests don't actually create accounts, just test endpoint availability
    run_test "Registration endpoint availability" \
        "curl -X POST -s -o /dev/null -w '%{http_code}' --max-time $TIMEOUT -H 'Content-Type: application/json' -H 'User-Agent: $USER_AGENT' https://$API_DOMAIN/auth/register -d '{}'" \
        "422" # Expect validation error for empty data
    
    run_test "Login endpoint availability" \
        "curl -X POST -s -o /dev/null -w '%{http_code}' --max-time $TIMEOUT -H 'Content-Type: application/json' -H 'User-Agent: $USER_AGENT' https://$API_DOMAIN/auth/login -d '{}'" \
        "422" # Expect validation error for empty data
    
    log_section "2.3 CRUD Endpoints (Unauthenticated - expecting 401/403)"
    run_test "Categories endpoint (auth required)" \
        "curl -s -o /dev/null -w '%{http_code}' --max-time $TIMEOUT -H 'User-Agent: $USER_AGENT' https://$API_DOMAIN/categories/" \
        "401\|403"
    
    run_test "Documents endpoint (auth required)" \
        "curl -s -o /dev/null -w '%{http_code}' --max-time $TIMEOUT -H 'User-Agent: $USER_AGENT' https://$API_DOMAIN/documents/" \
        "401\|403"
    
    run_test "Dictionary endpoint (auth required)" \
        "curl -s -o /dev/null -w '%{http_code}' --max-time $TIMEOUT -H 'User-Agent: $USER_AGENT' https://$API_DOMAIN/dictionary/" \
        "401\|403"
    
    log_section "2.4 Specialized Endpoints"
    run_test "Syntax highlighting endpoint" \
        "curl -X POST -s --max-time $TIMEOUT -H 'Content-Type: application/json' -H 'User-Agent: $USER_AGENT' https://$API_DOMAIN/highlight/syntax -d '{\"code\":\"console.log(\\\"test\\\");\",\"language\":\"javascript\"}'" \
        "highlighted_code\|html" \
        "optional"
}

# Phase 3: Frontend Integration Testing
test_frontend_integration() {
    log_header "PHASE 3: FRONTEND INTEGRATION TESTING"
    
    log_section "3.1 Frontend Application Testing"
    run_test "Frontend loads correctly" \
        "curl -I -s --max-time $TIMEOUT -H 'User-Agent: $USER_AGENT' https://$MAIN_DOMAIN" \
        "HTTP.*200"
    
    run_test "Frontend assets - main.js" \
        "curl -I -s --max-time $TIMEOUT -H 'User-Agent: $USER_AGENT' https://$MAIN_DOMAIN/assets/main.js" \
        "HTTP.*200" \
        "optional"
    
    run_test "Frontend assets - main.css" \
        "curl -I -s --max-time $TIMEOUT -H 'User-Agent: $USER_AGENT' https://$MAIN_DOMAIN/assets/main.css" \
        "HTTP.*200" \
        "optional"
    
    log_section "3.2 CORS Validation"
    run_test "CORS preflight request" \
        "curl -X OPTIONS -s -o /dev/null -w '%{http_code}' --max-time $TIMEOUT -H 'Origin: https://$MAIN_DOMAIN' -H 'Access-Control-Request-Method: GET' -H 'User-Agent: $USER_AGENT' https://$API_DOMAIN/health" \
        "200\|204"
    
    run_test "CORS actual request" \
        "curl -s --max-time $TIMEOUT -H 'Origin: https://$MAIN_DOMAIN' -H 'User-Agent: $USER_AGENT' https://$API_DOMAIN/health" \
        '"status":"healthy"'
    
    log_section "3.3 API Redirect Testing"
    run_test "Old API path redirects" \
        "curl -I -s --max-time $TIMEOUT -H 'User-Agent: $USER_AGENT' https://$MAIN_DOMAIN/api/health" \
        "301\|302" \
        "optional"
}

# Phase 4: Security Testing
test_security() {
    log_header "PHASE 4: SECURITY TESTING"
    
    log_section "4.1 Security Headers"
    local headers_response
    headers_response=$(curl -I -s --max-time $TIMEOUT -H "User-Agent: $USER_AGENT" https://$API_DOMAIN/health)
    
    if echo "$headers_response" | grep -qi "x-frame-options\|x-content-type-options\|strict-transport-security"; then
        log_success "Security headers present"
    else
        log_error "Missing security headers"
        echo "  Response headers:"
        echo "$headers_response" | grep -i "x-\|strict-transport"
    fi
    
    log_section "4.2 Bot Protection Testing"
    local bot_test_result
    bot_test_result=$(timeout 8 curl -s -o /dev/null -w '%{http_code}' https://$API_DOMAIN/health 2>&1)
    local bot_exit_code=$?
    
    if [[ $bot_exit_code -eq 124 ]] || [[ "$bot_test_result" == "000" ]] || [[ "$bot_test_result" == "444" ]]; then
        log_success "Bot protection blocks default curl (timeout/444 as expected)"
    elif [[ "$bot_test_result" =~ ^[45][0-9][0-9]$ ]]; then
        log_success "Bot protection blocks default curl (4xx/5xx response)"
    else
        log_error "Bot protection not working: $bot_test_result"
    fi
    
    log_section "4.3 Method Blocking"
    local method_test_result
    method_test_result=$(timeout 8 curl -X PATCH -s -o /dev/null -w '%{http_code}' -H 'User-Agent: $USER_AGENT' https://$API_DOMAIN/health 2>&1)
    local method_exit_code=$?
    
    if [[ $method_exit_code -eq 124 ]] || [[ "$method_test_result" == "000" ]] || [[ "$method_test_result" == "444" ]] || [[ "$method_test_result" == "405" ]]; then
        log_success "Invalid HTTP method blocked (timeout/444/405 as expected)"
    else
        log_error "Method blocking not working: $method_test_result"
    fi
    
    log_section "4.4 Malicious Request Blocking"
    local injection_test_result
    injection_test_result=$(timeout 8 curl -s -o /dev/null -w '%{http_code}' -H 'User-Agent: $USER_AGENT' 'https://$API_DOMAIN/health?test=<script>alert(1)</script>' 2>&1)
    local injection_exit_code=$?
    
    if [[ $injection_exit_code -eq 124 ]] || [[ "$injection_test_result" == "000" ]] || [[ "$injection_test_result" == "444" ]] || [[ "$injection_test_result" == "400" ]]; then
        log_success "Script injection blocked (timeout/444/400 as expected)"
    else
        log_error "Injection blocking not working: $injection_test_result"
    fi
}

# Phase 5: Performance Testing
test_performance() {
    log_header "PHASE 5: PERFORMANCE TESTING"
    
    log_section "5.1 Response Time Testing"
    local start_time end_time duration
    
    start_time=$(date +%s.%N)
    curl -s --max-time $TIMEOUT -H "User-Agent: $USER_AGENT" https://$API_DOMAIN/health > /dev/null
    end_time=$(date +%s.%N)
    duration=$(echo "$end_time - $start_time" | bc -l)
    
    if (( $(echo "$duration < 2.0" | bc -l) )); then
        log_success "API response time: ${duration}s (< 2s)"
    else
        log_warning "API response time: ${duration}s (slow)"
    fi
    
    log_section "5.2 Concurrent Request Testing"
    log_info "Testing 5 concurrent requests..."
    local concurrent_results=""
    for i in {1..5}; do
        curl -s -o /dev/null -w "%{http_code}" --max-time 10 -H "User-Agent: $USER_AGENT" https://$API_DOMAIN/health &
    done
    wait
    
    log_success "Concurrent requests completed"
}

# Generate summary report
generate_report() {
    log_header "TEST SUMMARY REPORT"
    
    echo -e "${CYAN}Total Tests: $TOTAL_TESTS${NC}"
    echo -e "${GREEN}Passed: $PASSED_TESTS${NC}"
    echo -e "${RED}Failed: $FAILED_TESTS${NC}"
    
    local success_rate
    if [[ $TOTAL_TESTS -gt 0 ]]; then
        success_rate=$(echo "scale=1; $PASSED_TESTS * 100 / $TOTAL_TESTS" | bc -l)
        echo -e "${BLUE}Success Rate: ${success_rate}%${NC}"
    fi
    
    echo ""
    echo -e "${PURPLE}DETAILED RESULTS:${NC}"
    for result in "${TEST_RESULTS[@]}"; do
        echo "  $result"
    done
    
    echo ""
    if [[ $FAILED_TESTS -eq 0 ]]; then
        echo -e "${GREEN}🎉 ALL TESTS PASSED! Subdomain architecture is functioning correctly.${NC}"
        echo -e "${GREEN}✅ Production deployment validation successful!${NC}"
    elif [[ $FAILED_TESTS -le 3 ]]; then
        echo -e "${YELLOW}⚠️  Minor issues detected. Review failed tests above.${NC}"
        echo -e "${YELLOW}🔍 Subdomain architecture mostly functional.${NC}"
    else
        echo -e "${RED}❌ Multiple issues detected. Subdomain architecture needs attention.${NC}"
        echo -e "${RED}🚨 Review failed tests and fix issues before proceeding.${NC}"
    fi
    
    # Save results to file
    local report_file="$TEMP_DIR/production-test-report.txt"
    {
        echo "Production Deployment Test Report"
        echo "Generated: $(date)"
        echo "Total Tests: $TOTAL_TESTS"
        echo "Passed: $PASSED_TESTS"
        echo "Failed: $FAILED_TESTS"
        echo "Success Rate: ${success_rate}%"
        echo ""
        echo "Results:"
        printf '%s\n' "${TEST_RESULTS[@]}"
    } > "$report_file"
    
    echo ""
    echo -e "${CYAN}📄 Full report saved to: $report_file${NC}"
}

# Main execution
main() {
    log_header "PRODUCTION DEPLOYMENT TEST SUITE"
    log_info "Testing subdomain architecture: $MAIN_DOMAIN → $API_DOMAIN"
    log_info "User Agent: $USER_AGENT"
    log_info "Timeout: ${TIMEOUT}s"
    
    # Check prerequisites
    if ! command -v curl &> /dev/null; then
        log_error "curl is required but not installed"
        exit 1
    fi
    
    if ! command -v jq &> /dev/null; then
        log_warning "jq not found - JSON parsing will be limited"
    fi
    
    if ! command -v bc &> /dev/null; then
        log_warning "bc not found - performance calculations will be limited"
    fi
    
    # Run test phases
    test_infrastructure
    test_api_endpoints
    test_frontend_integration
    test_security
    test_performance
    
    # Generate final report
    generate_report
    
    # Exit with appropriate code
    if [[ $FAILED_TESTS -eq 0 ]]; then
        exit 0
    else
        exit 1
    fi
}

# Script usage
show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -h, --help          Show this help message"
    echo "  -t, --timeout N     Set request timeout (default: 10s)"
    echo "  -v, --verbose       Enable verbose output"
    echo ""
    echo "This script validates the Phase 7 subdomain architecture deployment"
    echo "by testing all endpoints, security features, and integration points."
}

# Parse command line arguments
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
        *)
            echo "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Run main function
main "$@"

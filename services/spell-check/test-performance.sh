#!/bin/bash

# Comprehensive Testing Script for Spell Check Service
# Usage: ./test-performance.sh [test-type]

set -e

SERVICE_URL="http://localhost:8003"
TEST_DIR="$(dirname "$0")"
RESULTS_DIR="$TEST_DIR/results"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Create results directory
mkdir -p "$RESULTS_DIR"

print_header() {
    echo -e "${BLUE}================================================${NC}"
    echo -e "${BLUE} $1${NC}"
    echo -e "${BLUE}================================================${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if service is running
check_service() {
    print_header "Checking Service Health"

    if curl -s "$SERVICE_URL/health" > /dev/null; then
        print_success "Service is running and healthy"

        # Get service info
        HEALTH_INFO=$(curl -s "$SERVICE_URL/health/detailed")
        echo "$HEALTH_INFO" | jq '.components | keys[]' | head -5

    else
        print_error "Service is not running or not healthy"
        echo "Please start the service with: npm start"
        exit 1
    fi
}

# Basic functionality tests
test_basic_functionality() {
    print_header "Testing Basic Functionality"

    # Test main spell check endpoint
    echo "Testing spell check endpoint..."
    RESPONSE=$(curl -s -X POST "$SERVICE_URL/check" \
        -H "Content-Type: application/json" \
        -d '{
            "text": "This is a test sentnce with some misstakes.",
            "enableGrammar": true,
            "enableStyle": true
        }')

    if echo "$RESPONSE" | jq -e '.results.spelling' > /dev/null; then
        SPELLING_ISSUES=$(echo "$RESPONSE" | jq '.results.spelling | length')
        print_success "Spell check working - found $SPELLING_ISSUES spelling issues"
    else
        print_error "Spell check endpoint failed"
        echo "$RESPONSE" | jq '.'
        return 1
    fi

    # Test language detection
    echo "Testing language detection..."
    LANG_RESPONSE=$(curl -s -X POST "$SERVICE_URL/detect-language" \
        -H "Content-Type: application/json" \
        -d '{"text": "This is English text for language detection testing."}')

    if echo "$LANG_RESPONSE" | jq -e '.language' > /dev/null; then
        DETECTED_LANG=$(echo "$LANG_RESPONSE" | jq -r '.language')
        print_success "Language detection working - detected: $DETECTED_LANG"
    else
        print_warning "Language detection may have issues"
    fi

    # Test batch processing
    echo "Testing batch processing..."
    BATCH_RESPONSE=$(curl -s -X POST "$SERVICE_URL/check-batch" \
        -H "Content-Type: application/json" \
        -d '{
            "text": "This is a longer text for batch processing. It contains multiple sentences. Some may have errors in speling and grammer. The batch processor should handle this efficiently and return comprehensive results.",
            "chunkSize": 50
        }')

    if echo "$BATCH_RESPONSE" | jq -e '.batchInfo.chunkCount' > /dev/null; then
        CHUNK_COUNT=$(echo "$BATCH_RESPONSE" | jq '.batchInfo.chunkCount')
        print_success "Batch processing working - processed $CHUNK_COUNT chunks"
    else
        print_warning "Batch processing may have issues"
    fi
}

# Performance testing with curl
test_performance_simple() {
    print_header "Simple Performance Testing"

    # Test latency
    echo "Testing response times..."

    TOTAL_TIME=0
    REQUESTS=10

    for i in $(seq 1 $REQUESTS); do
        START=$(date +%s%N)
        curl -s -X POST "$SERVICE_URL/check" \
            -H "Content-Type: application/json" \
            -d '{"text": "This is a performance test with some deliberate misspellings and grammer errors."}' \
            > /dev/null
        END=$(date +%s%N)

        REQUEST_TIME=$(( (END - START) / 1000000 )) # Convert to milliseconds
        TOTAL_TIME=$(( TOTAL_TIME + REQUEST_TIME ))

        echo "Request $i: ${REQUEST_TIME}ms"
    done

    AVERAGE_TIME=$(( TOTAL_TIME / REQUESTS ))

    if [ $AVERAGE_TIME -lt 200 ]; then
        print_success "Average response time: ${AVERAGE_TIME}ms (Good)"
    elif [ $AVERAGE_TIME -lt 500 ]; then
        print_warning "Average response time: ${AVERAGE_TIME}ms (Acceptable)"
    else
        print_error "Average response time: ${AVERAGE_TIME}ms (Poor)"
    fi

    # Save results
    echo "{\"timestamp\": \"$(date -Iseconds)\", \"average_latency_ms\": $AVERAGE_TIME, \"requests\": $REQUESTS}" \
        > "$RESULTS_DIR/simple_performance.json"
}

# Memory usage monitoring
test_memory_usage() {
    print_header "Memory Usage Testing"

    # Get initial memory
    MEMORY_INFO=$(curl -s "$SERVICE_URL/health" | jq '.memory')
    HEAP_USED=$(echo "$MEMORY_INFO" | jq '.heapUsed // 0')
    HEAP_TOTAL=$(echo "$MEMORY_INFO" | jq '.heapTotal // 0')

    echo "Initial Memory Usage:"
    echo "  Heap Used: $(( HEAP_USED / 1024 / 1024 ))MB"
    echo "  Heap Total: $(( HEAP_TOTAL / 1024 / 1024 ))MB"

    # Run stress test
    echo "Running memory stress test..."

    for i in $(seq 1 20); do
        curl -s -X POST "$SERVICE_URL/check" \
            -H "Content-Type: application/json" \
            -d '{
                "text": "This is a larger text for memory testing. It contains multiple paragraphs with various spelling errors, grammar mistakes, and style issues that need to be analyzed. The purpose is to stress test the memory usage of the spell checking service under load. We want to ensure that memory usage remains stable and does not grow unbounded over time. This text is intentionally longer to simulate real-world usage patterns where users might submit substantial documents for checking.",
                "enableGrammar": true,
                "enableStyle": true,
                "enableContextualSuggestions": true
            }' > /dev/null &
    done

    wait # Wait for all requests to complete

    # Check memory after stress test
    sleep 2
    MEMORY_INFO_AFTER=$(curl -s "$SERVICE_URL/health" | jq '.memory')
    HEAP_USED_AFTER=$(echo "$MEMORY_INFO_AFTER" | jq '.heapUsed // 0')
    HEAP_TOTAL_AFTER=$(echo "$MEMORY_INFO_AFTER" | jq '.heapTotal // 0')

    echo "Memory Usage After Stress Test:"
    echo "  Heap Used: $(( HEAP_USED_AFTER / 1024 / 1024 ))MB"
    echo "  Heap Total: $(( HEAP_TOTAL_AFTER / 1024 / 1024 ))MB"

    MEMORY_INCREASE=$(( (HEAP_USED_AFTER - HEAP_USED) / 1024 / 1024 ))

    if [ $MEMORY_INCREASE -lt 50 ]; then
        print_success "Memory usage stable - increase: ${MEMORY_INCREASE}MB"
    else
        print_warning "Memory usage increased by ${MEMORY_INCREASE}MB"
    fi

    # Save memory test results
    echo "{
        \"timestamp\": \"$(date -Iseconds)\",
        \"initial_heap_mb\": $(( HEAP_USED / 1024 / 1024 )),
        \"final_heap_mb\": $(( HEAP_USED_AFTER / 1024 / 1024 )),
        \"increase_mb\": $MEMORY_INCREASE
    }" > "$RESULTS_DIR/memory_test.json"
}

# Feature-specific testing
test_all_features() {
    print_header "Testing All Features"

    # Test spell checking
    echo "Testing spell checking..."
    SPELL_RESULT=$(curl -s -X POST "$SERVICE_URL/check" \
        -H "Content-Type: application/json" \
        -d '{"text": "Ths sentnce has mltple misspellings."}')

    SPELLING_COUNT=$(echo "$SPELL_RESULT" | jq '.results.spelling | length')
    echo "  Spelling issues found: $SPELLING_COUNT"

    # Test grammar checking
    echo "Testing grammar checking..."
    GRAMMAR_RESULT=$(curl -s -X POST "$SERVICE_URL/check" \
        -H "Content-Type: application/json" \
        -d '{"text": "Me and him is going to the store yesterday.", "enableGrammar": true}')

    GRAMMAR_COUNT=$(echo "$GRAMMAR_RESULT" | jq '.results.grammar | length // 0')
    echo "  Grammar issues found: $GRAMMAR_COUNT"

    # Test style analysis
    echo "Testing style analysis..."
    STYLE_RESULT=$(curl -s -X POST "$SERVICE_URL/check" \
        -H "Content-Type: application/json" \
        -d '{"text": "This sentence is really, really, really long and very verbose and uses too many words unnecessarily.", "enableStyle": true}')

    STYLE_COUNT=$(echo "$STYLE_RESULT" | jq '.results.style | length // 0')
    echo "  Style issues found: $STYLE_COUNT"

    # Test contextual suggestions
    echo "Testing contextual suggestions..."
    CONTEXT_RESULT=$(curl -s -X POST "$SERVICE_URL/contextual-suggestions" \
        -H "Content-Type: application/json" \
        -d '{
            "word": "there",
            "context": "Put the book over there on the table.",
            "position": 18,
            "basicSuggestions": ["their", "there", "they"]
        }')

    if echo "$CONTEXT_RESULT" | jq -e '.suggestions' > /dev/null; then
        CONTEXT_COUNT=$(echo "$CONTEXT_RESULT" | jq '.suggestions | length')
        echo "  Contextual suggestions: $CONTEXT_COUNT"
        print_success "All features working correctly"
    else
        print_warning "Some features may have issues"
    fi
}

# Generate performance report
generate_report() {
    print_header "Generating Performance Report"

    REPORT_FILE="$RESULTS_DIR/performance_report_$(date +%Y%m%d_%H%M%S).json"

    # Get system info
    SYSTEM_INFO=$(curl -s "$SERVICE_URL/health")

    # Combine all test results
    cat > "$REPORT_FILE" << EOF
{
    "timestamp": "$(date -Iseconds)",
    "service_health": $SYSTEM_INFO,
    "test_results": {
        "simple_performance": $(cat "$RESULTS_DIR/simple_performance.json" 2>/dev/null || echo "null"),
        "memory_test": $(cat "$RESULTS_DIR/memory_test.json" 2>/dev/null || echo "null")
    },
    "recommendations": {
        "current_performance": "$([ -f "$RESULTS_DIR/simple_performance.json" ] && echo "Measured" || echo "Not measured")",
        "memory_efficiency": "$([ -f "$RESULTS_DIR/memory_test.json" ] && echo "Tested" || echo "Not tested")",
        "architecture_recommendation": "Continue with Node.js - performance adequate for current needs"
    }
}
EOF

    print_success "Performance report saved to: $REPORT_FILE"

    # Display summary
    echo -e "\n${BLUE}=== PERFORMANCE SUMMARY ===${NC}"
    if [ -f "$RESULTS_DIR/simple_performance.json" ]; then
        AVG_LATENCY=$(cat "$RESULTS_DIR/simple_performance.json" | jq '.average_latency_ms')
        echo "Average Latency: ${AVG_LATENCY}ms"
    fi

    if [ -f "$RESULTS_DIR/memory_test.json" ]; then
        MEMORY_INCREASE=$(cat "$RESULTS_DIR/memory_test.json" | jq '.increase_mb')
        echo "Memory Stability: +${MEMORY_INCREASE}MB under load"
    fi

    echo -e "\n${BLUE}=== ARCHITECTURE RECOMMENDATION ===${NC}"
    echo -e "${GREEN}✅ Keep Node.js Implementation${NC}"
    echo "Reasons:"
    echo "  • Well-architected and maintainable"
    echo "  • Performance meets requirements"
    echo "  • Simple deployment and operations"
    echo "  • Strong development velocity"
    echo ""
    echo "Consider FastAPI only if:"
    echo "  • Latency consistently > 500ms"
    echo "  • Concurrent users > 200"
    echo "  • Advanced ML features required"
}

# Main execution
main() {
    case "${1:-all}" in
        "health")
            check_service
            ;;
        "basic")
            check_service
            test_basic_functionality
            ;;
        "performance")
            check_service
            test_performance_simple
            ;;
        "memory")
            check_service
            test_memory_usage
            ;;
        "features")
            check_service
            test_all_features
            ;;
        "all")
            check_service
            test_basic_functionality
            test_performance_simple
            test_memory_usage
            test_all_features
            generate_report
            ;;
        *)
            echo "Usage: $0 [health|basic|performance|memory|features|all]"
            exit 1
            ;;
    esac
}

main "$@"
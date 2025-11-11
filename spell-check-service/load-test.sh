#!/bin/bash

# Simple Load Test for Spell Check Service
# Usage: ./load-test.sh [concurrent_users] [duration_seconds]

CONCURRENT_USERS=${1:-10}
DURATION=${2:-30}
SERVICE_URL="http://localhost:8003"
RESULTS_DIR="$(dirname "$0")/results"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

mkdir -p "$RESULTS_DIR"

echo -e "${BLUE}Starting Load Test${NC}"
echo "Concurrent Users: $CONCURRENT_USERS"
echo "Duration: $DURATION seconds"
echo "Target: $SERVICE_URL"
echo ""

# Test payloads of different sizes
SMALL_PAYLOAD='{"text": "This is a short test with errors."}'
MEDIUM_PAYLOAD='{"text": "This is a medium-length test document that contains multiple sentences with various types of errors including spelling mistakes, grammar issues, and style problems that need to be analyzed by the spell checking service."}'
LARGE_PAYLOAD='{"text": "This is a comprehensive test document designed to stress test the spell checking service with a substantial amount of text content. The document contains multiple paragraphs with various types of linguistic issues including spelling errors, grammatical mistakes, style inconsistencies, and other problems that a modern spell checking service should be able to identify and provide suggestions for. The purpose of this large payload is to simulate real-world usage where users might submit entire documents or substantial portions of text for analysis. By testing with larger payloads, we can evaluate how the service performs under more realistic conditions and identify any potential bottlenecks or performance issues that might arise when processing substantial amounts of text content."}'

# Start background load
start_load_worker() {
    local worker_id=$1
    local log_file="$RESULTS_DIR/worker_${worker_id}.log"

    {
        local requests=0
        local errors=0
        local total_time=0

        echo "Worker $worker_id started at $(date)" > "$log_file"

        local end_time=$(($(date +%s) + DURATION))

        while [ $(date +%s) -lt $end_time ]; do
            # Randomly select payload size
            local payload
            case $((RANDOM % 3)) in
                0) payload="$SMALL_PAYLOAD" ;;
                1) payload="$MEDIUM_PAYLOAD" ;;
                2) payload="$LARGE_PAYLOAD" ;;
            esac

            local start=$(date +%s%N)

            if curl -s -X POST "$SERVICE_URL/check" \
                -H "Content-Type: application/json" \
                -d "$payload" > /dev/null 2>&1; then
                local end=$(date +%s%N)
                local request_time=$(( (end - start) / 1000000 ))
                total_time=$((total_time + request_time))
                requests=$((requests + 1))

                echo "$(date +%H:%M:%S) Request $requests: ${request_time}ms" >> "$log_file"
            else
                errors=$((errors + 1))
                echo "$(date +%H:%M:%S) Error on request $((requests + errors))" >> "$log_file"
            fi

            # Small delay to prevent overwhelming
            sleep 0.1
        done

        local avg_time=0
        if [ $requests -gt 0 ]; then
            avg_time=$((total_time / requests))
        fi

        echo "Worker $worker_id completed: $requests requests, $errors errors, ${avg_time}ms avg" >> "$log_file"
        echo "{\"worker_id\": $worker_id, \"requests\": $requests, \"errors\": $errors, \"avg_time_ms\": $avg_time}" > "$RESULTS_DIR/worker_${worker_id}_summary.json"
    } &
}

# Start all workers
echo "Starting $CONCURRENT_USERS workers..."
for i in $(seq 1 $CONCURRENT_USERS); do
    start_load_worker $i
    echo "Started worker $i"
done

# Monitor progress
echo -e "\n${YELLOW}Load test in progress...${NC}"
echo "Monitoring for $DURATION seconds..."

# Progress indicator
for i in $(seq 1 $DURATION); do
    echo -n "."
    sleep 1
    if [ $((i % 10)) -eq 0 ]; then
        echo " ${i}s"
    fi
done

echo -e "\n\n${YELLOW}Waiting for workers to complete...${NC}"
wait

# Collect results
echo -e "\n${BLUE}Collecting Results${NC}"

total_requests=0
total_errors=0
total_avg_time=0
workers_completed=0

for i in $(seq 1 $CONCURRENT_USERS); do
    if [ -f "$RESULTS_DIR/worker_${i}_summary.json" ]; then
        worker_requests=$(jq '.requests' "$RESULTS_DIR/worker_${i}_summary.json")
        worker_errors=$(jq '.errors' "$RESULTS_DIR/worker_${i}_summary.json")
        worker_avg_time=$(jq '.avg_time_ms' "$RESULTS_DIR/worker_${i}_summary.json")

        total_requests=$((total_requests + worker_requests))
        total_errors=$((total_errors + worker_errors))
        total_avg_time=$((total_avg_time + worker_avg_time))
        workers_completed=$((workers_completed + 1))

        echo "Worker $i: $worker_requests requests, $worker_errors errors, ${worker_avg_time}ms avg"
    fi
done

# Calculate overall statistics
if [ $workers_completed -gt 0 ]; then
    overall_avg_time=$((total_avg_time / workers_completed))
    requests_per_second=$((total_requests / DURATION))
    error_rate=0
    if [ $total_requests -gt 0 ]; then
        error_rate=$(( (total_errors * 100) / (total_requests + total_errors) ))
    fi

    echo -e "\n${GREEN}=== LOAD TEST RESULTS ===${NC}"
    echo "Duration: ${DURATION}s"
    echo "Concurrent Users: $CONCURRENT_USERS"
    echo "Total Requests: $total_requests"
    echo "Total Errors: $total_errors"
    echo "Error Rate: ${error_rate}%"
    echo "Requests/Second: $requests_per_second"
    echo "Average Response Time: ${overall_avg_time}ms"

    # Save summary
    cat > "$RESULTS_DIR/load_test_summary.json" << EOF
{
    "timestamp": "$(date -Iseconds)",
    "config": {
        "concurrent_users": $CONCURRENT_USERS,
        "duration_seconds": $DURATION,
        "service_url": "$SERVICE_URL"
    },
    "results": {
        "total_requests": $total_requests,
        "total_errors": $total_errors,
        "error_rate_percent": $error_rate,
        "requests_per_second": $requests_per_second,
        "average_response_time_ms": $overall_avg_time,
        "workers_completed": $workers_completed
    },
    "performance_assessment": {
        "latency": "$([ $overall_avg_time -lt 200 ] && echo "Excellent" || [ $overall_avg_time -lt 500 ] && echo "Good" || echo "Needs Improvement")",
        "throughput": "$([ $requests_per_second -gt 10 ] && echo "Good" || echo "Low")",
        "reliability": "$([ $error_rate -lt 5 ] && echo "Excellent" || [ $error_rate -lt 10 ] && echo "Good" || echo "Poor")"
    }
}
EOF

    echo -e "\n${BLUE}Results saved to: $RESULTS_DIR/load_test_summary.json${NC}"

    # Performance assessment
    echo -e "\n${BLUE}=== PERFORMANCE ASSESSMENT ===${NC}"
    if [ $overall_avg_time -lt 200 ] && [ $error_rate -lt 5 ] && [ $requests_per_second -gt 10 ]; then
        echo -e "${GREEN}✅ EXCELLENT: Service performs well under load${NC}"
        echo "• Low latency (< 200ms)"
        echo "• High reliability (< 5% errors)"
        echo "• Good throughput (> 10 req/s)"
    elif [ $overall_avg_time -lt 500 ] && [ $error_rate -lt 10 ]; then
        echo -e "${YELLOW}⚠️  GOOD: Service performs adequately${NC}"
        echo "• Acceptable latency (< 500ms)"
        echo "• Reasonable reliability (< 10% errors)"
        echo "• Consider optimization for higher loads"
    else
        echo -e "${YELLOW}⚠️  NEEDS IMPROVEMENT: Consider optimization${NC}"
        echo "• High latency (> 500ms) or"
        echo "• High error rate (> 10%) or"
        echo "• Low throughput"
        echo ""
        echo "Recommendations:"
        echo "• Review service configuration"
        echo "• Check resource allocation"
        echo "• Consider caching strategies"
        echo "• Monitor system resources"
    fi

else
    echo "No workers completed successfully"
    exit 1
fi
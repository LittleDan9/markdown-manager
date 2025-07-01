#!/bin/bash

# Bot Traffic Analysis Script
# Usage: ./bot-analysis.sh [logfile] [hours]

LOGFILE=${1:-/var/log/nginx/access.log}
HOURS=${2:-24}

echo "=== Bot Traffic Analysis for last ${HOURS} hours ==="
echo "Log file: ${LOGFILE}"
echo "Generated at: $(date)"
echo ""

# Check if log file exists
if [ ! -f "$LOGFILE" ]; then
    echo "Error: Log file $LOGFILE not found"
    exit 1
fi

# Calculate the start time for analysis
START_TIME=$(date -d "${HOURS} hours ago" '+%d/%b/%Y:%H:%M:%S')

echo "=== Top 20 User Agents (last ${HOURS} hours) ==="
awk -v start="$START_TIME" '
    BEGIN { FS="\"" }
    $4 >= start {
        gsub(/^[ \t]+|[ \t]+$/, "", $6)
        if ($6 != "") agents[$6]++
    }
    END {
        for (agent in agents)
            printf "%5d %s\n", agents[agent], agent
    }
' "$LOGFILE" | sort -nr | head -20

echo ""
echo "=== Top 20 IPs with most requests (last ${HOURS} hours) ==="
awk -v start="$START_TIME" '
    BEGIN { FS=" " }
    $4 >= "["start {
        ips[$1]++
    }
    END {
        for (ip in ips)
            printf "%5d %s\n", ips[ip], ip
    }
' "$LOGFILE" | sort -nr | head -20

echo ""
echo "=== Suspicious Bot Activity ==="
echo "Requests with 'bot' in user agent:"
awk -v start="$START_TIME" '
    BEGIN { FS="\"" }
    $4 >= start && tolower($6) ~ /bot/ {
        bots[tolower($6)]++
    }
    END {
        for (bot in bots)
            printf "%5d %s\n", bots[bot], bot
    }
' "$LOGFILE" | sort -nr | head -10

echo ""
echo "=== Empty or suspicious user agents ==="
awk -v start="$START_TIME" '
    BEGIN { FS="\"" }
    $4 >= start && ($6 == "" || $6 == "-" || length($6) < 3) {
        empty++
    }
    END { printf "Empty/suspicious user agents: %d\n", empty }
' "$LOGFILE"

echo ""
echo "=== 444 Responses (blocked by nginx) ==="
awk -v start="$START_TIME" '
    $4 >= "["start && $9 == "444" {
        blocked[$1]++
        total++
    }
    END {
        printf "Total 444 responses: %d\n", total
        printf "Top IPs getting 444:\n"
        for (ip in blocked)
            printf "%5d %s\n", blocked[ip], ip
    }
' "$LOGFILE" | head -15

echo ""
echo "=== API Endpoint Requests ==="
awk -v start="$START_TIME" '
    $4 >= "["start && $7 ~ /^\/api\// {
        api[$1]++
        total++
    }
    END {
        printf "Total API requests: %d\n", total
        printf "Top IPs accessing API:\n"
        for (ip in api)
            printf "%5d %s\n", api[ip], ip
    }
' "$LOGFILE" | head -10

echo ""
echo "=== Rate Limited Requests (429 responses) ==="
awk -v start="$START_TIME" '
    $4 >= "["start && $9 == "429" {
        limited[$1]++
        total++
    }
    END {
        printf "Total 429 responses: %d\n", total
        if (total > 0) {
            printf "Top IPs being rate limited:\n"
            for (ip in limited)
                printf "%5d %s\n", limited[ip], ip
        }
    }
' "$LOGFILE" | head -10

echo ""
echo "=== Summary ==="
awk -v start="$START_TIME" '
    $4 >= "["start {
        total++
        if ($9 == "200") ok++
        if ($9 == "404") notfound++
        if ($9 == "444") blocked++
        if ($9 == "429") limited++
        if ($9 >= "500") errors++
    }
    END {
        printf "Total requests: %d\n", total
        printf "200 OK: %d (%.1f%%)\n", ok, ok/total*100
        printf "404 Not Found: %d (%.1f%%)\n", notfound, notfound/total*100
        printf "444 Blocked: %d (%.1f%%)\n", blocked, blocked/total*100
        printf "429 Rate Limited: %d (%.1f%%)\n", limited, limited/total*100
        printf "5xx Errors: %d (%.1f%%)\n", errors, errors/total*100
    }
' "$LOGFILE"

echo ""
echo "=== Analysis complete ==="
echo "To monitor in real-time, use: tail -f $LOGFILE | grep -E '(bot|spider|crawl)'"
echo "To block specific IPs, add them to your firewall or nginx configuration"

#!/bin/bash

# Nginx Configuration Test Script
# This script tests the bot blocking configuration

set -e

echo "=== Nginx Bot Blocking Configuration Test ==="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Test nginx configuration syntax
echo "1. Testing nginx configuration syntax..."
if sudo nginx -t; then
    echo -e "${GREEN}✅ Nginx configuration syntax is valid${NC}"
else
    echo -e "${RED}❌ Nginx configuration syntax error${NC}"
    exit 1
fi

echo ""

# Test if required configuration files exist
echo "2. Checking required configuration files..."

required_files=(
    "/etc/nginx/conf.d/bot-blocking.conf"
    "/etc/nginx/conf.d/rate-limiting.conf"
    "/etc/nginx/conf.d/security.conf"
    "/etc/nginx/conf.d/main-config.conf"
    "/etc/nginx/sites-available/littledan.com.conf"
)

for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✅ $file exists${NC}"
    else
        echo -e "${YELLOW}⚠️  $file missing${NC}"
    fi
done

echo ""

# Test bot blocking functionality (if nginx is running)
echo "3. Testing bot blocking functionality..."

if systemctl is-active --quiet nginx; then
    echo "Testing bot User-Agent blocking..."

    # Test with a bad bot user agent (should be blocked/no response)
    echo -n "Testing BadBot user agent: "
    if timeout 5 curl -s -o /dev/null -w "%{http_code}" -H "User-Agent: BadBot/1.0" https://littledan.com/ 2>/dev/null | grep -q "000"; then
        echo -e "${GREEN}✅ Blocked (connection terminated)${NC}"
    else
        echo -e "${YELLOW}⚠️  Not blocked (may need nginx reload)${NC}"
    fi

    # Test with a normal user agent (should work)
    echo -n "Testing normal user agent: "
    response=$(timeout 5 curl -s -o /dev/null -w "%{http_code}" -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" https://littledan.com/ 2>/dev/null || echo "000")
    if [[ "$response" =~ ^[23] ]]; then
        echo -e "${GREEN}✅ Allowed ($response)${NC}"
    else
        echo -e "${YELLOW}⚠️  Unexpected response ($response)${NC}"
    fi

    echo ""
    echo "4. Testing rate limiting (if applicable)..."
    echo "Making 10 rapid requests to test rate limiting..."

    rate_limited=0
    for i in {1..10}; do
        response=$(timeout 2 curl -s -o /dev/null -w "%{http_code}" https://littledan.com/ 2>/dev/null || echo "000")
        if [ "$response" = "429" ]; then
            rate_limited=1
            break
        fi
        sleep 0.1
    done

    if [ $rate_limited -eq 1 ]; then
        echo -e "${GREEN}✅ Rate limiting is working (got 429)${NC}"
    else
        echo -e "${YELLOW}⚠️  Rate limiting not triggered (may need higher frequency)${NC}"
    fi

else
    echo -e "${YELLOW}⚠️  Nginx is not running, skipping functionality tests${NC}"
fi

echo ""
echo "5. Configuration Summary:"
echo "   - Bot blocking: Maps User-Agent patterns to block unwanted traffic"
echo "   - Rate limiting: Limits requests per second from single IPs"
echo "   - Security headers: Adds protective HTTP headers"
echo "   - Path blocking: Blocks access to sensitive paths"
echo ""
echo "To monitor bot activity, use:"
echo "   ./nginx/scripts/bot-analysis.sh"
echo ""
echo "To view blocked requests in real-time:"
echo "   sudo tail -f /var/log/nginx/access.log | grep ' 444 '"
echo ""
echo -e "${GREEN}🎉 Configuration test complete!${NC}"

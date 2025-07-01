#!/bin/bash

# nginx-admin.sh - Convenience script for nginx administration
# Usage: ./nginx-admin.sh [command]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if user is in nginx-admins group
if ! groups | grep -q "nginx-admins"; then
    echo -e "${RED}❌ Error: You must be a member of the nginx-admins group to use this script${NC}"
    echo -e "${YELLOW}Ask your administrator to add you: sudo usermod -a -G nginx-admins <username>${NC}"
    exit 1
fi

# Function to show usage
show_usage() {
    echo -e "${BLUE}nginx-admin.sh - Nginx Administration Tool${NC}"
    echo ""
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  start       - Start nginx service"
    echo "  stop        - Stop nginx service"
    echo "  restart     - Restart nginx service"
    echo "  reload      - Reload nginx configuration"
    echo "  status      - Show nginx service status"
    echo "  test        - Test nginx configuration"
    echo "  logs        - Show recent nginx access logs"
    echo "  errors      - Show recent nginx error logs"
    echo "  config      - Show nginx configuration"
    echo "  sites       - List available and enabled sites"
    echo "  enable      - Enable a site (usage: $0 enable <site>)"
    echo "  disable     - Disable a site (usage: $0 disable <site>)"
    echo ""
}

# Main command handling
case "${1:-help}" in
    "start")
        echo -e "${YELLOW}🚀 Starting nginx...${NC}"
        sudo systemctl start nginx
        echo -e "${GREEN}✅ Nginx started${NC}"
        ;;
    "stop")
        echo -e "${YELLOW}⏹️  Stopping nginx...${NC}"
        sudo systemctl stop nginx
        echo -e "${GREEN}✅ Nginx stopped${NC}"
        ;;
    "restart")
        echo -e "${YELLOW}🔄 Restarting nginx...${NC}"
        sudo systemctl restart nginx
        echo -e "${GREEN}✅ Nginx restarted${NC}"
        ;;
    "reload")
        echo -e "${YELLOW}🔄 Reloading nginx configuration...${NC}"
        sudo /usr/sbin/nginx -t && sudo systemctl reload nginx
        echo -e "${GREEN}✅ Nginx configuration reloaded${NC}"
        ;;
    "status")
        echo -e "${BLUE}📊 Nginx service status:${NC}"
        sudo systemctl status nginx --no-pager
        ;;
    "test")
        echo -e "${YELLOW}🧪 Testing nginx configuration...${NC}"
        sudo /usr/sbin/nginx -t
        echo -e "${GREEN}✅ Configuration test passed${NC}"
        ;;
    "logs")
        echo -e "${BLUE}📄 Recent nginx access logs:${NC}"
        tail -20 /var/log/nginx/access.log
        ;;
    "errors")
        echo -e "${BLUE}⚠️  Recent nginx error logs:${NC}"
        tail -20 /var/log/nginx/error.log
        ;;
    "config")
        echo -e "${BLUE}⚙️  Nginx configuration:${NC}"
        sudo /usr/sbin/nginx -T
        ;;
    "sites")
        echo -e "${BLUE}📁 Available sites:${NC}"
        ls -la /etc/nginx/sites-available/
        echo ""
        echo -e "${BLUE}🔗 Enabled sites:${NC}"
        ls -la /etc/nginx/sites-enabled/
        ;;
    "enable")
        if [ -z "$2" ]; then
            echo -e "${RED}❌ Error: Please specify a site to enable${NC}"
            echo "Usage: $0 enable <site>"
            exit 1
        fi
        if [ ! -f "/etc/nginx/sites-available/$2" ]; then
            echo -e "${RED}❌ Error: Site '$2' not found in sites-available${NC}"
            exit 1
        fi
        echo -e "${YELLOW}🔗 Enabling site: $2${NC}"
        ln -sf "/etc/nginx/sites-available/$2" "/etc/nginx/sites-enabled/$2"
        sudo /usr/sbin/nginx -t && sudo systemctl reload nginx
        echo -e "${GREEN}✅ Site '$2' enabled${NC}"
        ;;
    "disable")
        if [ -z "$2" ]; then
            echo -e "${RED}❌ Error: Please specify a site to disable${NC}"
            echo "Usage: $0 disable <site>"
            exit 1
        fi
        if [ ! -L "/etc/nginx/sites-enabled/$2" ]; then
            echo -e "${RED}❌ Error: Site '$2' is not enabled${NC}"
            exit 1
        fi
        echo -e "${YELLOW}🚫 Disabling site: $2${NC}"
        rm "/etc/nginx/sites-enabled/$2"
        sudo /usr/sbin/nginx -t && sudo systemctl reload nginx
        echo -e "${GREEN}✅ Site '$2' disabled${NC}"
        ;;
    "help"|"--help"|"-h")
        show_usage
        ;;
    *)
        echo -e "${RED}❌ Unknown command: $1${NC}"
        echo ""
        show_usage
        exit 1
        ;;
esac

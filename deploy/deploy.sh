#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT=${1:-production}
SKIP_BUILD=${2:-false}
SKIP_BACKEND=${3:-false}
INCREMENTAL_BUILD=${4:-false}

echo -e "${YELLOW}🚀 Starting deployment process for ${ENVIRONMENT}...${NC}"

# Environment-specific configuration
if [ "$ENVIRONMENT" = "dev" ] || [ "$ENVIRONMENT" = "development" ]; then
    DEV_MODE=true
    echo -e "${BLUE}🔧 Development mode enabled${NC}"
else
    DEV_MODE=false
    echo -e "${GREEN}🏭 Production mode${NC}"
fi

# Determine if we're on the target server
if [[ "$(hostname)" == "Danbian" ]]; then
    REMOTE=false
    if [ "$DEV_MODE" = true ]; then
        FRONTEND_DEST="/var/www/localhost-dev/"
        NGINX_SITE="localhost-dev"
        echo -e "${BLUE}📍 Local development deployment${NC}"
    else
        FRONTEND_DEST="/var/www/littledan.com/"
        NGINX_SITE="littledan.com"
        echo -e "${GREEN}📍 Local production deployment${NC}"
    fi
    BACKEND_DEST="/opt/markdown-manager-api/"
    NGINX_DEST="/etc/nginx/sites-available/"
else
    REMOTE=true
    REMOTE_HOST="dlittle@10.0.1.51"
    if [ "$DEV_MODE" = true ]; then
        FRONTEND_DEST="$REMOTE_HOST:/var/www/localhost-dev/"
        NGINX_SITE="localhost-dev"
        echo -e "${BLUE}📍 Remote development deployment${NC}"
    else
        FRONTEND_DEST="$REMOTE_HOST:/var/www/littledan.com/"
        NGINX_SITE="littledan.com"
        echo -e "${GREEN}📍 Remote production deployment${NC}"
    fi
    BACKEND_DEST="$REMOTE_HOST:/opt/markdown-manager-api/"
fi

# Function to check if nginx config has changed
check_nginx_config_changed() {
    if [ "$REMOTE" = true ]; then
        # For remote, always assume changed for now
        return 0
    else
        # Check main site config
        if ! cmp -s "nginx/sites-available/$NGINX_SITE" "/etc/nginx/sites-available/$NGINX_SITE"; then
            return 0  # Files are different
        fi

        # Check conf.d files
        for conffile in nginx/conf.d/*.conf; do
            basename_conf=$(basename "$conffile")
            if [ ! -f "/etc/nginx/conf.d/$basename_conf" ]; then
                return 0  # New file
            fi
            if ! cmp -s "$conffile" "/etc/nginx/conf.d/$basename_conf"; then
                return 0  # Files are different
            fi
        done

        return 1  # All files are the same
    fi
}

# Build frontend
if [ "$SKIP_BUILD" != "true" ]; then
    echo -e "${YELLOW}📦 Building frontend assets...${NC}"
    cd frontend
    npm install
    
    if [ "$INCREMENTAL_BUILD" = "true" ] && [ "$DEV_MODE" = "true" ]; then
        echo -e "${BLUE}⚡ Running incremental build for development...${NC}"
        npm run build:dev
    elif [ "$DEV_MODE" = "true" ]; then
        echo -e "${BLUE}🔧 Running development build...${NC}"
        npm run build:dev
    else
        echo -e "${GREEN}🏭 Running production build...${NC}"
        npm run build:clean
    fi
    
    cd ..
    echo -e "${GREEN}✅ Frontend build completed${NC}"
else
    echo -e "${YELLOW}⏭️  Skipping frontend build${NC}"
fi

# Verify frontend dist directory exists
if [ ! -d "frontend/dist" ]; then
    echo -e "${RED}❌ Error: frontend/dist directory not found. Please run build first.${NC}"
    exit 1
fi

# Deploy frontend
echo -e "${YELLOW}🚀 Deploying frontend...${NC}"
rsync -r --no-perms --no-times --no-group --progress frontend/dist/ "$FRONTEND_DEST"
echo -e "${GREEN}✅ Frontend deployed${NC}"

# Deploy backend
if [ "$SKIP_BACKEND" != "true" ]; then
    echo -e "${YELLOW}🐍 Deploying backend...${NC}"

    if [ "$REMOTE" = true ]; then
        # Remote deployment
        rsync -r --no-perms --no-times --no-group --progress --exclude="__pycache__" --exclude=".venv" backend/ "$BACKEND_DEST"
        echo -e "${BLUE}� Installing backend dependencies remotely...${NC}"
        ssh ${REMOTE_HOST%:*} "cd ${BACKEND_DEST} && poetry install --only=main"
        echo -e "${BLUE}🔄 Restarting backend service remotely...${NC}"
        ssh ${REMOTE_HOST%:*} "sudo systemctl restart markdown-manager-api"
    else
        # Local deployment
        rsync -r --no-perms --no-times --no-group --progress --exclude="__pycache__" --exclude=".venv" backend/ "$BACKEND_DEST"
        cd "$BACKEND_DEST"
        poetry install --only=main
        sudo systemctl restart markdown-manager-api
        cd -
    fi

    echo -e "${GREEN}✅ Backend deployed${NC}"
else
    echo -e "${YELLOW}⏭️  Skipping backend deployment${NC}"
fi

# Deploy nginx config if changed
echo -e "${YELLOW}⚙️  Checking nginx configuration...${NC}"
if check_nginx_config_changed; then
    echo -e "${YELLOW}📝 Nginx config has changed, updating...${NC}"

    if [ "$REMOTE" = true ]; then
        # Remote nginx update
        scp "nginx/sites-available/$NGINX_SITE" "$REMOTE_HOST:/tmp/$NGINX_SITE.new"
        # Copy conf.d files
        for conffile in nginx/conf.d/*.conf; do
            basename_conf=$(basename "$conffile")
            scp "$conffile" "$REMOTE_HOST:/tmp/$basename_conf.new"
            ssh ${REMOTE_HOST%:*} "sudo mv /tmp/$basename_conf.new /etc/nginx/conf.d/$basename_conf"
        done
        ssh ${REMOTE_HOST%:*} "sudo mv /tmp/$NGINX_SITE.new /etc/nginx/sites-available/$NGINX_SITE && sudo ln -sf /etc/nginx/sites-available/$NGINX_SITE /etc/nginx/sites-enabled/ && sudo /usr/sbin/nginx -t && sudo systemctl reload nginx"
    else
        # Local nginx update (nginx-admins group has write permissions)
        sudo cp "nginx/sites-available/$NGINX_SITE" "/etc/nginx/sites-available/$NGINX_SITE"
        sudo ln -sf "/etc/nginx/sites-available/$NGINX_SITE" "/etc/nginx/sites-enabled/"
        # Copy conf.d files
        for conffile in nginx/conf.d/*.conf; do
            basename_conf=$(basename "$conffile")
            sudo cp "$conffile" /etc/nginx/conf.d/$basename_conf
        done
        sudo /usr/sbin/nginx -t
        sudo systemctl reload nginx
    fi

    echo -e "${GREEN}✅ Nginx configuration updated and reloaded${NC}"
else
    echo -e "${BLUE}ℹ️  Nginx configuration unchanged, skipping update${NC}"
fi

# Verify deployment
echo -e "${YELLOW}🔍 Verifying deployment...${NC}"
if [ "$REMOTE" = false ]; then
    if [ -f "$FRONTEND_DEST/index.html" ]; then
        echo -e "${GREEN}✅ Frontend deployment verified${NC}"
    else
        echo -e "${RED}❌ Frontend deployment verification failed${NC}"
        exit 1
    fi

    if [ "$SKIP_BACKEND" != "true" ]; then
        if systemctl is-active --quiet markdown-manager-api; then
            echo -e "${GREEN}✅ Backend service is running${NC}"
        else
            echo -e "${RED}❌ Backend service verification failed${NC}"
            exit 1
        fi
    fi
else
    echo -e "${GREEN}✅ Remote deployment completed${NC}"
fi

echo -e "${GREEN}🎉 Deployment complete!${NC}"
if [ "$DEV_MODE" = true ]; then
    echo -e "${BLUE}📱 Frontend: http://localhost (10.0.1.0/24 network)${NC}"
    echo -e "${BLUE}🔗 API: http://localhost/api/v1/health-check${NC}"
    echo -e "${BLUE}ℹ️  Dev Info: http://localhost/dev-info${NC}"
else
    echo -e "${GREEN}📱 Frontend: https://littledan.com${NC}"
    if [ "$SKIP_BACKEND" != "true" ]; then
        echo -e "${GREEN}🔗 API Health: https://littledan.com/api/v1/health-check${NC}"
    fi
fi

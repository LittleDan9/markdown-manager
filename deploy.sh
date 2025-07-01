#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT=${1:-production}
SKIP_BUILD=${2:-false}

echo -e "${YELLOW}🚀 Starting deployment process for ${ENVIRONMENT}...${NC}"

# Build assets unless skipped
if [ "$SKIP_BUILD" != "true" ]; then
    echo -e "${YELLOW}📦 Building production assets...${NC}"
    npm run build:clean
    echo -e "${GREEN}✅ Build completed successfully${NC}"
else
    echo -e "${YELLOW}⏭️  Skipping build step${NC}"
fi

# Determine deployment destination
echo -e "${YELLOW}🔍 Determining deployment destination...${NC}"
if [[ "$(hostname)" == "Danbian" ]]; then
    destination="/var/www/littledan.com/"
    echo -e "${GREEN}📍 Local deployment to: ${destination}${NC}"
else
    destination="dlittle@10.0.1.51:/var/www/littledan.com/"
    echo -e "${GREEN}📍 Remote deployment to: ${destination}${NC}"
fi

# Verify dist directory exists
if [ ! -d "dist" ]; then
    echo -e "${RED}❌ Error: dist directory not found. Please run build first.${NC}"
    exit 1
fi

# Show what will be deployed
echo -e "${YELLOW}📋 Files to be deployed:${NC}"
ls -la dist/

# Deploy files
echo -e "${YELLOW}🚀 Deploying files...${NC}"
rsync -r --no-perms --no-times --no-group --progress dist/ "$destination"

# Verify deployment
echo -e "${YELLOW}🔍 Verifying deployment...${NC}"
if [[ "$(hostname)" == "Danbian" ]]; then
    if [ -f "$destination/index.html" ]; then
        echo -e "${GREEN}✅ Deployment verified successfully${NC}"
    else
        echo -e "${RED}❌ Deployment verification failed${NC}"
        exit 1
    fi
else
    # For remote deployment, we can't easily verify, so we'll assume success
    echo -e "${GREEN}✅ Remote deployment completed${NC}"
fi

echo -e "${GREEN}🎉 Deployment complete!${NC}"
echo -e "${GREEN}📱 Your application should now be live at your web server${NC}"

#!/usr/bin/env bash

# Setup production environment variables for Markdown Manager
# This script should be run on the production server to ensure
# all required environment variables are present in /etc/markdown-manager.env

source ./scripts/colors.sh

ENV_FILE="/etc/markdown-manager.env"
TEMP_ENV_FILE="/tmp/markdown-manager.env.new"

echo "$BLUE🔧 Setting up production environment variables...$NC"

# Check if we have sudo access
if ! sudo -n true 2>/dev/null; then
    echo "$RED❌ This script requires sudo access to create/update $ENV_FILE$NC"
    exit 1
fi

# Required environment variables for production
declare -A REQUIRED_VARS=(
    ["DATABASE_URL"]="postgresql+asyncpg://postgres:password@localhost:5432/markdown_manager"
    ["EXPORT_SERVICE_URL"]="http://localhost:8001"
    ["MARKDOWN_LINT_SERVICE_URL"]="http://localhost:8002"
    ["ENVIRONMENT"]="production"
    ["GITHUB_CLIENT_ID"]="your-github-client-id"
    ["GITHUB_CLIENT_SECRET"]="your-github-client-secret"
    ["GITHUB_REDIRECT_URI"]="https://yourdomain.com/api/github/auth/callback"
    ["JWT_SECRET_KEY"]="your-production-jwt-secret-key-make-it-long-and-random"
    ["CONTAINER_STORAGE_ROOT"]="/documents"
    ["HOST_STORAGE_ROOT"]="/var/lib/markdown-manager/storage"
    ["MARKDOWN_LINT_PORT"]="8002"
)

# Create or update environment file
echo "$YELLOW📝 Creating/updating environment file...$NC"

# Start with existing file if it exists
if [ -f "$ENV_FILE" ]; then
    echo "$BLUE📋 Preserving existing environment variables...$NC"
    sudo cp "$ENV_FILE" "$TEMP_ENV_FILE"
else
    touch "$TEMP_ENV_FILE"
fi

# Function to update or add a variable
update_env_var() {
    local var_name="$1"
    local default_value="$2"

    if grep -q "^${var_name}=" "$TEMP_ENV_FILE" 2>/dev/null; then
        echo "$GREEN✅ $var_name already exists$NC"
    else
        echo "$YELLOW➕ Adding $var_name with default value$NC"
        echo "${var_name}=${default_value}" >> "$TEMP_ENV_FILE"
    fi
}

# Add/update all required variables
for var_name in "${!REQUIRED_VARS[@]}"; do
    update_env_var "$var_name" "${REQUIRED_VARS[$var_name]}"
done

# Move the temp file to the final location
sudo mv "$TEMP_ENV_FILE" "$ENV_FILE"
sudo chmod 600 "$ENV_FILE"
sudo chown root:root "$ENV_FILE"

echo "$GREEN✅ Environment file updated at $ENV_FILE$NC"
echo ""
echo "$YELLOW⚠️  Please review and update the following variables with your actual values:$NC"
echo "  - DATABASE_URL (database connection string)"
echo "  - GITHUB_CLIENT_ID (GitHub OAuth app client ID)"
echo "  - GITHUB_CLIENT_SECRET (GitHub OAuth app client secret)"
echo "  - GITHUB_REDIRECT_URI (your domain's OAuth callback URL)"
echo "  - JWT_SECRET_KEY (generate a secure random key)"
echo "  - HOST_STORAGE_ROOT (adjust storage path if needed)"
echo ""
echo "$BLUE🔍 Current environment file contents:$NC"
sudo cat "$ENV_FILE"
echo ""
echo "$GREEN🎉 Environment setup complete!$NC"
echo "$YELLOW💡 Remember to restart services after updating environment variables:$NC"
echo "  sudo systemctl restart markdown-manager-api"
echo "  sudo systemctl restart markdown-manager-pdf"
echo "  sudo systemctl restart markdown-manager-lint"
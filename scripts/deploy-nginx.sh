#!/usr/bin/env bash
set -e

source ./scripts/colors.sh

# Default values - initialize properly
REMOTE_USER_HOST="dlittle@10.0.1.51"
KEY="~/.ssh/id_danbian"

# Debug function
debug_vars() {
    echo "$BLUE🔍 Debug Info:$NC"
    echo "  REMOTE_USER_HOST: $REMOTE_USER_HOST"
    echo "  KEY: $KEY"
    echo "  Arguments: $@"
}

# Function to create backup with rotation (keep last 3)
create_backup() {
    local config_file=$1
    local backup_name="${config_file}.backup.$(date +%Y%m%d_%H%M%S)"

    echo "$YELLOW📦 Creating backup: $backup_name$NC"

    ssh -q -T -i $KEY $REMOTE_USER_HOST 'bash -s' <<EOF
        set -e
        config_file="$config_file"
        backup_name="$backup_name"

        if [ -f /etc/nginx/sites-available/\$config_file ]; then
            sudo cp /etc/nginx/sites-available/\$config_file /etc/nginx/sites-available/\$backup_name
            echo "✅ Backup created: \$backup_name"

            # Rotate backups (keep only last 3)
            echo "🗂️  Rotating backups (keeping last 3)..."

            # Get list of backup files (newest first) and remove the old ones (4th and beyond)
            backup_files=\$(sudo ls -1t /etc/nginx/sites-available/\${config_file}.backup.* 2>/dev/null || true)
            if [ -n "\$backup_files" ]; then
                old_backups=\$(echo "\$backup_files" | tail -n +4)
                if [ -n "\$old_backups" ]; then
                    echo "\$old_backups" | xargs -r sudo rm -f
                    echo "Removed old backups: \$(echo "\$old_backups" | wc -l) files"
                else
                    echo "No old backups to remove (only \$(echo "\$backup_files" | wc -l) total backups)"
                fi
            else
                echo "No existing backups found for \$config_file"
            fi
            echo "✅ Backup rotation complete"
        else
            echo "⚠️  No existing \$config_file to backup"
        fi
EOF
}

# Function to deploy a specific nginx config
deploy_config() {
    local config_file=$1
    local description=$2

    echo "$CYAN🚀 Deploying $description configuration...$NC"

    # Check if local config exists
    if [ ! -f "./nginx/sites-available/$config_file" ]; then
        echo "$RED❌ Local config file not found: ./nginx/sites-available/$config_file$NC"
        return 1
    fi

    # Create backup
    create_backup "$config_file"

    # Deploy new config
    echo "$YELLOW📤 Uploading $config_file...$NC"
    scp -q -i $KEY "./nginx/sites-available/$config_file" "$REMOTE_USER_HOST:/tmp/"

    # Copy file to final location and set permissions, then enable
    ssh -q -T -i $KEY $REMOTE_USER_HOST 'bash -s' <<EOF
        set -e
        sudo cp /tmp/$config_file /etc/nginx/sites-available/
        sudo chown root:root /etc/nginx/sites-available/$config_file
        sudo chmod 644 /etc/nginx/sites-available/$config_file
        sudo ln -sf /etc/nginx/sites-available/$config_file /etc/nginx/sites-enabled/
        echo "✅ $config_file deployed and enabled"
EOF
}

# Function to test and reload nginx
reload_nginx() {
    echo "$YELLOW🧪 Testing and reloading nginx...$NC"

    ssh -q -T -i $KEY $REMOTE_USER_HOST 'bash -s' <<EOF
        set -e
        echo "Testing nginx configuration..."
        sudo nginx -t
        echo "Reloading nginx..."
        sudo systemctl reload nginx
        echo "✅ Nginx reloaded"
EOF
}

# Function to deploy frontend nginx config only
deploy_frontend() {
    echo "$BLUE🎨 Deploying frontend nginx configuration...$NC"
    deploy_config "littledan.com.conf" "frontend (littledan.com)"
    reload_nginx

    # Test frontend
    echo "$YELLOW🔍 Testing frontend...$NC"
    if curl -s -I -H "User-Agent: Mozilla/5.0" https://littledan.com | grep -q "200 OK"; then
        echo "$GREEN✅ Frontend responsive$NC"
    else
        echo "$RED❌ Frontend not responding correctly$NC"
        return 1
    fi
}

# Function to deploy API nginx config only (now consolidated in main config)
deploy_api() {
    echo "$BLUE🔌 API configuration is now consolidated in main domain config...$NC"
    deploy_config "littledan.com.conf" "main domain (includes API at /api/*)"
    reload_nginx

    # Test API at new path-based endpoint
    echo "$YELLOW🔍 Testing API at path-based endpoint...$NC"
    if curl -s -H "User-Agent: Mozilla/5.0" https://littledan.com/api/health | grep -q '"status":"healthy"'; then
        echo "$GREEN✅ API health check passed (path-based)$NC"
    else
        echo "$RED❌ API health check failed (path-based)$NC"
        return 1
    fi
}

# Function to deploy all nginx configs
deploy_all() {
    echo "$CYAN🌐 Deploying consolidated nginx configuration...$NC"

    # Check remote host connectivity
    echo "$YELLOW🔍 Checking remote host connectivity...$NC"
    if ! ssh -q -T -i "$KEY" "$REMOTE_USER_HOST" "echo 'Connection successful'"; then
        echo "$RED❌ Cannot connect to remote host$NC"
        return 1
    fi

    # Deploy main config (now includes API)
    deploy_config "littledan.com.conf" "main domain (frontend + API)"

    # Disable old API subdomain if it exists
    echo "$YELLOW🔧 Disabling old API subdomain configuration if it exists...$NC"
    ssh -q -T -i $KEY $REMOTE_USER_HOST 'bash -s' <<'EOF'
        if [ -L /etc/nginx/sites-enabled/api.littledan.com.conf ]; then
            sudo rm /etc/nginx/sites-enabled/api.littledan.com.conf
            echo "✅ Disabled old api.littledan.com.conf symlink"
        else
            echo "ℹ️  No old api.littledan.com.conf symlink found (already disabled)"
        fi
EOF

    # Reload nginx
    reload_nginx

    # Clean up old backup files from previous naming convention
    echo "$YELLOW🧹 Cleaning up old backup files...$NC"
    ssh -q -T -i $KEY $REMOTE_USER_HOST 'bash -s' <<'EOF'
        cd /etc/nginx/sites-available/
        # Remove old backup files that don't follow the new naming convention
        sudo find . -name "littledan.com.backup.*" -type f -delete 2>/dev/null || true
        sudo find . -name "api.littledan.com.backup.*" -type f -delete 2>/dev/null || true
        echo "✅ Old backup cleanup complete"
EOF

    # Comprehensive testing
    test_deployment
}

# Function to test the full deployment
test_deployment() {
    echo "$CYAN🧪 Running comprehensive deployment tests...$NC"

    # Test main domain
    echo "$YELLOW🔍 Testing main domain (littledan.com)...$NC"
    if curl -s -I -H "User-Agent: Mozilla/5.0" https://littledan.com | grep -q "200 OK"; then
        echo "$GREEN✅ Main domain responsive$NC"
    else
        echo "$RED❌ Main domain not responding correctly$NC"
    fi

    # Test API at new path-based endpoint
    echo "$YELLOW🔍 Testing API at path-based endpoint (/api/health)...$NC"
    if curl -s -H "User-Agent: Mozilla/5.0" https://littledan.com/api/health | grep -q '"status":"healthy"'; then
        echo "$GREEN✅ API health check passed (path-based)$NC"
    else
        echo "$RED❌ API health check failed (path-based)$NC"
    fi

    # Test that old API subdomain redirects are working (if any remain)
    echo "$YELLOW🔍 Testing old API subdomain handling...$NC"
    api_subdomain_response=$(curl -s -I -H "User-Agent: Mozilla/5.0" https://api.littledan.com/health 2>/dev/null || echo "FAILED")
    if echo "$api_subdomain_response" | grep -q "301\|302"; then
        echo "$GREEN✅ Old API subdomain properly redirects$NC"
    elif echo "$api_subdomain_response" | grep -q "FAILED"; then
        echo "$GREEN✅ Old API subdomain disabled (expected)$NC"
    else
        echo "$YELLOW⚠️  Old API subdomain still responding directly$NC"
    fi

    # Show deployment summary
    echo "$CYAN📊 Deployment Summary:$NC"
    echo "  🌐 Frontend: https://littledan.com"
    echo "  🔌 API: https://littledan.com/api/*"
    echo "  🛡️  Rate limiting: Enabled with burst controls"
    echo "  🔒 Security headers: Applied to main domain"
    echo "  📋 Architecture: Same-domain serving with path-based API routing"
}

# Function to show currently enabled sites
show_status() {
    echo "$CYAN📋 Current nginx site status:$NC"

    ssh -q -T -i $KEY $REMOTE_USER_HOST 'bash -s' <<'EOF'
        echo "Sites available:"
        cd /etc/nginx/sites-available
        files=$(ls -1 | grep "littledan.*\.conf$" | grep -v "\.backup\." || true)
        if [ -n "$files" ]; then
            echo "$files" | sed 's/^/  /'
        else
            echo "  No littledan sites found"
        fi

        echo ""
        echo "Sites enabled:"
        cd /etc/nginx/sites-enabled
        files=$(ls -1 | grep "littledan.*\.conf$" || true)
        if [ -n "$files" ]; then
            echo "$files" | sed 's/^/  /'
        else
            echo "  No littledan sites enabled"
        fi

        echo ""
        echo "Old API subdomain status:"
        if [ -f /etc/nginx/sites-available/api.littledan.com.conf ]; then
            echo "  api.littledan.com.conf: Available (backed up)"
        else
            echo "  api.littledan.com.conf: Not found"
        fi
        if [ -L /etc/nginx/sites-enabled/api.littledan.com.conf ]; then
            echo "  api.littledan.com.conf: ENABLED (should be disabled)"
        else
            echo "  api.littledan.com.conf: Disabled (correct)"
        fi
EOF
}

# Function to clean up old backups manually
cleanup_backups() {
    echo "$YELLOW🧹 Cleaning up old backup files...$NC"

    ssh -q -T -i $KEY $REMOTE_USER_HOST 'bash -s' <<'EOF'
        set -e
        cd /etc/nginx/sites-available/

        echo "Current backup files:"
        ls -la *.backup.* 2>/dev/null || echo "No backup files found"

        echo ""
        echo "Keeping only the 3 most recent backups for each config..."

        # Clean up littledan.com.conf backups
        if ls littledan.com.conf.backup.* >/dev/null 2>&1; then
            echo "Processing littledan.com.conf backups..."
            backup_files=$(sudo ls -1t littledan.com.conf.backup.* 2>/dev/null || true)
            if [ -n "$backup_files" ]; then
                echo "$backup_files" | tail -n +4 | while read file; do
                    if [ -n "$file" ]; then
                        sudo rm -f "$file"
                        echo "Removed: $file"
                    fi
                done
            fi
        else
            echo "No littledan.com.conf backups to clean"
        fi

        # Clean up old api.littledan.com.conf backups (deprecated)
        if ls api.littledan.com.conf.backup.* >/dev/null 2>&1; then
            echo "Processing deprecated api.littledan.com.conf backups..."
            backup_files=$(sudo ls -1t api.littledan.com.conf.backup.* 2>/dev/null || true)
            if [ -n "$backup_files" ]; then
                echo "$backup_files" | while read file; do
                    if [ -n "$file" ]; then
                        sudo rm -f "$file"
                        echo "Removed deprecated backup: $file"
                    fi
                done
            fi
        else
            echo "No deprecated api.littledan.com.conf backups to clean"
        fi

        echo ""
        echo "Remaining backup files:"
        ls -la *.backup.* 2>/dev/null || echo "No backup files remaining"
EOF
}

# Help function
show_help() {
    echo "$CYAN📖 Nginx Deployment Script Usage:$NC"
    echo ""
    echo "$YELLOW  ./scripts/deploy-nginx.sh [REMOTE_HOST]$NC"
    echo ""
    echo "$BLUE  Functions available:$NC"
    echo "    deploy_frontend  - Deploy frontend nginx config (same as deploy_all)"
    echo "    deploy_api      - Deploy consolidated config (same as deploy_all)"
    echo "    deploy_all      - Deploy consolidated nginx config (default)"
    echo "    test_deployment - Test current deployment"
    echo "    show_status     - Show current nginx site status"
    echo "    cleanup_backups - Clean up old backup files"
    echo ""
    echo "$BLUE  Examples:$NC"
    echo "    ./scripts/deploy-nginx.sh"
    echo "    ./scripts/deploy-nginx.sh dlittle@10.0.1.51"
    echo ""
    echo "$BLUE  Integration with make:$NC"
    echo "    make deploy-nginx-frontend"
    echo "    make deploy-nginx-api"
    echo "    make deploy-nginx-all"
    echo ""
    echo "$GREEN  Note: API is now served from same domain at /api/* path$NC"
}

# Main execution logic
if [ $# -eq 0 ]; then
    # No arguments - deploy all
    deploy_all
else
    # Check if first argument is a function name
    case "$1" in
        deploy_frontend|deploy_api|deploy_all|test_deployment|show_status|cleanup_backups)
            # Shift to get remote host from second argument if provided
            COMMAND=$1
            shift
            if [ $# -gt 0 ]; then
                REMOTE_USER_HOST=$1
            fi
            $COMMAND
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            # Assume it's a remote host and deploy all
            REMOTE_USER_HOST=$1
            deploy_all
            ;;
    esac
fi

#!/bin/bash
# Script to configure sudoers for Ansible deployment
# Run this on Danbian as root or with sudo

cat > /etc/sudoers.d/ansible-deploy << 'EOF'
# Ansible deployment permissions for dlittle user
# More permissive for deployment simplicity while maintaining security

# General system operations needed for deployment
dlittle ALL=(ALL) NOPASSWD: /bin/systemctl *
dlittle ALL=(ALL) NOPASSWD: /bin/mkdir *
dlittle ALL=(ALL) NOPASSWD: /bin/chmod *
dlittle ALL=(ALL) NOPASSWD: /bin/chown *
dlittle ALL=(ALL) NOPASSWD: /usr/bin/tee *
dlittle ALL=(ALL) NOPASSWD: /bin/cp *
dlittle ALL=(ALL) NOPASSWD: /bin/rm *
dlittle ALL=(ALL) NOPASSWD: /bin/mv *
dlittle ALL=(ALL) NOPASSWD: /usr/bin/nginx *
dlittle ALL=(ALL) NOPASSWD: /usr/bin/apt-get *
EOF

# Set proper permissions on sudoers file
chmod 440 /etc/sudoers.d/ansible-deploy

# Test the sudoers file
visudo -c -f /etc/sudoers.d/ansible-deploy

if [ $? -eq 0 ]; then
    echo "✅ Sudoers configuration created successfully"
    echo "dlittle user now has passwordless sudo for Ansible deployment operations"
else
    echo "❌ Error in sudoers configuration - please check syntax"
    rm /etc/sudoers.d/ansible-deploy
    exit 1
fi
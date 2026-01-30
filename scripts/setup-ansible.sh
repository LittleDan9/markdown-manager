#!/bin/bash
# Ansible Installation and Setup Script for Markdown Manager

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔧 Markdown Manager Ansible Setup${NC}"
echo "======================================"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to get OS information
get_os_info() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        if command_exists lsb_release; then
            OS_ID=$(lsb_release -si | tr '[:upper:]' '[:lower:]')
            OS_VERSION=$(lsb_release -sr)
        elif [[ -f /etc/os-release ]]; then
            . /etc/os-release
            OS_ID=$(echo "$ID" | tr '[:upper:]' '[:lower:]')
            OS_VERSION="$VERSION_ID"
        else
            OS_ID="linux"
            OS_VERSION="unknown"
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        OS_ID="macos"
        OS_VERSION=$(sw_vers -productVersion)
    else
        OS_ID="unknown"
        OS_VERSION="unknown"
    fi
}

# Check if Ansible is installed and get version
check_ansible() {
    if command_exists ansible-playbook; then
        ANSIBLE_VERSION=$(ansible-playbook --version | head -n1 | grep -o '[0-9]\+\.[0-9]\+\.[0-9]\+')
        echo -e "${GREEN}✅ Ansible found: v${ANSIBLE_VERSION}${NC}"
        
        # Check if version is sufficient
        # Ansible 2.9+ or 8.0+ are both acceptable (versioning scheme changed)
        if python3 -c "
import sys
version = '${ANSIBLE_VERSION}'.split('.')
major, minor = int(version[0]), int(version[1])
# Accept Ansible 2.9+ or 8.0+
if (major == 2 and minor >= 9) or major >= 8:
    sys.exit(0)
else:
    sys.exit(1)
" 2>/dev/null; then
            echo -e "${GREEN}✅ Ansible version is sufficient (${ANSIBLE_VERSION})${NC}"
            return 0
        else
            echo -e "${YELLOW}⚠️  Ansible version ${ANSIBLE_VERSION} found, but >= 2.9 or >= 8.0 required${NC}"
            return 1
        fi
    else
        echo -e "${YELLOW}⚠️  Ansible not found${NC}"
        return 1
    fi
}

# Install Ansible based on OS
install_ansible() {
    get_os_info
    echo -e "${BLUE}📦 Installing Ansible for ${OS_ID}...${NC}"
    
    case "$OS_ID" in
        ubuntu|debian)
            echo "Installing Ansible via apt..."
            echo -e "${YELLOW}This requires sudo access to install system packages.${NC}"
            read -p "Continue with installation? (y/N): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                sudo apt update
                # Try pipx first (recommended for externally managed environments)
                if command_exists pipx || sudo apt install -y pipx; then
                    echo "Installing Ansible via pipx..."
                    sudo pipx install --global ansible
                    sudo apt install -y python3-docker python3-requests
                elif command_exists python3 && command_exists pip3; then
                    echo "Installing Ansible via pip3 with --break-system-packages..."
                    sudo apt install -y python3-pip python3-venv
                    sudo pip3 install --break-system-packages ansible docker requests
                else
                    # Fallback to apt packages
                    echo "Installing Ansible via apt packages..."
                    sudo apt install -y ansible python3-docker python3-requests
                fi
            else
                echo -e "${RED}❌ Installation cancelled${NC}"
                exit 1
            fi
            ;;
        fedora|rhel|centos|rocky|almalinux)
            echo "Installing Ansible via dnf/yum..."
            echo -e "${YELLOW}This requires sudo access to install system packages.${NC}"
            read -p "Continue with installation? (y/N): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                if command_exists dnf; then
                    sudo dnf install -y ansible python3-docker python3-requests
                else
                    sudo yum install -y ansible python3-docker python3-requests
                fi
            else
                echo -e "${RED}❌ Installation cancelled${NC}"
                exit 1
            fi
            ;;
        macos)
            if command_exists brew; then
                echo "Installing Ansible via Homebrew..."
                brew install ansible
                pip3 install docker requests
            else
                echo -e "${YELLOW}Homebrew not found. Installing via pip...${NC}"
                echo -e "${YELLOW}This may require sudo for system-wide installation.${NC}"
                read -p "Install system-wide with sudo? (y/N): " -n 1 -r
                echo
                if [[ $REPLY =~ ^[Yy]$ ]]; then
                    sudo pip3 install ansible docker requests
                else
                    echo "Installing in user space..."
                    pip3 install --user ansible docker requests
                fi
            fi
            ;;
        *)
            echo -e "${YELLOW}Unsupported OS: ${OS_ID}. Attempting pip installation...${NC}"
            echo -e "${YELLOW}This may require sudo for system-wide installation.${NC}"
            read -p "Install system-wide with sudo? (y/N): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                sudo pip3 install ansible docker requests
            else
                echo "Installing in user space..."
                pip3 install --user ansible docker requests
            fi
            ;;
    esac
}

# Install Ansible collections
install_collections() {
    echo -e "${BLUE}📚 Installing Ansible collections...${NC}"
    ansible-galaxy collection install community.docker ansible.posix --force
}

# Verify installation
verify_installation() {
    echo -e "${BLUE}🔍 Verifying installation...${NC}"
    
    if ! command_exists ansible-playbook; then
        echo -e "${RED}❌ Ansible installation failed${NC}"
        exit 1
    fi
    
    ANSIBLE_VERSION=$(ansible-playbook --version | head -n1 | grep -o '[0-9]\+\.[0-9]\+\.[0-9]\+')
    echo -e "${GREEN}✅ Ansible v${ANSIBLE_VERSION} installed successfully${NC}"
    
    # Test collections
    if ansible-galaxy collection list | grep -q "community.docker"; then
        echo -e "${GREEN}✅ community.docker collection available${NC}"
    else
        echo -e "${YELLOW}⚠️  community.docker collection not found${NC}"
    fi
    
    if ansible-galaxy collection list | grep -q "ansible.posix"; then
        echo -e "${GREEN}✅ ansible.posix collection available${NC}"
    else
        echo -e "${YELLOW}⚠️  ansible.posix collection not found${NC}"
    fi
}

# Main execution
main() {
    echo -e "${BLUE}Checking Ansible installation...${NC}"
    
    if check_ansible; then
        echo -e "${GREEN}✅ Ansible is ready for deployment${NC}"
        exit 0
    fi
    
    echo -e "${YELLOW}Installing Ansible...${NC}"
    install_ansible
    
    echo -e "${BLUE}Installing required collections...${NC}"
    install_collections
    
    echo -e "${BLUE}Verifying installation...${NC}"
    verify_installation
    
    echo -e "${GREEN}🎉 Ansible setup complete!${NC}"
    echo -e "${BLUE}You can now run: make deploy-ansible${NC}"
}

# Run main function
main "$@"
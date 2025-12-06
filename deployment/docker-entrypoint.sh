# Docker entrypoint script removed - using native Ansible deployment
#
# SSH key handling is now managed by the native Ansible installation
# which has direct access to ~/.ssh/id_danbian without container complexity
#
# No need for:
# - SSH key copying/permission fixing
# - Container-specific environment variables
# - Entrypoint wrapper scripts
#
# Native deployment uses standard Ansible SSH configuration
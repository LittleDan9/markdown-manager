#!/usr/bin/env bash
# ==============================================================================
# DEPRECATED — Infrastructure has moved to platform-manager
# ==============================================================================
# This script is no longer used. Shared infrastructure (db, redis, ollama,
# clamav, traefik, embedding) now lives in the platform-manager repo:
#
#   cd /opt/platform-manager && ./scripts/deploy-infra.sh
#
# This file is kept for reference during the migration period.
# ==============================================================================
echo "ERROR: This script is deprecated. Use platform-manager/scripts/deploy-infra.sh instead."
exit 1

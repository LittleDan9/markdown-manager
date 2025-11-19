# ==============================================================================
# Base image for Playwright with Ubuntu + Python
# ==============================================================================

FROM ubuntu:24.04

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive \
    PLAYWRIGHT_BROWSERS_PATH=/opt/playwright/browsers \
    PYTHONUNBUFFERED=1

# Install Python 3.12, pip, pipx, and system dependencies (default Python in Ubuntu 24.04)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-venv \
    python3-dev \
    python3-pip \
    pipx \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Create symlinks for python commands
RUN ln -s /usr/bin/python3 /usr/bin/python

# Install Poetry using pipx
RUN pipx install poetry && pipx ensurepath

# Add pipx binaries to PATH
ENV PATH="/root/.local/bin:$PATH"

# Install Playwright in a dedicated venv
RUN python -m venv /opt/playwright && \
    /opt/playwright/bin/pip install --upgrade pip && \
    /opt/playwright/bin/pip install playwright

# Install Playwright system dependencies and Chromium browser
RUN /opt/playwright/bin/playwright install-deps chromium && \
    /opt/playwright/bin/playwright install chromium
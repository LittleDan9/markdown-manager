# ==============================================================================
# Multi-stage build: Export Service with Playwright - Ubuntu base
# ==============================================================================

# Stage 1: Build dependencies and virtual environment with Ubuntu + Python
FROM ubuntu:24.04 AS python-base

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive \
    POETRY_VIRTUALENVS_CREATE=true \
    POETRY_VIRTUALENVS_IN_PROJECT=true \
    POETRY_NO_INTERACTION=1 \
    POETRY_CACHE_DIR=/tmp/poetry_cache \
    PLAYWRIGHT_BROWSERS_PATH=/opt/playwright/browsers \
    PYTHONUNBUFFERED=1

# Install Python 3.12, pipx, and system dependencies (default Python in Ubuntu 24.04)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-venv \
    python3-dev \
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

# Set working directory
WORKDIR /export-service

# Copy dependency files first (for better layer caching)
COPY ./pyproject.toml ./poetry.lock ./

# Install Python dependencies in virtual environment
RUN poetry config virtualenvs.in-project true && \
    poetry config virtualenvs.create true && \
    poetry install --no-root --without=dev && \
    rm -rf $POETRY_CACHE_DIR

# Verify virtual environment was created correctly
RUN ls -la /export-service/.venv/bin/ && \
    /export-service/.venv/bin/python --version && \
    /export-service/.venv/bin/uvicorn --version

# Install Playwright Chromium browser
RUN /export-service/.venv/bin/playwright install chromium

# Stage 2: Ubuntu runtime with copied Python and virtual environment
FROM ubuntu:24.04

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive \
    PLAYWRIGHT_BROWSERS_PATH=/opt/playwright/browsers \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/export-service

# Install minimal runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Create symlinks for python commands
RUN ln -s /usr/bin/python3 /usr/bin/python

# Copy virtual environment and Playwright browsers from build stage
COPY --from=python-base /export-service/.venv /export-service/.venv
COPY --from=python-base /opt/playwright/browsers /opt/playwright/browsers

# Install Playwright system dependencies for Chromium in runtime stage
RUN /export-service/.venv/bin/playwright install-deps chromium

WORKDIR /export-service

# Copy application files
COPY ./app /export-service/app
COPY ./static /export-service/static
COPY ./configs /export-service/configs

# Create non-root user for security
RUN groupadd -r exportservice && useradd -r -g exportservice exportservice && \
    chown -R exportservice:exportservice /export-service
USER exportservice

# Expose port
EXPOSE 8001

# Health check - use virtual environment python
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD /export-service/.venv/bin/python -c "import sys,requests; r=requests.get('http://localhost:8001/health', timeout=8); r.raise_for_status(); sys.exit(0)"

# Production-optimized CMD with proper signal handling
CMD ["/export-service/.venv/bin/uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "1", "--access-log", "--log-level", "info"]
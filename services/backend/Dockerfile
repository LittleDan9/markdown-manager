# ==============================================================================
# Multi-stage build: Clean backend without Playwright
# ==============================================================================

# Stage 1: Build dependencies and virtual environment with Python 3.13
FROM python:3.13-slim AS python-base

# Set Poetry environment variables for the build stage
ENV POETRY_VIRTUALENVS_CREATE=true \
    POETRY_VIRTUALENVS_IN_PROJECT=true \
    POETRY_NO_INTERACTION=1 \
    POETRY_CACHE_DIR=/tmp/poetry_cache

# Install Poetry
RUN pip install --no-cache-dir poetry

# Set working directory to match final container path
WORKDIR /markdown-manager

# Copy dependency files first (for better layer caching)
COPY ./pyproject.toml ./poetry.lock ./

# Install Python dependencies in virtual environment
# Create venv in the same path as it will be in the final container
RUN poetry config virtualenvs.in-project true && \
    poetry config virtualenvs.create true && \
    poetry install --no-root --without=dev && \
    rm -rf $POETRY_CACHE_DIR

# Verify virtual environment was created correctly
RUN ls -la /markdown-manager/.venv/bin/ && \
    /markdown-manager/.venv/bin/python --version && \
    which pip && \
    /markdown-manager/.venv/bin/alembic --version && \
    /markdown-manager/.venv/bin/uvicorn --version

# Stage 2: Python runtime with copied virtual environment
FROM python:3.13-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONPATH=/markdown-manager

# Copy virtual environment from build stage
COPY --from=python-base /markdown-manager/.venv /markdown-manager/.venv

# Install minimal runtime dependencies including git
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /markdown-manager

# Copy application files (in order of change frequency for better caching)
COPY ./alembic.ini /markdown-manager/
COPY ./migrations/env.py /markdown-manager/migrations/
COPY ./migrations/versions/ /markdown-manager/migrations/versions/
COPY ./scripts/entrypoint.sh /markdown-manager/
COPY ./app /markdown-manager/app

# Set executable permissions
RUN chmod +x /markdown-manager/entrypoint.sh

# Create non-root user for security and setup directories
RUN groupadd -r markdown && useradd -r -g markdown markdown && \
    mkdir -p /markdown-manager/documents && \
    mkdir -p /documents && \
    chown -R markdown:markdown /markdown-manager && \
    chown -R markdown:markdown /documents
USER markdown

# Expose port
EXPOSE 8000

# Health check - use virtual environment python
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD /markdown-manager/.venv/bin/python -c "import sys,requests; r=requests.get('http://localhost:8000/health', timeout=5); r.raise_for_status(); sys.exit(0)"


ENTRYPOINT ["/markdown-manager/entrypoint.sh"]
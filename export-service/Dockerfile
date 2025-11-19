# ==============================================================================
# Single-stage build: Export Service with Playwright Base
# ==============================================================================

FROM markdown-manager/playwright-base:latest

# Set environment variables
ENV POETRY_VIRTUALENVS_CREATE=true \
    POETRY_VIRTUALENVS_IN_PROJECT=true \
    POETRY_NO_INTERACTION=1 \
    POETRY_CACHE_DIR=/tmp/poetry_cache \
    PYTHONPATH=/export-service

# Set working directory
WORKDIR /export-service

# Copy dependency files first (for better layer caching)
COPY ./pyproject.toml ./poetry.lock ./

# Install Python dependencies in virtual environment
RUN poetry install --no-root --without=dev && \
    rm -rf $POETRY_CACHE_DIR

# Copy application files
COPY ./app /export-service/app
COPY ./static /export-service/static

# Create non-root user for security
RUN groupadd -r exportservice && useradd -r -g exportservice exportservice && \
    chown -R exportservice:exportservice /export-service
USER exportservice

# Expose port
EXPOSE 8001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD python -c "import sys,requests; r=requests.get('http://localhost:8001/health', timeout=5); r.raise_for_status(); sys.exit(0)"

CMD ["/export-service/.venv/bin/uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]

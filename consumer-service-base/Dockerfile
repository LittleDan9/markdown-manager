FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Poetry
RUN pip install poetry

# Copy poetry files for base consumer
COPY consumer-service-base/pyproject.toml consumer-service-base/poetry.lock* ./

# Configure poetry to not create virtual environment
RUN poetry config virtualenvs.create false

# Install dependencies
RUN poetry install --only=main --no-root

# Install events-core directly from wheel
COPY packages/events-core/dist/events_core-1.0.0-py3-none-any.whl ./
RUN pip install events_core-1.0.0-py3-none-any.whl && rm events_core-1.0.0-py3-none-any.whl

# Copy application code
COPY consumer-service-base/app/ ./app/
COPY consumer-service-base/main.py ./
COPY consumer-service-base/README.md ./

# Create config directory for service-specific configs
RUN mkdir -p /app/config

# Create non-root user
RUN useradd --create-home --shell /bin/bash app && \
    chown -R app:app /app
USER app

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD python -c "import sys; sys.exit(0)"

# Run the application
CMD ["python", "main.py"]
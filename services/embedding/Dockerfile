FROM python:3.11-slim

WORKDIR /embedding

# System dependencies (no gcc needed for CPU torch wheels)
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Install Poetry
RUN pip install poetry

# Copy dependency files
COPY pyproject.toml poetry.lock* ./

# Install dependencies — no virtualenv inside container
RUN poetry config virtualenvs.create false \
    && poetry install --only=main --no-interaction --no-ansi

# Copy application code
COPY app/ ./app/

ENV PYTHONPATH=/embedding
ENV PYTHONUNBUFFERED=1

HEALTHCHECK --interval=30s --timeout=30s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8005/health || exit 1

# Use 1 worker — model is a singleton; multiple workers waste memory
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8005", "--workers", "1"]

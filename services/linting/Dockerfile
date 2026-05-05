FROM node:20-slim

# Install curl for health checks
RUN --mount=type=secret,id=ca-cert,required=false \
    if [ -f /run/secrets/ca-cert ]; then \
      mkdir -p /etc/ssl/certs; \
      cat /run/secrets/ca-cert >> /etc/ssl/certs/ca-certificates.crt; \
    fi && \
    apt-get update && apt-get install -y curl && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN --mount=type=secret,id=ca-cert,required=false \
    if [ -f /run/secrets/ca-cert ]; then \
      mkdir -p /etc/ssl/certs; \
      cat /run/secrets/ca-cert >> /etc/ssl/certs/ca-certificates.crt; \
      export NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt; \
    fi && \
    npm install

# Copy application code and configuration files
COPY server.js ./
COPY rules-definitions.json ./
COPY recommended-defaults.json ./

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8002/health || exit 1

# Expose port
EXPOSE 8002

# Start the application
CMD ["npm", "start"]
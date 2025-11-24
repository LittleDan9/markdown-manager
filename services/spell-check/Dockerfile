# Spell Check Service Dockerfile
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install system dependencies for better performance
RUN apk add --no-cache \
    curl \
    && rm -rf /var/cache/apk/*

# Copy package files
COPY package*.json ./

# Install dependencies (include dev dependencies in development)
RUN if [ "$NODE_ENV" = "production" ]; then \
        npm ci --only=production && npm cache clean --force; \
    else \
        npm ci && npm cache clean --force; \
    fi

# Copy application code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S spellcheck -u 1001

# Change ownership of the app directory
RUN chown -R spellcheck:nodejs /app
USER spellcheck

# Expose the port
EXPOSE 8003

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:8003/health || exit 1

# Start the service
CMD ["npm", "start"]
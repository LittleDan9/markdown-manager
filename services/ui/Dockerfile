# ==============================================================================
# Multi-stage build: React UI → static files
# ==============================================================================
# Stage 1: Install deps and build production bundle
# Stage 2: Copy built files to /output volume (consumed by nginx container)
# ==============================================================================

FROM node:24-slim AS build

WORKDIR /app

# Copy dependency manifests first for layer caching
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy source
COPY . .

# Build production bundle
RUN npm run build

# ==============================================================================
# Stage 2: Copy built files to output
# ==============================================================================
FROM alpine:3.20 AS output

# Copy built files from build stage
COPY --from=build /app/dist /dist

# Clean old files and copy fresh build to the output volume mount point
CMD ["sh", "-c", "rm -rf /output/* && cp -a /dist/. /output/"]

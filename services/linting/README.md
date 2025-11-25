# Markdown Lint Service

A simple Node.js Express HTTP server for markdown linting using the markdownlint library. This service provides REST API endpoints for processing markdown content and returning linting issues.

## Overview

This service is part of the Markdown Manager's linting system, designed to provide real-time markdown syntax validation with configurable rules. It eliminates the complexity of subprocess calls by directly using the markdownlint Node.js library.

## Architecture

**Before (Complex):**

```text
Frontend → Backend FastAPI → Markdown-Lint FastAPI → subprocess → markdownlint CLI → Node.js
```

**After (Simple):**

```text
Frontend → Backend FastAPI → HTTP call → Node.js Express → markdownlint library
```

## API Endpoints

### Health Check

- **GET** `/health`
- Returns service health status

### Process Markdown Content

- **POST** `/lint`
- Body: `{ text: string, rules: object, chunk_offset?: number }`
- Returns: `{ issues: array, processed_length: number, rule_count: number }`

### Get Rule Definitions

- **GET** `/rules/definitions`
- Returns: `{ rules: object }` - Complete markdownlint rule definitions

## Development

### Local Development

```bash
npm install
npm run dev  # Uses nodemon for hot reload
```

### Docker Development

```bash
docker compose up --build markdown-lint-service
```

## Configuration

- **PORT**: Default 8002, configurable via `MARKDOWN_LINT_PORT` environment variable
- **NODE_ENV**: Set to `development` for additional logging

## Dependencies

- **express**: HTTP server framework
- **markdownlint**: Core markdown linting library
- **cors**: Cross-origin request support
- **nodemon**: Development hot reload (dev dependency)

## Integration

This service integrates with the main Markdown Manager backend via HTTP requests. The backend FastAPI service acts as a proxy, forwarding requests to this Node.js service for processing.

## Performance

- **Direct Library Access**: No subprocess overhead
- **Memory Efficient**: Node.js event loop handles concurrent requests
- **Hot Reload**: Development mode supports live code updates
- **Health Checks**: Built-in monitoring and Docker health checks

# Spell Check Service

A Node.js Express HTTP server for advanced spell checking, grammar analysis, and style suggestions. This service provides REST API endpoints for processing markdown content with enterprise-grade writing assistance features.

## Overview

This service is part of the Markdown Manager's enhanced writing assistance system, designed to provide real-time spell checking, grammar analysis, and style suggestions. It eliminates browser limitations by leveraging the full Node.js ecosystem.

## Architecture

**Before (Browser-Limited):**
```text
Frontend → Web Workers → nspell (limited) → Basic spell checking only
```

**After (Backend-Enhanced):**
```text
Frontend → Backend FastAPI → HTTP call → Node.js Express → Advanced NLP libraries
```

## Features

### Phase 1 (Current)
- ✅ Basic spell checking with nspell
- ✅ English (US) dictionary support
- ✅ Custom word integration
- ✅ RESTful API endpoints
- ✅ Docker containerization

### Phase 2+ (Planned)
- Grammar checking with retext
- Style analysis with write-good
- Multi-language support (10+ languages)
- Contextual suggestions with NLP
- Readability metrics
- Enterprise features (custom dictionaries, style guides)

## API Endpoints

### Health Check
- **GET** `/health`
- Returns service health status and version

### Basic Spell Check
- **POST** `/check`
- Body: `{ text: string, customWords?: string[], chunk_offset?: number }`
- Returns: `{ results: { spelling: array }, processingTime: number, statistics: object }`

## Development

### Local Development
```bash
npm install
npm run dev  # Uses nodemon for hot reload
```

### Docker Development
```bash
docker compose up --build spell-check-service
```

## Configuration

- **PORT**: Default 8003, configurable via `SPELL_CHECK_PORT` environment variable
- **NODE_ENV**: Set to `development` for additional logging
- **DICTIONARY_PATH**: Path to dictionary files (default: ./dictionaries)

## Dependencies

- **express**: HTTP server framework
- **nspell**: Fast Hunspell spell checker
- **dictionary-en-us**: English US dictionary
- **cors**: Cross-origin request support
- **nodemon**: Development hot reload (dev dependency)

## Integration

This service integrates with the main Markdown Manager backend via HTTP requests. The backend FastAPI service acts as a proxy, forwarding requests to this Node.js service for processing.

## Performance

Phase 1 targets:
- **Small Text (1KB)**: <100ms response time
- **Medium Text (10KB)**: <300ms response time
- **Memory Usage**: <100MB total service footprint
- **Dictionary Loading**: Pre-loaded at startup (no per-request overhead)

## Development Status

**Phase 1: Foundation Service** ✅ In Progress
- [x] Service skeleton created
- [x] Package.json with dependencies
- [ ] Express server implementation
- [ ] Basic spell checking functionality
- [ ] Docker integration
- [ ] Backend service integration
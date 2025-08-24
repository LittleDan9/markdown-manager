# Phase 2: Icon Extraction & Data Population

## Overview

Phase 2 builds upon the database foundation from Phase 1 by implementing the icon extraction system. This phase extracts icon data from Node.js packages (AWS icons and Iconify), processes them into a consistent format, and populates the database with actual icon metadata.

## Objectives

- Extract icons from Node.js packages (aws-icons, @iconify-json/*)
- Process AWS SVG files and Iconify JSON data into normalized format
- Create multi-stage Docker build for icon extraction
- Populate PostgreSQL database with extracted icon metadata
- Implement data validation and error handling

## Architecture Components

```text
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Node.js       │    │   Icon Data     │    │   PostgreSQL    │
│   Extractor     │───▶│   Processing    │───▶│   Population    │
│                 │    │                 │    │                 │
│ - AWS Icons     │    │ - Normalization │    │ - Insert Packs  │
│ - Iconify Packs │    │ - Validation    │    │ - Insert Icons  │
│ - File System   │    │ - Optimization  │    │ - Index Building│
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Implementation Requirements

### 1. Icon Package Extraction

Extract and process icons from multiple sources:

- AWS Icons: Process SVG files from aws-icons npm package
- Iconify: Extract JSON data from @iconify-json/* packages
- File system operations for SVG content reading
- Error handling for missing or corrupted files

### 2. Data Normalization

Convert different icon formats into consistent structure:

- Standardize icon metadata (prefix, key, category, description)
- Process SVG content to extract viewBox, dimensions, and body
- Generate search terms for full-text search optimization
- Create icon aliases and alternative naming schemes

### 3. Database Population

Efficiently insert processed icon data:

- Batch insert operations for performance
- Foreign key relationship management
- Duplicate detection and handling
- Transaction management for data consistency

### 4. Multi-Stage Docker Build

Optimize container size and build process:

- Node.js stage for icon extraction
- Python stage for the final service
- Efficient layer caching
- Minimal production image size

## Implementation Files

### File 1: `icon-service/scripts/extract-icons.js`

Main icon extraction script that processes all icon sources.

**Purpose**: Extract and normalize icon data from Node.js packages.

**Key Features**:

- Process AWS SVG files from aws-icons package
- Extract Iconify data from @iconify-json packages
- Normalize icon metadata across different sources
- Generate search-optimized data structures
- Error handling and logging

### File 2: `icon-service/scripts/icon-extractors/AwsIconExtractor.js`

Specialized extractor for AWS icon packages.

**Purpose**: Handle AWS-specific icon processing with proper categorization.

**Key Features**:

- Process architecture-service, architecture-group, category, resource icons
- Extract SVG content and metadata
- Generate AWS-specific prefixes (awssvg, awsgrp, awscat, awsres)
- Handle file naming conventions and aliases

### File 3: `icon-service/scripts/icon-extractors/IconifyExtractor.js`

Specialized extractor for Iconify icon packages.

**Purpose**: Process Iconify JSON format and convert to normalized structure.

**Key Features**:

- Parse Iconify JSON files
- Extract icon body, dimensions, viewBox
- Handle package-level metadata
- Support multiple Iconify collections

### File 4: `icon-service/package.json`

Node.js dependencies for icon extraction.

**Purpose**: Define dependencies needed for icon processing.

**Key Features**:

- AWS icons dependency
- Iconify package dependencies
- Build scripts for extraction
- Development dependencies for testing

### File 5: `icon-service/Dockerfile`

Multi-stage Dockerfile for icon service.

**Purpose**: Build container with icon extraction and Python service.

**Key Features**:

- Node.js stage for icon extraction
- Python stage for FastAPI service
- Efficient layer caching
- Copy extracted data between stages

### File 6: `icon-service/app/services/DatabasePopulator.py`

Python service for populating database with extracted icon data.

**Purpose**: Insert processed icon data into PostgreSQL database.

**Key Features**:

- Async database operations
- Batch insert optimization
- Transaction management
- Error handling and rollback

### File 7: `scripts/populate-icons.sh`

Shell script to orchestrate icon extraction and database population.

**Purpose**: Automate the complete icon processing workflow.

**Key Features**:

- Run icon extraction
- Start database population
- Health checks and validation
- Error reporting

## Success Criteria

Phase 2 is complete when:

- [ ] Icon extraction processes AWS and Iconify packages successfully
- [ ] Database contains icon packs with accurate metadata
- [ ] Icon metadata table populated with searchable entries
- [ ] Multi-stage Docker build produces working container
- [ ] PostgREST API returns real icon data
- [ ] Search functionality works with actual icons
- [ ] Performance meets requirements (< 2s for extraction)

## Data Model

The extracted data will populate these structures:

```sql
-- Icon Packs populated with:
-- - awssvg (AWS Services)
-- - awsgrp (AWS Groups) 
-- - awscat (AWS Categories)
-- - awsres (AWS Resources)
-- - logos (Iconify Logos)
-- - material-icon-theme (Material Icons)
-- - devicon (Developer Icons)

-- Icon Metadata populated with:
-- - Normalized keys and prefixes
-- - Search-optimized terms
-- - SVG content references
-- - Usage tracking fields
```

## Performance Requirements

- Icon extraction: Complete within 2 minutes
- Database population: Handle 10,000+ icons efficiently
- Memory usage: Stay under 512MB during extraction
- Container size: Final image under 200MB

## Testing Strategy

### Extraction Tests

- Verify AWS icon processing
- Validate Iconify data parsing
- Test error handling for missing files
- Confirm data normalization accuracy

### Database Tests

- Validate schema compliance
- Test batch insert performance
- Verify foreign key relationships
- Confirm search index creation

### Integration Tests

- End-to-end extraction workflow
- PostgREST API with real data
- Docker build and deployment
- Service health checks

## API Examples

After Phase 2, enhanced API functionality:

```bash
# Get all populated icon packs
curl http://localhost:3001/icon_packs

# Response includes real data:
# [
#   {"prefix": "awssvg", "display_name": "AWS Services", "icon_count": 200},
#   {"prefix": "logos", "display_name": "Iconify Logos", "icon_count": 150}
# ]

# Search for AWS icons
curl -X POST http://localhost:3001/rpc/search_icons \
  -H "Content-Type: application/json" \
  -d '{"search_term": "lambda", "category_filter": "aws"}'

# Get specific icons
curl "http://localhost:3001/icon_metadata?prefix=eq.awssvg&key=ilike.*lambda*"
```

## Migration to Phase 3

Phase 2 provides the data foundation. Phase 3 will add:

- FastAPI icon service for advanced operations
- Icon SVG serving endpoints
- Caching layer for performance
- Usage tracking initialization

The populated database from Phase 2 becomes the data source for the FastAPI service in Phase 3.

## Troubleshooting

Common issues and solutions:

- **Extraction fails**: Check Node.js dependencies and file permissions
- **Database insert errors**: Verify schema compatibility and constraints
- **Memory issues**: Implement streaming for large icon sets
- **Performance problems**: Optimize batch sizes and database connections

## Dependencies

- Node.js 18+ for extraction
- npm packages: aws-icons, @iconify-json/*
- PostgreSQL database from Phase 1
- Python 3.11+ for database population
- Docker for containerization

## Environment Variables

- `ICON_EXTRACTION_MODE`: full|incremental|test
- `DATABASE_URL`: PostgreSQL connection string
- `EXTRACTION_BATCH_SIZE`: Icons per batch (default: 100)
- `EXTRACTION_LOG_LEVEL`: debug|info|warn|error

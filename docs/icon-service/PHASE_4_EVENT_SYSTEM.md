# Phase 4: Event System & Cross-Service Communication

## Overview

Phase 4 implements the event-driven communication system using PostgreSQL NOTIFY/LISTEN to enable real-time coordination between the icon service and other microservices. This phase establishes the foundation for reactive, loosely-coupled service architecture.

## Objectives

- Implement PostgreSQL NOTIFY/LISTEN event system
- Create event handlers for user lifecycle management
- Establish cross-service communication patterns
- Add real-time usage tracking and analytics
- Implement data synchronization across services
- Provide event monitoring and debugging capabilities

## Architecture Components

```text
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Main Backend  │    │   Event System  │    │  Icon Service   │
│                 │    │                 │    │                 │
│ - User Events   │───▶│ PostgreSQL      │◄───│ - Event Handler │
│ - Doc Events    │    │ NOTIFY/LISTEN   │    │ - Cache Updates │
│ - Auth Events   │    │                 │    │ - Analytics     │
└─────────────────┘    │ - Triggers      │    └─────────────────┘
                       │ - Event Queue   │
                       │ - Dead Letter   │
                       └─────────────────┘
```

## Implementation Requirements

### 1. Event Infrastructure

PostgreSQL-based event system:

- Database triggers for automatic event generation
- NOTIFY/LISTEN for real-time event delivery
- Event payload standardization with JSON
- Event routing and filtering
- Dead letter handling for failed events

### 2. Event Types

Define events that the icon service needs to handle:

- User lifecycle events (created, updated, deleted, suspended)
- Document events (created, updated, published, deleted)
- Authentication events (login, logout, session changes)
- System events (maintenance, configuration changes)

### 3. Icon Service Event Handlers

React to relevant events to maintain data consistency:

- User creation: Initialize user-specific icon preferences
- User deletion: Clean up usage tracking data
- Document activity: Update icon usage analytics
- Authentication changes: Update access permissions

### 4. Real-time Analytics

Enhanced analytics based on event streams:

- Live usage tracking across user sessions
- Real-time popularity calculations
- Dynamic cache optimization
- User behavior pattern analysis

### 5. Data Synchronization

Maintain consistency across services:

- User data replication for icon service needs
- Permission synchronization
- Configuration updates
- Cache invalidation coordination

## Implementation Files

### File 1: `migrations/003_event_system.sql`

Database event system setup with triggers and functions.

**Purpose**: Create the PostgreSQL event infrastructure for cross-service communication.

**Key Features**:

- Event trigger functions for user, document, and system changes
- NOTIFY/LISTEN channel definitions
- Event payload standardization
- Event logging table for debugging
- Performance optimization for high-volume events

### File 2: `icon-service/app/services/EventService.py`

Core event handling service for icon service.

**Purpose**: Manage event subscriptions, processing, and error handling.

**Key Features**:

- Async PostgreSQL connection for LISTEN operations
- Event subscription management
- Event handler registration and routing
- Error handling and retry logic
- Event processing metrics and monitoring

### File 3: `icon-service/app/events/UserEventHandler.py`

Specialized handler for user-related events.

**Purpose**: Process user lifecycle events and maintain user-related icon data.

**Key Features**:

- User creation/deletion handling
- User preference initialization
- Usage data cleanup
- Permission synchronization
- User-specific cache management

### File 4: `icon-service/app/events/DocumentEventHandler.py`

Handler for document-related events that affect icon usage.

**Purpose**: Track icon usage in documents and update analytics.

**Key Features**:

- Document creation/update processing
- Icon usage extraction from document content
- Usage analytics updates
- Popular icon identification
- Document-specific icon recommendations

### File 5: `icon-service/app/events/SystemEventHandler.py`

Handler for system-wide events and configuration changes.

**Purpose**: React to system events that affect icon service operation.

**Key Features**:

- Configuration change processing
- Maintenance mode handling
- Cache invalidation events
- System health monitoring
- Performance optimization events

### File 6: `icon-service/app/models/EventModels.py`

Pydantic models for event data structures.

**Purpose**: Define strongly-typed event payloads and validation.

**Key Features**:

- Event base models with common fields
- User event models
- Document event models
- System event models
- Event processing result models

### File 7: `icon-service/app/services/AnalyticsService.py`

Enhanced analytics service with real-time capabilities.

**Purpose**: Process usage data and provide real-time analytics.

**Key Features**:

- Real-time usage aggregation
- Popular icon calculation
- User behavior analysis
- Trend detection and reporting
- Cache optimization recommendations

### File 8: `scripts/test-events.py`

Event system testing and debugging utilities.

**Purpose**: Test event generation, processing, and system integration.

**Key Features**:

- Event generation for testing
- Event handler verification
- Performance testing for event processing
- Integration testing across services
- Debugging tools for event troubleshooting

## Success Criteria

Phase 4 is complete when:

- [ ] PostgreSQL event system generates events for relevant database changes
- [ ] Icon service receives and processes events in real-time
- [ ] User lifecycle events properly manage icon service data
- [ ] Document events update usage analytics automatically
- [ ] Event processing doesn't impact service performance
- [ ] Event monitoring provides visibility into system behavior
- [ ] Failed events are handled gracefully with retry logic

## Event Types and Payloads

### User Events

```json
{
  "event_type": "user.created",
  "user_id": "uuid",
  "user_data": {
    "email": "user@example.com",
    "is_active": true,
    "created_at": "2025-08-23T10:00:00Z"
  },
  "timestamp": "2025-08-23T10:00:00Z",
  "correlation_id": "uuid"
}
```

### Document Events

```json
{
  "event_type": "document.updated", 
  "document_id": "uuid",
  "user_id": "uuid",
  "document_data": {
    "title": "Architecture Diagram",
    "is_public": true,
    "updated_at": "2025-08-23T10:00:00Z"
  },
  "changes": ["content", "visibility"],
  "timestamp": "2025-08-23T10:00:00Z",
  "correlation_id": "uuid"
}
```

### System Events

```json
{
  "event_type": "system.maintenance_mode",
  "system_data": {
    "maintenance_enabled": true,
    "estimated_duration": "30m",
    "affected_services": ["icon-service"]
  },
  "timestamp": "2025-08-23T10:00:00Z",
  "correlation_id": "uuid"
}
```

## Performance Requirements

- Event processing latency: < 100ms per event
- Event throughput: Handle 1000+ events per second
- Event handler memory: < 50MB additional overhead
- Event processing reliability: 99.9% success rate
- Event storage: Retain events for 30 days for debugging

## Event Monitoring

### Metrics

- Events processed per second
- Event processing latency
- Failed event count and reasons
- Handler performance by event type
- Database event generation rate

### Alerting

- Failed event processing above threshold
- Event processing latency spikes
- Missing expected events
- Database event generation failures
- Event handler crashes or errors

### Debugging

- Event payload logging
- Processing trace logging
- Performance profiling
- Error stack traces
- Event replay capabilities

## Testing Strategy

### Unit Tests

- Event handler logic
- Event model validation
- Error handling scenarios
- Performance under load

### Integration Tests

- End-to-end event processing
- Cross-service communication
- Database trigger functionality
- Event ordering and delivery

### Performance Tests

- High-volume event processing
- Concurrent event handling
- Memory usage during event storms
- Database performance impact

## Migration to Phase 5

Phase 4 provides event-driven foundations. Phase 5 will add:

- Batch API endpoints for efficient operations
- Advanced caching strategies based on usage patterns
- Performance optimization using event data
- Enhanced analytics and reporting

The real-time usage data from Phase 4 enables intelligent optimizations in Phase 5.

## Troubleshooting

Common issues and solutions:

- **Events not firing**: Check database triggers and permissions
- **Event processing delays**: Monitor event queue and handler performance
- **Missing events**: Verify LISTEN connections and channel subscriptions
- **Event processing errors**: Check handler logic and error logging
- **Database load**: Optimize trigger performance and event frequency

## Dependencies

- PostgreSQL with NOTIFY/LISTEN support
- asyncpg with connection pooling
- Structured logging for event tracing
- Monitoring tools for event metrics
- JSON validation for event payloads

## Configuration Variables

- `EVENT_PROCESSING_ENABLED`: Enable/disable event processing
- `EVENT_RETRY_ATTEMPTS`: Number of retry attempts for failed events
- `EVENT_BATCH_SIZE`: Events to process in a single batch
- `EVENT_TIMEOUT`: Timeout for event handler execution
- `EVENT_LOG_LEVEL`: Logging level for event processing
- `EVENT_MONITORING_INTERVAL`: Metrics collection interval

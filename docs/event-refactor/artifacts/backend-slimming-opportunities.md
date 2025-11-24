# Backend Slimming Opportunities — Event-Driven Decomposition Plan

This document identifies specific opportunities to reduce Backend responsibilities and convert synchronous calls into event-driven patterns.

## Current Backend Responsibilities (To Reduce)

### 1. **Context Broker Pattern** (Target for Elimination)
**Current**: Backend mediates all service interactions by:
- Validating user authentication for every downstream call
- Enriching requests with user context from database
- Transforming responses between services

**Problem**: Creates single point of failure and tight coupling

**Target**: Services own their user context via local projections

---

### 2. **Database Proxy Pattern** (Target for Elimination)
**Current**: Backend performs database queries on behalf of services:
- Linting Service → Backend → DB (for user rules)
- Spell-Check Service → Backend → DB (for custom dictionaries)

**Problem**: Database access bottleneck and service coupling

**Target**: Services own their data with local databases

---

## Event-Driven Conversion Opportunities

### 🎯 **Opportunity 1: User Lifecycle Events**

**Current Synchronous Pattern**:
```
Frontend → Backend → User CRUD → Database
                 ↓
     (Services unaware of user changes)
```

**Target Event-Driven Pattern**:
```
Backend → User CRUD → Database + Outbox
                          ↓
                    Redis Stream
                          ↓
              ┌─────────────────────┐
              ▼                     ▼
    Linting Service          Spell-Check Service
    (Local User Projection)  (Local User Projection)
```

**Events to Publish**:
- `identity.user.created.v1`
- `identity.user.updated.v1`
- `identity.user.deleted.v1`
- `identity.user.preferences.updated.v1`

**Consuming Services**:
- **Linting Service**: Needs user_id for rule scoping
- **Spell-Check Service**: Needs user_id for dictionary scoping

---

### 🎯 **Opportunity 2: Custom Dictionary Ownership Shift**

**Current Backend-Mediated Pattern**:
```
Frontend → Backend → Spell-Check Service
           ↑
    Database Query
    (custom_dictionaries table)
```

**Target Service-Owned Pattern**:
```
Frontend → Spell-Check Service
              ↓
    Local Database/Projection
    (spell.user_dictionaries)
```

**Implementation**:
1. **Phase 5**: Move `custom_dictionaries` table ownership to Spell-Check Service
2. **Phase 5**: Spell-Check Service consumes `identity.user.*` events for user context
3. **Phase 6**: Remove Backend proxy routes for dictionary management

**Benefits**:
- Spell-Check Service becomes self-contained
- Eliminates Backend database dependency
- Enables independent scaling

---

### 🎯 **Opportunity 3: Linting Rules Ownership Shift**

**Current Backend-Mediated Pattern**:
```
Frontend → Backend → Linting Service
           ↑
    Database Query
    (markdown_lint_rules table)
```

**Target Service-Owned Pattern**:
```
Frontend → Linting Service
              ↓
    Local Database/Projection
    (lint.user_rules)
```

**Implementation**:
1. **Phase 4**: Move `markdown_lint_rules` table ownership to Linting Service
2. **Phase 4**: Linting Service consumes `identity.user.*` events for user context
3. **Phase 6**: Remove Backend proxy routes for rule management

**Benefits**:
- Linting Service becomes self-contained
- Eliminates Backend database dependency
- Enables independent scaling

---

### 🎯 **Opportunity 4: Document Events for Export Service**

**Current Tight Coupling Pattern**:
```
Export Service → Backend Icon APIs
                    ↓
              Database Query
              (icon metadata)
```

**Target Event-Driven Pattern**:
```
Backend → Document Export → Document Events
                                ↓
                          Redis Stream
                                ↓
                        Export Service
                   (Local Icon Cache/Projection)
```

**Events to Publish**:
- `documents.export.requested.v1`
- `icons.metadata.updated.v1`

**Benefits**:
- Export Service pre-caches icon metadata locally
- Reduces real-time API dependencies
- Better export performance

---

## Specific Backend Route Elimination Plan

### Phase 6 Target: Remove These Backend Proxy Routes

#### 1. Spell-Check Proxy Routes (Move to Direct Service)
```python
# REMOVE from Backend
@router.post("/spell-check/")           # → spell-check-service:8003/check
@router.get("/spell-check/health")      # → spell-check-service:8003/health
@router.get("/spell-check/info")        # → spell-check-service:8003/info
@router.get("/spell-check/languages")   # → spell-check-service:8003/languages
```

**Nginx Replacement**:
```nginx
# ADD to nginx config
location /api/spell/ {
    rewrite ^/api/spell/(.*)$ /$1 break;
    proxy_pass http://spell-check-service:8003;
}
```

#### 2. Linting Proxy Routes (Move to Direct Service)
```python
# REMOVE from Backend
@router.post("/markdown-lint/process")                 # → lint-service:8002/lint
@router.get("/markdown-lint/rules/definitions")       # → lint-service:8002/rules/definitions
@router.get("/markdown-lint/user/defaults")           # → lint-service:8002/user/defaults
@router.put("/markdown-lint/user/defaults")           # → lint-service:8002/user/defaults
@router.get("/markdown-lint/categories/{id}/rules")   # → lint-service:8002/categories/{id}/rules
```

**Nginx Replacement**:
```nginx
# ADD to nginx config
location /api/lint/ {
    rewrite ^/api/lint/(.*)$ /$1 break;
    proxy_pass http://markdown-lint-service:8002;
}
```

#### 3. Dictionary Management Routes (Move to Spell-Check Service)
```python
# REMOVE from Backend
@router.get("/dictionary/")                    # → spell-check-service:8003/dictionary
@router.post("/dictionary/")                   # → spell-check-service:8003/dictionary
@router.delete("/dictionary/{word}")           # → spell-check-service:8003/dictionary/{word}
@router.get("/dictionary/categories/{id}")     # → spell-check-service:8003/dictionary/categories/{id}
@router.get("/dictionary/folders/{path}")      # → spell-check-service:8003/dictionary/folders/{path}
```

---

## Backend Slimming Results

### After Phase 6 Completion, Backend Focuses Only On:

#### ✅ **Core Backend Responsibilities** (Keep)
1. **Identity Management**: User auth, profile, preferences
2. **Document Lifecycle**: CRUD, categories, sharing, GitHub integration
3. **Icon/Asset Management**: Icon APIs, third-party browsing
4. **PDF Processing**: PDF generation and styling
5. **Image Management**: Image uploads, processing, metadata

#### ❌ **Eliminated Backend Responsibilities** (Remove)
1. **Service Proxying**: No more service-to-service mediation
2. **Custom Dictionary Management**: Moved to Spell-Check Service
3. **Linting Rules Management**: Moved to Linting Service
4. **Cross-Service Context Brokering**: Replaced with events

---

## Event-Driven vs Direct API Classification

### 🔄 **Event-Driven Communication** (Async, Eventually Consistent)
- **User lifecycle changes** → All services need user projections
- **Document metadata changes** → Export service needs caching
- **Configuration updates** → Services need preference changes

### 🔗 **Direct API Communication** (Sync, Immediately Consistent)
- **Frontend → Services**: Direct user-initiated requests
- **Export requests**: Real-time document conversion
- **Health checks**: Service monitoring

### 📁 **Filesystem Communication** (Shared Storage)
- **Document content**: Shared via filesystem storage (`/documents`)
- **Static assets**: Shared via filesystem or CDN

---

## Migration Safety & Rollback Strategy

### Phase-by-Phase Safety
1. **Phase 2-3**: Add events without removing existing APIs
2. **Phase 4-5**: Services build local projections while keeping Backend APIs
3. **Phase 6**: Remove Backend proxy routes only after services are self-sufficient

### Rollback Capability
- Keep Backend proxy routes as "circuit breakers" initially
- Services fall back to Backend APIs if local data is unavailable
- Gradual cutover with feature flags

### Testing Strategy
- Dual-write validation (events + APIs)
- End-to-end testing at each phase boundary
- Performance monitoring for event lag vs API latency
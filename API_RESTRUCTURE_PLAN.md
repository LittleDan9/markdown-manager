# API Restructure Plan: FastAPI Structure Migration

**Project**: Markdown Manager Backend  
**Goal**: Migrate from v1 API structure to a cleaner, more maintainable FastAPI structure based on acuity-app-entitlements pattern  
**Branch**: `api-restructure`  
**Date**: August 16, 2025

## Overview

This document outlines a comprehensive phased approach to restructure the markdown-manager backend FastAPI application. The migration will remove the `/api/v1` versioning structure and adopt the cleaner, more maintainable patterns used in the acuity-app-entitlements project.

## Current Structure Analysis

### Current markdown-manager structure:
```
backend/app/
├── __init__.py
├── main.py                    # Simple FastAPI app with basic setup
├── database.py
├── api/
│   └── v1/
│       ├── api.py            # Main router aggregation
│       ├── auth.py           # Authentication endpoints
│       ├── categories.py     # Category management
│       ├── custom_dictionary.py
│       ├── mfa.py           # Multi-factor authentication
│       ├── syntax_highlighting.py
│       ├── users.py         # User management
│       └── endpoints/
│           ├── debug.py
│           ├── documents.py
│           ├── health.py
│           ├── pdf.py
│           └── public.py
├── core/
├── crud/
├── models/
├── schemas/
└── services/
```

### Target acuity-app-entitlements structure:
```
app/
├── main.py                   # App initialization and startup
├── app_factory.py           # FastAPI app factory pattern
├── routers/
│   ├── default.py           # Root, health, utility endpoints
│   ├── token.py             # Authentication/token endpoints
│   ├── audit_reader.py      # Audit functionality
│   └── hooks/               # Webhook endpoints
├── configs/
├── models/
├── schemas/
├── services/
└── utils/
```

---

## Phase 1: Foundation Setup and App Factory Pattern

### **Objectives**
- Implement the app factory pattern for better modularity
- Improve application initialization and lifecycle management
- Prepare infrastructure for middleware and enhanced configuration

### **Tasks**

#### 1.1 Create App Factory (`backend/app/app_factory.py`)
- [x] Create `AppFactory` class with `create_app()` method
- [x] Move FastAPI app creation logic from `main.py`
- [x] Implement lifespan management with proper startup/shutdown
- [x] Add middleware framework (CORS, custom middleware preparation)
- [x] Include router registration in factory

#### 1.2 Restructure Main Application (`backend/app/main.py`)
- [x] Convert to use factory pattern
- [x] Add `AppInitializer` class for startup sequence
- [x] Implement proper database initialization
- [x] Add `create_app()` function for uvicorn factory mode
- [x] Maintain development server capabilities

#### 1.3 Configuration Enhancement
- [x] Review and enhance `core/config.py` for better modularity
- [x] Ensure settings are properly injectable into app factory
- [x] Prepare for environment-specific configurations

### **Files Modified**
- ✅ Create: `backend/app/app_factory.py`
- ✅ Modify: `backend/app/main.py`
- ✅ Review: `backend/app/core/config.py`

### **Success Criteria**
- [x] Application starts successfully with factory pattern
- [x] All existing endpoints remain functional
- [x] Docker compose setup continues to work
- [x] Lifespan events execute properly

---

## Phase 2: Router Restructuring - Remove v1 API Structure

### **Objectives**
- Eliminate the `/api/v1` nested structure
- Flatten API routes for cleaner URLs
- Move all routers to a single `routers/` directory

### **Tasks**

#### 2.1 Create New Router Directory Structure
- [x] Create `backend/app/routers/` directory
- [x] Move all files from `backend/app/api/v1/` to `backend/app/routers/`
- [x] Move files from `backend/app/api/v1/endpoints/` to `backend/app/routers/`

#### 2.2 Update Router Imports
- [x] Update `app_factory.py` to import from new router locations
- [x] Fix all internal router imports and dependencies
- [x] Update any cross-router references

#### 2.3 Remove Legacy API Structure
- [x] Delete `backend/app/api/v1/api.py` (functionality moved to app_factory)
- [x] Remove `backend/app/api/v1/` directory
- [x] Remove `backend/app/api/` directory if empty

#### 2.4 Update Configuration
- [x] Remove `api_v1_str` from settings if no longer needed
- [x] Update OpenAPI URL configuration
- [x] Verify all route prefixes work correctly

### **Files Modified**
- ✅ Create: `backend/app/routers/` (directory)
- ✅ Move: All router files to new location
- ✅ Modify: `backend/app/app_factory.py` (imports)
- ✅ Remove: `backend/app/api/` (directory structure)

### **Success Criteria**
- [x] All endpoints accessible without `/api/v1` prefix
- [x] No broken imports or missing dependencies
- [x] OpenAPI docs reflect new structure
- [x] All existing functionality preserved

---

## Phase 3: Router Organization and Consolidation

### **Objectives**
- Reorganize routers to match acuity-app-entitlements logical grouping
- Create consolidated, domain-focused router modules
- Improve endpoint organization and naming

### **Tasks**

#### 3.1 Create Default Router (`backend/app/routers/default.py`)
- [x] Implement root endpoint (`/`)
- [x] Move health check endpoints from `health.py`
- [x] Add utility endpoints (favicon, etc.)
- [x] Include redirect to docs for root access

#### 3.2 Consolidate Authentication
- [x] Merge `auth.py` and `mfa.py` into unified authentication handling
- [x] Consider renaming to `authentication.py` or keeping as `auth.py`
- [x] Organize endpoints logically (login, logout, MFA, token refresh)
- [x] Ensure all auth-related functionality is cohesive

#### 3.3 Organize Routers by Domain
- [x] Review and optimize `users.py` router
- [x] Review and optimize `categories.py` router
- [x] Review and optimize `documents.py` router
- [x] Consolidate `pdf.py` functionality appropriately
- [x] Review `syntax_highlighting.py` and `custom_dictionary.py` placement

#### 3.4 Clean Up Endpoint Paths
- [x] Review all route paths for consistency
- [x] Ensure REST principles are followed
- [x] Remove any redundant or unclear endpoints
- [x] Standardize response formats

### **Files Modified**
- ✅ Create: `backend/app/routers/default.py`
- ✅ Modify: All router files for consolidation and cleanup
- ✅ Potentially merge: `auth.py` and `mfa.py`

### **Success Criteria**
- [x] Logical grouping of related endpoints
- [x] Consistent routing patterns
- [x] Clean, REST-compliant API structure
- [x] Reduced complexity in router organization

---

## Phase 4: Configuration and Settings Enhancement

### **Objectives**
- Improve configuration management to be more modular and environment-aware
- Enhance secret management and security
- Optimize database configuration handling

### **Tasks**

#### 4.1 Enhance Settings Structure (`backend/app/core/config.py`)
- [ ] Review current settings class for modularity opportunities
- [ ] Consider splitting into domain-specific configuration classes
- [ ] Improve environment variable handling
- [ ] Add validation for required configuration values

#### 4.2 Environment-Specific Configuration
- [ ] Ensure proper development vs. production configuration
- [ ] Add configuration for different deployment environments
- [ ] Implement proper default values and overrides

#### 4.3 Secret Management
- [ ] Review current secret handling practices
- [ ] Ensure sensitive configuration is properly managed
- [ ] Document environment variables required

#### 4.4 Database Configuration
- [ ] Optimize database connection handling
- [ ] Ensure proper connection pooling configuration
- [ ] Review async session management

### **Files Modified**
- ✅ Modify: `backend/app/core/config.py`
- ✅ Review: Related configuration files

### **Success Criteria**
- [ ] Clean, modular configuration structure
- [ ] Proper environment variable handling
- [ ] Secure secret management
- [ ] Optimized database configuration

---

## Phase 5: Middleware and Request Handling

### **Objectives**
- Add comprehensive middleware for logging, monitoring, and request handling
- Implement standardized error handling
- Add request context management

### **Tasks**

#### 5.1 Logging Middleware
- [ ] Implement request/response logging middleware
- [ ] Add structured logging with request IDs
- [ ] Include performance timing information
- [ ] Filter sensitive information from logs

#### 5.2 Monitoring Middleware
- [ ] Add request metrics collection
- [ ] Implement performance monitoring
- [ ] Add health check monitoring
- [ ] Consider Prometheus metrics if needed

#### 5.3 Error Handling Middleware
- [ ] Standardize error response formats
- [ ] Implement global exception handling
- [ ] Add proper HTTP status code handling
- [ ] Include error logging and tracking

#### 5.4 Request Context Management
- [ ] Implement request context similar to acuity pattern
- [ ] Add request tracing capabilities
- [ ] Include user context in requests

### **Files Modified**
- ✅ Modify: `backend/app/app_factory.py` (middleware registration)
- ✅ Create: Middleware classes as needed
- ✅ Enhance: Error handling across routers

### **Success Criteria**
- [ ] Comprehensive request/response logging
- [ ] Standardized error handling
- [ ] Performance monitoring capabilities
- [ ] Request tracing functionality

---

## Phase 6: Testing and Validation

### **Objectives**
- Ensure all functionality works correctly after restructuring
- Update all tests to reflect new structure
- Validate integration points and deployment

### **Tasks**

#### 6.1 Test Updates
- [ ] Update all test imports to reflect new router locations
- [ ] Fix any broken test references
- [ ] Add tests for new app factory functionality
- [ ] Validate middleware functionality in tests

#### 6.2 Integration Testing
- [ ] Test all endpoints for functionality
- [ ] Verify authentication flows work correctly
- [ ] Test database operations and migrations
- [ ] Validate PDF generation and other services

#### 6.3 Docker and Deployment Validation
- [ ] Ensure Docker compose setup works with new structure
- [ ] Test containerized deployment
- [ ] Validate production deployment scripts
- [ ] Update any deployment documentation

#### 6.4 Documentation Updates
- [ ] Update API documentation to reflect new structure
- [ ] Update developer setup instructions
- [ ] Document any breaking changes for API consumers
- [ ] Update README if necessary

### **Files Modified**
- ✅ All test files (import updates)
- ✅ Documentation files
- ✅ Deployment scripts if needed

### **Success Criteria**
- [ ] All tests pass successfully
- [ ] Complete integration test coverage
- [ ] Docker compose works correctly
- [ ] Documentation is up to date

---

## Migration Benefits

### **Immediate Benefits**
- ✅ Cleaner URL structure (no `/api/v1` prefix)
- ✅ Better code organization and maintainability
- ✅ Improved application startup and lifecycle management
- ✅ Enhanced logging and monitoring capabilities

### **Long-term Benefits**
- ✅ Easier to add new features and endpoints
- ✅ Better testing and development experience
- ✅ More scalable architecture
- ✅ Improved debugging and troubleshooting

## Risk Mitigation

### **Breaking Changes**
- **Risk**: Frontend applications may need URL updates
- **Mitigation**: Document all URL changes and provide migration guide

### **Testing Coverage**
- **Risk**: Missing edge cases during restructuring
- **Mitigation**: Comprehensive testing at each phase before proceeding

### **Deployment Issues**
- **Risk**: Production deployment problems
- **Mitigation**: Thorough testing in development and staging environments

---

## Phase 7: Frontend API Integration Updates

### **Objectives**
- Update frontend API services to work with the new backend structure
- Remove `/api/v1` prefix from all frontend API calls
- Ensure seamless integration between frontend and restructured backend
- Maintain backward compatibility during transition if needed

### **Tasks**

#### 7.1 Update API Configuration (`frontend/src/config.js`)
- [ ] Remove `/api/v1` suffix from `getApiBaseUrl()` function
- [ ] Update development URL to `http://localhost:8000` (no prefix)
- [ ] Update production URL to remove `/api/v1` prefix
- [ ] Consider adding configuration option for API versioning if needed for future

#### 7.2 Review and Update API Service Files
- [ ] **userApi.js**: Update all endpoint paths to remove `/api/v1` prefix
  - [ ] Authentication endpoints (`/auth/*`)
  - [ ] User management endpoints (`/users/*`)
  - [ ] MFA endpoints (`/mfa/*`)
- [ ] **documentsApi.js**: Update document-related endpoint paths
  - [ ] Document CRUD operations (`/documents/*`)
  - [ ] PDF export endpoint (`/pdf/*`)
  - [ ] Sharing endpoints (`/shared/*`)
  - [ ] Category endpoints (ensure consistency with categoriesApi)
- [ ] **categoriesApi.js**: Update category management endpoint paths
  - [ ] Category CRUD operations (`/categories/*`)
  - [ ] Statistics endpoints (`/categories/stats`)
- [ ] **customDictionaryApi.js**: Update dictionary endpoint paths
  - [ ] Dictionary management (`/dictionary/*`)
- [ ] **highlightingApi.js**: Update syntax highlighting endpoint paths
  - [ ] Highlighting service (`/highlight/*`)

#### 7.3 Endpoint Path Consolidation Review
- [ ] Review for any duplicate or inconsistent endpoint patterns
- [ ] Ensure category endpoints are consistent between `documentsApi.js` and `categoriesApi.js`
- [ ] Verify all authentication-related endpoints follow consistent patterns
- [ ] Check for any hardcoded API version references

#### 7.4 API Base Class Enhancement (`frontend/src/api/api.js`)
- [ ] Review base `Api` class for any version-specific logic
- [ ] Ensure proper error handling for new endpoint structure
- [ ] Add any necessary headers or configuration for new backend structure
- [ ] Consider adding API version header if needed for future compatibility

#### 7.5 Integration Testing and Validation
- [ ] Test all authentication flows (login, logout, refresh, MFA)
- [ ] Test document CRUD operations
- [ ] Test category management functionality
- [ ] Test PDF export functionality
- [ ] Test syntax highlighting service
- [ ] Test custom dictionary features
- [ ] Test document sharing functionality
- [ ] Verify error handling works correctly with new endpoints

#### 7.6 Development and Production Environment Validation
- [ ] Test frontend-backend integration in development environment
- [ ] Verify nginx configuration handles new endpoint structure in production
- [ ] Update any deployment scripts that reference old API paths
- [ ] Test CORS configuration with new endpoint structure

### **Files Modified**
- ✅ Modify: `frontend/src/config.js`
- ✅ Modify: `frontend/src/api/userApi.js`
- ✅ Modify: `frontend/src/api/documentsApi.js`
- ✅ Modify: `frontend/src/api/categoriesApi.js`
- ✅ Modify: `frontend/src/api/customDictionaryApi.js`
- ✅ Modify: `frontend/src/api/highlightingApi.js`
- ✅ Review: `frontend/src/api/api.js`
- ✅ Update: Any deployment/nginx configuration files

### **Success Criteria**
- [ ] All frontend API calls work with new backend structure
- [ ] No `/api/v1` prefixes remain in frontend code
- [ ] All existing functionality preserved
- [ ] Proper error handling maintained
- [ ] Development and production environments work correctly
- [ ] No breaking changes for end users

### **Frontend API Changes Summary**

#### Current Frontend API Calls (with /api/v1):
```javascript
// Development: http://localhost:8000/api/v1
// Production: /api/v1
```

#### Updated Frontend API Calls (without /api/v1):
```javascript
// Development: http://localhost:8000
// Production: /
```

#### Specific Endpoint Changes:
- **Authentication**: `/api/v1/auth/*` → `/auth/*`
- **Users**: `/api/v1/users/*` → `/users/*`  
- **MFA**: `/api/v1/mfa/*` → `/mfa/*`
- **Documents**: `/api/v1/documents/*` → `/documents/*`
- **Categories**: `/api/v1/categories/*` → `/categories/*`
- **PDF**: `/api/v1/pdf/*` → `/pdf/*`
- **Dictionary**: `/api/v1/dictionary/*` → `/dictionary/*`
- **Highlighting**: `/api/v1/highlight/*` → `/highlight/*`
- **Shared**: `/api/v1/shared/*` → `/shared/*`

### **Deployment Considerations**
- [ ] Update nginx configuration to handle new endpoint structure
- [ ] Ensure CORS settings work with new paths
- [ ] Update any API documentation or OpenAPI specs
- [ ] Consider gradual rollout strategy if needed

---

## Phase Completion Checklist

- [x] **Phase 1**: App Factory Pattern ✅
- [x] **Phase 2**: Router Restructuring ✅  
- [ ] **Phase 3**: Router Organization ✅
- [ ] **Phase 4**: Configuration Enhancement ✅
- [ ] **Phase 5**: Middleware Implementation ✅
- [ ] **Phase 6**: Testing and Validation ✅
- [ ] **Phase 7**: Frontend API Integration Updates ✅

---

## Notes and Decisions

### Decisions Made
- Using app factory pattern for better modularity
- Removing v1 API structure for cleaner URLs
- Following acuity-app-entitlements organizational patterns

### Questions for Review
- Should we maintain any API versioning for future use?
- Are there specific middleware requirements beyond logging/monitoring?
- Any specific deployment considerations for the new structure?

---

**Last Updated**: August 16, 2025  
**Status**: Planning Phase  
**Next Phase**: Phase 1 - Foundation Setup and App Factory Pattern

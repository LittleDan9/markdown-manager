# AI Agent Unified Architecture Implementation Guide

applyTo: "**/*"

**Dependencies**:
- **MUST READ FIRST**: `#file:copilot-development.instructions.md` for development environment setup
- **Historical Context**: `#file:copilot-filebrowser.instructions.md` for pre-unification file browser architecture

---

## 🎯 Unified Architecture Mission: Single Source-of-Truth Document Access

This document provides complete implementation guidance for **unifying the disjointed document access architecture** while preserving all enhanced features and the beloved 3-tier file browser layout.

### 🚨 **Core Problem Statement**

**CRITICAL ISSUE IDENTIFIED**: The system has fundamental disconnects between file browser UI and document storage/serving:

1. **Multiple API Endpoints for Same Operation**:
   - `documentsApi.getDocument(id)` for local documents
   - `documentsApi.openGitHubDocument(id)` for GitHub documents
   - Different code paths for identical operations

2. **Frontend Branching Logic Complexity**:
   ```javascript
   // CURRENT PROBLEMATIC PATTERN
   if (document.github_repository_id) {
     await documentsApi.openGitHubDocument(documentId);
   } else {
     await documentsApi.getDocument(documentId);
   }
   ```

3. **Virtual Path Translation Layers**:
   - File browser shows `/Documents/General/doc.md`
   - Backend uses numerical document IDs
   - Complex path-to-ID translation in multiple places

4. **Dual Filesystem Architecture Abstraction Issues**:
   - Local: `/storage/{user_id}/local/{category}/` (each category = git repo)
   - GitHub: `/storage/{user_id}/github/{account_id}/{repo_name}/`
   - Providers create artificial complexity to hide this

### ✅ **Unified Solution Architecture**

**Core Principle**: **Document ID is the only identifier needed. Backend determines source type and handles accordingly.**

## 🏗️ Implementation Status & Next Steps

### **PHASE 1: COMPLETED ✅**
**Backend Infrastructure (Zero User Impact)**

#### ✅ Created Files (Session: 2024-09-23):
- `backend/app/services/unified_document.py` - Core unified document service
- `backend/app/services/unified_git_operations.py` - Consistent git operations
- `frontend/src/services/providers/UnifiedFileBrowserProvider.js` - ID-centric file browser
- `frontend/src/services/core/UnifiedFileOpeningService.js` - Single file opening pattern
- `frontend/src/components/file/tabs/UnifiedGitHubTab.jsx` - Simplified GitHub tab example
- `docs/unified-architecture-migration-plan.md` - Complete migration strategy
- `.github/instructions/copilot-unification.instructions.md` - This comprehensive guide

#### ✅ Services Implemented:
1. **UnifiedDocumentService**: Single interface for all document types
   - `get_document_with_content(document_id)` - works for local/GitHub/any source
   - `update_document_content(document_id, content)` - unified content updates
   - Automatic GitHub repo cloning and sync handling
   - Legacy database content fallback during migration

2. **UnifiedGitOperations**: Identical git operations across repository types
   - `get_git_status(document_id)` - works for local categories AND GitHub repos
   - `commit_changes(document_id, message)` - unified commit interface
   - `get_git_history(document_id)` - consistent history across sources
   - No branch-in-path complexity - git handles branches naturally

### **PHASE 2: IN PROGRESS 🔄**
**API Endpoint Migration (Backward Compatible)**

#### 🔄 Current Task (Updated: 2024-09-23):
**Update document router to use UnifiedDocumentService**

**Status**: Architecture designed and core services implemented. Ready for backend integration.

**Next Agent Should**:
1. Complete the backend router integration in `backend/app/routers/documents/crud.py`
2. Resolve existing lint/import conflicts in that file
3. Create comprehensive tests for the unified services
4. Generate and run the database migrations for unified fields

**Files Ready for Integration**:
- `UnifiedDocumentService` class fully implemented with error handling
- `UnifiedGitOperations` class implemented for consistent git operations
- Migration SQL scripts ready in `docs/unified-architecture-migration-plan.md`
- Frontend examples created showing simplified usage patterns

**Target File**: `backend/app/routers/documents/crud.py`

**Required Changes**:
```python
# BEFORE: Current get_document endpoint
@router.get("/{document_id}", response_model=Document)
async def get_document(document_id: int, ...):
    document = await document_crud.document.get(db=db, id=document_id)
    # ... complex source-specific handling
    return await create_document_response(document, user_id)

# AFTER: Unified endpoint
@router.get("/{document_id}", response_model=Document)
async def get_document(
    document_id: int,
    force_sync: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """UNIFIED endpoint - handles all document types transparently."""
    document_data = await unified_document_service.get_document_with_content(
        db=db, document_id=document_id, user_id=current_user.id, force_sync=force_sync
    )
    return Document(**document_data)
```

**Status**: Partially implemented, needs completion due to existing lint errors in crud.py

#### 🔄 Next Implementation Steps:

1. **Fix Backend Router Integration**
   ```bash
   cd backend/
   # Fix import conflicts and implement unified endpoint
   poetry run python -m pytest tests/test_unified_document_service.py
   ```

2. **Create Migration Scripts**
   ```bash
   cd backend/
   poetry run alembic revision --autogenerate -m "add unified document fields"
   # Implement migrations from docs/unified-architecture-migration-plan.md
   ```

3. **Add Unified Endpoint Tests**
   ```python
   # tests/test_unified_document_api.py
   async def test_unified_document_access():
       # Test same endpoint works for local and GitHub documents
   ```

### **PHASE 3: PLANNED 📋**
**Frontend Gradual Migration (Feature Flags)**

#### 📋 Files to Create/Update:

1. **UnifiedFileBrowserProvider** (CREATED ✅)
   - `frontend/src/services/providers/UnifiedFileBrowserProvider.js`
   - Works with document IDs directly instead of virtual paths
   - Factory functions: `createLocalProvider()`, `createGitHubProvider()`

2. **UnifiedFileOpeningService** (CREATED ✅)
   - `frontend/src/services/core/UnifiedFileOpeningService.js`
   - Single `openDocument(documentId)` method for all sources
   - React hook: `useUnifiedFileOpening()`

3. **Updated Tab Components** (EXAMPLE CREATED ✅)
   - `frontend/src/components/file/tabs/UnifiedGitHubTab.jsx`
   - Demonstrates simplified GitHub tab using unified approach

#### 📋 Integration Points:

1. **Update File Browser Usage**:
   ```javascript
   // BEFORE: Complex provider switching
   if (sourceType === 'local') {
     provider = new LocalDocumentsProvider(documentContext);
   } else {
     provider = new GitHubProvider(repository, branch);
   }

   // AFTER: Unified provider factory
   provider = createFileBrowserProvider({
     type: 'local', // or 'github'
     categoryId: categoryId, // for local
     repositoryId: repositoryId, // for GitHub
     branch: branch // for GitHub
   });
   ```

2. **Update File Opening Logic**:
   ```javascript
   // BEFORE: Branching logic in tabs
   const handleFileOpen = async (file) => {
     if (file.isImported && file.documentId) {
       if (isGitHub) {
         await documentsApi.openGitHubDocument(file.documentId);
       } else {
         const doc = documents.find(d => d.id === file.documentId);
         onFileOpen(doc);
       }
     }
   };

   // AFTER: Single unified pattern
   const { openFromFileNode } = useUnifiedFileOpening();
   const handleFileOpen = async (fileNode) => {
     const document = await openFromFileNode(fileNode);
     onFileOpen(document);
   };
   ```

### **PHASE 4: PLANNED 📋**
**Legacy Cleanup (After Confidence Period)**

#### 📋 Deprecated Endpoints to Remove:
- `/documents/{id}/github/open` - replaced by unified `/documents/{id}`
- GitHub-specific opening logic in frontend
- Complex provider path translation layers

## 🛠️ Development Environment Integration

**CRITICAL**: Follow `#file:copilot-development.instructions.md` for all development tasks:

### **Backend Development**:
```bash
# Start services
docker compose up --build -d backend

# Run migrations (ALWAYS locally with Poetry)
cd backend/
poetry run alembic revision --autogenerate -m "unified document fields"
poetry run alembic upgrade head

# Test unified services
poetry run pytest tests/test_unified_document_service.py -v
```

### **Frontend Development**:
```bash
# Start frontend with HMR
docker compose up frontend

# Access via nginx proxy (NOT :3000)
open http://localhost/

# If memory overflow from rapid changes:
docker compose restart frontend
```

### **Database Operations**:
```bash
# Direct database access (NOT via docker exec)
PGPASSWORD=postgres psql -h localhost -U postgres -d markdown_manager | cat

# Check document repository types
PGPASSWORD=postgres psql -h localhost -U postgres -d markdown_manager -c "SELECT repository_type, COUNT(*) FROM documents GROUP BY repository_type;" | cat
```

### **API Testing**:
```bash
# Test unified document endpoint (use nginx proxy)
curl -H "User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36" \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     http://localhost:80/api/documents/123

# Compare with legacy GitHub endpoint (should return same data)
curl -H "User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36" \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -X POST http://localhost:80/api/documents/123/github/open
```

## 🧭 Implementation Guidance for AI Agents

### **When Continuing This Work**:

1. **Always Check Current Phase Status**:
   ```bash
   # Check if unified services are deployed
   grep -r "unified_document_service" backend/app/routers/

   # Check database migration status
   cd backend/
   poetry run alembic current
   ```

2. **Read Implementation Status Logs**:
   - Check `docs/unified-architecture-migration-plan.md` for detailed migration steps
   - Review created files in `backend/app/services/` and `frontend/src/services/`
   - Examine example implementations in component files

3. **Test Before Proceeding**:
   ```bash
   # Verify existing functionality works
   cd backend/
   poetry run pytest tests/unit/ -v

   # Check frontend builds without errors
   docker compose up frontend --build
   ```

### **Implementation Priority Order**:

1. **FIRST**: Complete Phase 2 backend integration
   - Fix `backend/app/routers/documents/crud.py` unified endpoint
   - Add comprehensive tests for unified services
   - Create and run database migrations

2. **SECOND**: Implement Phase 3 frontend integration
   - Start with feature flags for gradual rollout
   - Update one tab component at a time
   - A/B test with small user percentage

3. **THIRD**: Monitor and validate
   - Compare response times and error rates
   - Ensure all existing functionality preserved
   - User acceptance testing

4. **FOURTH**: Phase 4 cleanup only after 100% confidence

### **Key Architecture Principles to Maintain**:

1. **Document ID Centricity**: All operations should use document ID as primary key
2. **Provider Pattern**: Keep provider abstraction for data sources, but simplify
3. **3-Tier Layout Preservation**: FileTree, FileList, FilePreview components unchanged
4. **Backward Compatibility**: Legacy endpoints functional during migration
5. **Zero Data Loss**: All migrations must be reversible with content backups

## 🚨 Critical Success Metrics

### **Technical Metrics**:
- [ ] Single API call for all document access (no frontend branching)
- [ ] Same file browser components work across all source types
- [ ] Git operations identical for local categories and GitHub repos
- [ ] Response times maintained or improved
- [ ] Zero document content loss during migration

### **User Experience Metrics**:
- [ ] File browser behavior identical across sources
- [ ] Same keyboard shortcuts and interactions
- [ ] Consistent error handling and loading states
- [ ] No user-visible changes during migration phases

### **Code Quality Metrics**:
- [ ] Reduced code duplication (single document access path)
- [ ] Simplified test scenarios (unified interface testing)
- [ ] Clear separation of concerns (provider pattern cleanup)
- [ ] Comprehensive documentation for future maintenance

## 🔄 Status Tracking & Handoff Protocol

### **For AI Agents Taking Over This Work**:

1. **Update Implementation Status**: Modify the "Implementation Status & Next Steps" section above with:
   - What you completed
   - What you started but didn't finish
   - Any blockers encountered
   - Next recommended steps

2. **Document Code Changes**: For each file you modify, add comments:
   ```python
   # UNIFIED ARCHITECTURE: Added 2024-XX-XX
   # Part of unified document access implementation
   # See: .github/instructions/copilot-unification.instructions.md
   ```

3. **Update Test Coverage**: Ensure any new functionality has tests:
   ```python
   # tests/test_unified_architecture_YYYYMMDD.py
   # Tests for unified architecture implementation phase X
   ```

4. **Migration Progress Tracking**: Update the phase completion status:
   ```markdown
   ### **PHASE X: COMPLETED ✅** or **IN PROGRESS 🔄** or **BLOCKED ⚠️**
   **Completion Date**: YYYY-MM-DD
   **Completed By**: Agent ID/Name
   **Key Changes**: Brief summary of what was implemented
   ```

## 🎯 Success Vision

**End State**: A developer or user working with documents never needs to think about whether a document is local or from GitHub. The file browser looks and works identically. Opening a document is always the same API call. Git operations work the same way. The complexity of dual storage is completely abstracted away, while all enhanced features (branch switching, sync status, commit operations) continue to work seamlessly.

**User Impact**: Zero. The system works exactly as before, but faster and more reliably.

**Developer Impact**: Massive simplification. Single API patterns, unified testing, easier maintenance, and straightforward feature additions.

---

**AI Agents**: This unified architecture eliminates the source-of-truth confusion by making Document ID the single identifier for all operations. The dual filesystem complexity is abstracted away while preserving all current functionality and the excellent 3-tier file browser UX. Follow the phase-by-phase approach, maintain backward compatibility, and always ensure zero data loss.
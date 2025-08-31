# Folder Hierarchy Migration - Project Overview

## Objective

Transform the Markdown Manager from a simple category-based document organization system to a modern folder-based hierarchy system that provides a unified UI experience for both local documents and GitHub repositories.

## Current State Analysis

### Problems with Current System

1. **UX Disparity**: GitHub browser has rich tree navigation while local documents use basic dropdown + flat list
2. **Conceptual Mismatch**: GitHub repos forced into artificial categories (`repo/branch` as category names)
3. **Limited Organization**: Flat category structure doesn't scale for complex document hierarchies
4. **Inconsistent Navigation**: Different interfaces for GitHub vs local content

### Current Architecture

- **Documents**: Stored with `category_id` foreign key to categories table
- **Custom Dictionaries**: Scoped to user-level and category-level
- **GitHub Integration**: Repos imported with artificial category names
- **UI**: Separate GitHubRepositoryBrowser and FileOpenModal components

## Proposed Solution

### Core Changes

1. **Unified File Browser**: Extract and generalize GitHubFileBrowser for both local and GitHub content
2. **Path-Based Storage**: Replace category system with folder paths (`/Work/Projects/file.md`)
3. **Simplified Dictionary Scoping**: User-level + root folder level only
4. **GitHub Path Mapping**: Natural folder structure (`/GitHub/repo-name/branch/path/to/file.md`)

### Benefits

- **Consistent UX**: Same navigation experience for all content
- **Scalable Organization**: Hierarchical folder structure
- **Natural GitHub Integration**: File paths map directly to repository structure
- **Simplified Management**: Two-level dictionary system instead of complex hierarchy
- **Future-Proof**: Foundation for advanced features like nested folders, search, etc.

## Migration Phases

| Phase | Focus | Duration | Risk Level |
|-------|-------|----------|------------|
| 1 | Extract Unified File Browser | 2-3 days | Low |
| 2 | Database Schema Migration | 1-2 days | Medium |
| 3 | Backend API Updates | 2-3 days | Medium |
| 4 | GitHub Integration Refactor | 3-4 days | Medium |
| 5 | Custom Dictionary Migration | 2-3 days | Low |
| 6 | Frontend UI Integration | 2-3 days | Low |
| 7 | Testing & Migration Scripts | 2-3 days | Low |

**Total Estimated Timeline**: 2-3 weeks

## Success Criteria

- [ ] Single file browser component works for both local and GitHub content
- [ ] All existing documents migrated to folder paths without data loss
- [ ] Custom dictionaries work with new root folder system
- [ ] GitHub imports create natural folder hierarchies
- [ ] Performance maintains or improves current levels
- [ ] Zero downtime migration path
- [ ] Backward compatibility during transition period

## Risk Mitigation

1. **Database Migration**: Use gradual migration with both systems running in parallel
2. **Custom Dictionary**: Maintain both old and new systems during transition
3. **GitHub Integration**: Preserve existing sync relationships during refactor
4. **UI Changes**: Feature flag the new browser during development
5. **Performance**: Index folder_path column and optimize queries

## Files Requiring Changes

### Backend

- `backend/app/models/document.py` - Add folder_path column
- `backend/app/models/custom_dictionary.py` - Add root_folder_path support
- `backend/app/crud/document.py` - Update queries for folder-based operations
- `backend/app/routers/documents.py` - New endpoints for folder operations
- `backend/app/services/github_service.py` - Update import path logic
- `backend/migrations/` - New migration files

### Frontend

- `frontend/src/components/github/browser/` - Extract to shared location
- `frontend/src/components/file/FileOpenModal.jsx` - Major refactor
- `frontend/src/components/shared/UnifiedFileBrowser.jsx` - New component
- `frontend/src/contexts/DocumentContext.js` - Update for folder operations
- `frontend/src/api/documents.js` - New folder-based API calls

### Testing

- `backend/tests/test_folder_migration.py` - New test suite
- `frontend/src/tests/UnifiedFileBrowser.test.js` - Component tests

## Next Steps

Review each phase document for detailed implementation plans, then begin with Phase 1.

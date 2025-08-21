---
applyTo: 'frontend/**/*'
---

# Frontend Architecture Refactoring Plan

**Created:** August 20, 2025
**Branch:** `frontend-refactor`
**Status:** Planning Phase Complete

## 🎯 Overview

This document outlines a comprehensive plan to simplify and improve the frontend architecture of the markdown-manager application. The current architecture has grown complex with 111 files across 21 directories, including several architectural inefficiencies.

## 📊 Current State Analysis

### Key Metrics

- **Total Files:** 111 JavaScript/JSX files
- **Total Directories:** 21
- **Largest Files:**
  - DocumentProvider.jsx (713 lines)
  - DocumentService.js (627 lines)
  - DictionaryTab.jsx (626 lines)
- **Providers:** 7 context providers with complex dependencies
- **Custom Hooks:** 20+ hooks, many single-purpose
- **Services:** Spread across 6 directories with unclear boundaries

### 🚨 Identified Problems

#### 1. Over-Complex Provider Layer

- **DocumentProvider.jsx** (713 lines) - Massive context provider handling too many responsibilities
- Multiple providers with overlapping concerns (Auth, Document, SharedView)
- Provider dependency chain: Logger → ErrorBoundary → Theme → Notifications → Auth → SharedView → Document → PreviewHTML
- Cross-provider dependencies create fragile coupling

#### 2. Services Architecture Issues

- Services scattered across 6 directories: `auth/`, `document/`, `editor/`, `rendering/`, `ui/`, `utils/`
- Unclear service boundaries (e.g., NotificationService in `ui/` but used as utility)
- Heavy use of barrel exports creating potential circular dependencies
- Some services misplaced (utility services mixed with business logic)

#### 3. Hook Proliferation

- 20+ custom hooks with complex interdependencies
- File operations split across 6+ separate hooks:
  - `useFileSaveController.js` (11 lines)
  - `useFileOpenController.js`
  - `useFileImportController.js`
  - `useFileExportController.js`
  - `useFileOverwriteController.js`
  - `useFileSaveAsController.js`
- Auto-save functionality spread across multiple hooks
- Some hooks too granular, others too broad

#### 4. Component Organization Issues

- Deep nesting: `components/toolbar/file/` with 11 files
- Inconsistent import patterns (mix of `@/` aliases and relative imports)
- Component responsibilities unclear in some areas
- Toolbar file operations overly fragmented

#### 5. Import and Dependency Issues

- Mixed import styles: `@/services/...` vs `../../providers/...`
- Complex dependency webs between hooks and services
- Potential circular dependencies due to barrel exports

---

## 🎯 Refactoring Plan

### Phase 1: Provider Consolidation

#### Impact: High | Risk: High | Priority: 4

**Objectives:**

- Reduce provider chain complexity
- Eliminate cross-provider dependencies
- Simplify data flow

**Actions:**

1. **Merge Document-Related Contexts:**

   ```javascript
   DocumentProvider + SharedViewProvider + PreviewHTMLProvider
   → DocumentContextProvider
   ```

2. **Keep Separate:**
   - `AuthProvider` (independent auth state)
   - `ThemeProvider` (UI theme state)
   - `LoggerProvider` (infrastructure)
   - `NotificationProvider` (UI feedback)

3. **New Provider Structure:**

   ```javascript
   Logger → ErrorBoundary → Theme → Notifications → Auth → Document
   ```

**Expected Outcome:**

- 7 providers → 5 providers
- Eliminated 3 levels of provider nesting
- Clearer data flow and dependencies

**Files to Modify:**

- `providers/DocumentProvider.jsx` (merge logic)
- `providers/SharedViewProvider.jsx` (migrate to DocumentProvider)
- `providers/PreviewHTMLProvider.jsx` (migrate to DocumentProvider)
- `providers/AppProviders.jsx` (update provider chain)
- All components using these contexts

---

### Phase 2: Service Layer Restructuring

#### Impact: High | Risk: Low | Priority: 1

**Objectives:**

- Establish clear service boundaries
- Organize by business domain rather than technical type
- Eliminate service category confusion

**New Structure:**

```text
services/
├── core/                   # Core business logic
│   ├── DocumentService.js  # Document CRUD, storage, sync
│   ├── AuthService.js      # Authentication, user management
│   └── index.js           # Domain exports
├── editor/                # Editor-specific features
│   ├── EditorService.js   # Monaco editor management
│   ├── SpellCheckService.js
│   ├── HighlightService.js
│   ├── CommentService.js
│   └── index.js
├── rendering/             # Content rendering
│   ├── MarkdownRenderer.js # Main rendering logic
│   ├── MermaidService.js  # Diagram rendering
│   └── index.js
└── utilities/             # Pure utilities (no business logic)
    ├── storage.js         # LocalStorage utilities
    ├── notifications.js   # Notification utilities
    ├── dictionary.js      # Dictionary/spell-check utilities
    ├── icons.js          # Icon management utilities
    └── index.js
```

**Migration Map:**

- `services/auth/` → `services/core/` (rename auth → core, move AuthService)
- `services/document/` → `services/core/` (move DocumentService, DocumentStorageService)
- `services/ui/NotificationService.js` → `services/utilities/notifications.js`
- `services/utils/DictionaryService.js` → `services/utilities/dictionary.js`
- `services/utils/IconPackManager.js` → `services/utilities/icons.js`
- `services/utils/AwsIconLoader.js` → `services/utilities/icons.js`

**Actions:**

1. Create new directory structure
2. Move and rename service files
3. Update all import statements across the codebase
4. Update barrel exports (`index.js` files)
5. Test all functionality

**Expected Outcome:**

- 6 service directories → 4 service directories
- Clearer service responsibilities
- Eliminated service category confusion
- Better discoverability

---

### Phase 3: Hook Rationalization

#### Impact: Medium | Risk: Medium | Priority: 2

**Objectives:**

- Reduce hook count and complexity
- Consolidate related functionality
- Improve hook reusability

**Consolidation Plan:**

1. **File Operations Consolidation:**

   ```javascript
   useFileSaveController +
   useFileOpenController +
   useFileImportController +
   useFileExportController +
   useFileOverwriteController +
   useFileSaveAsController
   → useFileOperations
   ```

2. **Auto-Save Consolidation:**

   ```javascript
   useAutoSave + useAutoSaveManager → useDocumentAutoSave
   ```

3. **Editor Consolidation:**

   ```javascript
   useMonacoEditor + useSpellCheck + useKeyboardShortcuts + useListBehavior
   → useEditor (with options for enabling features)
   ```

4. **Keep Separate (Good Single Responsibility):**
   - `useChangeTracker` (document change detection)
   - `useAppUIState` (UI state management)
   - `useGlobalKeyboardShortcuts` (app-level shortcuts)
   - `useSharedViewEffects` (shared view logic)
   - `useRenderingProgress` (rendering progress tracking)

**Target Hook Count:** 20+ hooks → 8-10 focused hooks

**Actions:**

1. Create consolidated hook files
2. Migrate logic from multiple hooks into single hooks
3. Update all components using these hooks
4. Remove old hook files
5. Update hook barrel exports

**Expected Outcome:**

- Reduced hook complexity
- Better hook discoverability
- Fewer dependencies between hooks
- More maintainable hook logic

---

### Phase 4: Component Structure Simplification

#### Impact: Medium | Risk: Low | Priority: 3

**Objectives:**

- Flatten component hierarchy
- Improve component discoverability
- Standardize component organization

**New Structure:**

```text
components/
├── core/                  # Main application components
│   ├── App.jsx
│   ├── Header.jsx
│   ├── AppLayout.jsx
│   └── index.js
├── editor/               # Editor-related components
│   ├── Editor.jsx
│   ├── MarkdownToolbar.jsx
│   ├── Renderer.jsx
│   ├── SharedRenderer.jsx
│   └── index.js
├── file/                 # File operation components
│   ├── FileDropdown.jsx
│   ├── FileImportModal.jsx
│   ├── FileOpenModal.jsx
│   ├── FileOverwriteModal.jsx
│   ├── FileSaveAsModal.jsx
│   └── index.js
├── modals/               # All modal components
│   ├── LoginModal.jsx
│   ├── UserSettingsModal.jsx
│   ├── ShareModal.jsx
│   ├── ... (all existing modals)
│   └── index.js
├── sections/            # Layout sections
│   ├── EditorSection.jsx
│   ├── RendererSection.jsx
│   └── index.js
├── toolbar/             # Toolbar components
│   ├── Toolbar.jsx
│   ├── Document.jsx
│   ├── User.jsx
│   ├── ThemeToggle.jsx
│   └── index.js
└── ui/                  # Reusable UI components
    ├── LoadingOverlay.jsx
    ├── ProgressIndicator.jsx
    ├── NotificationProvider.jsx
    ├── GlobalErrorBoundary.jsx
    └── index.js
```

**Migration Actions:**

1. Move `components/toolbar/file/*` → `components/file/`
2. Create barrel exports for each component directory
3. Update all import statements
4. Remove empty directories

**Expected Outcome:**

- 21 directories → ~12 directories
- Flatter, more discoverable structure
- Clearer component categories
- Better component organization

---

### Phase 5: Import Standardization

#### Impact: Low | Risk: Low | Priority: 5

**Objectives:**

- Establish consistent import patterns
- Improve code readability
- Reduce import confusion

**Import Standards:**

1. **Service Imports:** Always use `@/services/...`
2. **Component Imports:** Use `@/components/...` for cross-directory
3. **Relative Imports:** Only for same-directory files
4. **Provider Imports:** Use `@/providers/...`
5. **Hook Imports:** Use `@/hooks/...`
6. **Utility Imports:** Use `@/utils/...`

**Actions:**

1. Audit all import statements
2. Standardize imports according to new patterns
3. Update any remaining relative imports to aliases
4. Verify no broken imports

**Expected Outcome:**

- Consistent import patterns across codebase
- Improved readability
- Easier refactoring in the future

---

## 📈 Expected Overall Outcomes

### Quantitative Improvements

- **Files:** 111 → ~85 files (-23%)
- **Directories:** 21 → ~12 directories (-43%)
- **Largest Files:** Break down 700+ line files to <400 lines
- **Provider Chain:** 7 providers → 5 providers (-29%)
- **Hooks:** 20+ hooks → 8-10 hooks (-50%)

### Qualitative Improvements

- **Maintainability:** Clearer service boundaries and responsibilities
- **Developer Experience:** Easier to locate and modify functionality
- **Testing:** More modular, testable components
- **Performance:** Reduced provider re-renders
- **Onboarding:** Clearer architectural patterns for new developers

### Risk Mitigation

- **Phase 2** (Service restructuring) is low-risk, high-impact
- **Phase 1** (Provider consolidation) requires careful testing
- Each phase can be implemented and tested independently

---

## 🚀 Implementation Recommendations

### Suggested Order

1. **Phase 2:** Service Layer Restructuring (High impact, Low risk)
2. **Phase 3:** Hook Rationalization (Medium impact, Medium risk)
3. **Phase 4:** Component Structure Simplification (Medium impact, Low risk)
4. **Phase 1:** Provider Consolidation (High impact, High risk)
5. **Phase 5:** Import Standardization (Low impact, Low risk)

### Success Criteria

- All existing functionality preserved
- No performance degradation
- Improved code organization metrics
- Positive developer feedback
- Easier feature development going forward

### Testing Strategy

- Run full test suite after each phase
- Manual testing of all major features
- Performance testing (bundle size, render times)
- Code review for each phase completion

---

## 📝 Usage Instructions

To execute a specific phase:

```bash
# Reference this document and specify the phase
"Based on FRONTEND_REFACTORING_PLAN.md, let's execute Phase 2"
```

Each phase should be completed fully before moving to the next phase to avoid conflicts and ensure stability.

---

## 📚 Additional Notes

### Dependencies Between Phases

- Phase 1 depends on Phase 3 (hooks must be simplified before provider consolidation)
- Phase 4 can be done independently
- Phase 5 should be done after all structural changes

### Rollback Strategy

- Each phase should be implemented in a separate commit
- Feature branch allows easy rollback if issues arise
- Keep detailed notes of changes for easier rollback

### Future Considerations

- Consider TypeScript migration after refactoring
- Performance optimization opportunities post-refactoring
- Documentation updates needed after completion

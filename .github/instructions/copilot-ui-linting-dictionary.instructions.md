---
description: "Use when working on markdown linting rules UI, custom dictionary management, dictionary scope selection, spell check API integration, or lint rule import/export."
applyTo: "services/ui/src/components/linting/**,services/ui/src/components/dictionary/**,services/ui/src/hooks/dictionary/**,services/ui/src/services/dictionary/**,services/ui/src/api/lintingApi*,services/ui/src/api/customDictionaryApi*,services/ui/src/api/spellCheckApi*,services/ui/src/hooks/useMarkdownLintRules*"
---
# Linting & Dictionary UI

## Markdown Linting (`components/linting/`)

### MarkdownLintTab (main entry)
Rule management interface with:
- Persisted rules from `useMarkdownLintRules` + local editable state
- **Rule catalog**: API definitions merged with fallback definitions for resilience
- **Category-oriented editing**: Rules grouped by domain (Headings, Lists, Code, Whitespace, Links, etc.) with enable-all/disable-all per category
- **Import/export**: JSON config with version + timestamp; import validates shape via `validateRules` before applying
- **Config input**: `RuleConfigInput` renders select/number/boolean/text based on `definition.options` metadata

### Linting API (`lintingApi`)
- `getUserConfig()` → 404 returns null (use defaults)
- `getEffectiveRules()` → Fallback chain: no token → recommended defaults; user disabled → empty; failure → defaults → empty
- Supports user, category, and folder rule scopes
- `processText(content, rules)` → Lint endpoint
- Save/delete clears internal rules cache

## Custom Dictionary (`components/dictionary/`)

### Dictionary Scope System
Three scope types with resolution based on current document:
1. **User** (personal/global) → Always available
2. **Folder** (root folder scoped) → Local documents use first path segment
3. **GitHub** (repository scoped) → GitHub documents use `/github/repoName`

Scope resolution in `DictionaryScopeUtils`:
- No document → user scope
- GitHub doc (source=github or has repository_id) → folderPath `/github/repoName`
- Local doc → folder scope from first path segment only

### Components
- `DictionaryTab` → Main dictionary management interface
- `DictionaryAddWordForm` → Add word with scope selection
- `DictionaryScopeSelector` → Scope picker showing available scopes from document corpus
- `DictionaryWordList` → Filtered word list with delete capability

### Dictionary Hooks (`hooks/dictionary/`)
- `useDictionaryState` → Words, loading, selected scope
- `useDictionaryOperations` → Add/delete routing: folderPath → folder service, categoryId → legacy category service, else → user service
- `useDictionaryUI` → UI state (filters, selection)

### Dictionary Services (`services/dictionary/`)
- `UserDictionaryService` → localStorage-backed personal word cache (key: `customDictionary`)
- `FolderDictionaryService` → Folder-scoped dictionary operations
- `CategoryDictionaryService` → Legacy category-compatible dictionary (backward compat)
- `DictionarySyncService` → Backend synchronization
- `DictionaryScopeUtils` → Scope resolution logic
- `DictionaryEntryFormatter` → Display formatting

### Dictionary API (`customDictionaryApi`)
Folder-first with category fallback:
- `getWords(folder_path | category_id)`, `getEntries(...)`
- `addWord({ word, folder_path?, category_id? })` → folder_path preferred
- `deleteWord(id)`, `deleteByText(word, scope?)`
- Bulk operations and scope-specific read methods

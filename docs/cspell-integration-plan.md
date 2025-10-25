# CSpell Integration Plan - Code Fence Spell Checking

**Target**: Integrate cspell into the existing spell-check-service for intelligent code fence spell checking
**Status**: Implementation Plan
**Priority**: High - Practical enhancement with immediate value

---

## 🎯 Objective

Enhance the spell-check service to intelligently spell check code within markdown code fences using CSpell, providing:
- Language-aware comment extraction and spell checking
- Variable/function name spell checking (camelCase, snake_case)
- String literal spell checking (configurable)
- Technical dictionary support
- Separate severity/styling for code vs prose issues

---

## 🏗️ Architecture Overview

### Current Flow
```
Frontend → Backend API → Spell Check Service → Response
```

### Enhanced Flow with CSpell
```
Frontend → Backend API → Spell Check Service
                            ↓
                          Parse Document
                            ↓
                    ┌─────────────────┐
                    │   Text Content  │
                    │  (existing flow) │
                    └─────────────────┘
                            ↓
                    ┌─────────────────┐
                    │   Code Fences   │
                    │  (new cspell)   │
                    └─────────────────┘
                            ↓
                       Merge Results
                            ↓
                         Response
```

---

## 📋 Implementation Plan

### Phase 1: Service Architecture (1-2 days)

#### 1.1 Add CSpell Dependencies
```bash
# Add to spell-check-service/package.json
npm install cspell-lib @cspell/cspell-bundled-dicts
```

**Key packages**:
- `cspell-lib` - Core spell checking engine
- `@cspell/cspell-bundled-dicts` - Programming language dictionaries
- Optional: `@cspell/dict-*` packages for specific languages

#### 1.2 Create CSpell Integration Module
**File**: `spell-check-service/lib/CSpellCodeChecker.js`

**Responsibilities**:
- Initialize cspell with programming language configurations
- Parse code fences with language detection
- Extract spellcheckable content (comments, strings, identifiers)
- Transform results to match existing API format
- Handle technical dictionaries and exclusions

#### 1.3 Enhance Document Parser
**File**: `spell-check-service/lib/MarkdownCodeFenceParser.js`

**Responsibilities**:
- Extract code fences with language and position information
- Identify supported programming languages
- Handle edge cases (unclosed fences, nested content)
- Maintain accurate position mapping for results

### Phase 2: CSpell Engine Integration (2-3 days)

#### 2.1 Language Configuration Matrix
```javascript
// Support matrix for initial implementation
const SUPPORTED_LANGUAGES = {
  // High priority - common languages
  'javascript': { cspellId: 'javascript', checkIdentifiers: true },
  'typescript': { cspellId: 'typescript', checkIdentifiers: true },
  'python': { cspellId: 'python', checkIdentifiers: true },
  'java': { cspellId: 'java', checkIdentifiers: true },
  'html': { cspellId: 'html', checkIdentifiers: false },
  'php': { cspellId: 'php', checkIdentifiers: true },

  // Medium priority - markup/config
  'json': { cspellId: 'json', checkIdentifiers: false },
  'yaml': { cspellId: 'yaml', checkIdentifiers: false },
  'sql': { cspellId: 'sql', checkIdentifiers: true },

  // Lower priority - system languages
  'cpp': { cspellId: 'cpp', checkIdentifiers: true },
  'rust': { cspellId: 'rust', checkIdentifiers: true },
  'go': { cspellId: 'go', checkIdentifiers: true }
};
```

#### 2.2 Content Extraction Strategy
**What to spell check**:
- ✅ **Comments** (single-line, multi-line, documentation)
- ✅ **String literals** (configurable - may be too noisy)
- ✅ **Variable/function names** (split camelCase/snake_case)
- ❌ **Keywords, operators, built-ins** (excluded)
- ❌ **Import paths, URLs** (excluded)

#### 2.3 Result Classification
```javascript
// Different severity for code vs prose
const CODE_ISSUE_TYPES = {
  'code-comment': 'info',     // Blue underline - comments
  'code-string': 'hint',      // Gray underline - strings
  'code-identifier': 'info',  // Blue underline - variables
  'code-documentation': 'info' // Blue underline - JSDoc/docstrings
};
```

### Phase 3: API Integration (1 day)

#### 3.1 Enhanced Main Endpoint
**Endpoint**: `POST /check` (existing)

**Enhanced request**:
```javascript
{
  "text": "markdown content with code fences",
  "customWords": ["..."],
  "options": {
    "enableCodeSpellCheck": true,        // NEW
    "codeSpellSettings": {               // NEW
      "checkComments": true,
      "checkStrings": false,             // Often too noisy
      "checkIdentifiers": true,
      "supportedLanguages": ["javascript", "python"],
      "severity": "info"                 // Lower than prose issues
    }
  }
}
```

**Enhanced response**:
```javascript
{
  "results": {
    "spelling": [...],     // Existing prose spell check
    "grammar": [...],      // Existing grammar check
    "style": [...],        // Existing style check
    "codeSpelling": [...]  // NEW - code fence issues
  },
  // ... existing fields
  "codeSpellStatistics": { // NEW
    "codeBlocks": 3,
    "languagesDetected": ["javascript", "python"],
    "issuesFound": 5
  }
}
```

#### 3.2 Optional: Dedicated Code Endpoint
**Endpoint**: `POST /check-code` (optional)

For direct code checking without markdown parsing:
```javascript
{
  "code": "function getUserName() { return 'jhon doe'; }",
  "language": "javascript",
  "options": { ... }
}
```

### Phase 4: Frontend Integration (1 day)

#### 4.1 Enhanced Spell Check Settings
**File**: `frontend/src/components/editor/spell-check/SpellCheckSettingsPanel.jsx`

Add code spell check toggle:
```jsx
<div className="setting-group">
  <label>
    <input
      type="checkbox"
      checked={settings.enableCodeSpellCheck}
      onChange={...}
    />
    Code Spell Check
  </label>
  <div className="sub-settings">
    <label>
      <input type="checkbox" checked={settings.codeSpellSettings.checkComments} />
      Comments
    </label>
    <label>
      <input type="checkbox" checked={settings.codeSpellSettings.checkIdentifiers} />
      Variable Names
    </label>
  </div>
</div>
```

#### 4.2 Monaco Editor Markers
**File**: `frontend/src/services/editor/SpellCheckMarkers.js`

Add code-specific marker styling:
```javascript
createCodeSpellingMarkers(monaco, issues) {
  return issues.map(issue => ({
    // ... existing marker fields
    severity: monaco.MarkerSeverity.Info,  // Blue for code issues
    tags: [monaco.MarkerTag.Unnecessary],  // Subtle styling
    source: 'code-spell-check'
  }));
}
```

---

## 🔧 Technical Implementation Details

### Configuration Strategy
```javascript
// spell-check-service/config/cspell-config.json
{
  "version": "0.2",
  "language": "en",
  "dictionaries": [
    "typescript",
    "node",
    "npm",
    "filetypes",
    "softwareTerms",
    "companies"
  ],
  "dictionaryDefinitions": [
    {
      "name": "custom-tech",
      "path": "./dictionaries/custom-technical.txt"
    }
  ],
  "languageSettings": [
    {
      "languageId": "javascript,typescript",
      "dictionaries": ["typescript", "node", "npm"]
    },
    {
      "languageId": "python",
      "dictionaries": ["python", "django", "flask"]
    }
  ]
}
```

### Performance Considerations

#### 1. **Caching Strategy**
- Cache cspell configurations per language
- Cache parsed code fence positions
- Implement LRU cache for frequent code blocks

#### 2. **Chunking for Large Documents**
- Process code fences in parallel
- Limit individual code fence size (e.g., 10KB max)
- Skip very large code blocks with warning

#### 3. **Memory Management**
- Initialize cspell engine once per language
- Dispose of language engines not used in 5+ minutes
- Monitor memory usage and restart service if needed

### Error Handling

#### 1. **Graceful Degradation**
- If cspell fails, return only standard spell check results
- Log cspell errors but don't fail entire request
- Provide fallback for unsupported languages

#### 2. **Language Detection Issues**
- Default to generic text checking for unknown languages
- Provide language hints in frontend based on fence declaration
- Allow manual language override in settings

---

## 📊 Implementation Phases & Timeline

| Phase | Duration | Deliverables |
|-------|----------|-------------|
| **Phase 1** | 1-2 days | CSpell dependencies, basic integration module |
| **Phase 2** | 2-3 days | Full code fence parsing, language support matrix |
| **Phase 3** | 1 day | API enhancement, response format updates |
| **Phase 4** | 1 day | Frontend settings and marker integration |
| **Testing** | 1 day | Integration testing, performance validation |

**Total Estimated Time**: 5-7 days

---

## 🎯 Success Metrics

### Functional Requirements
- [ ] Support 5+ programming languages initially
- [ ] Extract and spell check comments in code fences
- [ ] Variable name spell checking (camelCase/snake_case)
- [ ] Configurable code spell check settings
- [ ] Visual differentiation from prose issues (blue markers)
- [ ] Performance: <200ms additional overhead for typical documents

### Quality Requirements
- [ ] False positive rate <5% for technical terms
- [ ] No degradation in existing spell check performance
- [ ] Graceful handling of unsupported languages
- [ ] Comprehensive error handling and logging

---

## 🚀 Future Enhancements (Post-MVP)

### Short Term
- Add more programming languages (C#, Ruby, Swift)
- Custom technical dictionary management
- Language-specific configuration (e.g., Python docstring checking)

### Long Term
- Integration with code linting rules
- Context-aware suggestions (API names, framework terms)
- Team-wide code spell check policies
- IDE extension integration

---

## 🔍 Risk Assessment

### Technical Risks
- **CSpell bundle size**: Could increase service image size significantly
  - *Mitigation*: Use selective dictionary imports, optimize Docker layers
- **Performance impact**: Additional processing overhead
  - *Mitigation*: Parallel processing, caching, performance monitoring
- **Memory usage**: Multiple language engines in memory
  - *Mitigation*: Lazy loading, memory monitoring, engine disposal

### Implementation Risks
- **False positives**: Code terms flagged as misspellings
  - *Mitigation*: Comprehensive technical dictionaries, extensive testing
- **Language detection accuracy**: Wrong language applied to code fence
  - *Mitigation*: Explicit language declaration, fallback strategies

### Operational Risks
- **Service complexity**: Added complexity to deployment and maintenance
  - *Mitigation*: Comprehensive documentation, monitoring, gradual rollout

---

**Recommendation**: This is a high-value, practical enhancement that leverages proven technology (CSpell) to provide immediate developer value. The implementation is straightforward, builds on existing architecture, and provides a clear upgrade path for the spell-check service.
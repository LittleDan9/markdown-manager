---
applyTo: "frontend/src/services/editor/**/*"
description: "Phase 1: Core Service Architecture - MarkdownLintService, MarkdownLintWorkerPool, MarkdownLintMarkers, MarkdownLintMarkerAdapter, MarkdownLintActions"
---

# Phase 1: Core Service Architecture Implementation

## 🎯 **Phase Objective**
Implement the core service layer for markdown linting following the proven spell checker architecture patterns. This phase establishes the foundational services that all other components will depend on.

## 📋 **Requirements Analysis**

### **Pattern Matching with Spell Checker**
Study these existing files for architectural patterns:
- `frontend/src/services/editor/SpellCheckService.js` - Core service structure
- `frontend/src/services/editor/SpellCheckWorkerPool.js` - Worker pool management
- `frontend/src/services/editor/SpellCheckMarkers.js` - Monaco marker handling
- `frontend/src/services/editor/MonacoMarkerAdapter.js` - Issue to marker conversion
- `frontend/src/services/editor/SpellCheckActions.js` - Quick fix integration

### **Key Dependencies**
- `markdownlint` library (install via npm)
- Monaco Editor integration
- Existing worker infrastructure patterns
- Text chunking utilities from `@/utils`

## 🔧 **Implementation Tasks**

### **Task 1.1: MarkdownLintService**
**File**: `frontend/src/services/editor/MarkdownLintService.js`

```javascript
// Import pattern matching SpellCheckService
import MarkdownLintWorkerPool from './MarkdownLintWorkerPool';
import { chunkTextWithOffsets } from '@/utils';
import MarkdownLintRulesService from '../linting/MarkdownLintRulesService';

export class MarkdownLintService {
  constructor(chunkSize = 2000) {
    this.workerPool = new MarkdownLintWorkerPool(4);
    this.chunkSize = chunkSize;
  }

  async init() {
    if (this.workerPool?.workers?.length > 0) return;
    await this.workerPool.init();
  }

  async scan(text, onProgress = () => {}, categoryId = null, folderPath = null) {
    await this.init();

    // Get applicable rules for this category/folder
    const rules = MarkdownLintRulesService.getApplicableRules(folderPath, categoryId);

    // Chunk text for parallel processing (pattern from SpellCheckService)
    const chunks = chunkTextWithOffsets(text, this.chunkSize);
    const chunksWithRules = chunks.map(chunk => ({
      text: chunk.text,
      startOffset: chunk.offset,
      rules
    }));

    // Process chunks in parallel
    const issues = await this.workerPool.runLintOnChunks(
      chunksWithRules,
      rules,
      onProgress
    );

    return issues;
  }

  terminate() {
    if (this.workerPool) {
      this.workerPool.terminate();
    }
  }
}

// Export singleton instance (pattern from SpellCheckService)
export default new MarkdownLintService();
```

### **Task 1.2: MarkdownLintWorkerPool**
**File**: `frontend/src/services/editor/MarkdownLintWorkerPool.js`

```javascript
// Pattern matches SpellCheckWorkerPool structure
const DEFAULT_MAX_WORKERS = 4;

class MarkdownLintWorkerPool {
  constructor(maxWorkers) {
    this.maxWorkers = Math.min(
      maxWorkers || navigator.hardwareConcurrency || 2,
      DEFAULT_MAX_WORKERS
    );
    this.workers = [];
    this.idleWorkers = [];
    this.taskQueue = [];
    this.activeTasks = 0;
    this.results = [];
    this.progressCallback = null;
    this.totalChunks = 0;
    this.completedChunks = 0;
  }

  async init() {
    if (this.workers?.length > 0) return;

    for (let i = 0; i < this.maxWorkers; i++) {
      try {
        // Use worker-loader import pattern (matches SpellCheckWorkerPool)
        const MarkdownLintWorker = require('../../workers/markdownLint.worker.js').default;
        const worker = new MarkdownLintWorker();

        worker.onmessage = (e) => this._handleWorkerMessage(worker, e);
        worker.onerror = (err) => {
          console.error(`[MarkdownLintWorkerPool] Worker #${i+1} error:`, err.message);
        };

        this.workers.push(worker);
        this.idleWorkers.push(worker);
      } catch (err) {
        console.error(`[MarkdownLintWorkerPool] Failed to create worker #${i+1}:`, err);
      }
    }
  }

  terminate() {
    this.workers.forEach(w => w.terminate());
    this.workers = [];
    this.idleWorkers = [];
    this.taskQueue = [];
    this.results = [];
    this.activeTasks = 0;
    this.progressCallback = null;
    this.totalChunks = 0;
    this.completedChunks = 0;
  }

  runLintOnChunks(chunks, rules, progressCallback) {
    this.results = new Array(chunks.length);
    this.progressCallback = progressCallback;
    this.totalChunks = chunks.length;
    this.completedChunks = 0;
    this.taskQueue = chunks.map((chunk, idx) => ({ chunk, idx }));
    this.activeTasks = 0;
    this._rules = rules;

    return new Promise((resolve, reject) => {
      this._resolve = resolve;
      this._reject = reject;
      this._dispatchTasks();
    });
  }

  _dispatchTasks() {
    while (this.idleWorkers.length > 0 && this.taskQueue.length > 0) {
      const worker = this.idleWorkers.pop();
      const { chunk, idx } = this.taskQueue.shift();
      this.activeTasks++;

      worker._currentTaskIdx = idx;
      const requestId = `task_${idx}_${Date.now()}`;
      worker._currentRequestId = requestId;

      worker.postMessage({
        type: 'lintChunk',
        chunk,
        rules: this._rules,
        requestId
      });
    }
  }

  _handleWorkerMessage(worker, e) {
    const { type, requestId, issues, error } = e.data;

    if (type === 'lintComplete') {
      const taskIdx = worker._currentTaskIdx;
      this.results[taskIdx] = issues || [];
      this.completedChunks++;
      this.activeTasks--;

      // Progress callback
      if (this.progressCallback) {
        this.progressCallback(this.completedChunks / this.totalChunks);
      }

      // Return worker to idle pool
      this.idleWorkers.push(worker);
      worker._currentTaskIdx = null;
      worker._currentRequestId = null;

      // Check if all tasks complete
      if (this.completedChunks === this.totalChunks) {
        const allIssues = this.results.flat();
        this._resolve(allIssues);
      } else {
        this._dispatchTasks();
      }
    } else if (type === 'lintError') {
      console.error('[MarkdownLintWorkerPool] Worker error:', error);
      this._reject(new Error(error));
    }
  }
}

export default MarkdownLintWorkerPool;
```

### **Task 1.3: MarkdownLintMarkers**
**File**: `frontend/src/services/editor/MarkdownLintMarkers.js`

```javascript
// Pattern matches SpellCheckMarkers exactly
import * as monaco from 'monaco-editor';

/**
 * Service for managing markdown lint markers in Monaco editor
 */
export default class MarkdownLintMarkers {
  /**
   * Clear all markdown lint markers from the Monaco editor
   * @param {Object} editor - Monaco editor instance
   * @param {Map} suggestionsMap - The suggestions map to clear (optional)
   */
  static clearMarkers(editor, suggestionsMap = null) {
    if (!editor || typeof editor.getModel !== 'function') return;

    // Guard against Monaco not being loaded
    if (!monaco || !monaco.editor) {
      console.warn('Monaco editor not fully loaded, skipping marker clearing');
      return;
    }

    const model = editor.getModel();
    if (model) {
      monaco.editor.setModelMarkers(model, 'markdownlint', []);
      if (suggestionsMap) {
        suggestionsMap.clear();
      }
    }
  }

  /**
   * Get existing markdown lint markers for a model
   * @param {Object} model - Monaco editor model
   * @returns {Array} Array of existing markdown lint markers
   */
  static getExistingMarkers(model) {
    if (!monaco || !monaco.editor || !model) {
      return [];
    }

    return monaco.editor.getModelMarkers({ resource: model.uri })
      .filter(m => m.owner === 'markdownlint');
  }

  /**
   * Filter markers that are outside a specific region
   * @param {Array} markers - Array of Monaco markers
   * @param {Object} model - Monaco editor model
   * @param {number} startOffset - Start offset of the region
   * @param {number} endOffset - End offset of the region
   * @returns {Array} Filtered markers outside the region
   */
  static filterMarkersOutsideRegion(markers, model, startOffset, endOffset) {
    return markers.filter(m => {
      const markerStart = model.getOffsetAt({
        lineNumber: m.startLineNumber,
        column: m.startColumn
      });
      const markerEnd = model.getOffsetAt({
        lineNumber: m.endLineNumber,
        column: m.endColumn
      });
      return markerEnd < startOffset || markerStart > endOffset;
    });
  }

  /**
   * Apply markers to the Monaco editor model
   * @param {Object} model - Monaco editor model
   * @param {Array} markers - Array of markers to apply
   */
  static applyMarkers(model, markers) {
    if (!monaco || !monaco.editor || !model) {
      console.warn('Monaco editor not available for applying markers');
      return;
    }

    monaco.editor.setModelMarkers(model, 'markdownlint', markers);
  }
}
```

### **Task 1.4: MarkdownLintMarkerAdapter**
**File**: `frontend/src/services/editor/MarkdownLintMarkerAdapter.js`

```javascript
// Pattern matches MonacoMarkerAdapter structure
import * as monaco from 'monaco-editor';
import MarkdownLintMarkers from './MarkdownLintMarkers';

/**
 * Service for converting markdown lint issues to Monaco markers
 */
export default class MarkdownLintMarkerAdapter {
  /**
   * Convert markdown lint issues to Monaco markers
   * @param {Object} editor - Monaco editor instance
   * @param {Array} issues - Array of markdown lint issues
   * @param {number} startOffset - Offset where the scanned region starts
   * @returns {Array} Array of Monaco markers
   */
  static toMonacoMarkers(editor, issues, startOffset = 0) {
    if (!editor || !issues) return [];

    const model = editor.getModel();
    if (!model) return [];

    const markers = this._createMarkersFromIssues(model, issues, startOffset);

    return markers;
  }

  /**
   * Create Monaco markers from markdown lint issues
   * @param {Object} model - Monaco editor model
   * @param {Array} issues - Array of markdown lint issues
   * @param {number} startOffset - Start offset for the region
   * @returns {Array} Array of Monaco markers
   * @private
   */
  static _createMarkersFromIssues(model, issues, startOffset) {
    const markers = [];

    issues.forEach(issue => {
      const marker = this._createMarkerFromIssue(model, issue, startOffset);
      if (marker) {
        markers.push(marker);
      }
    });

    return markers;
  }

  /**
   * Create a single Monaco marker from a markdown lint issue
   * @param {Object} model - Monaco editor model
   * @param {Object} issue - Markdown lint issue
   * @param {number} startOffset - Start offset for the region
   * @returns {Object|null} Monaco marker or null if creation failed
   * @private
   */
  static _createMarkerFromIssue(model, issue, startOffset) {
    try {
      // Adjust line number (markdownlint uses 1-based, Monaco uses 1-based)
      const lineNumber = issue.lineNumber;
      const startColumn = issue.columnNumber || 1;
      const endColumn = startColumn + (issue.length || 1);

      // Determine severity
      const severity = this._getSeverity(issue.severity || 'warning');

      // Create descriptive message
      const ruleCode = issue.ruleNames?.[0] || 'MD000';
      const message = `${ruleCode}: ${issue.ruleDescription || 'Markdown linting issue'}`;

      return {
        owner: 'markdownlint',
        severity,
        message,
        startLineNumber: lineNumber,
        startColumn,
        endLineNumber: lineNumber,
        endColumn,
        code: ruleCode,
        tags: issue.fixable ? [monaco.MarkerTag.Unnecessary] : []
      };
    } catch (error) {
      console.warn('Failed to create marker from issue:', issue, error);
      return null;
    }
  }

  /**
   * Convert issue severity to Monaco severity
   * @param {string} severity - Issue severity level
   * @returns {number} Monaco MarkerSeverity
   * @private
   */
  static _getSeverity(severity) {
    switch (severity?.toLowerCase()) {
      case 'error':
        return monaco.MarkerSeverity.Error;
      case 'warning':
        return monaco.MarkerSeverity.Warning;
      case 'info':
        return monaco.MarkerSeverity.Info;
      default:
        return monaco.MarkerSeverity.Warning;
    }
  }
}
```

### **Task 1.5: MarkdownLintActions**
**File**: `frontend/src/services/editor/MarkdownLintActions.js`

```javascript
// Pattern matches SpellCheckActions structure
import * as monaco from 'monaco-editor';
import MarkdownLintService from './MarkdownLintService';
import MarkdownLintMarkerAdapter from './MarkdownLintMarkerAdapter';

/**
 * Service for managing markdown lint quick fix actions and commands in Monaco editor
 */
export default class MarkdownLintActions {
  /**
   * Register quick fix actions for markdown linting
   * @param {Object} editor - Monaco editor instance
   * @param {Function|string} getCategoryId - Function or value to get category ID
   * @param {Function|string} getFolderPath - Function or value to get folder path
   */
  static registerQuickFixActions(editor, getCategoryId, getFolderPath) {
    this._registerCodeActionProvider(getCategoryId, getFolderPath);
    this._registerGlobalCommands(getCategoryId, getFolderPath);
  }

  /**
   * Register code action provider for markdown lint quick fixes
   * @param {Function|string} getCategoryId - Function or value to get category ID
   * @param {Function|string} getFolderPath - Function or value to get folder path
   * @private
   */
  static _registerCodeActionProvider(getCategoryId, getFolderPath) {
    monaco.languages.registerCodeActionProvider('markdown', {
      provideCodeActions: (model, range, context) => {
        const actions = [];

        context.markers
          .filter(m => m.owner === 'markdownlint')
          .forEach(marker => {
            // Auto-fix action for fixable rules
            if (this._isFixableRule(marker.code)) {
              actions.push({
                title: `Fix ${marker.code}`,
                kind: monaco.languages.CodeActionKind.QuickFix,
                edit: this._createFixEdit(model, marker),
                diagnostics: [marker]
              });
            }

            // Disable rule action
            actions.push({
              title: `Disable ${marker.code} for this line`,
              kind: monaco.languages.CodeActionKind.QuickFix,
              edit: this._createDisableEdit(model, marker),
              diagnostics: [marker]
            });

            // View rule documentation
            actions.push({
              title: `View ${marker.code} documentation`,
              kind: monaco.languages.CodeActionKind.QuickFix,
              command: {
                id: 'markdownlint.viewRuleDoc',
                title: 'View Rule Documentation',
                arguments: [marker.code]
              },
              diagnostics: [marker]
            });
          });

        return { actions, dispose: () => {} };
      }
    });
  }

  /**
   * Register global Monaco commands
   * @param {Function|string} getCategoryId - Function or value to get category ID
   * @param {Function|string} getFolderPath - Function or value to get folder path
   * @private
   */
  static _registerGlobalCommands(getCategoryId, getFolderPath) {
    // Run markdown lint command
    monaco.editor.addCommand({
      id: 'markdownlint.runLint',
      run: async (accessor, ...args) => {
        const editor = monaco.editor.getActiveCodeEditor();
        if (editor) {
          await this._triggerFullLint(editor, getCategoryId, getFolderPath);
        }
      }
    });

    // View rule documentation command
    monaco.editor.addCommand({
      id: 'markdownlint.viewRuleDoc',
      run: (accessor, ruleCode) => {
        const url = `https://github.com/DavidAnson/markdownlint/blob/main/doc/${ruleCode.toLowerCase()}.md`;
        window.open(url, '_blank');
      }
    });
  }

  /**
   * Check if a rule is auto-fixable
   * @param {string} ruleCode - Rule code (e.g., 'MD001')
   * @returns {boolean} True if rule is fixable
   * @private
   */
  static _isFixableRule(ruleCode) {
    // Auto-fixable rules from markdownlint
    const fixableRules = [
      'MD004', 'MD005', 'MD007', 'MD009', 'MD010', 'MD011', 'MD012', 'MD014',
      'MD018', 'MD019', 'MD020', 'MD021', 'MD022', 'MD023', 'MD026', 'MD027',
      'MD030', 'MD031', 'MD032', 'MD034', 'MD037', 'MD038', 'MD039', 'MD044',
      'MD047', 'MD049', 'MD050', 'MD051', 'MD053', 'MD054', 'MD058'
    ];
    return fixableRules.includes(ruleCode);
  }

  /**
   * Create auto-fix edit for a marker
   * @param {Object} model - Monaco editor model
   * @param {Object} marker - Monaco marker
   * @returns {Object} Monaco workspace edit
   * @private
   */
  static _createFixEdit(model, marker) {
    // This would contain the actual fix logic for each rule
    // For now, return a placeholder edit
    return {
      edits: [{
        resource: model.uri,
        edit: {
          range: {
            startLineNumber: marker.startLineNumber,
            startColumn: marker.startColumn,
            endLineNumber: marker.endLineNumber,
            endColumn: marker.endColumn
          },
          text: '' // Placeholder - actual fix would be rule-specific
        }
      }]
    };
  }

  /**
   * Create disable comment edit for a marker
   * @param {Object} model - Monaco editor model
   * @param {Object} marker - Monaco marker
   * @returns {Object} Monaco workspace edit
   * @private
   */
  static _createDisableEdit(model, marker) {
    const lineContent = model.getLineContent(marker.startLineNumber);
    const disableComment = `<!-- markdownlint-disable-next-line ${marker.code} -->`;

    return {
      edits: [{
        resource: model.uri,
        edit: {
          range: {
            startLineNumber: marker.startLineNumber,
            startColumn: 1,
            endLineNumber: marker.startLineNumber,
            endColumn: 1
          },
          text: disableComment + '\n'
        }
      }]
    };
  }

  /**
   * Trigger full lint of the editor content
   * @param {Object} editor - Monaco editor instance
   * @param {Function|string} getCategoryId - Function or value to get category ID
   * @param {Function|string} getFolderPath - Function or value to get folder path
   * @private
   */
  static async _triggerFullLint(editor, getCategoryId, getFolderPath) {
    const model = editor.getModel();
    if (!model) return;

    const text = model.getValue();
    const currentCategoryId = typeof getCategoryId === 'function' ? getCategoryId() : getCategoryId;
    const currentFolderPath = typeof getFolderPath === 'function' ? getFolderPath() : getFolderPath;

    try {
      const issues = await MarkdownLintService.scan(text, () => {}, currentCategoryId, currentFolderPath);
      const markers = MarkdownLintMarkerAdapter.toMonacoMarkers(editor, issues, 0);

      monaco.editor.setModelMarkers(model, 'markdownlint', markers);
    } catch (error) {
      console.error('Failed to run markdown lint:', error);
    }
  }
}
```

### **Task 1.6: Update Services Index**
**File**: `frontend/src/services/editor/index.js`

Add exports for new markdown lint services:

```javascript
// Add these exports to the existing index.js
export { default as MarkdownLintService } from './MarkdownLintService';
export { default as MarkdownLintWorkerPool } from './MarkdownLintWorkerPool';
export { default as MarkdownLintMarkers } from './MarkdownLintMarkers';
export { default as MarkdownLintMarkerAdapter } from './MarkdownLintMarkerAdapter';
export { default as MarkdownLintActions } from './MarkdownLintActions';

// Backward compatibility exports for markdown lint
export const clearMarkdownLintMarkers = (editor, suggestionsMap) =>
  MarkdownLintMarkers.clearMarkers(editor, suggestionsMap);
```

## ✅ **Verification Steps**

1. **Service Initialization**: Verify MarkdownLintService initializes without errors
2. **Worker Pool**: Confirm worker pool creates workers and handles messages
3. **Marker Management**: Test marker clearing, application, and filtering
4. **Issue Conversion**: Verify issues convert to proper Monaco markers
5. **Action Registration**: Confirm quick fix actions register correctly

## 🔗 **Integration Points**

- **Next Phase**: Phase 2 will implement the worker script that these services depend on
- **Dependencies**: Requires markdownlint library installation
- **Testing**: Unit tests should follow patterns in `tests/unit/services/`

## 📝 **Implementation Notes**

- Follow exact patterns from spell checker services for consistency
- Use same error handling and logging approaches
- Maintain same performance characteristics (chunking, worker pools)
- Ensure Monaco integration matches existing patterns
- Keep marker ownership separate ('markdownlint' vs 'spell')

This phase establishes the core foundation that all other markdown linting functionality will build upon.
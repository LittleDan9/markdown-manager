---
applyTo: "frontend/src/workers/**/*"
description: "Phase 2: Worker Implementation - markdownLint.worker.js background processing"
---

# Phase 2: Worker Implementation

## 🎯 **Phase Objective**
Implement the Web Worker that performs markdown linting in the background, following the pattern established by the spell check worker. This worker will process text chunks using the markdownlint library and return issues to the main thread.

## 📋 **Requirements Analysis**

### **Pattern Matching with Spell Check Worker**
Study the existing spell check worker:
- `frontend/src/workers/spellCheck.worker.js` - Worker message handling
- Worker communication patterns (postMessage/onmessage)
- Error handling and request ID tracking
- Chunk processing workflows

### **Dependencies**
- `markdownlint` library (core linting engine)
- Webpack worker-loader configuration
- Message passing interface matching the worker pool expectations

## 🔧 **Implementation Tasks**

### **Task 2.1: Install markdownlint Library**
```bash
cd frontend
npm install markdownlint
```

### **Task 2.2: Create Markdown Lint Worker**
**File**: `frontend/src/workers/markdownLint.worker.js`

```javascript
// Import markdownlint library
import { markdownlint } from 'markdownlint/lib/markdownlint';

/**
 * Markdown Lint Web Worker
 * Processes markdown text chunks using markdownlint library
 * Communicates with MarkdownLintWorkerPool via message passing
 */

self.onmessage = function(e) {
  const { type, chunk, rules, requestId } = e.data;

  if (type === 'lintChunk') {
    try {
      // Process the markdown chunk
      const result = processMarkdownChunk(chunk, rules, requestId);

      // Send results back to main thread
      self.postMessage({
        type: 'lintComplete',
        requestId,
        issues: result.issues
      });
    } catch (error) {
      // Send error back to main thread
      self.postMessage({
        type: 'lintError',
        requestId,
        error: error.message
      });
    }
  }
};

/**
 * Process a markdown chunk using markdownlint
 * @param {Object} chunk - Text chunk with startOffset
 * @param {Object} rules - Linting rules configuration
 * @param {string} requestId - Unique request identifier
 * @returns {Object} Linting results
 */
function processMarkdownChunk(chunk, rules, requestId) {
  // Prepare markdownlint options
  const options = {
    strings: {
      [requestId]: chunk.text
    },
    config: rules,
    resultVersion: 3 // Use latest result format
  };

  // Run markdownlint
  const results = markdownlint.sync(options);
  const rawIssues = results[requestId] || [];

  // Transform issues to include global offsets
  const issues = rawIssues.map(issue => {
    // Calculate global offset by adding chunk offset to line-based position
    const lineOffset = calculateLineOffset(chunk.text, issue.lineNumber - 1);
    const globalOffset = chunk.startOffset + lineOffset + (issue.columnNumber - 1);

    return {
      // Core issue properties
      ruleNames: issue.ruleNames,
      ruleDescription: issue.ruleDescription,
      ruleInformation: issue.ruleInformation,

      // Position information
      lineNumber: issue.lineNumber,
      columnNumber: issue.columnNumber,
      offset: globalOffset, // Global document offset
      length: issue.errorRange ? issue.errorRange[1] : 1,

      // Severity and fixing
      severity: 'warning', // markdownlint typically uses warnings
      fixable: isFixableRule(issue.ruleNames[0]),

      // Error context
      errorContext: issue.errorContext,
      errorDetail: issue.errorDetail,
      errorRange: issue.errorRange
    };
  });

  return { issues };
}

/**
 * Calculate the byte offset to a specific line in text
 * @param {string} text - Text content
 * @param {number} lineIndex - Zero-based line index
 * @returns {number} Byte offset to start of line
 */
function calculateLineOffset(text, lineIndex) {
  if (lineIndex <= 0) return 0;

  const lines = text.split('\n');
  let offset = 0;

  for (let i = 0; i < lineIndex && i < lines.length; i++) {
    offset += lines[i].length + 1; // +1 for newline character
  }

  return offset;
}

/**
 * Check if a markdownlint rule is auto-fixable
 * @param {string} ruleCode - Rule code (e.g., 'MD001')
 * @returns {boolean} True if rule supports auto-fixing
 */
function isFixableRule(ruleCode) {
  // Auto-fixable rules from markdownlint documentation
  const fixableRules = [
    'MD004', // ul-style
    'MD005', // list-indent
    'MD007', // ul-indent
    'MD009', // no-trailing-spaces
    'MD010', // no-hard-tabs
    'MD011', // no-reversed-links
    'MD012', // no-multiple-blanks
    'MD014', // commands-show-output
    'MD018', // no-missing-space-atx
    'MD019', // no-multiple-space-atx
    'MD020', // no-missing-space-closed-atx
    'MD021', // no-multiple-space-closed-atx
    'MD022', // blanks-around-headings
    'MD023', // heading-start-left
    'MD026', // no-trailing-punctuation
    'MD027', // no-multiple-space-blockquote
    'MD030', // list-marker-space
    'MD031', // blanks-around-fences
    'MD032', // blanks-around-lists
    'MD034', // no-bare-urls
    'MD037', // no-space-in-emphasis
    'MD038', // no-space-in-code
    'MD039', // no-space-in-links
    'MD044', // proper-names
    'MD047', // single-trailing-newline
    'MD049', // emphasis-style
    'MD050', // strong-style
    'MD051', // link-fragments
    'MD053', // link-image-reference-definitions
    'MD054', // link-image-style
    'MD058'  // blanks-around-tables
  ];

  return fixableRules.includes(ruleCode);
}

/**
 * Worker error handler
 */
self.onerror = function(error) {
  console.error('[MarkdownLintWorker] Unhandled error:', error);

  // Send error back to main thread
  self.postMessage({
    type: 'lintError',
    error: error.message || 'Unknown worker error'
  });
};

/**
 * Worker initialization - could be used for future setup
 */
function initializeWorker() {
  // Future: Could load custom rules or configurations
  console.log('[MarkdownLintWorker] Initialized');
}

// Initialize when worker loads
initializeWorker();
```

### **Task 2.3: Webpack Worker Configuration**
Ensure webpack.config.js properly handles the new worker:

**File**: `frontend/webpack.config.js` (verify existing configuration)

The configuration should already support worker-loader patterns from the spell check worker. Verify this section exists:

```javascript
{
  test: /\.worker\.js$/,
  use: {
    loader: 'worker-loader',
    options: {
      filename: '[name].[contenthash].worker.js',
      chunkFilename: '[id].[contenthash].worker.js'
    }
  }
}
```

### **Task 2.4: Worker Integration Testing**
Create a simple test to verify worker functionality:

**File**: `frontend/src/workers/__tests__/markdownLint.worker.test.js`

```javascript
/**
 * Basic worker integration test
 * Tests worker message handling and markdown processing
 */

describe('MarkdownLintWorker', () => {
  let worker;

  beforeAll(() => {
    // Create worker instance
    const MarkdownLintWorker = require('../markdownLint.worker.js').default;
    worker = new MarkdownLintWorker();
  });

  afterAll(() => {
    if (worker) {
      worker.terminate();
    }
  });

  test('should process markdown chunk and return issues', (done) => {
    const testMarkdown = '# Title\n### Skipped H2\n';
    const testRules = { MD001: true }; // heading-increment rule
    const requestId = 'test-123';

    worker.onmessage = (e) => {
      const { type, requestId: responseId, issues } = e.data;

      expect(type).toBe('lintComplete');
      expect(responseId).toBe(requestId);
      expect(Array.isArray(issues)).toBe(true);

      // Should detect MD001 violation (heading increment)
      const md001Issue = issues.find(issue => issue.ruleNames.includes('MD001'));
      expect(md001Issue).toBeDefined();

      done();
    };

    worker.onerror = (error) => {
      done(error);
    };

    // Send test message
    worker.postMessage({
      type: 'lintChunk',
      chunk: {
        text: testMarkdown,
        startOffset: 0
      },
      rules: testRules,
      requestId
    });
  });

  test('should handle worker errors gracefully', (done) => {
    worker.onmessage = (e) => {
      const { type, error } = e.data;

      if (type === 'lintError') {
        expect(error).toBeDefined();
        done();
      }
    };

    // Send invalid message to trigger error
    worker.postMessage({
      type: 'lintChunk',
      chunk: null, // Invalid chunk
      rules: {},
      requestId: 'error-test'
    });
  });
});
```

### **Task 2.5: Performance Optimization**
Add performance monitoring to the worker:

```javascript
// Add to worker message handler
function processMarkdownChunk(chunk, rules, requestId) {
  const startTime = performance.now();

  // ... existing processing code ...

  const endTime = performance.now();
  const processingTime = endTime - startTime;

  // Log performance for chunks > 1000 chars
  if (chunk.text.length > 1000) {
    console.log(`[MarkdownLintWorker] Processed ${chunk.text.length} chars in ${processingTime.toFixed(2)}ms`);
  }

  return { issues };
}
```

## ✅ **Verification Steps**

1. **Worker Creation**: Verify worker loads without errors
2. **Message Handling**: Confirm worker responds to lintChunk messages
3. **Issue Detection**: Test worker detects markdown lint violations
4. **Error Handling**: Verify worker handles invalid input gracefully
5. **Performance**: Confirm processing times are reasonable (< 100ms for 2KB chunks)

## 🔗 **Integration Points**

- **Previous Phase**: Integrates with MarkdownLintWorkerPool from Phase 1
- **Next Phase**: Phase 3 will create the rules service that provides rule configurations
- **Dependencies**: Requires markdownlint library installation

## 📊 **Performance Targets**

- **Chunk Processing**: < 100ms for 2KB text chunks
- **Memory Usage**: < 10MB per worker instance
- **Error Rate**: < 1% of chunks should fail processing
- **Startup Time**: Worker initialization < 50ms

## 🐛 **Common Issues & Solutions**

### **Issue**: Worker fails to load markdownlint
**Solution**: Ensure markdownlint is properly bundled with worker-loader

### **Issue**: Offset calculations incorrect
**Solution**: Verify line offset calculation handles different line endings (\n vs \r\n)

### **Issue**: Worker memory leaks
**Solution**: Ensure proper cleanup of markdownlint instances

## 📝 **Implementation Notes**

- Worker follows exact message passing patterns from spell check worker
- Uses markdownlint's sync API for consistency and performance
- Implements proper error boundaries for worker stability
- Includes performance monitoring for optimization
- Maintains compatibility with existing worker pool infrastructure

This phase provides the core processing engine that enables background markdown linting without blocking the main UI thread.
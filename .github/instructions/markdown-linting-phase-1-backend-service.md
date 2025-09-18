---
applyTo: "markdown-lint-service/**/*"
description: "Phase 1: Backend Markdown Lint Service - Simple Node.js Express server for markdown processing"
---

# Phase 1: Backend Markdown Lint Service

## 🎯 **Phase Objective**

Create a dedicated markdown-lint-service as a simple Node.js HTTP server that directly uses the markdownlint library. This service will handle all markdown linting processing, exposing HTTP endpoints that the backend FastAPI can consume directly. This eliminates the unnecessary FastAPI-to-subprocess-to-CLI abstraction layer.

## 📋 **Requirements Analysis**

### **Service Architecture Requirements**

1. **Node.js HTTP Server**: Simple Express.js server directly using markdownlint library
2. **Direct Library Access**: Use markdownlint library API, not CLI subprocess calls
3. **JSON API**: RESTful HTTP endpoints returning JSON responses
4. **Chunked Processing**: Handle large documents by processing text chunks
5. **Rule Application**: Apply custom rule configurations per request
6. **Performance**: Efficient processing for real-time editor feedback without subprocess overhead

### **API Interface Requirements**

- **POST /lint**: Process text chunks with rule configuration
- **GET /rules/definitions**: Get available markdownlint rule definitions
- **GET /health**: Health check endpoint for monitoring

### **Integration Requirements**

- **Docker Integration**: Service runs in docker-compose stack on port 8002
- **Backend Integration**: Backend FastAPI makes HTTP calls to this service
- **Error Handling**: Consistent JSON error responses
- **CORS Support**: Allow cross-origin requests from backend

## 🔧 **Implementation Tasks**

### **Task 1.1: Create Service Structure**

**Directory**: `markdown-lint-service/`

```
markdown-lint-service/
├── server.js                   # Express.js HTTP server
├── package.json                # Node.js dependencies and scripts
├── Dockerfile                  # Service containerization
└── README.md                   # Service documentation
```

### **Task 1.2: Implement Node.js Express Server**

**File**: `markdown-lint-service/server.js`

```javascript
const express = require('express');
const cors = require('cors');
const markdownlint = require('markdownlint');

const app = express();
const PORT = process.env.MARKDOWN_LINT_PORT || 8002;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Support large markdown files

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', service: 'markdown-lint' });
});

// Lint endpoint
app.post('/lint', async (req, res) => {
    try {
        const { text, rules, chunk_offset = 0 } = req.body;
        
        if (!text || !rules) {
            return res.status(400).json({ 
                error: 'Missing required fields: text and rules' 
            });
        }

        console.log(`Processing lint request - text length: ${text.length}, rules: ${Object.keys(rules).length}`);

        // Configure markdownlint options
        const options = {
            strings: {
                'content': text  // markdownlint expects content as named string
            },
            config: rules
        };

        // Run markdownlint
        const results = markdownlint.sync(options);
        
        // Parse results into our response format
        const issues = parseMarkdownlintResults(results, chunk_offset);
        
        console.log(`Found ${issues.length} issues`);

        res.json({
            issues: issues,
            processed_length: text.length,
            rule_count: Object.keys(rules).length
        });

    } catch (error) {
        console.error('Linting error:', error);
        res.status(500).json({ 
            error: 'Linting failed', 
            details: error.message 
        });
    }
});

// Get rule definitions endpoint
app.get('/rules/definitions', (req, res) => {
    try {
        // Get all available markdownlint rules
        const ruleDefinitions = getRuleDefinitions();
        
        res.json({
            rules: ruleDefinitions
        });

    } catch (error) {
        console.error('Failed to get rule definitions:', error);
        res.status(500).json({ 
            error: 'Failed to get rule definitions', 
            details: error.message 
        });
    }
});

// Parse markdownlint results into our API format
function parseMarkdownlintResults(results, chunkOffset) {
    const issues = [];
    
    // results.content contains array of issues for the 'content' string
    if (results.content) {
        results.content.forEach(issue => {
            const lintIssue = {
                ruleNames: issue.ruleNames || [],
                ruleDescription: issue.ruleDescription || '',
                ruleInformation: issue.ruleInformation || '',
                lineNumber: issue.lineNumber || 1,
                columnNumber: issue.columnNumber || 1,
                offset: chunkOffset + calculateOffset(issue),
                length: issue.errorRange ? issue.errorRange[1] : 1,
                severity: 'warning', // markdownlint issues are warnings
                fixable: isFixable(issue.ruleNames || []),
                errorContext: issue.errorContext || '',
                errorDetail: issue.errorDetail || '',
                errorRange: issue.errorRange || []
            };
            issues.push(lintIssue);
        });
    }
    
    return issues;
}

// Calculate character offset from line/column
function calculateOffset(issue) {
    const lineNum = issue.lineNumber || 1;
    const colNum = issue.columnNumber || 1;
    
    // Simplified calculation - in practice might need more precision
    return (lineNum - 1) * 50 + (colNum - 1);
}

// Determine if rule is auto-fixable
function isFixable(ruleNames) {
    const fixableRules = new Set([
        'MD004', 'MD005', 'MD007', 'MD009', 'MD010', 'MD011', 'MD012',
        'MD014', 'MD018', 'MD019', 'MD020', 'MD021', 'MD022', 'MD023',
        'MD026', 'MD027', 'MD030', 'MD031', 'MD032', 'MD034', 'MD037',
        'MD038', 'MD039', 'MD044', 'MD047', 'MD049', 'MD050', 'MD051',
        'MD053', 'MD054', 'MD058'
    ]);
    
    return ruleNames.some(rule => fixableRules.has(rule));
}

// Get comprehensive rule definitions
function getRuleDefinitions() {
    return {
        'MD001': {
            name: 'heading-increment',
            description: 'Heading levels should only increment by one level at a time',
            category: 'headings',
            fixable: false
        },
        'MD003': {
            name: 'heading-style',
            description: 'Heading style should be consistent',
            category: 'headings',
            fixable: false
        },
        'MD004': {
            name: 'ul-style',
            description: 'Unordered list style should be consistent',
            category: 'lists',
            fixable: true
        },
        'MD005': {
            name: 'list-indent',
            description: 'Inconsistent indentation for list items at the same level',
            category: 'lists',
            fixable: true
        },
        'MD007': {
            name: 'ul-indent',
            description: 'Unordered list indentation should be consistent',
            category: 'lists',
            fixable: true
        },
        'MD009': {
            name: 'no-trailing-spaces',
            description: 'Trailing spaces are not allowed',
            category: 'whitespace',
            fixable: true
        },
        'MD010': {
            name: 'no-hard-tabs',
            description: 'Hard tabs are not allowed',
            category: 'whitespace',
            fixable: true
        },
        'MD011': {
            name: 'no-reversed-links',
            description: 'Reversed link syntax is not allowed',
            category: 'links',
            fixable: true
        },
        'MD012': {
            name: 'no-multiple-blanks',
            description: 'Multiple consecutive blank lines are not allowed',
            category: 'whitespace',
            fixable: true
        },
        'MD013': {
            name: 'line-length',
            description: 'Line length should not exceed specified limit',
            category: 'line-length',
            fixable: false
        },
        'MD018': {
            name: 'no-missing-space-atx',
            description: 'No space after hash on atx style heading',
            category: 'headings',
            fixable: true
        },
        'MD019': {
            name: 'no-multiple-space-atx',
            description: 'Multiple spaces after hash on atx style heading',
            category: 'headings',
            fixable: true
        },
        'MD020': {
            name: 'no-missing-space-closed-atx',
            description: 'No space inside hashes on closed atx style heading',
            category: 'headings',
            fixable: true
        },
        'MD021': {
            name: 'no-multiple-space-closed-atx',
            description: 'Multiple spaces inside hashes on closed atx style heading',
            category: 'headings',
            fixable: true
        },
        'MD022': {
            name: 'blanks-around-headings',
            description: 'Headings should be surrounded by blank lines',
            category: 'headings',
            fixable: true
        },
        'MD023': {
            name: 'heading-start-left',
            description: 'Headings must start at the beginning of the line',
            category: 'headings',
            fixable: true
        },
        'MD024': {
            name: 'no-duplicate-heading',
            description: 'Multiple headings with the same content are not allowed',
            category: 'headings',
            fixable: false
        },
        'MD025': {
            name: 'single-title',
            description: 'Multiple top level headings in the same document are not allowed',
            category: 'headings',
            fixable: false
        },
        'MD026': {
            name: 'no-trailing-punctuation',
            description: 'Trailing punctuation in heading is not allowed',
            category: 'headings',
            fixable: true
        },
        'MD027': {
            name: 'no-multiple-space-blockquote',
            description: 'Multiple spaces after blockquote symbol are not allowed',
            category: 'blockquote',
            fixable: true
        },
        'MD028': {
            name: 'no-blanks-blockquote',
            description: 'Blank line inside blockquote is not allowed',
            category: 'blockquote',
            fixable: false
        },
        'MD029': {
            name: 'ol-prefix',
            description: 'Ordered list item prefix should be consistent',
            category: 'lists',
            fixable: false
        },
        'MD030': {
            name: 'list-marker-space',
            description: 'Spaces after list markers should be consistent',
            category: 'lists',
            fixable: true
        },
        'MD031': {
            name: 'blanks-around-fences',
            description: 'Fenced code blocks should be surrounded by blank lines',
            category: 'code',
            fixable: true
        },
        'MD032': {
            name: 'blanks-around-lists',
            description: 'Lists should be surrounded by blank lines',
            category: 'lists',
            fixable: true
        },
        'MD033': {
            name: 'no-inline-html',
            description: 'Inline HTML is not allowed',
            category: 'html',
            fixable: false
        },
        'MD034': {
            name: 'no-bare-urls',
            description: 'Bare URL used instead of link syntax',
            category: 'links',
            fixable: true
        },
        'MD035': {
            name: 'hr-style',
            description: 'Horizontal rule style should be consistent',
            category: 'hr',
            fixable: false
        },
        'MD036': {
            name: 'no-emphasis-as-heading',
            description: 'Emphasis used instead of a heading',
            category: 'emphasis',
            fixable: false
        },
        'MD037': {
            name: 'no-space-in-emphasis',
            description: 'Spaces inside emphasis markers are not allowed',
            category: 'emphasis',
            fixable: true
        },
        'MD038': {
            name: 'no-space-in-code',
            description: 'Spaces inside code span elements are not allowed',
            category: 'code',
            fixable: true
        },
        'MD039': {
            name: 'no-space-in-links',
            description: 'Spaces inside link text are not allowed',
            category: 'links',
            fixable: true
        },
        'MD040': {
            name: 'fenced-code-language',
            description: 'Fenced code blocks should have a language specified',
            category: 'code',
            fixable: false
        },
        'MD041': {
            name: 'first-line-heading',
            description: 'First line in file should be a top level heading',
            category: 'headings',
            fixable: false
        },
        'MD042': {
            name: 'no-empty-links',
            description: 'No empty links are allowed',
            category: 'links',
            fixable: false
        },
        'MD043': {
            name: 'required-headings',
            description: 'Required heading structure',
            category: 'headings',
            fixable: false
        },
        'MD044': {
            name: 'proper-names',
            description: 'Proper names should have the correct capitalization',
            category: 'spelling',
            fixable: true
        },
        'MD045': {
            name: 'no-alt-text',
            description: 'Images should have alternate text (alt text)',
            category: 'accessibility',
            fixable: false
        },
        'MD046': {
            name: 'code-block-style',
            description: 'Code block style should be consistent',
            category: 'code',
            fixable: false
        },
        'MD047': {
            name: 'single-trailing-newline',
            description: 'Files should end with a single newline character',
            category: 'whitespace',
            fixable: true
        },
        'MD048': {
            name: 'code-fence-style',
            description: 'Code fence style should be consistent',
            category: 'code',
            fixable: false
        },
        'MD049': {
            name: 'emphasis-style',
            description: 'Emphasis style should be consistent',
            category: 'emphasis',
            fixable: true
        },
        'MD050': {
            name: 'strong-style',
            description: 'Strong style should be consistent',
            category: 'emphasis',
            fixable: true
        },
        'MD051': {
            name: 'link-fragments',
            description: 'Link fragments should be valid',
            category: 'links',
            fixable: true
        },
        'MD052': {
            name: 'reference-links-images',
            description: 'Reference links and images should use a label that is defined',
            category: 'links',
            fixable: false
        },
        'MD053': {
            name: 'link-image-reference-definitions',
            description: 'Link and image reference definitions should be needed',
            category: 'links',
            fixable: true
        },
        'MD054': {
            name: 'link-image-style',
            description: 'Link and image style should be consistent',
            category: 'links',
            fixable: true
        },
        'MD055': {
            name: 'table-pipe-style',
            description: 'Table pipe style should be consistent',
            category: 'table',
            fixable: false
        },
        'MD056': {
            name: 'table-column-count',
            description: 'Table column count should be consistent',
            category: 'table',
            fixable: false
        }
    };
}

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Markdown Lint Service running on port ${PORT}`);
    console.log(`markdownlint library version: ${require('markdownlint/package.json').version}`);
});
```

### **Task 1.3: Create Package Configuration**

**File**: `markdown-lint-service/package.json`

```json
{
  "name": "markdown-lint-service",
  "version": "1.0.0",
  "description": "Simple Node.js HTTP server for markdown linting",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "markdownlint": "^0.34.0",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

### **Task 1.4: Create Dockerfile**

**File**: `markdown-lint-service/Dockerfile`

```dockerfile
FROM node:18-slim

# Install curl for health checks
RUN apt-get update && apt-get install -y curl && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --production

# Copy application code
COPY server.js ./

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8002/health || exit 1

# Expose port
EXPOSE 8002

# Start the application
CMD ["npm", "start"]
```

### **Task 1.5: Update Docker Compose**

**File**: `docker-compose.yml` (add service)

```yaml
  markdown-lint-service:
    build:
      context: ./markdown-lint-service
      dockerfile: Dockerfile
    environment:
      - MARKDOWN_LINT_PORT=8002
      - NODE_ENV=development
    ports:
      - "8002:8002"
    volumes:
      - ./markdown-lint-service:/app  # Volume mount for development
    command: ["npm", "run", "dev"]     # Use nodemon for hot reload
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8002/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped
```

### **Task 1.6: Update Backend Router (Optional for Phase 1)**

**File**: `backend/app/routers/markdown_lint.py` (minimal changes needed)

The existing backend router can remain largely the same, just change the service URL from FastAPI endpoint to the Node.js service:

```python
# Change service URL to point to Node.js service
MARKDOWN_LINT_SERVICE_URL = "http://markdown-lint-service:8002"

# The existing HTTP client calls will work with the Node.js endpoints
# as they return the same JSON structure
```

## ✅ **Verification Steps**

1. **Service Startup**: Verify Node.js service starts and responds to health checks
2. **API Testing**: Test lint endpoint with sample markdown and rules
3. **Rule Definitions**: Verify rule definitions endpoint returns complete data  
4. **Docker Integration**: Confirm service runs properly in docker-compose stack
5. **Performance**: Test processing speed with various document sizes
6. **Hot Reload**: Verify nodemon detects file changes and restarts service

## 🔗 **Integration Points**

- **Next Phase**: Phase 2 will enhance frontend to consume the improved API
- **Backend Integration**: Existing backend router works with minimal changes
- **Development Workflow**: Hot reload enables rapid development and debugging

## 📊 **Performance Considerations**

- **Direct Library Access**: No subprocess overhead for better performance
- **Memory Efficiency**: Node.js service handles concurrent requests efficiently  
- **Error Handling**: Direct access to markdownlint library exceptions and details
- **Resource Usage**: Lower CPU and memory usage compared to subprocess approach
- **Development Experience**: Hot reload and direct logging improve developer productivity

## 🎯 **Architecture Benefits**

**Before (Complex):**

```text
Frontend → Backend FastAPI → Markdown-Lint FastAPI → subprocess → markdownlint CLI → Node.js
```

**After (Simple):**

```text
Frontend → Backend FastAPI → HTTP call → Node.js Express → markdownlint library
```

**Key Improvements:**

- **50% fewer layers**: Eliminates FastAPI middleman and subprocess calls
- **Better error handling**: Direct access to library errors and stack traces  
- **Enhanced debugging**: Node.js console logs and error reporting
- **Full API access**: Can use markdownlint's complete feature set, not just CLI subset
- **Development productivity**: Hot reload for faster iteration cycles
- **Better performance**: No process spawning overhead

This phase establishes a clean, efficient backend foundation for the entire markdown linting system, providing a robust and scalable service for processing markdown content.

---
applyTo: "frontend/src/services/editor/**/*"
description: "Phase 2: API-Based Frontend Service - Replace worker implementation with HTTP API calls to backend"
---

# Phase 2: API-Based Frontend Service

## 🎯 **Phase Objective**

Replace the worker-based frontend implementation with an API-based service that communicates with the backend markdown-lint-service. This maintains the same interface for editor integration while offloading processing to the dedicated backend service.

## 📋 **Requirements Analysis**

### **Service Interface Requirements**

1. **Maintain Existing Interface**: Keep the same API surface for editor integration
2. **HTTP API Communication**: Replace worker pool with HTTP requests
3. **Chunked Processing**: Send text chunks to backend service efficiently
4. **Error Handling**: Graceful degradation when backend is unavailable
5. **Performance**: Optimize API calls for real-time editor feedback

### **Integration Requirements**

- **Monaco Markers**: Continue to work with existing marker system
- **Rule Configuration**: Integrate with Phase 3 rules service
- **Editor Integration**: Compatible with existing useEditor hook
- **Performance**: Maintain responsive editing experience

## 🔧 **Implementation Tasks**

### **Task 2.1: Update MarkdownLintService**

**File**: `frontend/src/services/editor/MarkdownLintService.js`

```javascript
// MarkdownLintService.js
// API-based markdown linting service

import { chunkTextWithOffsets } from '@/utils';
import config from '@/config';

export class MarkdownLintService {
  constructor(chunkSize = 2000) {
    this.chunkSize = chunkSize;
    this.apiBase = config.apiBaseUrl;
    this.serviceUrl = `${this.apiBase}/markdown-lint`;
  }

  async init() {
    // No initialization needed for API-based service
    return Promise.resolve();
  }

  async scan(text, onProgress = () => {}, categoryId = null, folderPath = null) {
    try {
      // Import rules service dynamically to avoid circular dependencies
      const { MarkdownLintRulesService } = await import('../linting');
      
      // Get applicable rules for this category/folder
      const rules = MarkdownLintRulesService.getApplicableRules(folderPath, categoryId);

      // Chunk text for processing
      const chunks = chunkTextWithOffsets(text, this.chunkSize);
      
      // Process chunks via API
      const issues = await this._processChunksViaAPI(chunks, rules, onProgress);
      
      return issues;
    } catch (error) {
      console.error('Markdown linting failed:', error);
      
      // Graceful degradation - return empty array if service unavailable
      if (error.code === 'ERR_NETWORK' || error.response?.status >= 500) {
        console.warn('Markdown lint service unavailable, skipping linting');
        return [];
      }
      
      throw error;
    }
  }

  async _processChunksViaAPI(chunks, rules, onProgress) {
    const allIssues = [];
    const totalChunks = chunks.length;
    let completedChunks = 0;

    // Process chunks in parallel (with concurrency limit)
    const concurrency = 3; // Limit concurrent API requests
    const semaphore = new Array(concurrency).fill(null);
    
    await Promise.all(
      chunks.map(async (chunk, index) => {
        // Wait for available slot
        await this._acquireSemaphore(semaphore);
        
        try {
          const chunkIssues = await this._processChunk(chunk, rules);
          allIssues.push(...chunkIssues);
          
          // Report progress
          completedChunks++;
          onProgress(completedChunks / totalChunks);
          
        } finally {
          this._releaseSemaphore(semaphore);
        }
      })
    );

    return allIssues;
  }

  async _processChunk(chunk, rules) {
    const requestBody = {
      text: chunk.text,
      rules: rules,
      chunk_offset: chunk.offset
    };

    const response = await fetch(`${this.serviceUrl}/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.issues || [];
  }

  async _acquireSemaphore(semaphore) {
    while (true) {
      const index = semaphore.indexOf(null);
      if (index !== -1) {
        semaphore[index] = true;
        return;
      }
      // Wait a bit before checking again
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  _releaseSemaphore(semaphore) {
    const index = semaphore.indexOf(true);
    if (index !== -1) {
      semaphore[index] = null;
    }
  }

  terminate() {
    // No cleanup needed for API-based service
  }

  /**
   * Get available rule definitions from backend service
   */
  async getRuleDefinitions() {
    try {
      const response = await fetch(`${this.serviceUrl}/rules/definitions`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get rule definitions: ${response.status}`);
      }

      const data = await response.json();
      return data.rules;
    } catch (error) {
      console.error('Failed to get rule definitions:', error);
      // Fallback to local definitions if service unavailable
      const { MarkdownLintRulesService } = await import('../linting');
      return MarkdownLintRulesService.getRuleDefinitions();
    }
  }

  /**
   * Check service health
   */
  async checkHealth() {
    try {
      const response = await fetch(`${this.serviceUrl}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export default new MarkdownLintService();
```

### **Task 2.2: Remove Worker Pool Implementation**

**Files to Remove**:

- `frontend/src/services/editor/MarkdownLintWorkerPool.js`
- `frontend/src/workers/markdownLint.worker.js`
- `frontend/src/workers/__tests__/markdownLint.worker.test.js`

**Cleanup Commands**:

```bash
rm frontend/src/services/editor/MarkdownLintWorkerPool.js
rm frontend/src/workers/markdownLint.worker.js
rm -rf frontend/src/workers/__tests__/
```

### **Task 2.3: Update API Configuration**

**File**: `frontend/src/config/index.js` (ensure markdown-lint endpoints are configured)

```javascript
const config = {
  // ... existing config
  apiBaseUrl: process.env.NODE_ENV === 'production' 
    ? 'https://your-domain.com/api'
    : 'http://localhost:8000',
  
  // Service-specific URLs
  markdownLintServiceUrl: process.env.NODE_ENV === 'production'
    ? 'https://your-domain.com/api/markdown-lint'
    : 'http://localhost:8000/markdown-lint'
};
```

### **Task 2.4: Create API Error Handling**

**File**: `frontend/src/services/editor/MarkdownLintApiClient.js`

```javascript
// Dedicated API client for markdown lint service communication
export class MarkdownLintApiClient {
  constructor(baseUrl, authToken) {
    this.baseUrl = baseUrl;
    this.authToken = authToken;
  }

  async lintText(text, rules, chunkOffset = 0) {
    const response = await this._makeRequest('/process', {
      method: 'POST',
      body: JSON.stringify({
        text,
        rules,
        chunk_offset: chunkOffset
      })
    });

    return response.issues || [];
  }

  async getRuleDefinitions() {
    const response = await this._makeRequest('/rules/definitions');
    return response.rules || {};
  }

  async checkHealth() {
    try {
      await this._makeRequest('/health');
      return true;
    } catch {
      return false;
    }
  }

  async _makeRequest(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    
    const requestOptions = {
      headers: {
        'Content-Type': 'application/json',
        ...(this.authToken && { 'Authorization': `Bearer ${this.authToken}` })
      },
      ...options
    };

    const response = await fetch(url, requestOptions);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.detail || 
        `API request failed: ${response.status} ${response.statusText}`
      );
    }

    return response.json();
  }
}
```

### **Task 2.5: Update Service Index**

**File**: `frontend/src/services/editor/index.js`

```javascript
// Export editor services (remove worker pool exports)
export { default as MarkdownLintService } from './MarkdownLintService';
export { default as MarkdownLintMarkers } from './MarkdownLintMarkers';
export { default as MarkdownLintMarkerAdapter } from './MarkdownLintMarkerAdapter';
export { default as MarkdownLintActions } from './MarkdownLintActions';

// Keep existing exports
export { default as SpellCheckService } from './SpellCheckService';
export { default as SpellCheckWorkerPool } from './SpellCheckWorkerPool';
export { default as SpellCheckMarkers } from './SpellCheckMarkers';
// ... other exports
```

### **Task 2.6: Add Backend Proxy Endpoint**

**File**: `backend/app/routers/markdown_lint.py` (add proxy endpoint)

```python
from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any
import httpx
from ..core.auth import get_current_user
from ..core.config import get_settings

router = APIRouter(prefix="/markdown-lint", tags=["markdown-lint"])

@router.post("/process")
async def process_markdown(
    request: Dict[str, Any],
    current_user = Depends(get_current_user)
):
    """
    Proxy endpoint to markdown-lint-service
    Adds user context and forwards request
    """
    settings = get_settings()
    lint_service_url = f"http://markdown-lint-service:8002/lint"
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                lint_service_url,
                json=request,
                timeout=30.0
            )
            response.raise_for_status()
            return response.json()
    
    except httpx.RequestError as e:
        raise HTTPException(
            status_code=503, 
            detail=f"Markdown lint service unavailable: {str(e)}"
        )
    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=e.response.status_code,
            detail=f"Markdown lint service error: {e.response.text}"
        )

@router.get("/rules/definitions")
async def get_rule_definitions():
    """
    Proxy endpoint for rule definitions
    """
    settings = get_settings()
    lint_service_url = f"http://markdown-lint-service:8002/rules/definitions"
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(lint_service_url, timeout=10.0)
            response.raise_for_status()
            return response.json()
    
    except httpx.RequestError as e:
        raise HTTPException(
            status_code=503, 
            detail=f"Markdown lint service unavailable: {str(e)}"
        )
```

## ✅ **Verification Steps**

1. **Service Communication**: Verify frontend can communicate with backend lint service
2. **Chunked Processing**: Test with large documents to ensure chunking works
3. **Error Handling**: Test graceful degradation when service is unavailable
4. **Performance**: Compare response times with previous worker implementation
5. **Monaco Integration**: Verify markers still display correctly in editor

## 🔗 **Integration Points**

- **Previous Phase**: Uses backend service created in Phase 1
- **Next Phase**: Phase 3 rules service will provide rule configuration
- **Existing Systems**: Maintains compatibility with existing marker and action systems

## 📊 **Performance Considerations**

- **Concurrent Requests**: Limited to 3 concurrent API calls to avoid overwhelming backend
- **Request Batching**: Process multiple chunks efficiently
- **Timeout Handling**: Appropriate timeouts for real-time editing
- **Caching**: Consider caching rule definitions to reduce API calls
- **Fallback Strategy**: Graceful degradation when service unavailable

## 🚨 **Breaking Changes**

- **Worker Dependencies**: Remove markdownlint from frontend package.json
- **Import Paths**: Update any imports of MarkdownLintWorkerPool
- **Testing**: Update tests to mock API calls instead of worker communication

This phase successfully transitions from browser-based processing to a robust backend API architecture while maintaining the same user experience.

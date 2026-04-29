import { Api } from "./api";

class DocumentsApi extends Api {
  async svgToPngDataUri(svgEl) {
    // Client-side SVG to PNG conversion using Canvas API
    // Note: For higher quality conversion, consider using exportDiagramAsPNG()
    // which uses the server-side export service with Chromium rendering

    // 1) Serialize the SVG node to a string
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svgEl);

    // 2) Create a Blob & ObjectURL
    const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    // 3) Load it into an Image
    const img = new Image();
    img.src = url;
    await img.decode();       // wait until it's loaded

    // 4) Draw to a Canvas
    const canvas = document.createElement("canvas");
    canvas.width  = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    // optional: set a white background
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    // 5) Extract PNG data-URI
    const dataUri = canvas.toDataURL("image/png");

    // 6) Clean up
    URL.revokeObjectURL(url);

    return dataUri;
  }

  async exportAsPDF(htmlContent, documentName, isDarkMode = false) {
    // Use the dedicated export service for PDF generation
    const exportServiceApi = (await import('./exportServiceApi')).default;
    return await exportServiceApi.exportAsPDF(htmlContent, documentName, isDarkMode);
  }

  async exportDiagramAsSVG(htmlContent, options = {}) {
    // Use the dedicated export service for SVG diagram generation
    const exportServiceApi = (await import('./exportServiceApi')).default;
    return await exportServiceApi.exportDiagramAsSVG(htmlContent, options);
  }

  async exportDiagramAsPNG(htmlContent, options = {}) {
    // Use the dedicated export service for PNG diagram generation
    const exportServiceApi = (await import('./exportServiceApi')).default;
    return await exportServiceApi.exportDiagramAsPNG(htmlContent, options);
  }

  async exportDiagramAsDrawio(mermaidSource, svgContent, options = {}) {
    // Use the dedicated export service for Draw.io XML generation
    const exportServiceApi = (await import('./exportServiceApi')).default;
    return await exportServiceApi.exportDiagramAsDrawioXML(mermaidSource, svgContent, options);
  }

  async exportDiagramAsDiagramsNet(svgContent, options = {}) {
    // Legacy method - use the dedicated export service for diagrams.net XML generation
    console.warn('exportDiagramAsDiagramsNet is deprecated. Use exportDiagramAsDrawio instead.');
    const exportServiceApi = (await import('./exportServiceApi')).default;
    return await exportServiceApi.exportDiagramAsDiagramsNet(svgContent, options);
  }

  async getAllDocuments(category = null, repositoryType = "local") {
    let endpoint = "/documents";
    const params = new URLSearchParams();

    if (category && category !== "All") {
      params.append("category", category);
    }

    // Add repository_type parameter - default to "local" to only get local documents
    params.append("repository_type", repositoryType);

    if (params.toString()) {
      endpoint += `?${params.toString()}`;
    }

    const res = await this.apiCall(endpoint);
    return res.data.documents || [];
  }

  async getDocument(id) {
    const res = await this.apiCall(`/documents/${id}`);
    return res.data;
  }

  /**
   * Open a GitHub document with proper repo management and filesystem sync
   * @param {number} id - Document ID
   * @returns {Promise<Object>} - Document with synced content
   */
  async openGitHubDocument(id) {
    const res = await this.apiCall(`/documents/${id}/github/open`, 'POST');
    return res.data;
  }

  async createDocument({ name, content, category, category_id }) {
    // If category_id is provided, use it; otherwise try to resolve category name to ID
    let finalCategoryId = category_id;

    if (!finalCategoryId && category) {
      // Try to get category ID from category name using CategoriesAPI
      try {
        const categoriesApi = (await import('./categoriesApi')).default;
        const categories = await categoriesApi.getCategories();
        const categoryObj = categories.find(cat => cat.name === category);
        finalCategoryId = categoryObj?.id;
      } catch (error) {
        console.warn('Could not resolve category name to ID:', error);
      }
    }

    const requestData = { name, content: content || "" };
    if (finalCategoryId !== undefined && finalCategoryId !== null) {
      // Ensure category_id is an integer
      requestData.category_id = parseInt(finalCategoryId, 10);
    }

    const res = await this.apiCall(`/documents`, "POST", requestData);
    return res.data;
  }

  async updateDocument(id, { name, content, category, category_id, skip_commit }) {
    // If category_id is provided, use it; otherwise try to resolve category name to ID
    let finalCategoryId = category_id;

    if (!finalCategoryId && category) {
      // Try to get category ID from category name using CategoriesAPI
      try {
        const categoriesApi = (await import('./categoriesApi')).default;
        const categories = await categoriesApi.getCategories();
        const categoryObj = categories.find(cat => cat.name === category);
        finalCategoryId = categoryObj?.id;
        if (!finalCategoryId) {
          console.error(`Category "${category}" not found in categories list — category will not be updated`);
        }
      } catch (error) {
        console.error('Failed to resolve category name to ID — category will not be updated:', error);
      }
    }

    const requestData = {};
    if (name !== undefined) requestData.name = name;
    if (content !== undefined) requestData.content = content;
    if (finalCategoryId !== undefined && finalCategoryId !== null) {
      // Ensure category_id is an integer
      requestData.category_id = parseInt(finalCategoryId, 10);
    }
    if (skip_commit !== undefined) requestData.skip_commit = skip_commit;

    const res = await this.apiCall(`/documents/${id}`, "PUT", requestData);
    return res.data;
  }

  async deleteDocument(id) {
    await this.apiCall(`/documents/${id}`, "DELETE");
    return true;
  }

  async getCategories() {
    // Use the proper Categories API instead of document-based categories
    try {
      const categoriesApi = (await import('./categoriesApi')).default;
      const categories = await categoriesApi.getCategories();
      return categories.length ? categories : [{ id: null, name: "General" }];
    } catch (error) {
      console.warn('Could not fetch categories, using fallback:', error);
      return [{ id: null, name: "General" }];
    }
  }

  async addCategory(category) {
    // Use the proper Categories API
    try {
      const categoriesApi = (await import('./categoriesApi')).default;
      const newCategory = await categoriesApi.createCategory(category);
      return newCategory;
    } catch (error) {
      console.error('Failed to create category:', error);
      throw error;
    }
  }

  /**
   * Delete a category using the proper Categories API
   * Note: The new API doesn't support migration - documents with this category
   * will need to be handled by the backend's foreign key constraints
   */
  async deleteCategory(categoryName, _options = {}) {
    try {
      const categoriesApi = (await import('./categoriesApi')).default;

      // First, find the category by name to get its ID
      const categories = await categoriesApi.getCategories();
      const category = categories.find(cat => cat.name === categoryName);

      if (!category) {
        throw new Error(`Category "${categoryName}" not found`);
      }

      // Delete using the Categories API
      await categoriesApi.deleteCategory(category.id);

      // Return updated categories
      return await categoriesApi.getCategories();
    } catch (error) {
      console.error('Failed to delete category:', error);
      throw error;
    }
  }

  async getCurrentDocumentId() {
    const res = await this.apiCall(`/documents/current`);
    const doc = res.data;
    return doc && doc.id ? doc.id : null;
  }

  async setCurrentDocumentId(id) {
    const res = await this.apiCall(`/documents/current`, "POST", { doc_id: id });
    return res.data.current_doc_id;
  }

  /**
   * Enable sharing for a document
   * @param {number} id - Document ID
   * @returns {Promise<Object>} - Share response with token and URL
   */
  async enableSharing(id) {
    const res = await this.apiCall(`/documents/${id}/share`, "POST");
    return res.data;
  }

  /**
   * Disable sharing for a document
   * @param {number} id - Document ID
   * @returns {Promise<boolean>} - Success status
   */
  async disableSharing(id) {
    await this.apiCall(`/documents/${id}/share`, "DELETE");
    return true;
  }

  /**
   * Get shared document by token (public access - no auth required)
   * @param {string} shareToken - Share token
   * @returns {Promise<Object>} - Shared document data
   */
  async getSharedDocument(shareToken) {
    const res = await this.apiCall(`/shared/${shareToken}`, "GET", null, {}, { noAuth: true });
    return res.data;
  }

  /**
   * Get recent documents
   * @param {number} limit - Maximum number of documents to return (default: 6)
   * @param {string} source - Filter by source: 'local' or 'github' (optional)
   * @returns {Promise<Array>} - Array of recent documents
   */
  async getRecentDocuments(limit = 6, source = null) {
    const params = { limit };
    if (source) {
      params.source = source;
    }
    const res = await this.apiCall('/documents/recent', 'GET', null, params);
    return res.data;
  }

  /**
   * Get recent local documents
   * @param {number} limit - Maximum number of documents to return (default: 3)
   * @returns {Promise<Array>} - Array of recent local documents
   */
  async getRecentLocalDocuments(limit = 3) {
    const res = await this.apiCall('/documents/recent/local', 'GET', null, { limit });
    return res.data;
  }

  /**
   * Get recent GitHub documents
   * @param {number} limit - Maximum number of documents to return (default: 3)
   * @returns {Promise<Array>} - Array of recent GitHub documents
   */
  async getRecentGitHubDocuments(limit = 3) {
    const res = await this.apiCall('/documents/recent/github', 'GET', null, { limit });
    return res.data;
  }

  /**
   * Mark a document as recently opened
   * @param {number} documentId - Document ID
   * @returns {Promise<Object>} - Response with updated last_opened_at
   */
  async markDocumentOpened(documentId) {
    const res = await this.apiCall(`/documents/${documentId}/mark-opened`, 'PUT');
    return res.data;
  }

  /**
   * Dismiss a document from the recent list (clears last_opened_at)
   * @param {number} documentId - Document ID
   * @returns {Promise<Object>} - Confirmation response
   */
  async dismissFromRecent(documentId) {
    const res = await this.apiCall(`/documents/${documentId}/dismiss-recent`, 'PUT');
    return res.data;
  }

  // ========================================
  // UNIFIED GITHUB REPOSITORY MANAGEMENT
  // ========================================

  /**
   * Get GitHub repositories for an account (unified approach)
   * @param {number} accountId - GitHub account ID
   * @returns {Promise<Object>} - Response with repositories list
   */
  async getGitHubRepositories(accountId) {
    const res = await this.apiCall(`/github/accounts/${accountId}/repositories`, 'GET');
    return res.data;
  }

  /**
   * Add a GitHub repository to sync (unified approach)
   * @param {number} accountId - GitHub account ID
   * @param {number} repositoryId - Repository ID
   * @returns {Promise<Object>} - Response with updated repository
   */
  async addGitHubRepository(accountId, repositoryId) {
    const res = await this.apiCall(`/github/accounts/${accountId}/repositories/${repositoryId}`, 'POST');
    return res.data;
  }

  /**
   * Remove a GitHub repository from sync (unified approach)
   * @param {number} accountId - GitHub account ID
   * @param {number} repositoryId - Repository ID
   * @returns {Promise<Object>} - Response confirming removal
   */
  async removeGitHubRepository(accountId, repositoryId) {
    const res = await this.apiCall(`/github/accounts/${accountId}/repositories/${repositoryId}`, 'DELETE');
    return res.data;
  }

  /**
   * Get GitHub repository statistics (unified approach)
   * @param {number} accountId - GitHub account ID
   * @returns {Promise<Object>} - Statistics about selected repositories
   */
  async getGitHubRepositoryStatistics(accountId) {
    const res = await this.apiCall(`/github/accounts/${accountId}/repositories/statistics`, 'GET');
    return res.data;
  }

  // ========================================
  // DOCUMENT-BASED GIT OPERATIONS
  // ========================================

  /**
   * Get git status for a document's repository (local or GitHub)
   * @param {number} documentId - Document ID
   * @returns {Promise<Object>} - Git status information
   */
  async getDocumentGitStatus(documentId) {
    const res = await this.apiCall(`/documents/${documentId}/git/status`, "GET");
    return res.data;
  }

  /**
   * Commit changes for a document's repository
   * @param {number} documentId - Document ID
   * @param {string} commitMessage - Commit message
   * @returns {Promise<Object>} - Commit result
   */
  async commitDocumentChanges(documentId, commitMessage) {
    const res = await this.apiCall(`/documents/${documentId}/git/commit`, "POST", {
      commit_message: commitMessage
    });
    return res.data;
  }

  /**
   * Get git history for a document's repository
   * @param {number} documentId - Document ID
   * @param {number} limit - Number of commits to retrieve (default: 20)
   * @returns {Promise<Object>} - Git history with commits
   */
  async getDocumentGitHistory(documentId, limit = 20) {
    const res = await this.apiCall(`/documents/${documentId}/git/history?limit=${limit}`, "GET");
    return res.data;
  }

  /**
   * Create a new branch for a document's repository
   * @param {number} documentId - Document ID
   * @param {Object} branchData - Branch configuration
   * @param {string} branchData.branch_name - Name of new branch
   * @param {string} branchData.base_branch - Base branch (optional)
   * @param {boolean} branchData.switch_to_branch - Switch to new branch
   * @returns {Promise<Object>} - Branch creation result
   */
  async createDocumentBranch(documentId, branchData) {
    const res = await this.apiCall(`/documents/${documentId}/git/branches`, "POST", branchData);
    return res.data;
  }

  /**
   * Get branch information for a document's repository
   * @param {number} documentId - Document ID
   * @param {boolean} includeRemote - Include remote branches (default: false)
   * @returns {Promise<Object>} - Branch information
   */
  async getDocumentBranches(documentId, includeRemote = false) {
    const res = await this.apiCall(`/documents/${documentId}/git/branches?include_remote=${includeRemote}`, "GET");
    return res.data;
  }

  // ========================================
  // GIT MANAGEMENT MODAL ENDPOINTS
  // ========================================

  /**
   * Get overview of all user repositories for git management modal
   * @returns {Promise<Object>} - Repository overview
   */
  async getGitOverview() {
    const res = await this.apiCall('/documents/git/overview', 'GET');
    return res.data;
  }

  /**
   * Get git operation logs for the current user
   * @param {Object} options - Filter options
   * @param {number} options.limit - Number of logs to retrieve (default: 50)
   * @param {string} options.operationType - Filter by operation type
   * @param {boolean} options.success - Filter by success status
   * @returns {Promise<Object>} - Operation logs
   */
  async getGitOperationLogs(options = {}) {
    const { limit = 50, operationType, success } = options;
    const params = { limit };
    if (operationType) params.operation_type = operationType;
    if (success !== undefined) params.success = success;

    const res = await this.apiCall('/documents/git/operation-logs', 'GET', null, params);
    return res.data;
  }

  /**
   * Get branches from all user repositories
   * @returns {Promise<Object>} - All repository branches
   */
  async getAllGitBranches() {
    const res = await this.apiCall('/documents/git/branches/all', 'GET');
    return res.data;
  }

  /**
   * Get document content at a specific git commit.
   * @param {number} documentId - Document ID
   * @param {string} commitHash - Commit hash to retrieve content from
   * @returns {Promise<Object>} - { document_id, document_name, commit_hash, content }
   */
  async getDocumentAtCommit(documentId, commitHash) {
    const res = await this.apiCall(`/documents/${documentId}/history/${commitHash}`, 'GET');
    return res.data;
  }

  /**
   * Trigger a session commit for a document.
   * Call when an editing session ends (document switch, page close).
   * No-ops gracefully when there are no pending changes or the doc is on GitHub.
   * @param {number} documentId - Document ID
   * @returns {Promise<Object>} - { success, committed, commit_hash?, reason? }
   */
  async sessionCommit(documentId) {
    const res = await this.apiCall(`/documents/${documentId}/git/session-commit`, "POST");
    return res.data;
  }

  /**
   * Get a unified diff between two commits for a document.
   * @param {number} documentId - Document ID
   * @param {string} commitA - Base commit hash
   * @param {string} commitB - Target commit hash (defaults to HEAD)
   * @returns {Promise<Object>} - { diff: string }
   */
  async getDocumentDiff(documentId, commitA, commitB) {
    const params = { commit_a: commitA };
    if (commitB) params.commit_b = commitB;
    const res = await this.apiCall(`/documents/${documentId}/git/diff`, "GET", null, params);
    return res.data;
  }

  /**
   * Restore a document's content to the state at a specific commit.
   * Creates a new restore commit on top of HEAD.
   * @param {number} documentId - Document ID
   * @param {string} commitHash - Commit hash to restore to
   * @returns {Promise<Object>} - Restored document data
   */
  async restoreDocumentVersion(documentId, commitHash) {
    const res = await this.apiCall(
      `/documents/${documentId}/git/restore/${commitHash}`,
      "POST",
      { confirm: true }
    );
    return res.data;
  }

  /**
   * Get git configuration settings
   * @returns {Promise<Object>} - Git configuration settings
   */
  async getGitSettings() {
    const res = await this.apiCall('/documents/git/settings', 'GET');
    return res.data;
  }

  /**
   * Update git configuration settings
   * @param {Object} settings - Git settings to update
   * @param {string} settings.user_name - Git user name
   * @param {string} settings.user_email - Git user email
   * @param {boolean} settings.auto_commit_on_save - Auto-commit on save
   * @param {boolean} settings.auto_init_repos - Auto-initialize repositories
   * @param {boolean} settings.operation_logging - Enable operation logging
   * @returns {Promise<Object>} - Update result
   */
  async updateGitSettings(settings) {
    const res = await this.apiCall('/documents/git/settings', 'POST', { settings });
    return res.data;
  }

  /**
   * Save document to GitHub with automatic diagram conversion
   * @param {number} documentId - Document ID to save
   * @param {Object} options - Save options
   * @param {number} options.repository_id - GitHub repository ID
   * @param {string} options.file_path - Path within repository for the file
   * @param {string} options.commit_message - Commit message for the save operation
   * @param {string} [options.branch="main"] - Target branch for the commit
   * @param {boolean} [options.create_branch=false] - Create branch if it doesn't exist
   * @param {string} [options.base_branch] - Base branch for new branch creation
   * @param {boolean} [options.auto_convert_diagrams] - Override user settings for diagram conversion
   * @returns {Promise<Object>} - Save result with conversion details
   */
  async saveToGitHubWithDiagrams(documentId, options = {}) {
    const payload = {
      repository_id: options.repository_id,
      file_path: options.file_path,
      commit_message: options.commit_message,
      branch: options.branch || "main",
      create_branch: options.create_branch || false,
      base_branch: options.base_branch,
      auto_convert_diagrams: options.auto_convert_diagrams
    };

    // If diagram conversion is enabled, extract rendered diagrams from cache
    if (options.auto_convert_diagrams && options.document_content) {
      try {
        const renderedDiagrams = await this.extractRenderedDiagramsFromCache(options.document_content);
        if (renderedDiagrams.length > 0) {
          payload.rendered_diagrams = renderedDiagrams;
        }
      } catch (error) {
        console.warn('Failed to extract rendered diagrams from cache:', error);
        // Continue with the request even if diagram extraction fails
      }
    }

    const res = await this.apiCall(`/documents/${documentId}/github/save`, 'POST', payload);
    return res.data;
  }

  /**
   * Extract rendered diagrams from the frontend mermaid cache
   * @param {string} content - Markdown content
   * @returns {Promise<Array>} - Array of rendered diagram objects from cache
   */
  async extractRenderedDiagramsFromCache(content) {
    // Import the shared singleton — same instance used by Renderer.jsx
    const { default: renderer } = await import('@/services/rendering/mermaid/singleton.js');

    // Extract mermaid code blocks from content
    const mermaidPattern = /```mermaid\n([\s\S]*?)\n```/g;
    const diagrams = [];
    let match;

    while ((match = mermaidPattern.exec(content)) !== null) {
      const diagramCode = match[1].trim();

      // Check if this diagram is in the cache
      if (renderer.cache.has(diagramCode)) {
        try {
          // Get the cached SVG HTML
          const cachedSvgHtml = renderer.cache.get(diagramCode);

          // Extract the raw SVG from the formatted HTML
          const svgContent = this.extractSvgFromFormattedHtml(cachedSvgHtml);

          if (svgContent) {
            // Generate hash for consistent matching with backend
            const hash = await this.generateDiagramHash(diagramCode);

            diagrams.push({
              diagram_code: diagramCode,
              svg_content: svgContent,
              hash: hash
            });
          }
        } catch (error) {
          console.warn('Failed to extract SVG from cached diagram:', diagramCode, error);
          // Continue with other diagrams
        }
      } else {
        console.warn('Diagram not found in cache, may need to wait for rendering:', diagramCode.substring(0, 50) + '...');
        // Diagram hasn't been rendered yet or cache was cleared
        // Could fallback to rendering here if needed
      }
    }

    return diagrams;
  }

  /**
   * Extract raw SVG content from the formatted HTML stored in cache
   * @param {string} formattedHtml - Formatted HTML containing SVG
   * @returns {string|null} - Raw SVG content or null if not found
   */
  extractSvgFromFormattedHtml(formattedHtml) {
    // The cache stores formatted HTML like: <div class="d-flex justify-content-center"><svg>...</svg></div>
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = formattedHtml;

    const svgElement = tempDiv.querySelector('svg');
    if (svgElement) {
      return svgElement.outerHTML;
    }

    return null;
  }

  /**
   * Generate hash for diagram code (matches backend implementation)
   * @param {string} code - Diagram code
   * @returns {Promise<string>} - SHA256 hash (first 12 characters)
   */
  async generateDiagramHash(code) {
    const encoder = new TextEncoder();
    const data = encoder.encode(code);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex.substring(0, 12);
  }

  /**
   * Update image metadata for a document
   * @param {number} documentId - Document ID
   * @param {Object} metadata - Image metadata updates
   * @returns {Promise<Object>} - Response from server
   */
  async updateImageMetadata(documentId, metadata) {
    try {
      const response = await this.apiCall(`/documents/${documentId}/image-metadata`, 'PATCH', metadata);
      return response;
    } catch (error) {
      console.error('Failed to update image metadata:', error);
      throw error;
    }
  }

  /**
   * Get sibling documents in the same category (lightweight metadata for tab bar)
   * @param {number} documentId - Document ID
   * @param {string} sort - Sort order: 'name', 'created', or 'modified'
   * @returns {Promise<Object>} - { siblings, category_id, category_name, tabs_enabled }
   */
  async getSiblingDocuments(documentId, sort = 'name') {
    const res = await this.apiCall(`/documents/${documentId}/siblings?sort=${sort}`);
    return res.data;
  }
}

export default new DocumentsApi();

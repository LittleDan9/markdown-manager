// Handles synchronization between localStorage and backend
// Operates independently of local storage operations

class DocumentSyncService {
  constructor() {
    this.getIsAuthenticated = null;
    this.getToken = null;
    this.syncQueue = [];
    this.isProcessingQueue = false;
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 second base delay
    this.getUser = null; // callback for user/profile
    this._lastIsAuthenticated = false; // Track last known authentication state

  }

  setUserGetter(fn) {
    this.getUser = fn;
  }

  setTokenGetter(fn) {
    this.getToken = fn;
  }

  setIsAuthenticatedGetter(fn) {
    this.getIsAuthenticated = fn;
    this._checkAuthenticationChange();
  }

  _checkAuthenticationChange() {
    const isAuthenticated = this.getIsAuthenticated();
    if (isAuthenticated && !this._lastIsAuthenticated){
      this.processQueue();
    }
    this._lastIsAuthenticated = isAuthenticated;
  }

  // initialize(isAuthenticated, token) {
  //   console.log('[DocumentSyncService] initialize called. isAuthenticated:', isAuthenticated, 'token:', token);
  //   this.isAuthenticated = isAuthenticated;
  //   this.token = token;
  //   if (isAuthenticated) {
  //     console.log('[DocumentSyncService] Authenticated. Processing sync queue.');
  //     this.processQueue();
  //   } else {
  //     console.log('[DocumentSyncService] Not authenticated. Sync queue will not process.');
  //   }
  // }

  // Queue operations for sync
  queueDocumentSync(document) {
    if (!this.getIsAuthenticated()) {
      console.log('Skipping document sync: not authenticated');
      return;
    }

    this.syncQueue.push({
      type: 'document:save',
      data: { document },
      retryCount: 0,
      timestamp: Date.now()
    });
    this.processQueue();
  }

  queueDocumentDelete(id) {
    if (!this.getIsAuthenticated()) {
      console.log('Skipping document delete sync: not authenticated');
      return;
    }

    this.syncQueue.push({
      type: 'document:delete',
      data: { id },
      retryCount: 0,
      timestamp: Date.now()
    });
    this.processQueue();
  }

  queueCurrentDocumentSync(documentId) {
    console.log('[DocumentSyncService] queueCurrentDocumentSync called with documentId:', documentId);
    if (!this.getIsAuthenticated()) {
      console.log('[DocumentSyncService] Skipping current document sync: not authenticated');
      return;
    }
    this.syncQueue.push({
      type: 'current-document:set',
      data: { documentId },
      retryCount: 0,
      timestamp: Date.now()
    });
    console.log('[DocumentSyncService] Queued current-document:set operation:', { documentId });
    this.processQueue();
  }

  queueCategorySync(operation, data) {
    if (!this.getIsAuthenticated()) {
      console.log('Skipping category sync: not authenticated');
      return;
    }

    this.syncQueue.push({
      type: `category:${operation}`,
      data,
      retryCount: 0,
      timestamp: Date.now()
    });
    this.processQueue();
  }

  // Full sync operations
  async syncAllDocuments() {
    if (!this.getIsAuthenticated()) return [];

    try {
      const DocumentsApi = (await import("../js/api/documentsApi.js")).default;
      const LocalStorage = (await import("./LocalDocumentStorage.js")).default;

      // Get backend documents
      const backendDocs = await DocumentsApi.getAllDocuments();
      const localDocs = LocalStorage.getAllDocuments();

      // Create maps for easier comparison
      const backendDocsById = new Map(backendDocs.map(doc => [doc.id, doc]));
      const localDocsById = new Map(localDocs.map(doc => [doc.id, doc]));

      const toSyncToBackend = [];
      const toUpdateLocally = [];

      // Find local docs that need to be synced to backend
      for (const localDoc of localDocs) {
        if (!localDoc.id || String(localDoc.id).startsWith("doc_")) {
          // Local-only document, needs to be created on backend
          if (!this._isDefaultDocument(localDoc)) {
            toSyncToBackend.push({ action: 'create', document: localDoc });
          }
        } else if (backendDocsById.has(localDoc.id)) {
          // Compare timestamps to see which is newer
          const backendDoc = backendDocsById.get(localDoc.id);
          const localTime = new Date(localDoc.updated_at || localDoc.created_at || 0).getTime();
          const backendTime = new Date(backendDoc.updated_at || backendDoc.created_at || 0).getTime();

          if (localTime > backendTime) {
            toSyncToBackend.push({ action: 'update', document: localDoc });
          } else if (backendTime > localTime) {
            toUpdateLocally.push(backendDoc);
          }
        }
      }

      // Find backend docs that don't exist locally
      for (const backendDoc of backendDocs) {
        if (!localDocsById.has(backendDoc.id)) {
          toUpdateLocally.push(backendDoc);
        }
      }

      // Execute sync operations
      const syncResults = [];

      // Sync to backend
      for (const { action, document } of toSyncToBackend) {
        try {
          let result;
          if (action === 'create') {
            result = await DocumentsApi.createDocument({
              name: document.name,
              content: document.content,
              category: document.category,
            });
            // Update local document with backend ID
            const updatedDoc = { ...document, ...result };
            LocalStorage.bulkUpdateDocuments([updatedDoc]);
          } else {
            result = await DocumentsApi.updateDocument(document.id, {
              name: document.name,
              content: document.content,
              category: document.category,
            });
          }
          syncResults.push({ success: true, action, document: result });
        } catch (error) {
          syncResults.push({ success: false, action, document, error: error.message });
        }
      }

      // Update locally
      if (toUpdateLocally.length > 0) {
        LocalStorage.bulkUpdateDocuments(toUpdateLocally);
      }

      return syncResults;
    } catch (error) {
      console.error('Full sync failed:', error);
      throw error;
    }
  }

  async syncUserSettings() {
    if (!this.getIsAuthenticated()) return;

    try {
      const UserApi = (await import("../js/api/userApi.js")).default;
      const LocalStorage = (await import("./LocalDocumentStorage.js")).default;

      // Use context user/profile if available
      const userProfile = this.getUser ? this.getUser() : null;
      if (!userProfile) return;

      // Sync settings
      const localAutosave = localStorage.getItem("autosaveEnabled");
      const localPreviewScroll = localStorage.getItem("syncPreviewScrollEnabled");
      const localCurrentDoc = LocalStorage.getCurrentDocument();

      let settingsToUpdate = {};

      // Check if local settings differ from backend
      if (localAutosave !== null && String(userProfile.autosave_enabled) !== localAutosave) {
        settingsToUpdate.autosave_enabled = localAutosave === "true";
      }
      if (localPreviewScroll !== null && String(userProfile.sync_preview_scroll_enabled) !== localPreviewScroll) {
        settingsToUpdate.sync_preview_scroll_enabled = localPreviewScroll === "true";
      }

      // Update backend settings if needed
      if (Object.keys(settingsToUpdate).length > 0) {
        await UserApi.updateProfileInfo(settingsToUpdate);
      }

      // Update local settings from backend if local is null
      if (localAutosave === null) {
        localStorage.setItem("autosaveEnabled", String(userProfile.autosave_enabled));
      }
      if (localPreviewScroll === null) {
        localStorage.setItem("syncPreviewScrollEnabled", String(userProfile.sync_preview_scroll_enabled));
      }

      // Sync current document
      if (localCurrentDoc && localCurrentDoc.id && !this._isDefaultDocument(localCurrentDoc)) {
        await this._syncCurrentDocumentId(localCurrentDoc.id);
      } else if (userProfile.current_doc_id) {
        const doc = LocalStorage.getDocument(userProfile.current_doc_id);
        if (doc) {
          LocalStorage.setCurrentDocument(doc);
        }
      }

    } catch (error) {
      console.error('Settings sync failed:', error);
    }
  }

  async syncCategories() {
    if (!this.getIsAuthenticated()) return;

    try {
      const DocumentsApi = (await import("../js/api/documentsApi.js")).default;
      const LocalStorage = (await import("./LocalDocumentStorage.js")).default;

      const [backendCategories] = await Promise.all([
        DocumentsApi.getCategories().catch(() => [])
      ]);

      const localCategories = LocalStorage.getCategories();
      const localDocs = LocalStorage.getAllDocuments();

      // Get categories from local documents
      const docCategories = Array.from(new Set(
        localDocs.map(doc => doc.category).filter(Boolean)
      ));

      // Merge all categories
      const allCategories = Array.from(new Set([
        ...localCategories,
        ...backendCategories,
        ...docCategories
      ]));

      LocalStorage.setCategories(allCategories);
    } catch (error) {
      console.error('Categories sync failed:', error);
    }
  }

  // Process the sync queue
  async processQueue() {
    if (this.isProcessingQueue || !this.getIsAuthenticated() || this.syncQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    // Emit queue start event
    this._emitQueueProgress();

    while (this.syncQueue.length > 0 && this.getIsAuthenticated()) {
      const operation = this.syncQueue.shift();

      try {
        await this._processOperation(operation);
        // Emit progress update
        this._emitQueueProgress();
      } catch (error) {
        // If we get a 403 or authentication error, stop processing
        if (error.response?.status === 403 || error.message?.includes('authentication')) {
          console.log('Authentication error during sync, stopping queue processing');
          this.clearQueue();
          break;
        }

        operation.retryCount++;
        operation.error = error.message;

        if (operation.retryCount < this.maxRetries) {
          // Re-queue for retry with exponential backoff
          setTimeout(() => {
            if (this.getIsAuthenticated()) { // Only retry if still authenticated
              this.syncQueue.push(operation);
              this.processQueue();
            }
          }, this.retryDelay * Math.pow(2, operation.retryCount - 1));
        } else {
          console.error('Operation failed after max retries:', operation);
          // Could emit an event here for error handling
        }
      }
    }

    this.isProcessingQueue = false;

    // Emit final progress update
    this._emitQueueProgress();

    // If queue is empty and logout is pending, complete it
    if (this.syncQueue.length === 0 && !this.getIsAuthenticated()) {
      window.dispatchEvent(new CustomEvent('markdown-manager:logout-ready'));
    }
  }

  // Private methods
  async _processOperation(operation) {
    // Double-check authentication before processing
    if (!this.getIsAuthenticated() || !this.token) {
      throw new Error('Not authenticated');
    }

    const DocumentsApi = (await import("../js/api/documentsApi.js")).default;

    switch (operation.type) {
      case 'document:save':
        await this._syncDocument(operation.data.document);
        break;
      case 'document:delete':
        await DocumentsApi.deleteDocument(operation.data.id);
        break;
      case 'current-document:set':
        await this._syncCurrentDocumentId(operation.data.documentId);
        break;
      case 'category:add':
        await DocumentsApi.addCategory(operation.data.category);
        break;
      case 'category:delete':
        await DocumentsApi.deleteCategory(operation.data.category, operation.data.options);
        break;
      case 'category:rename':
        await DocumentsApi.apiCall(
          `/documents/categories/${encodeURIComponent(operation.data.oldName)}`,
          "PATCH",
          { new_name: operation.data.newName }
        );
        break;
      default:
        console.warn('Unknown sync operation type:', operation.type);
    }
  }

  async _syncDocument(document) {
    const DocumentsApi = (await import("../js/api/documentsApi.js")).default;

    if (!document.id || String(document.id).startsWith("doc_")) {
      // Create new document
      const result = await DocumentsApi.createDocument({
        name: document.name,
        content: document.content,
        category: document.category,
      });

      // Update local document with backend ID
      const LocalStorage = (await import("./LocalDocumentStorage.js")).default;
      const updatedDoc = { ...document, ...result };
      LocalStorage.bulkUpdateDocuments([updatedDoc]);

      return result;
    } else {
      // Update existing document
      return await DocumentsApi.updateDocument(document.id, {
        name: document.name,
        content: document.content,
        category: document.category,
      });
    }
  }

  async _syncCurrentDocumentId(documentId) {
    const DocumentsApi = (await import("../js/api/documentsApi.js")).default;
    console.log('[DocumentSyncService] _syncCurrentDocumentId: sending to backend:', documentId);
    try {
      const result = await DocumentsApi.setCurrentDocumentId(documentId);
      console.log('[DocumentSyncService] _syncCurrentDocumentId: backend response:', result);
      return result;
    } catch (error) {
      console.error('[DocumentSyncService] _syncCurrentDocumentId: error:', error);
      throw error;
    }
  }

  _isDefaultDocument(doc) {
    return (!doc.id || String(doc.id).startsWith("doc_")) &&
           doc.name === "Untitled Document" &&
           doc.category === "General" &&
           doc.content === "";
  }

  // Clear queue on logout
  clearQueue() {
    console.log('Clearing sync queue and stopping authentication');
    this.syncQueue = [];

    this.token = null;
    this.isProcessingQueue = false; // Stop any ongoing processing
  }

  // Get queue status for logout progress
  getQueueStatus() {
    return {
      pending: this.syncQueue.length,
      isProcessing: this.isProcessingQueue,
      hasItems: this.syncQueue.length > 0 || this.isProcessingQueue
    };
  }

  // Force stop all operations immediately
  forceStop() {
    console.log('Force stopping all sync operations');
    this.clearQueue();
    // Emit event to notify any listeners
    window.dispatchEvent(new CustomEvent('markdown-manager:sync-force-stopped'));
  }

  // Emit queue progress events
  _emitQueueProgress() {
    const status = this.getQueueStatus();
    window.dispatchEvent(new CustomEvent('markdown-manager:sync-progress', {
      detail: status
    }));
  }
}

export default new DocumentSyncService();

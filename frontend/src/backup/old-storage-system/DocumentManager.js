// High-level document management API
// Provides the main interface for document operations
// Combines LocalDocumentStorage with sync capabilities

import LocalStorage from './LocalDocumentStorage.js';

class DocumentManager {
  constructor() {
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;

    // Initialize storage event handler
    const StorageEventHandler = (await import('./StorageEventHandler.js')).default;
    StorageEventHandler.initialize();

    // Set up force logout listener
    this._setupForceLogoutListener();

    this.isInitialized = true;
  }

  // Document operations

  getAllDocuments() {
    return LocalStorage.getAllDocuments();
  }


  getDocument(id) {
    return LocalStorage.getDocument(id);
  }


  async saveDocument(doc) {
    try {
      const savedDoc = LocalStorage.saveDocument(doc);
      return savedDoc;
    } catch (error) {
      throw error;
    }
  }


  async deleteDocument(id) {
    const deletedDoc = LocalStorage.deleteDocument(id);
    return deletedDoc;
  }


  searchDocuments(query) {
    return LocalStorage.searchDocuments(query);
  }

  // Current document operations

  getCurrentDocument() {
    return LocalStorage.getCurrentDocument();
  }


  setCurrentDocument(doc) {
    return LocalStorage.setCurrentDocument(doc);
  }


  clearCurrentDocument() {
    return LocalStorage.clearCurrentDocument();
  }


  getLastDocumentId() {
    return LocalStorage.getLastDocumentId();
  }

  // Category operations

  getCategories() {
    return LocalStorage.getCategories();
  }


  async addCategory(category) {
    return LocalStorage.addCategory(category);
  }


  async deleteCategory(name, options = {}) {
    return LocalStorage.deleteCategory(name, options);
  }


  async renameCategory(oldName, newName) {
    return LocalStorage.renameCategory(oldName, newName);
  }

  // Stats and utilities

  getDocumentStats() {
    return LocalStorage.getDocumentStats();
  }

  // Authentication-related operations
  async handleLogin(token) {
    // Emit auth event to trigger sync
    window.dispatchEvent(new CustomEvent('markdown-manager:auth', {
      detail: { type: 'login', data: { token } }
    }));
  }

  async handleLogout(force = false) {
    if (!force) {
      // Check if there are pending sync operations
      const SyncService = (await import('./DocumentSyncService.js')).default;
      const queueStatus = SyncService.getQueueStatus();

      if (queueStatus.hasItems) {
        // Emit event to show logout progress modal
        window.dispatchEvent(new CustomEvent('markdown-manager:logout-pending', {
          detail: { queueStatus }
        }));
        return false; // Indicate logout was deferred
      }
    }

    // Emit auth event to clear data
    window.dispatchEvent(new CustomEvent('markdown-manager:auth', {
      detail: { type: 'logout', data: { force } }
    }));
    return true; // Indicate logout completed
  }

  async forceLogout() {
    return await this.handleLogout(true);
  }

  async handleTokenRefresh(newToken) {
    // Emit auth event to update token
    window.dispatchEvent(new CustomEvent('markdown-manager:auth', {
      detail: { type: 'token-refresh', data: { token: newToken } }
    }));
  }

  // Manual sync operations
  async triggerFullSync() {
    const StorageEventHandler = (await import('./StorageEventHandler.js')).default;
    return await StorageEventHandler.triggerFullSync();
  }

  async triggerDocumentSync(document) {
    const StorageEventHandler = (await import('./StorageEventHandler.js')).default;
    return await StorageEventHandler.triggerDocumentSync(document);
  }

  // Error handling
  onError(callback) {
    const handleError = (event) => {
      callback(event.detail.message);
    };
    window.addEventListener('markdown-manager:error', handleError);

    // Return cleanup function
    return () => {
      window.removeEventListener('markdown-manager:error', handleError);
    };
  }

  // Bulk operations (useful for import/export)
  async importDocuments(documents) {
    const results = [];
    for (const doc of documents) {
      try {
        const saved = await this.saveDocument(doc);
        results.push({ success: true, document: saved });
      } catch (error) {
        results.push({ success: false, document: doc, error: error.message });
      }
    }
    return results;
  }

  exportDocuments(format = 'json') {
    const documents = this.getAllDocuments();

    switch (format) {
      case 'json':
        return JSON.stringify(documents, null, 2);
      case 'csv':
        return this._exportToCsv(documents);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  // Migration utilities (for moving from old storage format)

  async migrateFromLegacyStorage(legacyData) {
    try {
      // Clear existing data first
      LocalStorage.clearAllData();

      // Import legacy documents
      if (legacyData.documents) {
        const documents = Array.isArray(legacyData.documents)
          ? legacyData.documents
          : Object.values(legacyData.documents);

        await this.importDocuments(documents);
      }

      // Import categories
      if (legacyData.categories) {
        LocalStorage.setCategories(legacyData.categories);
      }

      // Set current document
      if (legacyData.currentDocument) {
        LocalStorage.setCurrentDocument(legacyData.currentDocument);
      }

      return { success: true, migratedCount: legacyData.documents?.length || 0 };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Private methods

  // Removed _getLocalStorage, not needed with static import

  _exportToCsv(documents) {
    const headers = ['ID', 'Name', 'Category', 'Created', 'Updated', 'Content Length'];
    const rows = documents.map(doc => [
      doc.id || '',
      doc.name || '',
      doc.category || '',
      doc.created_at || '',
      doc.updated_at || '',
      (doc.content || '').length
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    return csvContent;
  }

  // Set up force logout event listener
  _setupForceLogoutListener() {
    const handleForceLogout = async () => {
      console.log('Force logout event received');

      // Force stop the sync service
      const SyncService = (await import('./DocumentSyncService.js')).default;
      SyncService.forceStop();

      // Proceed with force logout
      await this.forceLogout();
    };

    window.addEventListener('markdown-manager:force-logout', handleForceLogout);
  }

  // Cleanup
  destroy() {
    if (!this.isInitialized) return;

    // Cleanup storage event handler
    this._getStorageEventHandler().destroy();
    this.isInitialized = false;
  }

  async _getStorageEventHandler() {
    return (await import('./StorageEventHandler.js')).default;
  }
}

export default new DocumentManager();

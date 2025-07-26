// Event handler for storage events and sync coordination
// Listens to localStorage events and triggers appropriate sync operations

class StorageEventHandler {
  constructor() {
    this.isInitialized = false;
    this.boundHandleStorageEvent = this._handleStorageEvent.bind(this);
  }

  initialize() {
    if (this.isInitialized) return;

    // Listen to our custom storage events
    window.addEventListener('markdown-manager:storage', this.boundHandleStorageEvent);

    // Listen to authentication state changes
    window.addEventListener('markdown-manager:auth', this._handleAuthEvent.bind(this));

    this.isInitialized = true;
  }

  destroy() {
    if (!this.isInitialized) return;

    window.removeEventListener('markdown-manager:storage', this.boundHandleStorageEvent);
    window.removeEventListener('markdown-manager:auth', this._handleAuthEvent.bind(this));

    this.isInitialized = false;
  }

  async _handleStorageEvent(event) {
    const { type, data } = event.detail;
    const SyncService = (await import('./DocumentSyncService.js')).default;

    switch (type) {
      case 'document:saved':
        SyncService.queueDocumentSync(data.document);
        break;

      case 'document:deleted':
        SyncService.queueDocumentDelete(data.id);
        break;

      case 'current-document:changed':
        if (data.document && data.document.id) {
          SyncService.queueCurrentDocumentSync(data.document.id);
        }
        break;

      case 'category:added':
        SyncService.queueCategorySync('add', { category: data.category });
        break;

      case 'category:deleted':
        SyncService.queueCategorySync('delete', {
          category: data.category,
          options: data.options
        });
        // Also sync affected documents
        data.affectedDocuments?.forEach(({ action, document }) => {
          if (action === 'migrated') {
            SyncService.queueDocumentSync(document);
          }
        });
        break;

      case 'category:renamed':
        SyncService.queueCategorySync('rename', {
          oldName: data.oldName,
          newName: data.newName
        });
        // Sync affected documents
        data.affectedDocuments?.forEach(document => {
          SyncService.queueDocumentSync(document);
        });
        break;

      case 'storage:cleared':
        SyncService.clearQueue();
        break;

      default:
        // Unknown event type, ignore
        break;
    }
  }

  async _handleAuthEvent(event) {
    const { type, data } = event.detail;
    const SyncService = (await import('./DocumentSyncService.js')).default;

    switch (type) {
      case 'token-refresh':
        // Update token in sync service
        SyncService.initialize(true, data.token);
        break;

      default:
        break;
    }
  }

  _emitErrorEvent(message) {
    window.dispatchEvent(new CustomEvent('markdown-manager:error', {
      detail: { message }
    }));
  }

  // Manual trigger methods for external use
  async triggerFullSync() {
    const SyncService = (await import('./DocumentSyncService.js')).default;
    try {
      await Promise.all([
        SyncService.syncAllDocuments(),
        SyncService.syncUserSettings(),
        SyncService.syncCategories()
      ]);
      return true;
    } catch (error) {
      console.error('Manual sync failed:', error);
      this._emitErrorEvent('Sync failed. Please try again.');
      return false;
    }
  }

  async triggerDocumentSync(document) {
    const SyncService = (await import('./DocumentSyncService.js')).default;
    SyncService.queueDocumentSync(document);
  }
}

export default new StorageEventHandler();

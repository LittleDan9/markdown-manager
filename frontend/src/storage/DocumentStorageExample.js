// Example usage of the new modular document storage system
// This shows how to migrate from the old DocumentStorage usage

import DocumentManager from './DocumentManager.js';
import StorageMigration from './StorageMigration.js';

class DocumentStorageExample {
  static async initializeApp() {
    // 1. Check if migration is needed
    if (!StorageMigration.isMigrationComplete()) {
      const migrationResult = await StorageMigration.migrateFromOldSystem();
      if (!migrationResult.success) {
        console.error('Migration failed:', migrationResult.message);
        // Handle migration failure - maybe show user error
      }
    }

    // 2. Initialize the document manager
    await DocumentManager.initialize();

    // 3. Set up error handling
    const cleanup = DocumentManager.onError((message) => {
      console.error('Storage error:', message);
      // Show user notification using your notification system
      // NotificationProvider.showError(message);
    });

    // 4. Handle authentication events
    this.setupAuthHandlers();

    // Return cleanup function for app shutdown
    return cleanup;
  }

  static setupAuthHandlers() {
    // When user logs in
    window.addEventListener('user-login', async (event) => {
      const { token } = event.detail;
      await DocumentManager.handleLogin(token);
    });

    // When user logs out
    window.addEventListener('user-logout', async () => {
      await DocumentManager.handleLogout();
    });

    // When token is refreshed
    window.addEventListener('token-refresh', async (event) => {
      const { token } = event.detail;
      await DocumentManager.handleTokenRefresh(token);
    });
  }

  // Example document operations
  static async exampleDocumentOperations() {
    // Save a document
    const newDoc = {
      name: 'My Document',
      content: '# Hello World',
      category: 'Personal'
    };

    try {
      const savedDoc = await DocumentManager.saveDocument(newDoc);
      console.log('Document saved:', savedDoc);
    } catch (error) {
      console.error('Failed to save document:', error.message);
    }

    // Get all documents
    const allDocs = DocumentManager.getAllDocuments();
    console.log('All documents:', allDocs);

    // Search documents
    const searchResults = DocumentManager.searchDocuments('hello');
    console.log('Search results:', searchResults);

    // Set current document
    DocumentManager.setCurrentDocument(savedDoc);

    // Get current document
    const currentDoc = DocumentManager.getCurrentDocument();
    console.log('Current document:', currentDoc);

    // Category operations
    await DocumentManager.addCategory('Work');
    const categories = DocumentManager.getCategories();
    console.log('Categories:', categories);

    // Get stats
    const stats = DocumentManager.getDocumentStats();
    console.log('Document stats:', stats);
  }

  // Example sync operations
  static async exampleSyncOperations() {
    // Trigger manual sync
    const syncSuccess = await DocumentManager.triggerFullSync();
    if (syncSuccess) {
      console.log('Sync completed successfully');
    } else {
      console.log('Sync failed');
    }

    // Export documents
    const jsonExport = DocumentManager.exportDocuments('json');
    console.log('Exported documents:', jsonExport);

    // Import documents
    const documentsToImport = [
      { name: 'Imported Doc 1', content: 'Content 1', category: 'Imported' },
      { name: 'Imported Doc 2', content: 'Content 2', category: 'Imported' }
    ];

    const importResults = await DocumentManager.importDocuments(documentsToImport);
    console.log('Import results:', importResults);
  }

  // Migration example
  static async exampleMigration() {
    // Check backup info
    const backupInfo = StorageMigration.getBackupInfo();
    if (backupInfo) {
      console.log('Backup available:', backupInfo);
    }

    // If something goes wrong, restore from backup
    try {
      // Some operation that might fail
      await DocumentManager.triggerFullSync();
    } catch (error) {
      console.error('Operation failed, restoring backup');
      const restoreResult = StorageMigration.restoreFromBackup();
      if (restoreResult.success) {
        console.log('Successfully restored from backup');
      }
    }
  }
}

export default DocumentStorageExample;

/*
MIGRATION GUIDE FOR EXISTING CODE:

1. Replace imports:
   OLD: import DocumentStorage from './storage/DocumentStorage.js';
   NEW: import DocumentManager from './storage/DocumentManager.js';

2. Initialize the system:
   Add this to your app startup:
   await DocumentManager.initialize();

3. Update method calls:
   OLD: DocumentStorage.saveDocument(doc, isAuthenticated, token)
   NEW: DocumentManager.saveDocument(doc)

4. Handle authentication:
   OLD: Call sync methods manually with auth params
   NEW: Call DocumentManager.handleLogin(token) / handleLogout()

5. Error handling:
   OLD: Try/catch around each operation
   NEW: Set up global error handler with DocumentManager.onError()

6. Sync operations:
   OLD: DocumentStorage.syncAndMergeDocuments(isAuthenticated, token)
   NEW: DocumentManager.triggerFullSync()
*/

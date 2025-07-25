// Migration utility to transition from old DocumentStorage to new modular system
// Run this once during the transition period

import DocumentManager from './DocumentManager.js';

class StorageMigration {
  static async migrateFromOldSystem() {
    try {
      console.log('Starting storage migration...');

      // Initialize the new system
      await DocumentManager.initialize();

      // Check if old data exists
      const hasOldData = this._hasOldStorageData();

      if (!hasOldData) {
        console.log('No old data found, migration not needed');
        return { success: true, message: 'No migration needed' };
      }

      // Extract old data
      const oldData = this._extractOldData();

      // Backup old data
      this._backupOldData(oldData);

      // Migrate to new system
      const result = await DocumentManager.migrateFromLegacyStorage(oldData);

      if (result.success) {
        // Mark migration as complete
        localStorage.setItem('storage-migration-complete', Date.now().toString());
        console.log(`Migration complete. Migrated ${result.migratedCount} documents.`);

        // Optionally clean up old data after successful migration
        // Uncomment the next line if you want to remove old data immediately
        // this._cleanupOldData();

        return {
          success: true,
          message: `Successfully migrated ${result.migratedCount} documents`,
          migratedCount: result.migratedCount
        };
      } else {
        console.error('Migration failed:', result.error);
        return {
          success: false,
          message: `Migration failed: ${result.error}`
        };
      }

    } catch (error) {
      console.error('Migration error:', error);
      return {
        success: false,
        message: `Migration error: ${error.message}`
      };
    }
  }

  static isMigrationComplete() {
    return localStorage.getItem('storage-migration-complete') !== null;
  }

  static _hasOldStorageData() {
    // Check for existence of old storage keys that don't match our new format
    const oldKeys = [
      'documents',        // if the old system used a different key
      'documentStorage',  // another possible old key
      'markdown-docs'     // another possible old key
    ];

    return oldKeys.some(key => localStorage.getItem(key) !== null) ||
           this._hasOldFormatInNewKeys();
  }

  static _hasOldFormatInNewKeys() {
    // Check if the current keys contain old format data
    const savedDocs = localStorage.getItem('savedDocuments');
    if (!savedDocs) return false;

    try {
      const docs = JSON.parse(savedDocs);
      // Check if it's using the old format (this is just an example)
      // Adjust this logic based on what the old format looked like
      return Object.values(docs).some(doc =>
        doc.hasOwnProperty('lastModified') || // old timestamp field
        doc.hasOwnProperty('timestamp') ||    // another old field
        !doc.hasOwnProperty('created_at')     // missing new required field
      );
    } catch {
      return false;
    }
  }

  static _extractOldData() {
    const data = {};

    // Try different possible old storage keys
    const possibleKeys = [
      'savedDocuments',
      'documents',
      'documentStorage',
      'markdown-docs'
    ];

    for (const key of possibleKeys) {
      const stored = localStorage.getItem(key);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            data.documents = parsed;
          } else if (typeof parsed === 'object') {
            data.documents = Object.values(parsed);
          }
          break;
        } catch (e) {
          console.warn(`Failed to parse ${key}:`, e);
        }
      }
    }

    // Extract categories
    const categories = localStorage.getItem('documentCategories');
    if (categories) {
      try {
        data.categories = JSON.parse(categories);
      } catch (e) {
        console.warn('Failed to parse categories:', e);
      }
    }

    // Extract current document
    const currentDoc = localStorage.getItem('currentDocument');
    if (currentDoc) {
      try {
        data.currentDocument = JSON.parse(currentDoc);
      } catch (e) {
        console.warn('Failed to parse current document:', e);
      }
    }

    return data;
  }

  static _backupOldData(data) {
    // Create a backup in localStorage with timestamp
    const backup = {
      timestamp: new Date().toISOString(),
      data: data,
      version: '1.0'
    };

    localStorage.setItem('storage-migration-backup', JSON.stringify(backup));
    console.log('Created backup of old data');
  }

  static _cleanupOldData() {
    // Remove old storage keys
    const keysToRemove = [
      'documents',
      'documentStorage',
      'markdown-docs'
    ];

    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
    });

    console.log('Cleaned up old storage keys');
  }

  static restoreFromBackup() {
    const backup = localStorage.getItem('storage-migration-backup');
    if (!backup) {
      throw new Error('No backup found');
    }

    try {
      const backupData = JSON.parse(backup);

      // Restore old data
      if (backupData.data.documents) {
        localStorage.setItem('savedDocuments', JSON.stringify(backupData.data.documents));
      }
      if (backupData.data.categories) {
        localStorage.setItem('documentCategories', JSON.stringify(backupData.data.categories));
      }
      if (backupData.data.currentDocument) {
        localStorage.setItem('currentDocument', JSON.stringify(backupData.data.currentDocument));
      }

      // Remove migration marker
      localStorage.removeItem('storage-migration-complete');

      console.log('Restored from backup');
      return { success: true };

    } catch (error) {
      console.error('Failed to restore from backup:', error);
      return { success: false, error: error.message };
    }
  }

  static getBackupInfo() {
    const backup = localStorage.getItem('storage-migration-backup');
    if (!backup) return null;

    try {
      const backupData = JSON.parse(backup);
      return {
        timestamp: backupData.timestamp,
        documentCount: backupData.data.documents?.length || 0,
        hasCategories: !!backupData.data.categories,
        hasCurrentDocument: !!backupData.data.currentDocument
      };
    } catch {
      return null;
    }
  }
}

export default StorageMigration;

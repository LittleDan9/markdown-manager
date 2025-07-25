// Migration and initialization script for the new storage system
// Run this during app startup to ensure smooth transition

import DocumentManager from './storage/DocumentManager.js';
import StorageMigration from './storage/StorageMigration.js';

class StorageInitializer {
  static async initialize() {
    console.log('Initializing document storage system...');

    try {
      // 1. Check and run migration if needed
      if (!StorageMigration.isMigrationComplete()) {
        console.log('Running storage migration...');
        const migrationResult = await StorageMigration.migrateFromOldSystem();

        if (migrationResult.success) {
          console.log(`Migration successful: ${migrationResult.message}`);
        } else {
          console.error(`Migration failed: ${migrationResult.message}`);
          // Continue anyway, new system should work
        }
      } else {
        console.log('Storage migration already complete');
      }

      // 2. Initialize DocumentManager
      await DocumentManager.initialize();
      console.log('DocumentManager initialized');

      // 3. Set up global error handling for storage issues
      const cleanup = DocumentManager.onError((message) => {
        console.error('Storage error:', message);
        // You can integrate with your notification system here
        // NotificationProvider.showError(message);
      });

      // 4. Return cleanup function for app shutdown
      return cleanup;

    } catch (error) {
      console.error('Storage initialization failed:', error);
      throw error;
    }
  }

  // Utility to check if old DocumentStorage is still being used
  static checkForOldUsage() {
    // This can be used in development to find remaining references
    if (window.DocumentStorage) {
      console.warn('Old DocumentStorage still exists on window object');
    }

    // Check for old import patterns in console
    const oldPatterns = [
      'DocumentStorage.saveDocument',
      'DocumentStorage.getAllDocuments',
      'DocumentStorage.syncAndMergeDocuments'
    ];

    // In development, you could scan the source for these patterns
    if (process.env.NODE_ENV === 'development') {
      console.log('Migration complete. Update any remaining references to use DocumentManager instead.');
    }
  }

  // Emergency rollback if something goes wrong
  static async rollback() {
    try {
      const result = StorageMigration.restoreFromBackup();
      if (result.success) {
        console.log('Successfully rolled back to old storage format');
        // Reload the page to use old system
        window.location.reload();
      } else {
        console.error('Rollback failed:', result.error);
      }
    } catch (error) {
      console.error('Rollback error:', error);
    }
  }

  // Get migration status for debugging
  static getMigrationStatus() {
    return {
      isComplete: StorageMigration.isMigrationComplete(),
      backup: StorageMigration.getBackupInfo(),
      currentSystem: 'modular'
    };
  }
}

export default StorageInitializer;

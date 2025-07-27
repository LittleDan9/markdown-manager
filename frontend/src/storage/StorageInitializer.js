// Migration and initialization script for the new storage system
// Run this during app startup to ensure smooth transition

import { notification } from '@/services/EventDispatchService.js';
import DocumentManager from './storage/DocumentManager.js';

class StorageInitializer {
  static async initialize() {
    console.log('Initializing document storage system...');

    try {
      // 2. Initialize DocumentManager
      await DocumentManager.initialize();
      console.log('DocumentManager initialized');

      // 3. Set up global error handling for storage issues
      const cleanup = DocumentManager.onError((message) => {
        console.error('Storage error:', message);
        // You can integrate with your notification system here
        notification.error({
          message: 'Storage Error: ' + message,
       });
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
}

export default StorageInitializer;

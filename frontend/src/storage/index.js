// Storage module exports
// Provides easy access to all storage services

// Main API - use this for most operations
export { default as DocumentManager } from './DocumentManager.js';

// Individual services - use these for specific needs
export { default as LocalDocumentStorage } from './LocalDocumentStorage.js';
export { default as DocumentSyncService } from './DocumentSyncService.js';
export { default as StorageEventHandler } from './StorageEventHandler.js';

// Legacy compatibility - re-export DocumentManager as default for existing code
import DocumentManager from './DocumentManager.js';
export default DocumentManager;

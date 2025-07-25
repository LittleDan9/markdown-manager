# Document Storage System

A modular, event-driven document storage system that manages documents in localStorage with automatic backend synchronization for authenticated users.

## Architecture

The system is split into four main components:

### 1. LocalDocumentStorage
- **Purpose**: Pure localStorage operations
- **Responsibilities**: CRUD operations, local data management
- **No dependencies**: No backend logic, always works offline

### 2. DocumentSyncService
- **Purpose**: Backend synchronization
- **Responsibilities**: Queue sync operations, handle retries, batch operations
- **Features**: Automatic retry with exponential backoff, conflict resolution

### 3. StorageEventHandler
- **Purpose**: Event coordination
- **Responsibilities**: Listen to storage events, trigger sync operations
- **Features**: Decoupled event-driven architecture

### 4. DocumentManager
- **Purpose**: Main API interface
- **Responsibilities**: High-level operations, coordination between services
- **Features**: Simple API, error handling, migration support

## Key Benefits

1. **Separation of Concerns**: Each service has a single, well-defined responsibility
2. **Reliability**: Local operations always work, sync happens independently
3. **Event-Driven**: Changes automatically trigger appropriate sync operations
4. **Error Handling**: Comprehensive retry logic and error reporting
5. **Testability**: Each component can be tested in isolation
6. **Maintainability**: Clear boundaries and minimal interdependencies

## Usage

### Basic Setup

```javascript
import DocumentManager from './storage/DocumentManager.js';

// Initialize the system
await DocumentManager.initialize();

// Set up error handling
const cleanup = DocumentManager.onError((message) => {
  NotificationProvider.showError(message);
});
```

### Authentication Handling

```javascript
// When user logs in
await DocumentManager.handleLogin(token);

// When user logs out
await DocumentManager.handleLogout();

// When token refreshes
await DocumentManager.handleTokenRefresh(newToken);
```

### Document Operations

```javascript
// Save document (automatically syncs if authenticated)
const doc = await DocumentManager.saveDocument({
  name: 'My Document',
  content: '# Hello World',
  category: 'Personal'
});

// Get all documents
const docs = DocumentManager.getAllDocuments();

// Search documents
const results = DocumentManager.searchDocuments('hello');

// Delete document
await DocumentManager.deleteDocument(docId);
```

### Category Operations

```javascript
// Add category
await DocumentManager.addCategory('Work');

// Get all categories
const categories = DocumentManager.getCategories();

// Rename category
await DocumentManager.renameCategory('Old Name', 'New Name');

// Delete category
await DocumentManager.deleteCategory('Category', {
  migrateTo: 'General' // or { deleteDocs: true }
});
```

### Manual Sync Operations

```javascript
// Trigger full sync
const success = await DocumentManager.triggerFullSync();

// Sync specific document
await DocumentManager.triggerDocumentSync(document);
```

## Event System

The system uses custom events for communication:

### Storage Events
- `document:saved` - Document saved to localStorage
- `document:deleted` - Document deleted from localStorage
- `current-document:changed` - Current document changed
- `category:added/deleted/renamed` - Category operations
- `storage:cleared` - All data cleared

### Auth Events
- `login` - User logged in, trigger initial sync
- `logout` - User logged out, clear data
- `token-refresh` - Token refreshed, update sync service

### Error Events
- `markdown-manager:error` - Global error occurred

## Migration

### From Old DocumentStorage

1. **Run Migration**:
```javascript
import StorageMigration from './storage/StorageMigration.js';

if (!StorageMigration.isMigrationComplete()) {
  const result = await StorageMigration.migrateFromOldSystem();
  if (!result.success) {
    console.error('Migration failed:', result.message);
  }
}
```

2. **Update Code**:
```javascript
// OLD
DocumentStorage.saveDocument(doc, isAuthenticated, token)

// NEW
DocumentManager.saveDocument(doc)
```

3. **Handle Auth**:
```javascript
// OLD
DocumentStorage.syncAndMergeDocuments(isAuthenticated, token)

// NEW
DocumentManager.handleLogin(token) // automatic sync
```

## Configuration

### Retry Settings
```javascript
// In DocumentSyncService.js
this.maxRetries = 3;
this.retryDelay = 1000; // Base delay in ms
```

### Storage Keys
```javascript
// In LocalDocumentStorage.js
const DOCUMENTS_KEY = "savedDocuments";
const CURRENT_DOC_KEY = "currentDocument";
const CATEGORIES_KEY = "documentCategories";
```

## Testing

Each component can be tested independently:

```javascript
// Test LocalDocumentStorage
import LocalStorage from './LocalDocumentStorage.js';
const doc = LocalStorage.saveDocument({ name: 'Test', content: 'Test' });

// Test DocumentSyncService
import SyncService from './DocumentSyncService.js';
SyncService.queueDocumentSync(doc);

// Test DocumentManager
import DocumentManager from './DocumentManager.js';
await DocumentManager.saveDocument(doc);
```

## Error Handling

The system provides multiple levels of error handling:

1. **Local Operations**: Immediate errors for validation issues
2. **Sync Operations**: Queued retries with exponential backoff
3. **Global Errors**: Event-based error reporting for UI notifications

## Performance Considerations

- **Local First**: All operations write to localStorage immediately
- **Background Sync**: Backend operations happen asynchronously
- **Batch Operations**: Multiple changes are batched for efficiency
- **Conflict Resolution**: Smart merging based on timestamps

## Future Enhancements

- **Offline Detection**: Pause sync when offline
- **Change Tracking**: Track specific field changes for efficient sync
- **Compression**: Compress large documents in localStorage
- **Encryption**: Encrypt sensitive data in localStorage

# Recovery Provider System Documentation

## Overview

The Recovery Provider is a comprehensive data loss prevention system implemented for the Markdown Manager application. It prevents catastrophic data loss by detecting document conflicts, handling authentication failures, and providing user-friendly recovery interfaces.

## Problem Statement

Web applications face several data loss scenarios:

- Network interruptions during document synchronization
- Authentication token expiration while editing
- Browser crashes with unsaved changes
- Multiple device synchronization conflicts
- Unexpected logout scenarios
- Content conflicts between local and remote versions

## Architecture

### Frontend Components

#### 1. RecoveryProvider (`src/components/recovery/RecoveryProvider.jsx`)
- **Purpose**: Central context provider for recovery state management
- **Features**:
  - Listens for `showRecoveryModal` events
  - Manages recovery document state
  - Provides UI for document review and resolution
  - Integrates with backend recovery API

#### 2. RecoveryModal (`src/components/recovery/RecoveryModal.jsx`)
- **Purpose**: Individual document review interface
- **Features**:
  - Displays full document content for review
  - Shows conflict information
  - Provides Save/Overwrite/Discard options
  - Handles collision scenarios

#### 3. RecoveryList (`src/components/recovery/RecoveryList.jsx`)
- **Purpose**: Overview of all recovery documents
- **Features**:
  - Lists all documents requiring attention
  - Shows document metadata and conflict status
  - Provides bulk operations (Discard All)

### Backend Components

#### 1. Database Model (`backend/app/models/document_recovery.py`)
```python
class DocumentRecovery(Base):
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    document_id = Column(String, nullable=True)
    name = Column(String, nullable=False)
    category = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    recovered_at = Column(DateTime, default=datetime.utcnow)
    collision = Column(Boolean, default=False)
```

#### 2. API Endpoints (`backend/app/api/v1/recovery.py`)
- `POST /recovery/save` - Save recovery document
- `GET /recovery/list/{user_id}` - List user's recovery documents
- `POST /recovery/resolve/{doc_id}` - Mark document as resolved

#### 3. CRUD Operations (`backend/app/crud/document_recovery.py`)
- `create_recovery_doc()` - Create new recovery document
- `get_recovery_docs()` - Fetch user's recovery documents
- `delete_recovery_doc()` - Remove resolved recovery document

## Implementation Details

### Step 1: Integration into Main App

The RecoveryProvider is integrated into the React component hierarchy:

```jsx
// src/index.js
<GlobalErrorBoundary>
  <NotificationProvider>
    <AuthProvider>
      <RecoveryProvider>  {/* Added here */}
        <DocumentProvider>
          <App />
        </DocumentProvider>
      </RecoveryProvider>
    </AuthProvider>
  </NotificationProvider>
</GlobalErrorBoundary>
```

**Positioning**: Between AuthProvider and DocumentProvider ensures access to authentication state while wrapping document operations.

### Step 2: Enhanced Conflict Detection

Modified `DocumentSyncService.syncAllDocuments()` to detect real conflicts:

```javascript
// Enhanced conflict detection logic
const contentDifferent = localDoc.content !== backendDoc.content;
const nameDifferent = localDoc.name !== backendDoc.name;
const categoryDifferent = localDoc.category !== backendDoc.category;
const hasChanges = contentDifferent || nameDifferent || categoryDifferent;
const timeDifference = Math.abs(localTime - backendTime);
const isSignificantTimeDifference = timeDifference > 5000; // 5 seconds

if (isSignificantTimeDifference && hasChanges) {
  // Flag as conflict requiring user intervention
  conflicts.push(conflictDocument);
}
```

**Key Features**:
- Content-based conflict detection (not just timestamps)
- 5-second threshold for significant time differences
- Automatic conflict saving to backend recovery system
- Detailed conflict metadata for user review

### Step 3: Recovery Triggers

Multiple trigger points ensure comprehensive coverage:

#### A. Login Recovery Trigger
```javascript
// After successful login
setTimeout(() => {
  checkForRecoveryDocuments(user.id, token);
}, 1000);
```

#### B. Orphaned Document Detection
```javascript
// On app startup
const orphanedDocs = localDocs.filter(doc =>
  doc.content && doc.content.trim() !== '' &&
  doc.name !== 'Untitled Document'
);
```

#### C. Network Reconnection Recovery
```javascript
// Listen for online events
window.addEventListener('online', handleOnline);
document.addEventListener('visibilitychange', handleVisibilityChange);
```

#### D. Authentication State Tracking
```javascript
// Track auth changes for recovery detection
localStorage.setItem('lastKnownAuthState', 'authenticated');
```

### Step 4: Backend Integration

#### Automatic Conflict Saving
When conflicts are detected during sync:
```javascript
// Save conflict to backend recovery system
await RecoveryApi.saveRecoveryDoc({
  user_id: this.user?.id,
  document_id: localDoc.id,
  name: localDoc.name,
  category: localDoc.category,
  content: localDoc.content,
  collision: true
}, this.token);
```

#### Recovery Document Resolution
When users resolve conflicts:
```javascript
// Remove from backend after resolution
await RecoveryApi.resolveRecoveryDoc(doc.id, token);
```

## User Experience Flow

### 1. Conflict Detection
- System automatically detects conflicts during sync
- Conflicts are saved to backend recovery system
- User receives notification about recovered documents

### 2. Recovery Modal Display
- Modal shows list of all recovery documents
- Each document displays name, category, and recovery timestamp
- "Collision" indicator shows if conflicts exist

### 3. Document Review
- User clicks "Review" to see full document content
- Side-by-side comparison (implied) with conflict information
- Clear action buttons: Save, Overwrite, Discard

### 4. Resolution Actions
- **Save**: Creates new document with recovered content
- **Overwrite**: Replaces existing document with recovered version
- **Discard**: Permanently removes recovered document

## Technical Specifications

### Conflict Detection Thresholds
- **Time Threshold**: 5 seconds minimum difference
- **Content Comparison**: Exact string matching
- **Metadata Comparison**: Name and category changes

### Recovery Document Structure
```javascript
{
  id: "conflict_123_1234567890",
  document_id: "original_doc_id",
  name: "Document Name",
  category: "Category",
  content: "Full document content...",
  collision: true,
  recoveredAt: "2025-08-01T12:00:00.000Z",
  conflictType: "content" // content|name|category|orphaned
}
```

### API Integration
- **Authentication**: Bearer token required for all operations
- **Error Handling**: Comprehensive error handling with user feedback
- **Async Operations**: All backend calls are asynchronous with proper error boundaries

## Security Considerations

### Data Protection
- Recovery documents are user-scoped (user_id filtering)
- Authentication required for all recovery operations
- Automatic cleanup of resolved documents

### Privacy
- Recovery documents contain full content (necessary for recovery)
- Temporary storage with user-controlled resolution
- No indefinite storage of recovery documents

## Monitoring and Maintenance

### Logging
- Conflict detection events logged to console
- Recovery operations logged with success/failure status
- Backend API errors logged for debugging

### Cleanup
- Resolved recovery documents automatically removed
- No automatic expiration (user-controlled)
- Consider implementing automatic cleanup after 30 days

## Testing Scenarios

### 1. Network Interruption
- Edit document while online
- Disconnect network
- Continue editing
- Reconnect network
- Verify recovery modal appears

### 2. Authentication Loss
- Edit document while logged in
- Token expires during editing
- User forced to re-login
- Verify recovery of unsaved changes

### 3. Multiple Device Conflict
- Edit same document on two devices
- Ensure both changes are preserved
- Verify conflict resolution options

### 4. Browser Crash Recovery
- Edit document with unsaved changes
- Force browser close/crash
- Restart application
- Verify orphaned document recovery

## Future Enhancements

### Potential Improvements
1. **Visual Diff**: Side-by-side comparison of conflicting versions
2. **Merge Tool**: Advanced merge capabilities for conflicts
3. **Auto-Recovery**: Automatic recovery based on user preferences
4. **Recovery History**: Audit trail of recovery actions
5. **Batch Operations**: Bulk resolution of multiple conflicts
6. **Smart Conflict Resolution**: ML-based conflict resolution suggestions

### Performance Optimizations
1. **Lazy Loading**: Load recovery documents on-demand
2. **Pagination**: For users with many recovery documents
3. **Compression**: Compress large document content in recovery storage
4. **Caching**: Cache recovery status to reduce API calls

## Deployment Checklist

### Database Migration
- [ ] Apply recovery table migration: `8f3a2c1d7b4a_add_document_recovery_table.py`
- [ ] Verify foreign key constraints
- [ ] Test recovery API endpoints

### Frontend Deployment
- [ ] Verify RecoveryProvider integration in index.js
- [ ] Test recovery modal UI components
- [ ] Validate conflict detection logic
- [ ] Test all recovery triggers

### Backend Deployment
- [ ] Deploy recovery API endpoints
- [ ] Verify database permissions
- [ ] Test recovery CRUD operations
- [ ] Monitor recovery system logs

## Troubleshooting

### Common Issues

#### Recovery Modal Not Appearing
- Check browser console for JavaScript errors
- Verify RecoveryProvider is properly integrated
- Ensure event listeners are attached correctly

#### Conflicts Not Detected
- Verify sync service is running
- Check conflict detection thresholds
- Ensure backend API is accessible

#### Recovery Documents Not Saving
- Check authentication token validity
- Verify backend API connectivity
- Review server logs for errors

### Debug Commands
```javascript
// Check recovery system status
window.dispatchEvent(new CustomEvent('showRecoveryModal', {
  detail: [/* test recovery docs */]
}));

// Manual recovery check
checkForRecoveryDocuments(userId, token);

// Check local storage state
localStorage.getItem('lastKnownAuthState');
localStorage.getItem('markdown_manager_documents');
```

## Conclusion

The Recovery Provider system provides comprehensive data loss prevention for the Markdown Manager application. By implementing multiple detection mechanisms, user-friendly recovery interfaces, and robust backend integration, users can confidently work with their documents knowing their data is protected against various failure scenarios.

The system balances user control with automatic protection, ensuring no data is lost while maintaining a clean and intuitive user experience.

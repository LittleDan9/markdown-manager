import { useCallback } from 'react';
import { useDocumentContext } from '@/providers/DocumentContextProvider.jsx';
import { useNotification } from '@/components/NotificationProvider';
import { useAuth } from '@/providers/AuthProvider';

const DRAFTS_CATEGORY = 'Drafts';
const ACKNOWLEDGED_DRAFTS_KEY = 'acknowledgedDrafts';

function isDraftAcknowledged(docId) {
  if (!docId) return false;
  try {
    const ack = JSON.parse(localStorage.getItem(ACKNOWLEDGED_DRAFTS_KEY) || '[]');
    return ack.includes(String(docId));
  } catch {
    return false;
  }
}

function markDraftAcknowledged(docId) {
  if (!docId) return;
  try {
    const ack = JSON.parse(localStorage.getItem(ACKNOWLEDGED_DRAFTS_KEY) || '[]');
    if (!ack.includes(String(docId))) {
      ack.push(String(docId));
      localStorage.setItem(ACKNOWLEDGED_DRAFTS_KEY, JSON.stringify(ack));
    }
  } catch {
    // Ignore storage errors
  }
}

/**
 * Custom hook that provides a standardized save document function.
 *
 * @param {Object} options
 * @param {Function} [options.onDraftPromote] - Called when an explicit save targets a
 *   Drafts-category doc that hasn't been acknowledged yet. Receives the document and
 *   a `proceedSave` callback. Return value is ignored; the caller is expected to show
 *   a modal and call `proceedSave(updatedDoc)` when the user confirms.
 * @returns {Function} handleSave
 */
export { markDraftAcknowledged, isDraftAcknowledged };
export default function useSaveDocument({ onDraftPromote } = {}) {
  const { currentDocument, saveDocument, content } = useDocumentContext();
  const { showSuccess, showError } = useNotification();
  const { isAuthenticated } = useAuth();

  const handleSave = useCallback(async () => {
    console.log('useSaveDocument: Save initiated');
    // Validation checks
    if (!currentDocument) {
      showError('No document to save.');
      return null;
    }
    if (!saveDocument) {
      showError('Save function not available.');
      return null;
    }

    // Draft promotion check — only on explicit save, not auto-save
    if (
      onDraftPromote &&
      currentDocument.category === DRAFTS_CATEGORY &&
      !isDraftAcknowledged(currentDocument.id)
    ) {
      onDraftPromote(currentDocument, content, saveDocument);
      return null; // Modal will handle the save
    }
    console.log('useSaveDocument: Save validation passed', {
      hasContent: !!content,
      hasDocument: !!currentDocument,
      isAuthenticated,
      documentId: currentDocument?.id,
      contentLength: content?.length || 0,
      repositoryType: currentDocument?.repository_type
    });

    try {
      console.log('useSaveDocument: Starting save operation...');

      // Special handling for GitHub documents - only update content, not document record
      if (currentDocument.repository_type === 'github' && isAuthenticated) {
        console.log('useSaveDocument: GitHub document detected, using content-only update');
        const documentsApi = (await import('@/api/documentsApi')).default;

        await documentsApi.updateDocument(currentDocument.id, {
          content: content
        });

        showSuccess('Document content saved to filesystem');
        return { ...currentDocument, content };
      }

      // Standard save flow for local documents
      const docWithCurrentContent = { ...currentDocument, content };
      const saved = await saveDocument(docWithCurrentContent, true); // Show notifications
      console.log('useSaveDocument: Save operation completed:', { saved: !!saved });
      if (!saved) {
        showError('Save failed - no document returned.');
        return null;
      }
      // Note: Success notifications are handled by DocumentService/DocumentProvider
      return saved;
    } catch (error) {
      console.error('useSaveDocument: Save error:', error);
      showError(`Save failed: ${error.message || 'Unknown error'}`);
      return null;
    }
  }, [currentDocument, saveDocument, content, isAuthenticated, showSuccess, showError, onDraftPromote]);
  return handleSave;
}

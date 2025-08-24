import { useCallback } from 'react';
import { useDocumentContext } from '@/providers/DocumentContextProvider.jsx';
import { useNotification } from '@/components/NotificationProvider';
import { useAuth } from '@/providers/AuthProvider';

/**
 * Custom hook that provides a standardized save document function
 * Encapsulates all save logic and can be used by shortcuts, buttons, menus, etc.
 * 
 * @returns {Function} handleSave - Function to save the current document
 */
export default function useSaveDocument() {
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
    console.log('useSaveDocument: Save validation passed', {
      hasContent: !!content,
      hasDocument: !!currentDocument,
      isAuthenticated,
      documentId: currentDocument?.id,
      contentLength: content?.length || 0
    });
    try {
      console.log('useSaveDocument: Starting save operation...');
      // Create document with current content for save
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
  }, [currentDocument, saveDocument, content, isAuthenticated, showSuccess, showError]);
  return handleSave;
}

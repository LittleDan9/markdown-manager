import { useState, useEffect } from 'react';

/**
 * Track unsaved changes in the current document
 * @param {Object} currentDocument - Current document object
 * @param {Array} documents - Array of all documents
 * @param {string} content - Current editor content
 * @returns {boolean} - Whether there are unsaved changes
 */
export default function useChangeTracker(currentDocument, documents, content) {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    if (!currentDocument) {
      setHasUnsavedChanges(false);
      return;
    }

    // Compare current content with saved content
    const savedContent = currentDocument.content || '';
    const currentContent = content || '';

    // Check if content has changed
    const contentChanged = savedContent !== currentContent;

    // For new documents (no ID), consider it "changed" if there's content
    const isNewDocument = !currentDocument.id || String(currentDocument.id).startsWith('doc_');
    const hasContent = currentContent.trim() !== '';

    if (isNewDocument) {
      setHasUnsavedChanges(hasContent);
    } else {
      setHasUnsavedChanges(contentChanged);
    }
  }, [currentDocument, content]);

  return hasUnsavedChanges;
}

import { useState, useEffect } from 'react';

const DEFAULT_CATEGORY = 'General';

// Utility function to check if document has unsaved changes
export function checkHasUnsavedChanges(currentDocument, documents, editorContent = null) {
  // Use editorContent if provided, otherwise use currentDocument.content
  const contentToCheck = editorContent !== null ? editorContent : currentDocument?.content || '';

  if (!currentDocument?.id) {
    return (
      currentDocument?.name !== 'Untitled Document' ||
      contentToCheck !== '' ||
      currentDocument?.category !== DEFAULT_CATEGORY
    );
  }

  const saved = documents.find(d => d.id === currentDocument.id);
  return (
    !saved ||
    saved.name !== currentDocument.name ||
    saved.content !== contentToCheck ||
    saved.category !== currentDocument.category
  );
}

export default function useChangeTracker(currentDocument, documents, editorContent = null) {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    setHasUnsavedChanges(checkHasUnsavedChanges(currentDocument, documents, editorContent));
  }, [currentDocument, documents, editorContent]);
  return hasUnsavedChanges;
}

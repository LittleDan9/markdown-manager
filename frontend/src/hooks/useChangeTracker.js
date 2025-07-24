import { useState, useEffect } from 'react';
import useLocalDocuments from './useLocalDocuments'; // optional

const DEFAULT_CATEGORY = 'General';
export default function useChangeTracker(currentDocument, documents) {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  useEffect(() => {
    if (!currentDocument?.id) {
      setHasUnsavedChanges(
        currentDocument.name !== 'Untitled Document' ||
        currentDocument.content !== '' ||
        currentDocument.category !== DEFAULT_CATEGORY
      );
      return;
    }
    const saved = documents.find(d => d.id === currentDocument.id);
    setHasUnsavedChanges(
      !saved ||
      saved.name !== currentDocument.name ||
      saved.content !== currentDocument.content ||
      saved.category !== currentDocument.category
    );
  }, [currentDocument, documents]);
  return hasUnsavedChanges;
}

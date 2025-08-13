import { useEffect, useRef } from "react";

/**
 * useAutoSave
 * Automatically saves the document after changes, with simple debounce.
 * @param {object} currentDocument - The current document object.
 * @param {string} content - The current content string.
 * @param {function} saveCallback - The save function to call.
 * @param {boolean} enabled - Whether autosave is enabled.
 * @param {number} delay - Debounce delay in ms (default: 30000 = 30 seconds)
 */
export default function useAutoSave(currentDocument, content, saveCallback, enabled = true, delay = 30000) {
  const timeoutRef = useRef();
  const lastSavedContentRef = useRef('');
  const lastSavedDocumentIdRef = useRef(null);
  const isSavingRef = useRef(false);

  // Initialize refs when document changes
  useEffect(() => {
    if (currentDocument && currentDocument.id !== lastSavedDocumentIdRef.current) {
      lastSavedContentRef.current = currentDocument.content || '';
      lastSavedDocumentIdRef.current = currentDocument.id;
      console.log('AutoSave: Document changed, initializing refs for:', currentDocument.name);
    }
  }, [currentDocument?.id, currentDocument?.name]);

  // Auto-save when content changes
  useEffect(() => {
    if (!enabled || !currentDocument || !saveCallback || isSavingRef.current) {
      return;
    }

    const currentContent = content || '';

    // Only auto-save if content actually changed and document has a name
    const hasContentChanged = currentContent !== lastSavedContentRef.current;
    const hasValidName = currentDocument.name && currentDocument.name.trim() !== '';
    const isNotEmpty = currentContent.trim() !== '';
    const isNotUntitled = !currentDocument.name?.includes('Untitled Document');
    const hasRealContent = currentContent.length > 10; // More than just a few characters

    console.log('AutoSave: Checking conditions:', {
      enabled,
      hasContentChanged,
      hasValidName,
      isNotEmpty,
      isNotUntitled,
      hasRealContent,
      currentContentLength: currentContent.length,
      lastSavedContentLength: lastSavedContentRef.current.length,
      documentName: currentDocument.name
    });

    if (hasContentChanged && hasValidName && isNotEmpty && isNotUntitled && hasRealContent) {
      // Clear existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        console.log('AutoSave: Cleared existing timeout');
      }

      console.log(`AutoSave: Setting timeout for ${delay}ms for document:`, currentDocument.name);

      // Set new timeout for auto-save
      timeoutRef.current = setTimeout(async () => {
        if (isSavingRef.current) {
          console.log('AutoSave: Save already in progress, skipping');
          return;
        }

        try {
          isSavingRef.current = true;
          console.log('AutoSave: Starting save for:', currentDocument.name);
          
          await saveCallback();
          
          lastSavedContentRef.current = currentContent;
          console.log('AutoSave: Completed successfully for:', currentDocument.name);
        } catch (error) {
          console.warn('AutoSave: Failed for:', currentDocument.name, error);
        } finally {
          isSavingRef.current = false;
        }
      }, delay);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [currentDocument, content, enabled, delay, saveCallback]);

  // Save on page unload if there are unsaved changes
  useEffect(() => {
    if (!enabled || !saveCallback) return;

    const handleBeforeUnload = (e) => {
      const currentContent = content || '';
      const hasUnsavedChanges = currentContent !== lastSavedContentRef.current;

      if (hasUnsavedChanges && currentDocument?.name?.trim()) {
        console.log('AutoSave: Attempting save on page unload');
        // Try to save synchronously (best effort)
        try {
          saveCallback();
        } catch (error) {
          console.warn('AutoSave: Failed to save on page unload:', error);
        }

        // Show browser confirmation dialog
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [enabled, saveCallback, currentDocument, content]);
}

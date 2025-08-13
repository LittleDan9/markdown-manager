import { useEffect, useRef } from "react";

/**
 * useAutoSave
 * Automatically saves the document after changes, with simple debounce.
 * @param {object} currentDocument - The current document object.
 * @param {function} saveDocument - The save function from context.
 * @param {boolean} enabled - Whether autosave is enabled.
 * @param {number} delay - Debounce delay in ms (default: 30000 = 30 seconds)
 */
export default function useAutoSave(currentDocument, saveDocument, enabled = true, delay = 30000) {
  const timeoutRef = useRef();
  const lastSavedContentRef = useRef('');
  const lastSavedDocumentIdRef = useRef(null);
  const isSavingRef = useRef(false);

  // Initialize refs when document changes
  useEffect(() => {
    if (currentDocument && currentDocument.id !== lastSavedDocumentIdRef.current) {
      lastSavedContentRef.current = currentDocument.content || '';
      lastSavedDocumentIdRef.current = currentDocument.id;
    }
  }, [currentDocument.id]);

  // Auto-save when content changes
  useEffect(() => {
    if (!enabled || !currentDocument || isSavingRef.current) {
      return;
    }

    const currentContent = currentDocument.content || '';

    // Only auto-save if content actually changed and document has a name
    const hasContentChanged = currentContent !== lastSavedContentRef.current;
    const hasValidName = currentDocument.name && currentDocument.name.trim() !== '';
    const isNotEmpty = currentContent.trim() !== '';

    if (hasContentChanged && hasValidName && isNotEmpty) {
      // Clear existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Set new timeout for auto-save
      timeoutRef.current = setTimeout(async () => {
        if (isSavingRef.current) return;

        try {
          isSavingRef.current = true;
          await saveDocument(currentDocument, false); // Don't show notification for auto-save
          lastSavedContentRef.current = currentContent;
          console.log('Auto-save completed for:', currentDocument.name);
        } catch (error) {
          console.warn('Auto-save failed:', error);
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
  }, [currentDocument, currentDocument?.content, enabled, delay, saveDocument]);

  // Save on page unload if there are unsaved changes
  useEffect(() => {
    if (!enabled) return;

    const handleBeforeUnload = (e) => {
      const currentContent = currentDocument?.content || '';
      const hasUnsavedChanges = currentContent !== lastSavedContentRef.current;

      if (hasUnsavedChanges && currentDocument?.name?.trim()) {
        // Try to save synchronously (best effort)
        try {
          saveDocument(currentDocument, false);
        } catch (error) {
          console.warn('Failed to save on page unload:', error);
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
  }, [enabled, saveDocument, currentDocument]);
}

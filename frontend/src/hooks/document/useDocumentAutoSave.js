import { useEffect, useRef, useCallback } from "react";

/**
 * useDocumentAutoSave
 * Unified auto-save hook for documents.
 * @param {object} currentDocument - The current document object.
 * @param {string} content - The current content string.
 * @param {function} saveDocument - The save function to call.
 * @param {boolean} autosaveEnabled - Whether autosave is enabled.
 * @param {boolean} isSharedView - Whether shared view is active (disables autosave).
 * @param {number} delay - Debounce delay in ms (default: 30000 = 30 seconds)
 * @returns {function} runAutoSave - Manual trigger for auto-save (for testing/UI)
 */
export default function useDocumentAutoSave(
  currentDocument,
  content,
  saveDocument,
  autosaveEnabled = true,
  isSharedView = false,
  delay = 30000
) {
  const timeoutRef = useRef();
  const isSavingRef = useRef(false);

  // Unified auto-save callback
  const runAutoSave = useCallback(async () => {
    if (isSharedView) return;
    if (!autosaveEnabled) return;
    if (!currentDocument) return;
    try {
      const docWithCurrentContent = { ...currentDocument, content };
      await saveDocument(docWithCurrentContent, false); // No notifications for auto-save
    } catch (error) {
      // Optionally handle/log error
    }
  }, [currentDocument, content, saveDocument, autosaveEnabled, isSharedView]);

  // Debounced auto-save effect
  useEffect(() => {
    if (!autosaveEnabled || isSharedView) return;
    if (!currentDocument) return;
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(runAutoSave, delay);
    return () => clearTimeout(timeoutRef.current);
  }, [currentDocument, content, autosaveEnabled, isSharedView, delay, runAutoSave]);

  // Expose manual trigger for testing/UI
  return runAutoSave;
}

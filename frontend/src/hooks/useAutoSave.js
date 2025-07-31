import { useEffect, useRef } from "react";

/**
 * useAutoSave
 * Automatically saves the document after changes, with debounce.
 * @param {object} currentDocument - The current document object.
 * @param {function} saveDocument - The save function from context.
 * @param {boolean} enabled - Whether autosave is enabled.
 * @param {number} delay - Debounce delay in ms (default: 2000)
 */
export default function useAutoSave(currentDocument, saveDocument, enabled = true, delay = 120000) {
  const intervalRef = useRef();
  const hibernateRef = useRef(false);
  const lastSavedContentRef = useRef(currentDocument.content);

  useEffect(() => {
    if (!enabled) return;
    // If hibernating, only wake up on content change
    if (hibernateRef.current && lastSavedContentRef.current === currentDocument.content) return;

    // If content changed, wake up and start interval
    hibernateRef.current = false;
    clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      if (lastSavedContentRef.current !== currentDocument.content) {
        saveDocument(currentDocument);
        lastSavedContentRef.current = currentDocument.content;
      } else {
        // No change since last save, hibernate
        clearInterval(intervalRef.current);
        hibernateRef.current = true;
      }
    }, delay);
    return () => clearInterval(intervalRef.current);
  }, [currentDocument.content, enabled, delay, saveDocument, currentDocument]);

  // Save on unmount or before unload
  useEffect(() => {
    if (!enabled) return;
    const handleBeforeUnload = () => {
      saveDocument(currentDocument);
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [enabled, saveDocument, currentDocument]);
}

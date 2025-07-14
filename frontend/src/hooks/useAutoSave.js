import { useEffect, useRef } from "react";

/**
 * useAutoSave
 * Automatically saves the document after changes, with debounce.
 * @param {object} currentDocument - The current document object.
 * @param {function} saveDocument - The save function from context.
 * @param {boolean} enabled - Whether autosave is enabled.
 * @param {number} delay - Debounce delay in ms (default: 2000)
 */
export default function useAutoSave(currentDocument, saveDocument, enabled = true, delay = 2000) {
  const timeoutRef = useRef();
  const prevContentRef = useRef(currentDocument.content);

  useEffect(() => {
    if (!enabled) return;
    if (prevContentRef.current === currentDocument.content) return;
    // Debounce save
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      saveDocument(currentDocument);
      prevContentRef.current = currentDocument.content;
    }, delay);
    return () => clearTimeout(timeoutRef.current);
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

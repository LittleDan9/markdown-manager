import { useEffect, useRef } from 'react';
import { useSaveDocument } from '../document';

/**
 * Custom hook for managing global (app-wide) keyboard shortcuts
 * These shortcuts work regardless of which element has focus
 * 
 * Currently handles:
 * - Ctrl+S (Cmd+S on Mac): Save document
 * - Ctrl+Alt+N (Cmd+Alt+N on Mac): New document
 */
export default function useGlobalKeyboardShortcuts({ onDraftPromote, onNewDocument } = {}) {
  const handleSave = useSaveDocument({ onDraftPromote });
  const handleSaveRef = useRef(handleSave);
  const onNewDocumentRef = useRef(onNewDocument);
  // Always keep refs up to date with latest callbacks
  handleSaveRef.current = handleSave;
  onNewDocumentRef.current = onNewDocument;

  useEffect(() => {
    const handleGlobalKeyDown = async (e) => {
      // Ctrl+S (or Cmd+S on Mac) - Save document
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        await handleSaveRef.current();
      }
      // Ctrl+Alt+N (or Cmd+Alt+N on Mac) - New document
      if ((e.ctrlKey || e.metaKey) && e.altKey && e.key === 'n') {
        e.preventDefault();
        onNewDocumentRef.current?.();
      }
    };
    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      document.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, []); // Empty dependency array for stable registration

  // This hook doesn't return anything - it just sets up global event listeners
}

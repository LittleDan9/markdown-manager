import { useEffect, useRef } from 'react';
import useSaveDocument from './useSaveDocument';

/**
 * Custom hook for managing global (app-wide) keyboard shortcuts
 * These shortcuts work regardless of which element has focus
 * 
 * Currently handles:
 * - Ctrl+S (Cmd+S on Mac): Save document
 * 
 * Future shortcuts can be added here:
 * - Ctrl+N: New document
 * - Ctrl+O: Open document
 * - etc.
 */
export default function useGlobalKeyboardShortcuts() {
  const handleSave = useSaveDocument();
  const handleSaveRef = useRef(handleSave);
  // Always keep ref up to date with latest handleSave
  handleSaveRef.current = handleSave;

  useEffect(() => {
    const handleGlobalKeyDown = async (e) => {
      // Ctrl+S (or Cmd+S on Mac) - Save document
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        await handleSaveRef.current();
      }
      // Future global shortcuts can be added here:
      /*
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        // Handle new document
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault();
        // Handle open document
      }
      */
    };
    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      document.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, []); // Empty dependency array for stable registration

  // This hook doesn't return anything - it just sets up global event listeners
}

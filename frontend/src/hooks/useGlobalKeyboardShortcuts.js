import { useEffect } from 'react';
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

  useEffect(() => {
    const handleGlobalKeyDown = async (e) => {
      // Ctrl+S (or Cmd+S on Mac) - Save document
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        console.log('useGlobalKeyboardShortcuts: Ctrl+S detected - triggering save');
        await handleSave();
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

    // Attach to document for true global coverage
    // This ensures shortcuts work even when focus is on modals, dropdowns, buttons, etc.
    console.log('useGlobalKeyboardShortcuts: Registering global keyboard handlers');
    document.addEventListener('keydown', handleGlobalKeyDown);

    return () => {
      console.log('useGlobalKeyboardShortcuts: Unregistering global keyboard handlers');
      document.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [handleSave]);

  // This hook doesn't return anything - it just sets up global event listeners
}

import { useCallback } from 'react';
import useAutoSave from './useAutoSave';

/**
 * Custom hook for managing auto-save functionality
 * Encapsulates auto-save logic and provides a clean interface
 * 
 * @param {Object} currentDocument - Current document object
 * @param {string} content - Current content
 * @param {Function} saveDocument - Function to save document
 * @param {boolean} autosaveEnabled - Whether auto-save is enabled
 * @param {boolean} isSharedView - Whether we're in shared view (disables auto-save)
 * @param {number} delay - Auto-save delay in milliseconds
 */
export default function useAutoSaveManager(
  currentDocument, 
  content, 
  saveDocument, 
  autosaveEnabled, 
  isSharedView,
  delay = 5000
) {
  
  // Create auto-save callback for the hook
  const runAutoSave = useCallback(async () => {
    // Don't autosave in shared view
    if (isSharedView) {
      console.log('Auto-save skipped: in shared view');
      return;
    }

    try {
      // Create document with current content for auto-save
      const docWithCurrentContent = { ...currentDocument, content };
      const savedDoc = await saveDocument(docWithCurrentContent, false); // Don't show notifications for auto-save

      // If the save was successful, the DocumentProvider will update the currentDocument
      // The useChangeTracker will then see that the saved content matches current content
      console.log('Auto-save completed successfully for:', savedDoc?.name);
      return savedDoc;
    } catch (error) {
      console.warn("Auto-save failed:", error);
      throw error;
    }
  }, [saveDocument, currentDocument, content, isSharedView]);

  // Setup auto-save with enhanced hook (includes test functions)
  useAutoSave(currentDocument, content, runAutoSave, autosaveEnabled, delay);

  // Return the auto-save function in case it's needed elsewhere
  return runAutoSave;
}

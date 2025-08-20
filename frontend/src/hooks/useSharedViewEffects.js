import { useEffect } from 'react';

/**
 * Custom hook for managing shared view effects and behaviors
 * Handles the specific logic needed when the app is in shared view mode
 * 
 * @param {boolean} isSharedView - Whether we're in shared view mode
 * @param {Object} sharedDocument - The shared document object
 * @param {string} content - Current content
 * @param {Function} setContent - Function to set content
 * @param {Function} setFullscreenPreview - Function to set fullscreen mode
 */
export default function useSharedViewEffects(isSharedView, sharedDocument, content, setContent, setFullscreenPreview) {
  
  // Set fullscreen preview when in shared view
  useEffect(() => {
    if (isSharedView) {
      setFullscreenPreview(true);
    }
  }, [isSharedView, setFullscreenPreview]);

  // Load shared document content into editor context
  useEffect(() => {
    if (isSharedView && sharedDocument && sharedDocument.content !== content) {
      setContent(sharedDocument.content);
    }
  }, [isSharedView, sharedDocument, content, setContent]);

  // This hook doesn't return anything - it just manages side effects
}

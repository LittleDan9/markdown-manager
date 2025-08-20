import { useState } from 'react';

/**
 * Custom hook for managing App-level UI state
 * Handles local UI state that doesn't belong in global contexts
 * 
 * @param {boolean} isSharedView - Whether we're in shared view mode
 * @returns {Object} UI state and setters
 */
export default function useAppUIState(isSharedView = false) {
  // UI state for the main app
  const [renderedHTML, setRenderedHTML] = useState("");
  const [cursorLine, setCursorLine] = useState(1);
  const [fullscreenPreview, setFullscreenPreview] = useState(false);
  const [showIconBrowser, setShowIconBrowser] = useState(false);

  return {
    // State values
    renderedHTML,
    cursorLine,
    fullscreenPreview,
    showIconBrowser,
    
    // State setters
    setRenderedHTML,
    setCursorLine,
    setFullscreenPreview,
    setShowIconBrowser,
  };
}

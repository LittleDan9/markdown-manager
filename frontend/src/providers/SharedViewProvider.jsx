/**
 * SharedView Context Provider
 * Manages shared document view state and lifecycle
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { DocumentService } from '@/services/core';
import { DocumentStorageService } from '@/services/core';

const SharedViewContext = createContext(null);

export function SharedViewProvider({ children }) {
  // Shared view state
  const [isSharedView, setIsSharedView] = useState(false);
  const [sharedDocument, setSharedDocument] = useState(null);
  const [sharedLoading, setSharedLoading] = useState(false);
  const [sharedError, setSharedError] = useState(null);
  const [shareToken, setShareToken] = useState(null);

  // Check if current URL indicates shared view
  const checkForSharedDocument = useCallback(async () => {
    const path = window.location.pathname;
    const sharedMatch = path.match(/^\/shared\/([^/]+)$/);

    if (sharedMatch) {
      const token = sharedMatch[1];

      // Only proceed if this is a new share token or we're not already in shared view
      if (!isSharedView || shareToken !== token) {
        // Clear any existing document data when viewing shared document
        DocumentStorageService.clearAllData();

        setIsSharedView(true);
        setShareToken(token);
        setSharedLoading(true);
        setSharedError(null);

        try {
          const document = await DocumentService.getSharedDocument(token);
          setSharedDocument(document);
          console.log('Shared document loaded successfully:', document.name);
        } catch (error) {
          setSharedError('Failed to load shared document');
          setSharedDocument(null);
          console.error('Failed to load shared document:', error);
        } finally {
          setSharedLoading(false);
        }
      }
    } else {
      // Reset shared state if not on a shared URL
      if (isSharedView) {
        setIsSharedView(false);
        setSharedDocument(null);
        setSharedError(null);
        setShareToken(null);
      }
    }
  }, [isSharedView, shareToken]);

  // Exit shared view and return to main app
  const exitSharedView = useCallback(() => {
    // Clear any document content that may have been loaded from shared view
    DocumentStorageService.clearAllData();

    setIsSharedView(false);
    setSharedDocument(null);
    setSharedError(null);
    setShareToken(null);

    // Navigate to main app
    window.history.pushState({}, '', '/');
  }, []);

  // Initialize shared view checking on mount
  useEffect(() => {
    checkForSharedDocument();

    // Listen for URL changes (if using pushState/popState)
    window.addEventListener('popstate', checkForSharedDocument);

    // Clean up localStorage when leaving shared view (browser close, navigation, etc.)
    const handleBeforeUnload = () => {
      if (isSharedView) {
        DocumentStorageService.clearAllData();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('popstate', checkForSharedDocument);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [checkForSharedDocument, isSharedView]);

  const contextValue = {
    // State
    isSharedView,
    sharedDocument,
    sharedLoading,
    sharedError,
    shareToken,

    // Actions
    exitSharedView,
    checkForSharedDocument,
  };

  return (
    <SharedViewContext.Provider value={contextValue}>
      {children}
    </SharedViewContext.Provider>
  );
}

SharedViewProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export function useSharedView() {
  const context = useContext(SharedViewContext);
  if (!context) {
    throw new Error("useSharedView must be used within a SharedViewProvider");
  }
  return context;
}

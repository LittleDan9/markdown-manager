import React, { createContext, useContext, useMemo, useState, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useAuth } from './AuthProvider';
import { useNotification } from '../components/NotificationProvider.jsx';
import { useDocumentState } from '../hooks/document';
import { useSharedViewState, usePreviewHTMLState, useRenderingState } from '../hooks/ui';

// Consolidated context for document, shared view, and preview HTML
const DocumentContext = createContext();

export function useDocumentContext() {
  return useContext(DocumentContext);
}

export function DocumentContextProvider({ children }) {
  // Auth and notification
  const { token, user, isAuthenticated, isInitializing } = useAuth();

  // UI state for global app UI management
  const [cursorLine, setCursorLine] = useState(1);
  const [fullscreenPreview, setFullscreenPreview] = useState(false);
  const [showIconBrowser, setShowIconBrowser] = useState(false);

  // Debug logging for UI state changes
  useEffect(() => {
    console.log('🎛️ DocumentContext: UI state updated', {
      cursorLine,
      fullscreenPreview,
      showIconBrowser,
      timestamp: new Date().toISOString()
    });
  }, [cursorLine, fullscreenPreview, showIconBrowser]);

  // Use modular hooks for state and logic
  const notification = useNotification();
  const auth = useAuth();
  const sharedViewState = useSharedViewState();
  const previewHTMLState = usePreviewHTMLState();
  const renderingState = useRenderingState();

  // Pass shared view state to document state to prevent conflicts
  const documentState = useDocumentState(
    notification,
    auth,
    previewHTMLState.setPreviewHTML,
    sharedViewState.isSharedView  // Add shared view flag
  );

  // Centralized content update trigger
  const triggerContentUpdate = useCallback((newContent, options = {}) => {
    const { reason = 'content-change', skipRender = false } = options;

    console.log(`📝 Centralized content update: ${reason}`, {
      length: newContent?.length || 0,
      skipRender,
      timestamp: new Date().toISOString()
    });

    // Update content state
    documentState.setContent(newContent);

    // Trigger rendering unless explicitly skipped
    if (!skipRender && renderingState.setIsRendering) {
      // Set rendering state to trigger orchestrator
      renderingState.setIsRendering(true);
    }
  }, [documentState, renderingState]);

  const value = useMemo(() => {
    // Performance selectors - computed values that don't cause re-renders when accessed
    const selectors = {
      // Content state selectors
      hasContent: documentState.content && documentState.content.trim().length > 0,
      contentLength: documentState.content?.length || 0,
      isContentEmpty: !documentState.content || documentState.content.trim().length === 0,

      // Document state selectors
      hasCurrentDocument: !!documentState.currentDocument?.id,
      isDefaultDocument: !documentState.currentDocument?.id || String(documentState.currentDocument.id).startsWith('doc_'),

      // Rendering state selectors
      isRenderingActive: renderingState.isRendering,
      isRapidTypingActive: renderingState.isRapidTyping,
      renderState: renderingState.renderState,

      // Combined state selectors
      canSave: documentState.hasUnsavedChanges && documentState.content && documentState.content.trim().length > 0,
      canExport: documentState.content && documentState.content.trim().length > 0 && previewHTMLState.previewHTML,
    };

    return {
      ...documentState,
      ...sharedViewState,
      ...previewHTMLState,
      ...renderingState,
      ...selectors,
      // Centralized functions
      triggerContentUpdate,
      // UI state
      cursorLine,
      setCursorLine,
      fullscreenPreview,
      setFullscreenPreview,
      showIconBrowser,
      setShowIconBrowser,
      // Auth context values
      token: auth.token,
      user: auth.user,
      isAuthenticated: auth.isAuthenticated,
      isInitializing: auth.isInitializing
    };
  }, [documentState, sharedViewState, previewHTMLState, renderingState, triggerContentUpdate, cursorLine, fullscreenPreview, showIconBrowser, auth.token, auth.user, auth.isAuthenticated, auth.isInitializing]);

  return (
    <DocumentContext.Provider value={value}>
      {children}
    </DocumentContext.Provider>
  );
}

DocumentContextProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

import React, { createContext, useContext, useMemo, useState, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useAuth } from './AuthProvider';
import { useNotification } from '../components/NotificationProvider.jsx';
import { useDocumentState, useSiblingDocs } from '../hooks/document';
import { useSharedViewState, usePreviewHTMLState, useRenderingState } from '../hooks/ui';

// Consolidated context for document, shared view, and preview HTML
const DocumentContext = createContext();

export function useDocumentContext() {
  return useContext(DocumentContext);
}

export function DocumentContextProvider({ children }) {
  // Auth and notification
  const { token: _token, user: _user, isAuthenticated: _isAuthenticated, isInitializing: _isInitializing } = useAuth();

  // UI state for global app UI management
  const [cursorLine, setCursorLine] = useState(1);
  const [fullscreenPreview, setFullscreenPreview] = useState(false);
  const [showIconBrowser, setShowIconBrowser] = useState(false);
  const [showChatDrawer, setShowChatDrawer] = useState(false);
  const [mobileViewMode, setMobileViewMode] = useState('editor'); // 'editor' | 'preview'
  const [editorSelection, setEditorSelection] = useState(null); // { text, startLine, endLine } or null

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

  // Sibling docs for category tab bar
  const siblingDocsState = useSiblingDocs(
    documentState.currentDocument,
    auth.isAuthenticated,
    auth.tabSortOrder
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

  // Coordinated openRecents: set override FIRST, then fetch recents and load first doc.
  // Setting override before loadDocument prevents the useSiblingDocs effect from
  // firing a category-based sibling fetch when currentDocument changes.
  const openRecentsCoordinated = useCallback(async () => {
    // Set a temporary override immediately so any in-flight sibling refresh
    // short-circuits instead of overwriting with category-based siblings
    siblingDocsState.setSiblingOverride('recents', [], 'Recent');
    const docs = await documentState.openRecents(auth.recentsTabLimit || 10);
    if (docs) {
      // Now update the override with the actual doc list
      siblingDocsState.setSiblingOverride('recents', docs, 'Recent');
      // Force a preview re-render. loadDocument clears previewHTML, and if the loaded
      // document is the same one already active (e.g. it's the most recent), the
      // orchestrator's content-change effect doesn't re-fire because content/docId
      // dependencies are unchanged. Poking setContent with the current value via
      // triggerContentUpdate ensures the effect runs and re-renders the preview.
      if (documentState.content) {
        triggerContentUpdate(documentState.content, { reason: 'recents-open' });
      }
    } else {
      // No recents found — clear the temporary override
      siblingDocsState.clearSiblingOverride();
    }
  }, [documentState, siblingDocsState, auth.recentsTabLimit, triggerContentUpdate]);

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
      // Sibling docs for tab bar
      siblingDocs: siblingDocsState.siblingDocs,
      tabsEnabled: siblingDocsState.tabsEnabled,
      siblingCategoryName: siblingDocsState.categoryName,
      siblingDocsLoading: siblingDocsState.isLoading,
      refreshSiblings: siblingDocsState.refreshSiblings,
      removeSibling: siblingDocsState.removeSibling,
      updateSiblingName: siblingDocsState.updateSiblingName,
      // Override mode for virtual categories (e.g. recents)
      siblingOverrideMode: siblingDocsState.overrideMode,
      clearSiblingOverride: siblingDocsState.clearSiblingOverride,
      openRecents: openRecentsCoordinated,
      // Centralized functions
      triggerContentUpdate,
      // UI state
      cursorLine,
      setCursorLine,
      fullscreenPreview,
      setFullscreenPreview,
      showIconBrowser,
      setShowIconBrowser,
      showChatDrawer,
      setShowChatDrawer,
      mobileViewMode,
      setMobileViewMode,
      editorSelection,
      setEditorSelection,
      // Auth context values
      token: auth.token,
      user: auth.user,
      isAuthenticated: auth.isAuthenticated,
      isInitializing: auth.isInitializing
    };
  }, [documentState, sharedViewState, previewHTMLState, renderingState, siblingDocsState, triggerContentUpdate, openRecentsCoordinated, cursorLine, fullscreenPreview, showIconBrowser, showChatDrawer, mobileViewMode, editorSelection, auth.token, auth.user, auth.isAuthenticated, auth.isInitializing]);

  return (
    <DocumentContext.Provider value={value}>
      {children}
    </DocumentContext.Provider>
  );
}

DocumentContextProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

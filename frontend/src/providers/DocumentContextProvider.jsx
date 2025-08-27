import React, { createContext, useContext, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useAuth } from './AuthProvider';
import { useNotification } from '../components/NotificationProvider.jsx';
import { useDocumentState } from '../hooks/document';
import { useSharedViewState, usePreviewHTMLState } from '../hooks/ui';

// Consolidated context for document, shared view, and preview HTML
const DocumentContext = createContext();

export function useDocumentContext() {
  return useContext(DocumentContext);
}

export function DocumentContextProvider({ children }) {
  // Auth and notification
  const { token, user, isAuthenticated, isInitializing } = useAuth();

  // Use modular hooks for state and logic
  const notification = useNotification();
  const auth = useAuth();
  const sharedViewState = useSharedViewState();
  const previewHTMLState = usePreviewHTMLState();
  const documentState = useDocumentState(notification, auth, previewHTMLState.setPreviewHTML);

  const value = useMemo(() => ({
    ...documentState,
    ...sharedViewState,
    ...previewHTMLState,
    // Auth context values
    token: auth.token,
    user: auth.user,
    isAuthenticated: auth.isAuthenticated,
    isInitializing: auth.isInitializing
  }), [documentState, sharedViewState, previewHTMLState, auth.token, auth.user, auth.isAuthenticated, auth.isInitializing]);

  return (
    <DocumentContext.Provider value={value}>
      {children}
    </DocumentContext.Provider>
  );
}

DocumentContextProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

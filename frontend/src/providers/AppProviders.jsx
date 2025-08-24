import React from 'react';
import PropTypes from 'prop-types';

// Infrastructure Providers
import { LoggerProvider } from './LoggerProvider.jsx';
import GlobalErrorBoundary from '../components/GlobalErrorBoundary.jsx';
import { ThemeProvider } from './ThemeProvider';
import { NotificationProvider } from '../components/NotificationProvider.jsx';

// Application Providers
import { AuthProvider } from './AuthProvider';
import { DocumentContextProvider } from './DocumentContextProvider.jsx';

/**
 * AppProviders - Centralized provider composition for the entire application
 * 
 * Provider order is critical for dependencies:
 * 1. Infrastructure Layer (Logger, ErrorBoundary, Theme, Notifications)
 * 2. Core Application Layer (Auth)
 * 3. Feature Layer (SharedView, Document, PreviewHTML)
 * 
 * Dependencies:
 * - DocumentProvider depends on: AuthProvider, SharedViewProvider, NotificationProvider
 * - All others are independent
 */
function AppProviders({ children }) {
  return (
    <LoggerProvider>
      <GlobalErrorBoundary>
        <ThemeProvider>
          <NotificationProvider>
            <AuthProvider>
              <DocumentContextProvider>
                {children}
              </DocumentContextProvider>
            </AuthProvider>
          </NotificationProvider>
        </ThemeProvider>
      </GlobalErrorBoundary>
    </LoggerProvider>
  );
}

AppProviders.propTypes = {
  children: PropTypes.node.isRequired,
};

export default AppProviders;

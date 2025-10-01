import React from 'react';
import PropTypes from 'prop-types';

// Infrastructure Providers
import { LoggerProvider } from './LoggerProvider.jsx';
import GlobalErrorBoundary from '../components/GlobalErrorBoundary.jsx';
import { ThemeProvider } from './ThemeProvider';
import { NotificationProvider } from '../components/NotificationProvider.jsx';

// Application Providers
import { AuthProvider } from './AuthProvider';
import { UserSettingsProvider } from './UserSettingsProvider';
import { DocumentContextProvider } from './DocumentContextProvider.jsx';
import { GitHubSettingsProvider } from '../contexts/GitHubSettingsProvider.jsx';

/**
 * AppProviders - Centralized provider composition for the entire application
 *
 * Provider order is critical for dependencies:
 * 1. Infrastructure Layer (Logger, ErrorBoundary, Theme, Notifications)
 * 2. Core Application Layer (Auth, UserSettings)
 * 3. Feature Layer (Document, GitHubSettings)
 *
 * Dependencies:
 * - UserSettingsProvider depends on: AuthProvider
 * - GitHubSettingsProvider depends on: AuthProvider
 * - DocumentProvider depends on: AuthProvider, NotificationProvider
 * - All others are independent
 */
function AppProviders({ children }) {
  return (
    <LoggerProvider>
      <GlobalErrorBoundary>
        <ThemeProvider>
          <NotificationProvider>
            <AuthProvider>
              <UserSettingsProvider>
                <GitHubSettingsProvider>
                  <DocumentContextProvider>
                    {children}
                  </DocumentContextProvider>
                </GitHubSettingsProvider>
              </UserSettingsProvider>
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

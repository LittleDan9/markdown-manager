// Provider exports for clean imports
export { AuthProvider, useAuth } from './AuthProvider';
export { LoggerProvider, useLogger } from './LoggerProvider';
export { ThemeProvider, useTheme } from './ThemeProvider';
export { default as AppProviders } from './AppProviders';
export { DocumentContextProvider, useDocumentContext } from './DocumentContextProvider.jsx';

// All legacy providers have been migrated to DocumentContextProvider.jsx and modular hooks

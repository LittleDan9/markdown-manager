/**
 * File Browser Providers - Main entry point for all data providers
 *
 * This module exports all file browser providers for unified file browsing.
 * Providers handle different data sources (local documents, GitHub repositories, etc.)
 */

// Base provider interface
export { BaseFileBrowserProvider } from './providers/BaseFileBrowserProvider.js';

// Concrete provider implementations
export { LocalDocumentsProvider } from './providers/LocalDocumentsProvider.js';
export { GitHubProvider } from './providers/GitHubProvider.js';

// Utility classes for GitHub operations
export {
  GitHubTreeConverter,
  GitHubSearchUtils,
  GitHubImportUtils
} from './providers/GitHubProviderUtils.js';

// Re-export types for convenience
export { NODE_TYPES, SOURCE_TYPES } from '../../types/FileBrowserTypes.js';

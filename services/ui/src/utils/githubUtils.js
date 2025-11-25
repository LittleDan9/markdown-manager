/**
 * Utility functions for GitHub integration
 */

/**
 * Format last sync timestamp to human-readable string
 * @param {string} lastSync - ISO timestamp string
 * @returns {string} Formatted time difference
 */
export const formatLastSync = (lastSync) => {
  if (!lastSync) return 'Never synced';

  const now = new Date();
  const syncDate = new Date(lastSync);
  const diffMs = now - syncDate;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minutes ago`;
  if (diffHours < 24) return `${diffHours} hours ago`;
  return `${diffDays} days ago`;
};

/**
 * Generate instructions for connecting a different GitHub account
 * @param {string} baseUrl - Base URL of the application
 * @returns {string} Instructions text
 */
export const getDifferentAccountInstructions = (baseUrl = window.location.origin) => {
  const authUrl = `${baseUrl}/github-connect`;
  
  return {
    url: authUrl,
    instructions: `To connect a different GitHub account:

1. Copy this URL: ${authUrl}
2. Open a new incognito/private window (Ctrl+Shift+N / Cmd+Shift+N)
3. Paste the URL in the incognito window
4. Log into your app and connect the GitHub account

This ensures a clean session without cached GitHub authentication.`
  };
};

/**
 * Copy text to clipboard with fallback
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>} Success status
 */
export const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    // Fallback for older browsers
    console.log('Clipboard copy failed, text:', text);
    return false;
  }
};

/**
 * Open GitHub logout page in new tab
 */
export const openGitHubLogout = () => {
  window.open('https://github.com/logout', '_blank');
};

/**
 * Sort repositories alphabetically by name
 * @param {Array} repositories - Array of repository objects
 * @returns {Array} Sorted array
 */
export const sortRepositories = (repositories) => {
  return [...repositories].sort((a, b) => {
    return (a.name || '').localeCompare(b.name || '');
  });
};

// Repository Browser Utilities

/**
 * Get badge variant for file/folder type
 * @param {string} type - Item type ('dir' or 'file')
 * @param {string} theme - Current theme
 * @returns {string} Bootstrap badge class
 * @deprecated Use fileBrowserUtils.js for unified file browser components
 */
export const getTypeBadgeClass = (type, theme) => {
  if (type === 'dir') {
    return 'bg-primary';
  }
  return theme === 'dark' ? 'bg-secondary' : 'bg-light text-dark border';
};

// Note: The following functions have been moved to fileBrowserUtils.js:
// - sortRepositoryItems
// - formatFileSize  
// - isMarkdownFile
// - getHoverBackgroundColor
// - getElevatedHoverBackgroundColor
// - createBreadcrumbSegments
// - getParentPath
// - getTableVariant
// - getTableHeaderClass
// - getEmptyState

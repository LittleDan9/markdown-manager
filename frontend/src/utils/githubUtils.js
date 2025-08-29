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
 * Sort repository items with folders first, then alphabetically
 * @param {Array} items - Array of file/folder objects
 * @returns {Array} Sorted array
 */
export const sortRepositoryItems = (items) => {
  return [...items].sort((a, b) => {
    // Folders first
    if (a.type === 'dir' && b.type !== 'dir') return -1;
    if (a.type !== 'dir' && b.type === 'dir') return 1;
    // Then alphabetically
    return (a.name || '').localeCompare(b.name || '');
  });
};

/**
 * Format file size in human-readable format
 * @param {number} size - File size in bytes
 * @returns {string} Formatted size string
 */
export const formatFileSize = (size) => {
  if (!size || size === 0) return '-';
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let index = 0;
  let fileSize = size;
  
  while (fileSize >= 1024 && index < units.length - 1) {
    fileSize /= 1024;
    index++;
  }
  
  return `${fileSize.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
};

/**
 * Check if a file is a markdown file
 * @param {string} filename - Name of the file
 * @returns {boolean} True if it's a markdown file
 */
export const isMarkdownFile = (filename) => {
  return /\.(md|markdown)$/i.test(filename);
};

/**
 * Get theme-aware hover background color
 * @param {string} theme - Current theme ('dark' or 'light')
 * @param {boolean} isSelected - Whether the item is selected
 * @returns {string} CSS background color
 */
export const getHoverBackgroundColor = (theme, isSelected = false) => {
  if (isSelected) return '';
  return theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)';
};

/**
 * Get theme-aware elevated hover background color (for special items)
 * @param {string} theme - Current theme ('dark' or 'light')
 * @returns {string} CSS background color
 */
export const getElevatedHoverBackgroundColor = (theme) => {
  return theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)';
};

/**
 * Create breadcrumb path segments from a path string
 * @param {string} path - Full path string
 * @returns {Array} Array of path segments with cumulative paths
 */
export const createBreadcrumbSegments = (path) => {
  if (!path) return [];
  
  const parts = path.split('/');
  return parts.map((part, index) => ({
    name: part,
    path: parts.slice(0, index + 1).join('/'),
    isLast: index === parts.length - 1
  }));
};

/**
 * Get parent path from a given path
 * @param {string} path - Current path
 * @returns {string} Parent path
 */
export const getParentPath = (path) => {
  if (!path) return '';
  return path.split('/').slice(0, -1).join('/');
};

/**
 * Get table variant based on theme
 * @param {string} theme - Current theme
 * @returns {string|undefined} Bootstrap table variant
 */
export const getTableVariant = (theme) => {
  return theme === 'dark' ? 'dark' : undefined;
};

/**
 * Get table header class based on theme
 * @param {string} theme - Current theme
 * @returns {string} CSS class string
 */
export const getTableHeaderClass = (theme) => {
  return `sticky-top ${theme === 'dark' ? 'table-dark' : 'table-light'}`;
};

/**
 * Get badge variant for file/folder type
 * @param {string} type - Item type ('dir' or 'file')
 * @param {string} theme - Current theme
 * @returns {string} Bootstrap badge class
 */
export const getTypeBadgeClass = (type, theme) => {
  if (type === 'dir') {
    return 'bg-primary';
  }
  return theme === 'dark' ? 'bg-secondary' : 'bg-light text-dark border';
};

/**
 * Get empty state icon and message
 * @param {string} context - Context ('tree' or 'list')
 * @returns {Object} Icon class and message
 */
export const getEmptyState = (context = 'tree') => {
  const states = {
    tree: {
      icon: 'bi-folder-x',
      message: 'No files found'
    },
    list: {
      icon: 'bi-folder-x', 
      message: 'This folder is empty'
    }
  };
  
  return states[context] || states.tree;
};

/**
 * Utility functions for unified file browser components
 */

/**
 * Sort repository items with proper hierarchy and alphabetical ordering
 * 1. Folders first (alphabetical)
 * 2. Dot files (alphabetical) 
 * 3. Regular files (alphabetical)
 * @param {Array} items - Array of file/folder objects
 * @returns {Array} Sorted array
 */
export const sortRepositoryItems = (items) => {
  return [...items].sort((a, b) => {
    const aName = a.name || '';
    const bName = b.name || '';
    const aIsFolder = a.type === 'dir' || a.type === 'folder';
    const bIsFolder = b.type === 'dir' || b.type === 'folder';
    const aIsDotFile = aName.startsWith('.');
    const bIsDotFile = bName.startsWith('.');

    // 1. Folders always come first
    if (aIsFolder && !bIsFolder) return -1;
    if (!aIsFolder && bIsFolder) return 1;

    // 2. If both are folders, sort alphabetically
    if (aIsFolder && bIsFolder) {
      return aName.localeCompare(bName, undefined, { 
        numeric: true, 
        sensitivity: 'base' 
      });
    }

    // 3. For files: dot files come before regular files
    if (aIsDotFile && !bIsDotFile) return -1;
    if (!aIsDotFile && bIsDotFile) return 1;

    // 4. Within the same category (both dot files or both regular files), sort alphabetically
    return aName.localeCompare(bName, undefined, { 
      numeric: true, 
      sensitivity: 'base' 
    });
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
  
  const parts = path.split('/').filter(p => p);
  return parts.map((part, index) => ({
    name: part,
    path: '/' + parts.slice(0, index + 1).join('/'),
    isLast: index === parts.length - 1
  }));
};

/**
 * Get parent path from a given path
 * @param {string} path - Current path
 * @returns {string} Parent path
 */
export const getParentPath = (path) => {
  if (!path || path === '/') return '/';
  const parts = path.split('/').filter(p => p);
  if (parts.length <= 1) return '/';
  return '/' + parts.slice(0, -1).join('/');
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

/**
 * Normalize file path for consistent handling
 * @param {string} path - File path to normalize
 * @returns {string} Normalized path
 */
export const normalizePath = (path) => {
  if (!path || path === '/') return '/';
  
  // Remove trailing slashes and ensure leading slash
  const normalized = '/' + path.replace(/^\/+|\/+$/g, '');
  return normalized === '/' ? '/' : normalized;
};

/**
 * Get file extension from filename
 * @param {string} filename - Name of the file
 * @returns {string} File extension (without dot)
 */
export const getFileExtension = (filename) => {
  if (!filename) return '';
  const lastDotIndex = filename.lastIndexOf('.');
  if (lastDotIndex === -1 || lastDotIndex === 0) return '';
  return filename.slice(lastDotIndex + 1).toLowerCase();
};

/**
 * Check if a path represents a parent of another path
 * @param {string} parentPath - Potential parent path
 * @param {string} childPath - Potential child path
 * @returns {boolean} True if parentPath is a parent of childPath
 */
export const isParentPath = (parentPath, childPath) => {
  if (!parentPath || !childPath) return false;
  
  const normalizedParent = normalizePath(parentPath);
  const normalizedChild = normalizePath(childPath);
  
  if (normalizedParent === '/') return true;
  return normalizedChild.startsWith(normalizedParent + '/');
};

/**
 * Get depth level of a path (how many folders deep)
 * @param {string} path - File path
 * @returns {number} Depth level (0 for root)
 */
export const getPathDepth = (path) => {
  if (!path || path === '/') return 0;
  return path.split('/').filter(p => p).length;
};

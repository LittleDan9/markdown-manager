/**
 * File browser type definitions for unified file browsing
 */

/**
 * File tree node interface for unified file browsing
 * @typedef {Object} FileTreeNode
 * @property {string|number} id - Unique identifier for the node
 * @property {string} name - Display name of the file/folder
 * @property {'file'|'folder'} type - Type of node
 * @property {string} path - Full path to the file/folder
 * @property {'local'|'github'} source - Source of the file
 * @property {FileTreeNode[]} [children] - Child nodes for folders
 * @property {number} [size] - File size in bytes
 * @property {Date} [lastModified] - Last modified date
 * @property {string} [description] - Optional description
 * @property {string} [sha] - GitHub SHA hash
 * @property {string} [url] - GitHub API URL
 * @property {string} [category] - Local document category
 * @property {number} [documentId] - Local document ID
 */

/**
 * File browser configuration
 * @typedef {Object} FileBrowserConfig
 * @property {boolean} allowMultiSelect - Allow selecting multiple files
 * @property {boolean} showPreview - Show file preview pane
 * @property {boolean} showActions - Show action buttons
 * @property {'tree'|'list'} defaultView - Default view mode
 * @property {Object} [filters] - Filtering options
 * @property {string[]} [filters.fileTypes] - Allowed file extensions
 * @property {('local'|'github')[]} [filters.sources] - Allowed sources
 */

/**
 * Default configuration for file browser
 * @type {FileBrowserConfig}
 */
export const DEFAULT_CONFIG = {
  allowMultiSelect: false,
  showPreview: true,
  showActions: true,
  defaultView: 'tree',
  filters: {
    fileTypes: ['.md', '.markdown', '.txt'],
    sources: ['local', 'github']
  }
};

/**
 * File browser view modes
 */
export const VIEW_MODES = {
  TREE: 'tree',
  LIST: 'list'
};

/**
 * File source types
 */
export const SOURCE_TYPES = {
  LOCAL: 'local',
  GITHUB: 'github'
};

/**
 * Node types
 */
export const NODE_TYPES = {
  FILE: 'file',
  FOLDER: 'folder'
};

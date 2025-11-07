/**
 * Base provider interface for file browser data sources
 */

import { shouldIncludeFile } from '../../../types/FileBrowserTypes.js';

/**
 * Base provider interface for file browser data sources
 */
export class BaseFileBrowserProvider {
  constructor(config = {}) {
    this.config = config;
  }

  /**
   * Check if a file should be included based on the current configuration
   * @param {string} fileName - Name of the file to check
   * @returns {boolean} - True if file should be included
   */
  shouldIncludeFile(fileName) {
    const allowedTypes = this.config?.filters?.fileTypes || [];
    return shouldIncludeFile(fileName, allowedTypes);
  }
  /**
   * Get the tree structure for the data source
   * @returns {Promise<FileTreeNode[]>}
   */
  async getTreeStructure() {
    throw new Error('getTreeStructure must be implemented');
  }

  /**
   * Get files directly in the specified path
   * @param {string} path - Path to get files from
   * @returns {Promise<FileTreeNode[]>}
   */
  async getFilesInPath(path) {
    throw new Error('getFilesInPath must be implemented');
  }

  /**
   * Get content of a file
   * @param {FileTreeNode} fileNode - File node to get content for
   * @returns {Promise<string>}
   */
  async getFileContent(fileNode) {
    throw new Error('getFileContent must be implemented');
  }

  /**
   * Create a new folder (if supported)
   * @param {string} parentPath - Parent path
   * @param {string} folderName - Name of new folder
   * @returns {Promise<FileTreeNode>}
   */
  async createFolder(parentPath, folderName) {
    throw new Error('createFolder not supported by this provider');
  }

  /**
   * Get the display name for this provider
   * @returns {string}
   */
  getDisplayName() {
    return 'Unknown Provider';
  }

  /**
   * Search for files (if supported)
   * @param {string} query - Search query
   * @returns {Promise<FileTreeNode[]>}
   */
  async searchFiles(query) {
    throw new Error('searchFiles not supported by this provider');
  }

  /**
   * Get statistics about the data source (if supported)
   * @returns {Promise<Object>}
   */
  async getStats() {
    throw new Error('getStats not supported by this provider');
  }
}

/**
 * Data providers for unified file browsing
 */

import { NODE_TYPES, SOURCE_TYPES } from '../types/FileBrowserTypes';
import gitHubApi from '../api/gitHubApi';

/**
 * Base provider interface for file browser data sources
 */
export class BaseFileBrowserProvider {
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
}

/**
 * Local documents provider - adapts existing document/category system
 */
export class LocalDocumentsProvider extends BaseFileBrowserProvider {
  constructor(documentContext) {
    super();
    this.documentContext = documentContext;
  }

  getDisplayName() {
    return 'My Documents';
  }

  async getTreeStructure() {
    const { documents = [], categories = [] } = this.documentContext;
    
    // Ensure 'General' category exists
    const safeCategories = categories.includes('General') 
      ? categories 
      : ['General', ...categories.filter(c => c !== 'General')];

    return safeCategories.map(category => ({
      id: `category-${category}`,
      name: category,
      type: NODE_TYPES.FOLDER,
      path: `/${category}`,
      source: SOURCE_TYPES.LOCAL,
      category: category,
      children: documents
        .filter(doc => doc.category === category)
        .map(doc => ({
          id: doc.id,
          name: doc.name,
          type: NODE_TYPES.FILE,
          path: `/${category}/${doc.name}`,
          source: SOURCE_TYPES.LOCAL,
          documentId: doc.id,
          category: category,
          lastModified: doc.updated_at ? new Date(doc.updated_at) : null,
          size: doc.content ? doc.content.length : 0
        }))
    }));
  }

  async getFilesInPath(path) {
    const { documents = [] } = this.documentContext;
    
    // Parse path to determine category
    const pathParts = path.split('/').filter(p => p);
    
    if (pathParts.length === 0) {
      // Root path - return categories as folders
      const { categories = [] } = this.documentContext;
      const safeCategories = categories.includes('General') 
        ? categories 
        : ['General', ...categories.filter(c => c !== 'General')];
        
      return safeCategories.map(category => ({
        id: `category-${category}`,
        name: category,
        type: NODE_TYPES.FOLDER,
        path: `/${category}`,
        source: SOURCE_TYPES.LOCAL,
        category: category
      }));
    } else if (pathParts.length === 1) {
      // Category level - return documents in category
      const category = pathParts[0];
      return documents
        .filter(doc => doc.category === category)
        .map(doc => ({
          id: doc.id,
          name: doc.name,
          type: NODE_TYPES.FILE,
          path: `/${category}/${doc.name}`,
          source: SOURCE_TYPES.LOCAL,
          documentId: doc.id,
          category: category,
          lastModified: doc.updated_at ? new Date(doc.updated_at) : null,
          size: doc.content ? doc.content.length : 0
        }));
    }

    return [];
  }

  async getFileContent(fileNode) {
    const { documents = [] } = this.documentContext;
    const document = documents.find(doc => doc.id === fileNode.documentId);
    return document?.content || '';
  }
}

/**
 * GitHub provider - adapts existing GitHub API
 */
export class GitHubProvider extends BaseFileBrowserProvider {
  constructor(repository, branch) {
    super();
    this.repository = repository;
    this.branch = branch;
    this.treeCache = new Map();
  }

  getDisplayName() {
    return `${this.repository.name} (${this.branch})`;
  }

  async getTreeStructure() {
    try {
      const contents = await gitHubApi.getRepositoryContents(
        this.repository.id,
        '', // root path
        this.branch
      );
      return this.convertGitHubContentsToFileNodes(contents);
    } catch (error) {
      console.error('Failed to get GitHub tree structure:', error);
      return [];
    }
  }

  async getFilesInPath(path) {
    try {
      const contents = await gitHubApi.getRepositoryContents(
        this.repository.id,
        path,
        this.branch
      );
      return this.convertGitHubContentsToFileNodes(contents);
    } catch (error) {
      console.error('Failed to get GitHub files in path:', error);
      return [];
    }
  }

  async getFileContent(fileNode) {
    try {
      // Use the GitHub API's getFileContent method
      const response = await gitHubApi.getFileContent(
        this.repository.id,
        fileNode.path,
        this.branch
      );
      // Extract just the content string from the response object
      return response.content || '';
    } catch (error) {
      console.error('Failed to get GitHub file content:', error);
      return '';
    }
  }

  /**
   * Convert GitHub API response to FileTreeNode format
   * @param {Array} githubContents - GitHub API contents response
   * @returns {FileTreeNode[]}
   */
  convertGitHubContentsToFileNodes(githubContents) {
    return githubContents.map(item => ({
      id: item.sha || `${item.type}-${item.path}`,
      name: item.name,
      type: item.type === 'dir' ? NODE_TYPES.FOLDER : NODE_TYPES.FILE,
      path: item.path,
      source: SOURCE_TYPES.GITHUB,
      sha: item.sha,
      url: item.url,
      size: item.size,
      lastModified: null, // GitHub API doesn't provide this in contents
      children: [] // Will be loaded on-demand for folders
    }));
  }

  /**
   * Get folder contents with caching
   * @param {string} folderPath - Path to folder
   * @returns {Promise<FileTreeNode[]>}
   */
  async getFolderContents(folderPath) {
    const cacheKey = `${this.repository.id}-${this.branch}-${folderPath}`;
    
    if (this.treeCache.has(cacheKey)) {
      return this.treeCache.get(cacheKey);
    }

    try {
      const contents = await this.getFilesInPath(folderPath);
      this.treeCache.set(cacheKey, contents);
      return contents;
    } catch (error) {
      console.error('Failed to get folder contents:', error);
      return [];
    }
  }

  /**
   * Clear the tree cache (useful when branch changes)
   */
  clearCache() {
    this.treeCache.clear();
  }
}

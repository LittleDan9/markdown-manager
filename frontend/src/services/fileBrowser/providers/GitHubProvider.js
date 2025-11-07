/**
 * GitHub Provider - Core GitHub repository browsing functionality
 */

import { BaseFileBrowserProvider } from './BaseFileBrowserProvider.js';
import { GitHubTreeConverter, GitHubSearchUtils, GitHubImportUtils } from './GitHubProviderUtils.js';
import { NODE_TYPES, SOURCE_TYPES } from '../../../types/FileBrowserTypes.js';
import gitHubApi from '../../../api/gitHubApi.js';

/**
 * GitHub provider - provides folder-aware repository browsing
 */
export class GitHubProvider extends BaseFileBrowserProvider {
  constructor(repository, branch = 'main', config = {}) {
    super(config);
    this.repository = repository;
    this.branch = branch;
    this.treeCache = new Map();

    // Handle different repository object structures
    const name = repository.repo_name || repository.name;

    // Fallback if name is undefined
    const safeName = name || 'repository';

    this.rootPath = `/GitHub/${safeName}/${branch}`;
  }

  getDisplayName() {
    return `${this.repository.name || this.repository.repo_name} (${this.branch})`;
  }

  async getTreeStructure() {
    try {
      // Use the enhanced getRepositoryTree API for better folder structure
      const response = await gitHubApi.getRepositoryTree(
        this.repository.id,
        this.branch
      );

      // The API returns a flat list, not a recursive tree
      // Convert the flat list to tree structure
      return this.convertFlatTreeToHierarchy(response.tree);
    } catch (error) {
      console.error('Failed to get GitHub tree structure:', error);
      // Fallback to the old method if the new API isn't available
      try {
        const contents = await gitHubApi.getRepositoryContents(
          this.repository.id,
          '', // root path
          this.branch
        );
        return GitHubTreeConverter.convertGitHubContentsToFileNodes(contents);
      } catch (fallbackError) {
        console.error('Fallback method also failed:', fallbackError);
        return [];
      }
    }
  }

  async getFilesInPath(path) {
    try {
      // If requesting root path, return the root tree structure
      if (path === this.rootPath || path === '' || path === '/') {
        const treeStructure = await this.getTreeStructure();
        return treeStructure[0]?.children || [];
      }

      // Handle case where path is the repository root without branch
      // e.g., path = "/GitHub/repo-name" but rootPath = "/GitHub/repo-name/branch"
      const repoBasePath = this.rootPath.split('/').slice(0, -1).join('/'); // Remove branch part
      if (path === repoBasePath) {
        const treeStructure = await this.getTreeStructure();
        return treeStructure[0]?.children || [];
      }

      // For subfolder paths, extract the GitHub path and make API call
      if (path.startsWith(this.rootPath)) {
        // Extract GitHub path from our internal path
        let githubPath = path.replace(this.rootPath, '').replace(/^\//, '');

        // Get contents of specific folder
        const contents = await gitHubApi.getRepositoryContents(
          this.repository.id,
          githubPath,
          this.branch
        );

        // Convert to file nodes
        return GitHubTreeConverter.convertGitHubContentsToFileNodes(contents)
          .filter(item => item.type === NODE_TYPES.FOLDER || this.shouldIncludeFile(item.name))
          .map(item => ({
            ...item,
            path: `${this.rootPath}/${githubPath}${githubPath ? '/' : ''}${item.name}`,
            githubPath: `${githubPath}${githubPath ? '/' : ''}${item.name}`
          }));
      }

      // Handle paths that start with repository base but include subfolders
      if (path.startsWith(repoBasePath + '/')) {
        // Extract the part after the repository base
        let githubPath = path.replace(repoBasePath + '/', '');

        // Get contents of specific folder
        const contents = await gitHubApi.getRepositoryContents(
          this.repository.id,
          githubPath,
          this.branch
        );

        // Convert to file nodes
        return GitHubTreeConverter.convertGitHubContentsToFileNodes(contents)
          .filter(item => item.type === NODE_TYPES.FOLDER || this.shouldIncludeFile(item.name))
          .map(item => ({
            ...item,
            path: `${this.rootPath}/${githubPath}${githubPath ? '/' : ''}${item.name}`,
            githubPath: `${githubPath}${githubPath ? '/' : ''}${item.name}`
          }));
      }

      return [];
    } catch (error) {
      console.error('Failed to get GitHub files in path:', error);
      return [];
    }
  }

  async getFileContent(fileNode) {
    try {
      // Use the enhanced getFileContent method if available
      if (fileNode.githubPath) {
        const response = await gitHubApi.getFileContent(
          this.repository.id,
          fileNode.githubPath,
          this.branch
        );
        return response.content || '';
      }

      // Fallback to the old method
      const response = await gitHubApi.getFileContent(
        this.repository.id,
        fileNode.path,
        this.branch
      );
      return response.content || '';
    } catch (error) {
      console.error('Failed to get GitHub file content:', error);
      return '';
    }
  }

  async searchFiles(query) {
    return GitHubSearchUtils.searchFiles(
      this.repository,
      this.branch,
      query,
      this.rootPath
    );
  }

  async getStats() {
    return GitHubSearchUtils.getRepositoryStats(this.repository, this.branch);
  }

  /**
   * Import files from GitHub repository using the new import API
   * @param {string[]} filePaths - Array of file paths to import (null for all)
   * @param {boolean} overwriteExisting - Whether to overwrite existing files
   * @returns {Promise<Object>}
   */
  async importFiles(filePaths = null, overwriteExisting = false) {
    return GitHubImportUtils.importFiles(
      this.repository,
      this.branch,
      filePaths,
      overwriteExisting
    );
  }

  /**
   * Sync repository structure with backend
   * @param {boolean} cleanupOrphaned - Whether to cleanup orphaned files
   * @returns {Promise<Object>}
   */
  async syncRepository(cleanupOrphaned = true) {
    return GitHubImportUtils.syncRepository(
      this.repository,
      this.branch,
      cleanupOrphaned
    );
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
   * Convert flat tree response from API to hierarchical structure
   * @param {Array} flatTree - Flat tree from API
   * @returns {FileTreeNode[]}
   */
  convertFlatTreeToHierarchy(flatTree) {
    const rootNode = {
      id: 'root',
      name: this.getDisplayName(),
      type: NODE_TYPES.FOLDER,
      path: this.rootPath,
      source: SOURCE_TYPES.GITHUB,
      expanded: true,
      children: []
    };

    // Convert flat tree items to file nodes
    const fileNodes = flatTree
      .filter(item => item.type === 'dir' || (item.type === 'file' && this.shouldIncludeFile(item.name)))
      .map(item => ({
        id: item.sha || `${item.type}-${item.path}`,
        name: item.name,
        type: item.type === 'dir' ? NODE_TYPES.FOLDER : NODE_TYPES.FILE,
        path: `${this.rootPath}/${item.path}`,
        source: SOURCE_TYPES.GITHUB,
        sha: item.sha,
        size: item.size,
        githubPath: item.path,
        children: item.type === 'dir' ? [] : undefined // Folders get children, files don't
      }));

    rootNode.children = fileNodes;
    return [rootNode];
  }

  /**
   * Clear the tree cache (useful when branch changes)
   */
  clearCache() {
    this.treeCache.clear();
  }
}

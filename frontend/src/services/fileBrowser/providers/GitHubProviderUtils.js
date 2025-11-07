/**
 * GitHub Provider Utilities - Helper functions and utilities for GitHub operations
 */

import { NODE_TYPES, SOURCE_TYPES } from '../../../types/FileBrowserTypes.js';
import gitHubApi from '../../../api/gitHubApi.js';

/**
 * GitHub Tree Converter - converts GitHub tree API responses to FileTreeNode format
 */
export class GitHubTreeConverter {
  /**
   * Convert GitHub tree API response to FileTreeNode format with proper folder hierarchy
   * @param {Array} githubTree - GitHub tree API response
   * @param {string} rootPath - Root path for the repository
   * @param {Object} repository - Repository object
   * @param {string} branch - Branch name
   * @returns {FileTreeNode[]}
   */
  static convertGitHubTreeToFileNodes(githubTree, rootPath, repository, branch) {
    const rootNode = {
      id: 'root',
      name: `${repository.name || repository.repo_name} (${branch})`,
      type: NODE_TYPES.FOLDER,
      path: rootPath,
      source: SOURCE_TYPES.GITHUB,
      expanded: true,
      children: []
    };

    // Build folder structure from flat GitHub tree
    const folderMap = new Map();
    folderMap.set('', rootNode);

    // Sort by path to ensure parent folders are created first
    const sortedFiles = githubTree.sort((a, b) => a.path.localeCompare(b.path));

    for (const item of sortedFiles) {
      // Only process markdown files and directories
      if (item.type === 'blob' && !item.path.endsWith('.md')) {
        continue;
      }

      const pathParts = item.path.split('/');
      const fileName = pathParts[pathParts.length - 1];
      const folderPath = pathParts.slice(0, -1).join('/');

      // Create intermediate folders if they don't exist
      for (let i = 0; i < pathParts.length - 1; i++) {
        const partialPath = pathParts.slice(0, i + 1).join('/');
        if (!folderMap.has(partialPath)) {
          const folderNode = {
            id: `folder-${partialPath}`,
            name: pathParts[i],
            type: NODE_TYPES.FOLDER,
            path: `${rootPath}/${partialPath}`,
            source: SOURCE_TYPES.GITHUB,
            expanded: false,
            children: []
          };

          const parentPath = pathParts.slice(0, i).join('/');
          const parent = folderMap.get(parentPath);
          if (parent) {
            parent.children.push(folderNode);
            folderMap.set(partialPath, folderNode);
          }
        }
      }

      // Add file to its parent folder
      if (item.type === 'blob' && item.path.endsWith('.md')) {
        const fileNode = {
          id: item.sha,
          name: fileName,
          type: NODE_TYPES.FILE,
          path: `${rootPath}/${item.path}`,
          source: SOURCE_TYPES.GITHUB,
          sha: item.sha,
          size: item.size,
          githubPath: item.path
        };

        const parentFolder = folderMap.get(folderPath);
        if (parentFolder) {
          parentFolder.children.push(fileNode);
        }
      } else if (item.type === 'tree') {
        // Directory - ensure it exists in the map
        const existingFolder = folderMap.get(item.path);
        if (existingFolder) {
          existingFolder.sha = item.sha;
        }
      }
    }

    return [rootNode];
  }

  /**
   * Convert GitHub API contents response to FileTreeNode format (fallback method)
   * @param {Array} githubContents - GitHub API contents response
   * @returns {FileTreeNode[]}
   */
  static convertGitHubContentsToFileNodes(githubContents) {
    return githubContents
      .filter(item => item.type === 'dir' || item.name.endsWith('.md')) // Only folders and markdown files
      .map(item => ({
        id: item.sha || `${item.type}-${item.path}`,
        name: item.name,
        type: item.type === 'dir' ? NODE_TYPES.FOLDER : NODE_TYPES.FILE,
        path: item.path,
        source: SOURCE_TYPES.GITHUB,
        sha: item.sha,
        url: item.url,
        size: item.size,
        githubPath: item.path,
        lastModified: null, // GitHub API doesn't provide this in contents
        children: [] // Will be loaded on-demand for folders
      }));
  }
}

/**
 * GitHub Search Utilities
 */
export class GitHubSearchUtils {
  /**
   * Search for files in a GitHub repository
   * @param {Object} repository - Repository object
   * @param {string} branch - Branch name
   * @param {string} query - Search query
   * @param {string} rootPath - Root path for results
   * @returns {Promise<FileTreeNode[]>}
   */
  static async searchFiles(repository, branch, query, rootPath) {
    try {
      const response = await gitHubApi.getRepositoryTree(repository.id, branch);

      return response.tree
        .filter(item =>
          item.type === 'blob' &&
          item.path.endsWith('.md') &&
          (item.path.toLowerCase().includes(query.toLowerCase()))
        )
        .map(item => ({
          id: item.sha,
          name: item.path.split('/').pop(),
          type: NODE_TYPES.FILE,
          path: `${rootPath}/${item.path}`,
          source: SOURCE_TYPES.GITHUB,
          sha: item.sha,
          githubPath: item.path,
          size: item.size
        }));
    } catch (error) {
      console.error('Failed to search files:', error);
      return [];
    }
  }

  /**
   * Get repository statistics
   * @param {Object} repository - Repository object
   * @param {string} branch - Branch name
   * @returns {Promise<Object>}
   */
  static async getRepositoryStats(repository, branch) {
    try {
      const response = await gitHubApi.getRepositoryTree(repository.id, branch);

      const markdownFiles = response.tree.filter(item =>
        item.type === 'blob' && item.path.endsWith('.md')
      );

      const folders = new Set();
      markdownFiles.forEach(file => {
        const folderPath = file.path.split('/').slice(0, -1).join('/');
        if (folderPath) folders.add(folderPath);
      });

      return {
        totalFiles: markdownFiles.length,
        totalFolders: folders.size,
        totalSize: markdownFiles.reduce((sum, file) => sum + (file.size || 0), 0)
      };
    } catch (error) {
      console.error('Failed to get repository stats:', error);
      return { totalFiles: 0, totalFolders: 0, totalSize: 0 };
    }
  }
}

/**
 * GitHub Import/Sync Operations
 */
export class GitHubImportUtils {
  /**
   * Import files from GitHub repository using the new import API
   * @param {Object} repository - Repository object
   * @param {string} branch - Branch name
   * @param {string[]} filePaths - Array of file paths to import (null for all)
   * @param {boolean} overwriteExisting - Whether to overwrite existing files
   * @returns {Promise<Object>}
   */
  static async importFiles(repository, branch, filePaths = null, overwriteExisting = false) {
    try {
      return await gitHubApi.importRepositoryFiles(repository.id, {
        branch: branch,
        file_paths: filePaths, // null means import all
        overwrite_existing: overwriteExisting
      });
    } catch (error) {
      console.error('Failed to import files:', error);
      throw error;
    }
  }

  /**
   * Sync repository structure with backend
   * @param {Object} repository - Repository object
   * @param {string} branch - Branch name
   * @param {boolean} cleanupOrphaned - Whether to cleanup orphaned files
   * @returns {Promise<Object>}
   */
  static async syncRepository(repository, branch, cleanupOrphaned = true) {
    try {
      return await gitHubApi.syncRepositoryStructure(repository.id, {
        branch: branch,
        cleanup_orphaned: cleanupOrphaned
      });
    } catch (error) {
      console.error('Failed to sync repository:', error);
      throw error;
    }
  }
}

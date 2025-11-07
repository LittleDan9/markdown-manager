/**
 * Enhanced GitHub File Browser Provider for Folder Structure Support
 * Implements natural folder hierarchy for GitHub repository browsing
 */

import { BaseFileBrowserProvider } from './BaseFileBrowserProvider.js';

export class GitHubFolderProvider extends BaseFileBrowserProvider {
  constructor(githubService, repository, branch = 'main') {
    super();
    this.githubService = githubService;
    this.repository = repository;
    this.branch = branch;
    this.rootPath = `/GitHub/${repository.repo_name}/${branch}`;
  }

  async getTreeStructure() {
    try {
      const response = await this.githubService.getRepositoryTree(
        this.repository.id,
        this.branch
      );

      return this.convertGitHubTreeToFileNodes(response.tree);
    } catch (error) {
      console.error('Failed to get GitHub tree structure:', error);
      throw new Error(`Failed to load repository structure: ${error.message}`);
    }
  }

  convertGitHubTreeToFileNodes(githubTree) {
    const rootNode = {
      id: 'root',
      name: `${this.repository.repo_name} (${this.branch})`,
      type: 'folder',
      path: this.rootPath,
      source: 'github',
      expanded: true,
      children: []
    };

    // Build folder structure from flat GitHub tree
    const folderMap = new Map();
    folderMap.set('', rootNode);

    // Sort by path to ensure parent folders are created first
    const sortedFiles = githubTree.sort((a, b) => a.path.localeCompare(b.path));

    for (const item of sortedFiles) {
      // Skip non-markdown files unless they're directories
      if (item.type === 'file' && !item.name.endsWith('.md')) {
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
            type: 'folder',
            path: `${this.rootPath}/${partialPath}`,
            source: 'github',
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
      if (item.type === 'file' && item.name.endsWith('.md')) {
        const fileNode = {
          id: item.sha,
          name: fileName,
          type: 'file',
          path: `${this.rootPath}/${item.path}`,
          source: 'github',
          sha: item.sha,
          size: item.size,
          githubPath: item.path,
          downloadUrl: item.download_url,
          folderPath: item.folder_path || `${this.rootPath}/${folderPath}`
        };

        const parentFolder = folderMap.get(folderPath);
        if (parentFolder) {
          parentFolder.children.push(fileNode);
        }
      } else if (item.type === 'dir') {
        // Directory already handled in folder creation loop
        const existingFolder = folderMap.get(item.path);
        if (existingFolder) {
          existingFolder.sha = item.sha;
        }
      }
    }

    return [rootNode];
  }

  async getFilesInPath(path) {
    // Extract GitHub path from our internal path
    const githubPath = path.replace(this.rootPath, '').replace(/^\//, '');

    try {
      const response = await this.githubService.getRepositoryTree(
        this.repository.id,
        this.branch
      );

      // Filter files in the specific path
      return response.tree
        .filter(item => {
          const itemFolder = item.path.split('/').slice(0, -1).join('/');
          return itemFolder === githubPath && 
                 item.type === 'file' && 
                 item.name.endsWith('.md');
        })
        .map(item => ({
          id: item.sha,
          name: item.name,
          type: 'file',
          path: `${this.rootPath}/${item.path}`,
          source: 'github',
          sha: item.sha,
          githubPath: item.path,
          folderPath: item.folder_path || `${this.rootPath}/${item.path.split('/').slice(0, -1).join('/')}`
        }));
    } catch (error) {
      console.error('Failed to get files in path:', error);
      return [];
    }
  }

  async getFileContent(fileNode) {
    try {
      const response = await this.githubService.getFileContent(
        this.repository.id,
        fileNode.githubPath,
        this.branch
      );
      return response.content;
    } catch (error) {
      console.error('Failed to get file content:', error);
      throw new Error(`Failed to load file content: ${error.message}`);
    }
  }

  async searchFiles(query) {
    try {
      const response = await this.githubService.getRepositoryTree(
        this.repository.id,
        this.branch
      );

      return response.tree
        .filter(item => 
          item.type === 'file' && 
          item.name.endsWith('.md') &&
          (item.name.toLowerCase().includes(query.toLowerCase()) ||
           item.path.toLowerCase().includes(query.toLowerCase()))
        )
        .map(item => ({
          id: item.sha,
          name: item.name,
          type: 'file',
          path: `${this.rootPath}/${item.path}`,
          source: 'github',
          sha: item.sha,
          githubPath: item.path,
          folderPath: item.folder_path || `${this.rootPath}/${item.path.split('/').slice(0, -1).join('/')}`
        }));
    } catch (error) {
      console.error('Failed to search files:', error);
      return [];
    }
  }

  async getFolderStats() {
    try {
      const response = await this.githubService.getRepositoryTree(
        this.repository.id,
        this.branch
      );

      const markdownFiles = response.tree.filter(item => 
        item.type === 'file' && item.name.endsWith('.md')
      );

      const folders = new Set();
      markdownFiles.forEach(file => {
        const pathParts = file.path.split('/');
        for (let i = 1; i <= pathParts.length - 1; i++) {
          const folderPath = pathParts.slice(0, i).join('/');
          folders.add(`${this.rootPath}/${folderPath}`);
        }
      });

      return {
        totalFiles: markdownFiles.length,
        totalFolders: folders.size,
        folders: Array.from(folders)
      };
    } catch (error) {
      console.error('Failed to get folder stats:', error);
      return {
        totalFiles: 0,
        totalFolders: 0,
        folders: []
      };
    }
  }

  async importFile(fileNode) {
    try {
      const response = await this.githubService.importRepositoryFile(
        this.repository.id,
        fileNode.githubPath,
        this.branch
      );
      return response;
    } catch (error) {
      console.error('Failed to import file:', error);
      throw new Error(`Failed to import file: ${error.message}`);
    }
  }

  async importFolder(folderPath) {
    try {
      // Import all markdown files in the folder
      const files = await this.getFilesInPath(folderPath);
      const results = [];

      for (const file of files) {
        try {
          const result = await this.importFile(file);
          results.push({ file: file.name, success: true, result });
        } catch (error) {
          results.push({ file: file.name, success: false, error: error.message });
        }
      }

      return results;
    } catch (error) {
      console.error('Failed to import folder:', error);
      throw new Error(`Failed to import folder: ${error.message}`);
    }
  }

  async syncRepository() {
    try {
      const response = await this.githubService.syncRepositoryStructure(
        this.repository.id,
        this.branch
      );
      return response;
    } catch (error) {
      console.error('Failed to sync repository:', error);
      throw new Error(`Failed to sync repository: ${error.message}`);
    }
  }

  // Static method to create provider from repository data
  static create(githubService, repository, branch = 'main') {
    return new GitHubFolderProvider(githubService, repository, branch);
  }

  // Get display name for the provider
  getDisplayName() {
    return `GitHub: ${this.repository.repo_owner}/${this.repository.repo_name} (${this.branch})`;
  }

  // Get provider type identifier
  getType() {
    return 'github-folder';
  }

  // Check if this provider supports a specific operation
  supports(operation) {
    const supportedOperations = [
      'browse',
      'search',
      'import',
      'sync',
      'folder-structure',
      'batch-import'
    ];
    return supportedOperations.includes(operation);
  }
}

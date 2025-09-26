/**
 * Unified File Browser Provider - ID-centric approach
 *
 * Core principle: Work directly with document IDs, not virtual paths
 * The UI maintains user-friendly paths, but data operations use IDs
 */

import { BaseFileBrowserProvider } from './BaseFileBrowserProvider.js';
import { NODE_TYPES, SOURCE_TYPES } from '../../types/FileBrowserTypes.js';
import documentsApi from '../../api/documentsApi.js';
import gitHubApi from '../../api/gitHubApi.js';

/**
 * Unified provider that works with document IDs instead of virtual paths
 */
export class UnifiedFileBrowserProvider extends BaseFileBrowserProvider {
  constructor(sourceConfig, config = {}) {
    super(config);
    this.sourceConfig = sourceConfig; // { type: 'local'|'github', categoryId?, repositoryId?, branch? }
    this.documentCache = new Map(); // Cache documents by ID
  }

  getDisplayName() {
    if (this.sourceConfig.type === 'local') {
      return this.sourceConfig.categoryName || 'Local Documents';
    } else if (this.sourceConfig.type === 'github') {
      return `${this.sourceConfig.repositoryName} (${this.sourceConfig.branch || 'main'})`;
    }
    return 'Documents';
  }

  async getTreeStructure() {
    // Get all documents for this source
    const documents = await this._getSourceDocuments();

    // Build hierarchical structure based on folder_path
    const folderTree = this._buildFolderStructure(documents);

    return [folderTree];
  }

  async getFilesInPath(path) {
    if (this.sourceConfig.type === 'github') {
      return await this._getGitHubFilesInPath(path);
    } else {
      // Local documents - use existing logic
      const documents = await this._getSourceDocuments();
      return documents
        .filter(doc => this._getDocumentFolderPath(doc) === path)
        .map(doc => this._documentToFileNode(doc));
    }
  }

  async _getGitHubFilesInPath(path) {
    try {
      // Convert UI path to GitHub API path
      const githubPath = this._uiPathToGitHubPath(path);

      console.log(`🔍 Fetching GitHub path: "${githubPath}" for UI path: "${path}"`);

      const contents = await gitHubApi.getRepositoryContents(
        this.sourceConfig.repositoryId,
        githubPath,
        this.sourceConfig.branch
      );

      console.log(`📁 Found ${contents.length} items in GitHub path: ${githubPath}`);

      // Convert GitHub items to file nodes
      return contents
        .filter(item => {
          // Include directories for navigation
          if (item.type === 'dir') return true;
          // Include markdown files
          if (item.type === 'file' && item.name.endsWith('.md')) return true;
          // Exclude other file types
          return false;
        })
        .map(item => {
          if (item.type === 'dir') {
            return this._githubDirToFileNode(item, path);
          } else {
            return this._githubFileToFileNode(item, path);
          }
        });

    } catch (error) {
      console.error('Error fetching GitHub files in path:', path, error);
      return [];
    }
  }

  _uiPathToGitHubPath(uiPath) {
    // Convert UI path like "/GitHub/markdown-manager/main/docs" to GitHub API path "docs"
    if (uiPath === '/' || uiPath === '') return '';

    // Remove the GitHub prefix (e.g., "/GitHub/markdown-manager/main/")
    const pathParts = uiPath.split('/').filter(p => p);
    if (pathParts.length <= 3) return ''; // Root level

    // Return the actual GitHub path (everything after repo/branch)
    return pathParts.slice(3).join('/');
  }

  async getFileContent(fileNode) {
    // UNIFIED APPROACH: For GitHub files, always fetch directly from repository API
    if (this.sourceConfig.type === 'github') {
      return await this._getGitHubFileContent(fileNode);
    }

    // For local documents, use document ID
    const document = await documentsApi.getDocument(fileNode.documentId);
    return document.content || '';
  }

  async _getGitHubFileContent(fileNode) {
    try {
      console.log('📥 Fetching GitHub file content:', fileNode._githubFile.path);
      console.log('🔧 Repository ID:', this.sourceConfig.repositoryId);
      console.log('🌳 Branch:', this.sourceConfig.branch);

      const data = await gitHubApi.getFileContent(
        this.sourceConfig.repositoryId,
        fileNode._githubFile.path,
        this.sourceConfig.branch
      );

      console.log('📄 Content received, length:', data.content?.length || 0);
      return data.content || '';

    } catch (error) {
      console.error('Error fetching GitHub file content:', error);
      throw error;
    }
  }

  async _getSourceDocuments() {
    if (this.sourceConfig.type === 'local') {
      return await this._getLocalDocuments();
    } else if (this.sourceConfig.type === 'github') {
      return await this._getGitHubDocuments();
    }
    return [];
  }

  async _getLocalDocuments() {
    // Get documents for specific category
    const allDocs = await documentsApi.getAllDocuments();
    return allDocs.filter(doc =>
      doc.category_id === this.sourceConfig.categoryId &&
      doc.repository_type === 'local'
    );
  }

  async _getGitHubDocuments() {
    // UNIFIED APPROACH: Always browse repository directly via GitHub API
    console.log('� Browsing GitHub repository directly...');
    try {
      // Get repository contents directly from the GitHub API
      const contents = await gitHubApi.getRepositoryContents(
        this.sourceConfig.repositoryId,
        '',
        this.sourceConfig.branch
      );

      console.log(`🔍 Found ${contents.length} items in repository`);

      // Convert GitHub items to file nodes for the browser
      return contents
        .filter(item => {
          // Include directories for navigation
          if (item.type === 'dir') return true;
          // Include markdown files
          if (item.type === 'file' && item.name.endsWith('.md')) return true;
          // Exclude other file types
          return false;
        })
        .map(item => {
          if (item.type === 'dir') {
            return this._githubDirToDocument(item);
          } else {
            return this._githubFileToDocument(item);
          }
        });

    } catch (error) {
      console.error('Error browsing GitHub repository:', error);
      return [];
    }
  }

  _githubFileToDocument(githubFile) {
    // Create a document-like object for GitHub files
    return {
      id: `github-${this.sourceConfig.repositoryId}-${githubFile.sha}`,
      name: githubFile.name.replace('.md', ''), // Display name without extension
      filename: githubFile.name, // Keep original filename for extension checking
      source: 'github', // Important: mark as GitHub source
      type: 'file', // Mark as file type
      repository_type: 'github',
      github_file_path: githubFile.path,
      github_sha: githubFile.sha,
      file_path: `github/${this.sourceConfig.repositoryName}/${this.sourceConfig.branch}/${githubFile.path}`,
      category: this.sourceConfig.repositoryName,
      // GitHub file metadata
      _githubFile: githubFile
    };
  }

  _githubDirToDocument(githubDir) {
    // Create a document-like object for GitHub directories
    return {
      id: `github-dir-${this.sourceConfig.repositoryId}-${githubDir.sha}`,
      name: githubDir.name,
      repository_type: 'github',
      github_file_path: githubDir.path,
      github_sha: githubDir.sha,
      file_path: `github/${this.sourceConfig.repositoryName}/${this.sourceConfig.branch}/${githubDir.path}`,
      category: this.sourceConfig.repositoryName,
      type: 'dir', // Important: mark as directory
      // GitHub directory metadata
      _githubFile: githubDir
    };
  }

  _githubDirToFileNode(githubDir, currentPath) {
    // Create a file node directly for directory browsing
    return {
      id: `github-dir-${this.sourceConfig.repositoryId}-${githubDir.sha}`,
      name: githubDir.name,
      type: NODE_TYPES.FOLDER,
      path: currentPath === '/' ? `/${githubDir.name}` : `${currentPath}/${githubDir.name}`,
      source: this._getSourceType(),
      documentId: null, // Directories don't have document IDs
      githubFilePath: githubDir.path,
      _githubFile: githubDir,
      category: this.sourceConfig.repositoryName,
      size: 0
    };
  }

  _githubFileToFileNode(githubFile, currentPath) {
    // Create a file node directly for file browsing
    return {
      id: `github-${this.sourceConfig.repositoryId}-${githubFile.sha}`,
      name: githubFile.name.replace('.md', ''),
      type: NODE_TYPES.FILE,
      path: currentPath === '/' ? `/${githubFile.name}` : `${currentPath}/${githubFile.name}`,
      source: this._getSourceType(),
      documentId: null, // GitHub files don't have document IDs
      githubFilePath: githubFile.path,
      _githubFile: githubFile,
      category: this.sourceConfig.repositoryName,
      size: githubFile.size,
      lastModified: null
    };
  }

  _buildFolderStructure(documents) {
    const folderMap = new Map();

    // Create root folder
    const rootPath = this._getRootPath();
    const rootFolder = {
      id: 'root',
      name: this.getDisplayName(),
      type: NODE_TYPES.FOLDER,
      path: rootPath,
      source: this._getSourceType(),
      children: [],
      expanded: true
    };
    folderMap.set(rootPath, rootFolder);

    // Group documents by folder path
    const folderGroups = new Map();
    documents.forEach(doc => {
      const folderPath = this._getDocumentFolderPath(doc);
      if (!folderGroups.has(folderPath)) {
        folderGroups.set(folderPath, []);
      }
      folderGroups.get(folderPath).push(doc);
    });

    // Create folder nodes for each unique folder path
    for (const [folderPath, docs] of folderGroups) {
      if (folderPath === rootPath) {
        // Add files directly to root
        rootFolder.children.push(...docs.map(doc => this._documentToFileNode(doc)));
      } else {
        // Create intermediate folder if needed
        const folderNode = this._ensureFolderPath(folderMap, folderPath, rootFolder);
        folderNode.children.push(...docs.map(doc => this._documentToFileNode(doc)));
      }
    }

    return rootFolder;
  }

  _getDocumentFolderPath(document) {
    // For local docs, use category-based path
    if (document.repository_type === 'local') {
      return `/Documents/${document.category || 'General'}`;
    }

    // For GitHub docs, use repository-based path
    if (document.repository_type === 'github') {
      const repoName = this.sourceConfig.repositoryName || 'repository';
      const branch = document.github_branch || 'main';

      // Extract folder from file path
      const filePath = document.github_file_path || '';
      const pathParts = filePath.split('/');
      pathParts.pop(); // Remove filename

      if (pathParts.length === 0) {
        return `/GitHub/${repoName}/${branch}`;
      } else {
        return `/GitHub/${repoName}/${branch}/${pathParts.join('/')}`;
      }
    }

    return '/';
  }

  _documentToFileNode(document) {
    // Determine if this is a directory
    const isDirectory = document.type === 'dir' || document._githubFile?.type === 'dir';

    const node = {
      id: document.id,
      name: document.name,
      type: isDirectory ? NODE_TYPES.FOLDER : NODE_TYPES.FILE,
      path: this._getDocumentFolderPath(document) + '/' + document.name,
      source: this._getSourceType(),

      // Metadata
      lastModified: document.updated_at ? new Date(document.updated_at) : null,
      size: document.content ? document.content.length : 0,

      // Source-specific data
      category: document.category,
      githubFilePath: document.github_file_path,
    };

    // Handle GitHub items (always direct from repository)
    if (this.sourceConfig.type === 'github') {
      node.documentId = null; // No document ID - direct from GitHub
      node._githubFile = document._githubFile;
      node.size = document._githubFile?.size || 0;
    } else {
      // Local documents
      node.documentId = document.id;
    }

    return node;
  }

  _getRootPath() {
    if (this.sourceConfig.type === 'local') {
      return `/Documents/${this.sourceConfig.categoryName || 'General'}`;
    } else if (this.sourceConfig.type === 'github') {
      const repoName = this.sourceConfig.repositoryName || 'repository';
      const branch = this.sourceConfig.branch || 'main';
      return `/GitHub/${repoName}/${branch}`;
    }
    return '/';
  }

  _getSourceType() {
    return this.sourceConfig.type === 'local' ? SOURCE_TYPES.LOCAL : SOURCE_TYPES.GITHUB;
  }

  _ensureFolderPath(folderMap, targetPath, rootFolder) {
    if (folderMap.has(targetPath)) {
      return folderMap.get(targetPath);
    }

    // Create folder node
    const pathParts = targetPath.split('/').filter(p => p);
    const folderName = pathParts[pathParts.length - 1];

    const folderNode = {
      id: `folder-${targetPath}`,
      name: folderName,
      type: NODE_TYPES.FOLDER,
      path: targetPath,
      source: this._getSourceType(),
      children: []
    };

    // Find parent and add to it
    const parentPath = '/' + pathParts.slice(0, -1).join('/');
    if (parentPath === '/' || parentPath === this._getRootPath()) {
      rootFolder.children.push(folderNode);
    } else {
      const parentFolder = this._ensureFolderPath(folderMap, parentPath, rootFolder);
      parentFolder.children.push(folderNode);
    }

    folderMap.set(targetPath, folderNode);
    return folderNode;
  }

  // Search implementation using document IDs
  async searchFiles(query) {
    const documents = await this._getSourceDocuments();
    const lowercaseQuery = query.toLowerCase();

    return documents
      .filter(doc =>
        doc.name.toLowerCase().includes(lowercaseQuery) ||
        (doc.content && doc.content.toLowerCase().includes(lowercaseQuery))
      )
      .map(doc => this._documentToFileNode(doc));
  }

  // Stats implementation
  async getStats() {
    const documents = await this._getSourceDocuments();

    return {
      totalFiles: documents.length,
      totalSize: documents.reduce((sum, doc) => sum + (doc.content?.length || 0), 0),
      lastUpdated: documents.reduce((latest, doc) => {
        const docDate = new Date(doc.updated_at);
        return docDate > latest ? docDate : latest;
      }, new Date(0))
    };
  }
}

/**
 * Factory function to create providers for different sources
 */
export function createFileBrowserProvider(sourceConfig, config = {}) {
  return new UnifiedFileBrowserProvider(sourceConfig, config);
}

/**
 * Helper to create local category provider
 */
export function createLocalProvider(categoryId, categoryName, config = {}) {
  return createFileBrowserProvider({
    type: 'local',
    categoryId,
    categoryName
  }, config);
}

/**
 * Helper to create GitHub repository provider
 */
export function createGitHubProvider(repositoryId, repositoryName, branch = 'main', config = {}) {
  return createFileBrowserProvider({
    type: 'github',
    repositoryId,
    repositoryName,
    branch
  }, config);
}
/**
 * Local documents provider - adapts existing document/category system
 */

import { BaseFileBrowserProvider } from './BaseFileBrowserProvider.js';
import { NODE_TYPES, SOURCE_TYPES } from '../../../types/FileBrowserTypes.js';

/**
 * Local documents provider - adapts existing document/category system
 */
export class LocalDocumentsProvider extends BaseFileBrowserProvider {
  constructor(documents, categories, config = {}) {
    super(config);
    this.documents = documents;
    this.categories = categories;
  }

  getDisplayName() {
    return 'Documents';
  }

  getDefaultPath() {
    return '/Documents';
  }

  async getTreeStructure() {
    const { documents = [], categories = [] } = { documents: this.documents, categories: this.categories };

    // Separate local and GitHub documents
    const localDocuments = documents.filter(doc => doc.repository_type !== 'github_repo');
    const githubDocuments = documents.filter(doc => doc.repository_type === 'github_repo');

    // Ensure 'General' category exists
    const safeCategories = categories.includes('General')
      ? categories
      : ['General', ...categories.filter(c => c !== 'General')];

    const rootChildren = [];

    // Add Documents folder for local documents
    if (localDocuments.length > 0 || safeCategories.length > 0) {
      rootChildren.push({
        id: 'documents-root',
        name: 'Documents',
        type: NODE_TYPES.FOLDER,
        path: '/Documents',
        source: SOURCE_TYPES.LOCAL,
        children: safeCategories.map(category => ({
          id: `category-${category}`,
          name: category,
          type: NODE_TYPES.FOLDER,
          path: `/Documents/${category}`,
          source: SOURCE_TYPES.LOCAL,
          category: category,
          children: localDocuments
            .filter(doc => doc.category === category)
            .map(doc => ({
              id: doc.id,
              name: doc.name,
              type: NODE_TYPES.FILE,
              path: `/Documents/${category}/${doc.name}`,
              source: SOURCE_TYPES.LOCAL,
              documentId: doc.id,
              category: category,
              lastModified: doc.updated_at ? new Date(doc.updated_at) : null,
              size: doc.content ? doc.content.length : 0
            }))
        }))
      });
    }

    // Add GitHub folder for synced repositories
    if (githubDocuments.length > 0) {
      // Group GitHub documents by owner/repo
      const githubFolders = {};
      githubDocuments.forEach(doc => {
        if (doc.folder_path && doc.folder_path.startsWith('/GitHub/')) {
          const parts = doc.folder_path.split('/').filter(p => p);
          if (parts.length >= 2) {
            const owner = parts[1];
            const repo = parts[2];
            const key = `${owner}/${repo}`;

            if (!githubFolders[key]) {
              githubFolders[key] = {
                owner,
                repo,
                documents: []
              };
            }
            githubFolders[key].documents.push(doc);
          }
        }
      });

      const githubChildren = Object.values(githubFolders).map(folder => ({
        id: `github-${folder.owner}-${folder.repo}`,
        name: `${folder.owner}/${folder.repo}`,
        type: NODE_TYPES.FOLDER,
        path: `/GitHub/${folder.owner}/${folder.repo}`,
        source: SOURCE_TYPES.GITHUB,
        children: folder.documents.map(doc => ({
          id: doc.id,
          name: doc.name,
          type: NODE_TYPES.FILE,
          path: doc.folder_path + '/' + doc.name,
          source: SOURCE_TYPES.GITHUB,
          documentId: doc.id,
          lastModified: doc.updated_at ? new Date(doc.updated_at) : null,
          size: doc.content ? doc.content.length : 0
        }))
      }));

      rootChildren.push({
        id: 'github-root',
        name: 'GitHub',
        type: NODE_TYPES.FOLDER,
        path: '/GitHub',
        source: SOURCE_TYPES.GITHUB,
        children: githubChildren
      });
    }

    return rootChildren;
  }

  async getRecentFiles(limit = 10) {
    const { documents = [] } = { documents: this.documents };

    // Include both local and GitHub documents in recent files
    const allDocuments = documents.map(doc => ({
      ...doc,
      // Add display path for GitHub documents
      displayPath: doc.repository_type === 'github_repo' && doc.folder_path
        ? doc.folder_path.replace(/^\/GitHub\//, 'GitHub/')
        : doc.folder_path || 'Documents',
      // Add source indicator
      source: doc.repository_type === 'github_repo' ? 'GitHub' : 'Local'
    }));

    // Sort by updated_at descending
    return allDocuments
      .filter(doc => doc.updated_at)
      .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
      .slice(0, limit);
  }

  async getFileContent(fileNode) {
    const { documents = [] } = { documents: this.documents, categories: this.categories };
    const document = documents.find(doc => doc.id === fileNode.documentId);
    return document?.content || '';
  }

  async searchFiles(query) {
    const { documents = [] } = { documents: this.documents, categories: this.categories };

    // Include both local and GitHub documents in search
    const allDocuments = documents;
    const lowercaseQuery = query.toLowerCase();

    return allDocuments
      .filter(doc =>
        doc.name.toLowerCase().includes(lowercaseQuery) ||
        (doc.content && doc.content.toLowerCase().includes(lowercaseQuery))
      )
      .map(doc => {
        let path;
        if (doc.repository_type === 'github_repo') {
          // GitHub document path
          path = doc.folder_path ? `${doc.folder_path}/${doc.name}` : `/GitHub/${doc.name}`;
        } else {
          // Local document path
          path = `/Documents/${doc.category}/${doc.name}`;
        }

        return {
          id: doc.id,
          name: doc.name,
          type: NODE_TYPES.FILE,
          path: path,
          source: doc.repository_type === 'github_repo' ? SOURCE_TYPES.GITHUB : SOURCE_TYPES.LOCAL,
          documentId: doc.id,
          category: doc.category,
          lastModified: doc.updated_at ? new Date(doc.updated_at) : null,
          size: doc.content ? doc.content.length : 0
        };
      });
  }

  async getStats() {
    const { documents = [], categories = [] } = { documents: this.documents, categories: this.categories };

    // Include both local and GitHub documents in stats
    const _localDocuments = documents.filter(doc => doc.repository_type !== 'github_repo');
    const githubDocuments = documents.filter(doc => doc.repository_type === 'github_repo');

    // Count unique GitHub repos
    const githubRepos = new Set();
    githubDocuments.forEach(doc => {
      if (doc.folder_path && doc.folder_path.startsWith('/GitHub/')) {
        const parts = doc.folder_path.split('/').filter(p => p);
        if (parts.length >= 3) {
          githubRepos.add(`${parts[1]}/${parts[2]}`);
        }
      }
    });

    return {
      totalFiles: documents.length,
      totalFolders: categories.length + githubRepos.size,
      totalSize: documents.reduce((sum, doc) => sum + (doc.content?.length || 0), 0)
    };
  }

  async getFilesInPath(path) {
    const { documents = [], categories = [] } = { documents: this.documents, categories: this.categories };

    // Ensure 'General' category exists
    const safeCategories = categories.includes('General')
      ? categories
      : ['General', ...categories.filter(c => c !== 'General')];

    if (path === '/') {
      // Root level - return Documents and GitHub folders
      const rootChildren = [];

      // Add Documents folder
      const _localDocuments = documents.filter(doc => doc.repository_type !== 'github_repo');
      if (_localDocuments.length > 0 || safeCategories.length > 0) {
        rootChildren.push({
          id: 'documents-root',
          name: 'Documents',
          type: NODE_TYPES.FOLDER,
          path: '/Documents',
          source: SOURCE_TYPES.LOCAL
        });
      }

      // Add GitHub folder
      const githubDocuments = documents.filter(doc => doc.repository_type === 'github_repo');
      if (githubDocuments.length > 0) {
        rootChildren.push({
          id: 'github-root',
          name: 'GitHub',
          type: NODE_TYPES.FOLDER,
          path: '/GitHub',
          source: SOURCE_TYPES.GITHUB
        });
      }

      return rootChildren;
    }

    if (path === '/Documents') {
      // Documents root - return category folders
      return safeCategories.map(category => ({
        id: `category-${category}`,
        name: category,
        type: NODE_TYPES.FOLDER,
        path: `/Documents/${category}`,
        source: SOURCE_TYPES.LOCAL,
        category: category
      }));
    }

    if (path.startsWith('/Documents/')) {
      // Inside a category folder - return documents
      const category = path.split('/')[2];
      const localDocuments = documents.filter(doc => doc.repository_type !== 'github_repo' && doc.category === category);

      return localDocuments.map(doc => ({
        id: doc.id,
        name: doc.name,
        type: NODE_TYPES.FILE,
        path: `/Documents/${category}/${doc.name}`,
        source: SOURCE_TYPES.LOCAL,
        documentId: doc.id,
        category: category,
        lastModified: doc.updated_at ? new Date(doc.updated_at) : null,
        size: doc.content ? doc.content.length : 0
      }));
    }

    if (path === '/GitHub') {
      // GitHub root - return owner/repo folders
      const githubDocuments = documents.filter(doc => doc.repository_type === 'github_repo');
      const githubFolders = {};

      githubDocuments.forEach(doc => {
        if (doc.folder_path && doc.folder_path.startsWith('/GitHub/')) {
          const parts = doc.folder_path.split('/').filter(p => p);
          if (parts.length >= 2) {
            const owner = parts[1];
            const repo = parts[2];
            const key = `${owner}/${repo}`;

            if (!githubFolders[key]) {
              githubFolders[key] = {
                owner,
                repo,
                documents: []
              };
            }
            githubFolders[key].documents.push(doc);
          }
        }
      });

      return Object.values(githubFolders).map(folder => ({
        id: `github-${folder.owner}-${folder.repo}`,
        name: `${folder.owner}/${folder.repo}`,
        type: NODE_TYPES.FOLDER,
        path: `/GitHub/${folder.owner}/${folder.repo}`,
        source: SOURCE_TYPES.GITHUB
      }));
    }

    if (path.startsWith('/GitHub/')) {
      // Inside a GitHub repo folder - return documents
      const pathParts = path.split('/').filter(p => p);
      if (pathParts.length >= 2) {
        const owner = pathParts[1];
        const repo = pathParts[2];
        const expectedPath = `/GitHub/${owner}/${repo}`;

        if (path === expectedPath) {
          const githubDocuments = documents.filter(doc =>
            doc.repository_type === 'github_repo' &&
            doc.folder_path === expectedPath
          );

          return githubDocuments.map(doc => ({
            id: doc.id,
            name: doc.name,
            type: NODE_TYPES.FILE,
            path: `${expectedPath}/${doc.name}`,
            source: SOURCE_TYPES.GITHUB,
            documentId: doc.id,
            lastModified: doc.updated_at ? new Date(doc.updated_at) : null,
            size: doc.content ? doc.content.length : 0
          }));
        }
      }
    }

    return [];
  }
}

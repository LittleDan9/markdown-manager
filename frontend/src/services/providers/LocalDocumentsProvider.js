/**
 * Local documents provider - adapts existing document/category system
 */

import { BaseFileBrowserProvider } from './BaseFileBrowserProvider.js';
import { NODE_TYPES, SOURCE_TYPES } from '../../types/FileBrowserTypes.js';

/**
 * Local documents provider - adapts existing document/category system
 */
export class LocalDocumentsProvider extends BaseFileBrowserProvider {
  constructor(documentContext, config = {}) {
    super(config);
    this.documentContext = documentContext;
  }

  getDisplayName() {
    return 'Documents';
  }

  getDefaultPath() {
    return '/Documents';
  }

  async getTreeStructure() {
    const { documents = [], categories = [] } = this.documentContext;

    // Filter out GitHub documents - only show local documents
    const localDocuments = documents.filter(doc => doc.repository_type !== 'github');

    // Ensure 'General' category exists
    const safeCategories = categories.includes('General')
      ? categories
      : ['General', ...categories.filter(c => c !== 'General')];

    // Create a root "Documents" folder containing all categories
    return [{
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
    }];
  }

  async getFilesInPath(path) {
    const { documents = [] } = this.documentContext;

    // Filter out GitHub documents - only show local documents
    const localDocuments = documents.filter(doc => doc.repository_type !== 'github');

    // Parse path to determine level
    const pathParts = path.split('/').filter(p => p);

    if (pathParts.length === 0) {
      // Root path - return Documents folder
      return [{
        id: 'documents-root',
        name: 'Documents',
        type: NODE_TYPES.FOLDER,
        path: '/Documents',
        source: SOURCE_TYPES.LOCAL
      }];
    } else if (pathParts.length === 1 && pathParts[0] === 'Documents') {
      // Documents folder - return categories as folders
      const { categories = [] } = this.documentContext;
      const safeCategories = categories.includes('General')
        ? categories
        : ['General', ...categories.filter(c => c !== 'General')];

      return safeCategories.map(category => ({
        id: `category-${category}`,
        name: category,
        type: NODE_TYPES.FOLDER,
        path: `/Documents/${category}`,
        source: SOURCE_TYPES.LOCAL,
        category: category
      }));
    } else if (pathParts.length === 2 && pathParts[0] === 'Documents') {
      // Category level - return documents in category
      const category = pathParts[1];
      return localDocuments
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
        }));
    }

    return [];
  }

  async getFileContent(fileNode) {
    const { documents = [] } = this.documentContext;
    const document = documents.find(doc => doc.id === fileNode.documentId);
    return document?.content || '';
  }

  async searchFiles(query) {
    const { documents = [] } = this.documentContext;

    // Filter out GitHub documents - only search local documents
    const localDocuments = documents.filter(doc => doc.repository_type !== 'github');
    const lowercaseQuery = query.toLowerCase();

    return localDocuments
      .filter(doc =>
        doc.name.toLowerCase().includes(lowercaseQuery) ||
        (doc.content && doc.content.toLowerCase().includes(lowercaseQuery))
      )
      .map(doc => ({
        id: doc.id,
        name: doc.name,
        type: NODE_TYPES.FILE,
        path: `/Documents/${doc.category}/${doc.name}`,
        source: SOURCE_TYPES.LOCAL,
        documentId: doc.id,
        category: doc.category,
        lastModified: doc.updated_at ? new Date(doc.updated_at) : null,
        size: doc.content ? doc.content.length : 0
      }));
  }

  async getStats() {
    const { documents = [], categories = [] } = this.documentContext;

    // Filter out GitHub documents - only count local documents
    const localDocuments = documents.filter(doc => doc.repository_type !== 'github');

    return {
      totalFiles: localDocuments.length,
      totalFolders: categories.length,
      totalSize: localDocuments.reduce((sum, doc) => sum + (doc.content?.length || 0), 0)
    };
  }
}

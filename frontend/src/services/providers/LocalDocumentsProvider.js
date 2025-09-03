/**
 * Local documents provider - adapts existing document/category system
 */

import { BaseFileBrowserProvider } from './BaseFileBrowserProvider.js';
import { NODE_TYPES, SOURCE_TYPES } from '../../types/FileBrowserTypes.js';

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

  async searchFiles(query) {
    const { documents = [] } = this.documentContext;
    const lowercaseQuery = query.toLowerCase();
    
    return documents
      .filter(doc => 
        doc.name.toLowerCase().includes(lowercaseQuery) ||
        (doc.content && doc.content.toLowerCase().includes(lowercaseQuery))
      )
      .map(doc => ({
        id: doc.id,
        name: doc.name,
        type: NODE_TYPES.FILE,
        path: `/${doc.category}/${doc.name}`,
        source: SOURCE_TYPES.LOCAL,
        documentId: doc.id,
        category: doc.category,
        lastModified: doc.updated_at ? new Date(doc.updated_at) : null,
        size: doc.content ? doc.content.length : 0
      }));
  }

  async getStats() {
    const { documents = [], categories = [] } = this.documentContext;
    
    return {
      totalFiles: documents.length,
      totalFolders: categories.length,
      totalSize: documents.reduce((sum, doc) => sum + (doc.content?.length || 0), 0)
    };
  }
}

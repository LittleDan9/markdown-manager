/**
 * Unified File Opening Logic - Single pattern for all document types
 *
 * Replaces the branching logic between local and GitHub documents
 * wit            if (response.data) {
              console.log('🔍 Document existence check result:', response.data);

              if (response.data.exists) {
                console.log('📄 Found existing document via API:', response.data.document_id);
                return await this.openDocument(response.data.document_id);
              } else {
                console.log('🔍 Document does not exist via API, trying manual search...');
              }
            } else {
              console.log('🔍 Check endpoint failed, falling back to manual search...');, consistent file opening pattern.
 */

import { useState, useCallback } from 'react';
import documentsApi from '../../api/documentsApi.js';

/**
 * Unified file opening service - handles all document types with single API call
 */
export class UnifiedFileOpeningService {

  /**
   * Open any document by ID - handles local/GitHub/future types transparently
   *
   * @param {number} documentId - Document database ID
   * @param {object} options - Optional parameters
   * @returns {Promise<object>} - Opened document with content
   */
  static async openDocument(documentId, options = {}) {
    const {
      forceSync = false,  // Force sync for GitHub documents
      markAsOpened = true  // Mark as recently opened
    } = options;

    try {
      console.log(`Opening document ${documentId} (unified approach)`);

      // SINGLE API CALL - backend determines source type and handles accordingly
      const document = await documentsApi.getDocument(documentId, { force_sync: forceSync });

      // Mark as recently opened if requested
      if (markAsOpened) {
        await documentsApi.markDocumentOpened(documentId);
      }

      console.log(`Document ${documentId} opened successfully:`, {
        name: document.name,
        type: document.repository_type,
        hasContent: !!document.content,
        syncStatus: document.github_sync_status
      });

      return document;

    } catch (error) {
      console.error(`Failed to open document ${documentId}:`, error);
      throw new Error(`Unable to open document: ${error.message}`);
    }
  }

  /**
   * Open document from file browser node
   *
   * @param {object} fileNode - File node from file browser
   * @param {object} dataProvider - File browser provider (for GitHub direct browsing)
   * @returns {Promise<object>} - Opened document
   */
  static async openFromFileNode(fileNode, dataProvider = null) {
    // Handle GitHub files that are browsed directly (no documentId)
    if (!fileNode.documentId && fileNode._githubFile && dataProvider) {
      return await this.openGitHubFileDirect(fileNode, dataProvider);
    }

    // Handle regular documents with IDs
    if (!fileNode.documentId) {
      throw new Error('File node missing document ID and not a direct GitHub file');
    }

    return await this.openDocument(fileNode.documentId, {
      forceSync: fileNode.source === 'github' // Auto-sync GitHub documents
    });
  }

  /**
   * Open GitHub file by importing it as a proper document (UNIFIED APPROACH)
   *
   * @param {object} fileNode - GitHub file node
   * @param {object} dataProvider - GitHub file browser provider
   * @returns {Promise<object>} - Real document with database ID
   */
  static async openGitHubFileDirect(fileNode, dataProvider) {
    try {
      console.log('🔄 Importing GitHub file as document:', fileNode.name);

      // Import the file as a proper document
      const repositoryId = dataProvider.sourceConfig?.repositoryId;
      const branch = dataProvider.sourceConfig?.branch || 'main';
      const filePath = fileNode._githubFile.path;

      if (!repositoryId) {
        throw new Error('Repository ID not available');
      }

      console.log('📥 Importing GitHub file:', {
        repositoryId,
        filePath,
        branch
      });

      // Import using existing GitHub API
      const gitHubApi = (await import('../../api/gitHubApi.js')).default;
      const importResult = await gitHubApi.importRepositoryFile(repositoryId, filePath, branch);

      console.log('✅ GitHub import response:', importResult);
      console.log('🔍 Import results structure:', {
        imported: importResult.results?.imported?.length || 0,
        errors: importResult.results?.errors?.length || 0,
        updated: importResult.results?.updated?.length || 0
      });

      // Check if document was newly imported
      if (importResult.results?.imported && importResult.results.imported.length > 0) {
        const documentId = importResult.results.imported[0].document_id;
        console.log('📄 Opening newly imported document:', documentId);
        return await this.openDocument(documentId);
      }

      // Check if document already exists (in errors with "already exists" message)
      console.log('🔍 Checking for existing document errors...');
      if (importResult.results?.errors && importResult.results.errors.length > 0) {
        console.log('🔍 Found errors in import result:', importResult.results.errors);
        const existingError = importResult.results.errors.find(err =>
          err.error && err.error.includes('already exists')
        );

        console.log('🔍 Existing error found:', existingError);
        if (existingError) {
          console.log('📄 Document already exists, finding existing document:', existingError.file);

          // Use the dedicated GitHub document existence check API
          console.log('🔍 Checking if GitHub document exists via API...');

          try {
            // First, try the dedicated check endpoint if it exists
            // Use authenticated API service instead of manual fetch
            const { Api } = await import('../../api/api.js');
            const api = new Api();

            const response = await api.apiCall('/github/files/check-document-exists?' + new URLSearchParams({
              repository_id: repositoryId,
              file_path: filePath,
              branch: fileNode.branch || 'main'
            }), 'GET');

            if (response.ok) {
              const checkResult = await response.json();
              console.log('🔍 Document existence check result:', checkResult);

              if (checkResult.exists) {
                console.log('� Found existing document via API:', checkResult.document_id);
                return await this.openDocument(checkResult.document_id);
              }
            } else {
              console.log('🔍 Check endpoint failed, falling back to manual search...');

              // Fallback: Search through all documents manually
              const documentsApi = (await import('../../api/documentsApi.js')).default;
              const allDocuments = await documentsApi.getAllDocuments();

              console.log('� Searching through documents:', allDocuments.length);
              console.log('🔍 Looking for repository_id:', repositoryId, 'filePath:', filePath);

              const existingDoc = allDocuments.find(doc => {
                console.log('🔍 Checking document:', {
                  id: doc.id,
                  repository_type: doc.repository_type,
                  github_file_path: doc.github_file_path,
                  github_repository_id: doc.github_repository_id,
                  github_branch: doc.github_branch
                });
                return doc.repository_type === 'github' &&
                       doc.github_file_path === filePath &&
                       doc.github_repository_id === repositoryId;
              });

              if (existingDoc) {
                console.log('📄 Found existing document via manual search:', existingDoc.id);
                return await this.openDocument(existingDoc.id);
              }
            }
          } catch (error) {
            console.error('🔍 Error checking document existence:', error);
          }

          console.log('❌ No existing document found');
        }
      }

      // If we couldn't find the existing document, try importing with overwrite_existing: true
      console.log('🔄 Trying to import with overwrite_existing: true...');
      try {
        const overwriteResult = await gitHubApi.importRepositoryFiles(repositoryId, {
          branch,
          file_paths: [filePath],
          overwrite_existing: true
        });

        console.log('✅ Overwrite import response:', overwriteResult);

        // Check if document was imported/updated after overwrite
        if (overwriteResult.results?.imported && overwriteResult.results.imported.length > 0) {
          const documentId = overwriteResult.results.imported[0].document_id;
          console.log('📄 Opening overwrite-imported document:', documentId);
          return await this.openDocument(documentId);
        }

        if (overwriteResult.results?.updated && overwriteResult.results.updated.length > 0) {
          const documentId = overwriteResult.results.updated[0].document_id;
          console.log('📄 Opening overwrite-updated document:', documentId);
          return await this.openDocument(documentId);
        }
      } catch (overwriteError) {
        console.error('Failed to import with overwrite:', overwriteError);
      }

      throw new Error(`Unable to find or import GitHub file: ${JSON.stringify(importResult)}`);

    } catch (error) {
      console.error('Failed to open GitHub file directly:', error);
      throw new Error(`Unable to open GitHub file: ${error.message}`);
    }
  }

  /**
   * Open document with error handling and user feedback
   *
   * @param {number} documentId - Document ID
   * @param {function} onSuccess - Success callback
   * @param {function} onError - Error callback
   * @param {object} options - Opening options
   */
  static async openDocumentWithFeedback(documentId, onSuccess, onError = null, options = {}) {
    try {
      const document = await this.openDocument(documentId, options);
      onSuccess(document);
    } catch (error) {
      console.error('Document opening failed:', error);
      if (onError) {
        onError(error);
      } else {
        // Default error handling
        alert(`Failed to open document: ${error.message}`);
      }
    }
  }
}

/**
 * React hook for unified document opening
 */
export function useUnifiedFileOpening() {
  const [isOpening, setIsOpening] = useState(false);
  const [lastError, setLastError] = useState(null);

  const openDocument = useCallback(async (documentId, options = {}) => {
    setIsOpening(true);
    setLastError(null);

    try {
      const document = await UnifiedFileOpeningService.openDocument(documentId, options);
      return document;
    } catch (error) {
      setLastError(error);
      throw error;
    } finally {
      setIsOpening(false);
    }
  }, []);

  const openFromFileNode = useCallback(async (fileNode, dataProvider = null) => {
    setIsOpening(true);
    setLastError(null);

    try {
      const document = await UnifiedFileOpeningService.openFromFileNode(fileNode, dataProvider);
      return document;
    } catch (error) {
      setLastError(error);
      throw error;
    } finally {
      setIsOpening(false);
    }
  }, []);

  return {
    openDocument,
    openFromFileNode,
    isOpening,
    lastError,
    clearError: () => setLastError(null)
  };
}

// For backward compatibility during migration
export default UnifiedFileOpeningService;
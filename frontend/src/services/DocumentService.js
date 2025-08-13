/**
 * Unified Document Service
 * Handles all document operations with direct feedback and robust error handling
 * Uses AuthService directly instead of events
 */

import DocumentStorageService from './DocumentStorageService.js';
import { notification } from './EventDispatchService.js';
import AuthService from './AuthService.js';
import { saveAs } from 'file-saver';

class DocumentService {
  constructor() {
    this.isSaving = false;
    this.saveQueue = new Map(); // Track pending saves by document ID
    this.retryAttempts = new Map(); // Track retry attempts
    this.maxRetries = 3;
  }

  /**
   * Get current auth state from AuthService
   */
  getAuthState() {
    return AuthService.getAuthState();
  }

  /**
   * Save document with immediate feedback and retry logic
   * @param {Object} document - Document to save
   * @param {boolean} showNotification - Whether to show save notifications
   * @returns {Promise<Object>} - Saved document or null on failure
   */
  async saveDocument(document, showNotification = false) {
    if (!document) {
      throw new Error('Document is required');
    }

    // Validate document
    if (!document.name?.trim()) {
      throw new Error('Document name is required');
    }

    // Prevent concurrent saves of the same document
    const saveKey = document.id || 'new';
    if (this.saveQueue.has(saveKey)) {
      return this.saveQueue.get(saveKey);
    }

    // Create save promise
    const savePromise = this._performSave(document, showNotification);
    this.saveQueue.set(saveKey, savePromise);

    try {
      const result = await savePromise;
      this.saveQueue.delete(saveKey);
      this.retryAttempts.delete(saveKey);
      return result;
    } catch (error) {
      this.saveQueue.delete(saveKey);
      throw error;
    }
  }

  async _performSave(document, showNotification) {
    const saveKey = document.id || 'new';

    try {
      // Step 1: Save to localStorage immediately (prevents data loss)
      const localSavedDoc = this._saveToLocalStorage(document);

      // Step 2: Sync to backend if authenticated
      const { isAuthenticated, token } = this.getAuthState();
      if (isAuthenticated && token) {
        try {
          const backendSavedDoc = await this._saveToBackend(localSavedDoc);

          // Step 3: Update localStorage with backend data (ID, timestamps, etc.)
          if (backendSavedDoc && backendSavedDoc.id !== localSavedDoc.id) {
            const finalDoc = this._updateLocalStorageWithBackendData(localSavedDoc, backendSavedDoc);

            if (showNotification) {
              notification.success('Document saved successfully');
            }

            return finalDoc;
          }

          if (showNotification) {
            notification.success('Document saved successfully');
          }

          return backendSavedDoc || localSavedDoc;
        } catch (backendError) {
          // Backend save failed, but local save succeeded
          console.warn('Backend save failed:', backendError);

          // Queue for retry if it's a network error
          if (this._isRetryableError(backendError)) {
            this._queueRetry(localSavedDoc, saveKey);

            if (showNotification) {
              notification.warning('Document saved locally. Will sync when connection is restored.');
            }
          } else {
            if (showNotification) {
              notification.error(`Save to server failed: ${backendError.message}`);
            }
          }

          return localSavedDoc; // Return local document even if backend failed
        }
      } else {
        // Not authenticated - only local save
        if (showNotification) {
          notification.success('Document saved successfully');
        }
      }

      return localSavedDoc;
    } catch (error) {
      console.error('Document save failed:', error);

      if (showNotification) {
        notification.error(`Failed to save document: ${error.message}`);
      }

      throw error;
    }
  }

  _saveToLocalStorage(document) {
    try {
      return DocumentStorageService.saveDocument(document);
    } catch (error) {
      console.error('Local storage save failed:', error);
      throw new Error(`Local save failed: ${error.message}`);
    }
  }

  async _saveToBackend(document) {
    const { isAuthenticated, token } = this.getAuthState();
    if (!isAuthenticated || !token) {
      throw new Error('Not authenticated');
    }

    try {
      const DocumentsApi = (await import('../api/documentsApi.js')).default;

      // Determine if this is a create or update operation
      const isCreate = !document.id || String(document.id).startsWith('doc_');

      if (isCreate) {
        const result = await DocumentsApi.createDocument({
          name: document.name,
          content: document.content,
          category: document.category || 'General'
        });
        return result;
      } else {
        const result = await DocumentsApi.updateDocument(document.id, {
          name: document.name,
          content: document.content,
          category: document.category || 'General'
        });
        return result;
      }
    } catch (error) {
      // Transform API errors into user-friendly messages
      if (error.response?.status === 403) {
        throw new Error('Authentication expired. Please log in again.');
      } else if (error.response?.status === 409) {
        throw new Error('Document name already exists. Please choose a different name.');
      } else if (error.response?.status >= 500) {
        throw new Error('Server error. Please try again later.');
      } else if (!navigator.onLine) {
        throw new Error('No internet connection');
      }

      throw error;
    }
  }

  _updateLocalStorageWithBackendData(localDoc, backendDoc) {
    try {
      // Merge backend data with local document
      const updatedDoc = {
        ...localDoc,
        id: backendDoc.id,
        created_at: backendDoc.created_at,
        updated_at: backendDoc.updated_at,
        // Preserve local content if it's newer
        content: localDoc.content,
        name: localDoc.name,
        category: localDoc.category
      };

      return DocumentStorageService.saveDocument(updatedDoc);
    } catch (error) {
      console.warn('Failed to update local storage with backend data:', error);
      return backendDoc; // Return backend doc if local update fails
    }
  }

  _isRetryableError(error) {
    // Network errors, timeouts, 5xx errors are retryable
    return !navigator.onLine ||
           error.code === 'NETWORK_ERROR' ||
           error.response?.status >= 500 ||
           error.message?.includes('timeout') ||
           error.message?.includes('network');
  }

  _queueRetry(document, saveKey) {
    const attempts = this.retryAttempts.get(saveKey) || 0;

    if (attempts < this.maxRetries) {
      this.retryAttempts.set(saveKey, attempts + 1);

      // Exponential backoff: 2s, 4s, 8s
      const delay = Math.pow(2, attempts + 1) * 1000;

      setTimeout(() => {
        const { isAuthenticated } = this.getAuthState();
        if (isAuthenticated) {
          this.saveDocument(document, false).catch(error => {
            console.warn('Retry save failed:', error);
          });
        }
      }, delay);
    }
  }

  /**
   * Load document by ID
   */
  loadDocument(id) {
    return DocumentStorageService.getDocument(id);
  }

  /**
   * Delete document with backend sync
   */
  async deleteDocument(id, showNotification = true) {
    try {
      // Step 1: Delete from localStorage immediately
      const deletedDoc = DocumentStorageService.deleteDocument(id);

      if (!deletedDoc) {
        throw new Error('Document not found');
      }

      if (showNotification) {
        notification.success('Document deleted');
      }

      // Step 2: Delete from backend if authenticated and document exists on backend
      const { isAuthenticated, token } = this.getAuthState();
      if (isAuthenticated && token && !String(id).startsWith('doc_')) {
        try {
          const DocumentsApi = (await import('../api/documentsApi.js')).default;
          await DocumentsApi.deleteDocument(id);
        } catch (error) {
          console.warn('Backend delete failed:', error);
          // Don't show error to user since local delete succeeded
        }
      }

      return deletedDoc;
    } catch (error) {
      if (showNotification) {
        notification.error(`Failed to delete document: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get all documents
   */
  getAllDocuments() {
    return DocumentStorageService.getAllDocuments();
  }

  /**
   * Create new document
   */
  createNewDocument() {
    // Generate a unique untitled name
    const untitledBase = 'Untitled Document';
    const allDocs = this.getAllDocuments();
    const regex = new RegExp(`^${untitledBase}(?: (\\d+))?$`);
    const counts = allDocs
      .map(d => {
        const m = d.name.match(regex);
        return m ? (m[1] ? parseInt(m[1], 10) : 1) : null;
      })
      .filter(n => n !== null);
    const max = counts.length > 0 ? Math.max(...counts) : 0;
    const newName = max === 0 ? untitledBase : `${untitledBase} ${max + 1}`;

    return {
      id: null,
      name: newName,
      category: 'General',
      content: ''
    };
  }

  /**
   * Trigger full sync with backend
   */
  async syncWithBackend() {
    const { isAuthenticated, token } = this.getAuthState();
    if (!isAuthenticated || !token) {
      throw new Error('Not authenticated');
    }

    try {
      const DocumentsApi = (await import('../api/documentsApi.js')).default;

      // Get backend documents
      const backendDocs = await DocumentsApi.getAllDocuments();
      const localDocs = DocumentStorageService.getAllDocuments();

      // Simple merge strategy: backend wins for conflicts
      const mergedDocs = new Map();

      // Add all backend docs
      backendDocs.forEach(doc => mergedDocs.set(doc.id, doc));

      // Add local-only docs (those with temporary IDs)
      localDocs.forEach(doc => {
        if (!doc.id || String(doc.id).startsWith('doc_')) {
          // This is a local-only document, we'll save it to backend
          mergedDocs.set(doc.id || `temp_${Date.now()}`, doc);
        }
      });

      // Update localStorage with merged documents
      DocumentStorageService.bulkUpdateDocuments(Array.from(mergedDocs.values()));

      // Save local-only documents to backend
      const savePromises = [];
      mergedDocs.forEach(doc => {
        if (!doc.id || String(doc.id).startsWith('doc_')) {
          savePromises.push(this.saveDocument(doc, false));
        }
      });

      await Promise.all(savePromises);

      notification.success('Documents synchronized successfully');

      return {
        success: true,
        syncedCount: savePromises.length,
        totalCount: mergedDocs.size
      };
    } catch (error) {
      console.error('Full sync failed:', error);
      notification.error(`Sync failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Export document as Markdown file
   * @param {string} content - Document content
   * @param {string} filename - Optional filename (uses current document name if not provided)
   */
  exportAsMarkdown(content, filename = null) {
    try {
      const name = filename || 'document';
      const fileName = name.endsWith('.md') ? name : `${name}.md`;
      const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
      saveAs(blob, fileName);

      notification.success(`Document exported as ${fileName}`);
    } catch (error) {
      console.error('Markdown export failed:', error);
      notification.error('Failed to export document');
      throw error;
    }
  }

  /**
   * Export document as PDF
   * @param {string} htmlContent - Rendered HTML content
   * @param {string} filename - Optional filename
   * @param {string} theme - Theme ('light' or 'dark')
   */
  async exportAsPDF(htmlContent, filename = null, theme = 'light') {
    try {
      const documentName = filename || 'document';
      const isDark = theme === 'dark';

      const DocumentsApi = (await import('../api/documentsApi.js')).default;
      const pdfBlob = await DocumentsApi.exportAsPDF(htmlContent, documentName, isDark);

      const url = window.URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = documentName.endsWith('.pdf') ? documentName : `${documentName}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      notification.success(`Document exported as ${link.download}`);
    } catch (error) {
      console.error('PDF export failed:', error);
      notification.error('PDF export failed');
      throw error;
    }
  }

  /**
   * Import Markdown file
   * @param {File} file - File object to import
   * @returns {Promise<Object>} - Object with content and name
   */
  importMarkdownFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const content = e.target.result;
          const name = file.name.replace(/\.md$/, '');
          resolve({ content, name });
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  /**
   * Clear all document state (for logout scenarios)
   * This should be called when user authentication is lost
   */
  clearDocumentState() {
    try {
      DocumentStorageService.clearAllData();

      // Clear any pending saves
      this.saveQueue.clear();
      this.retryAttempts.clear();

      return true;
    } catch (error) {
      console.error('Failed to clear document state:', error);
      return false;
    }
  }

  /**
   * Get save queue status (for debugging)
   */
  getSaveStatus() {
    const { isAuthenticated } = this.getAuthState();
    return {
      pendingSaves: this.saveQueue.size,
      retryAttempts: Array.from(this.retryAttempts.entries()),
      isAuthenticated
    };
  }
}

export default new DocumentService();

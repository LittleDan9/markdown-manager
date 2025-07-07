

import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import config from './config.js';
import authManager from './auth.js';

// Constants for local storage keys
const DOCUMENTS_KEY = 'savedDocuments';
const CURRENT_DOC_KEY = 'currentDocument';
const AUTO_SAVE_KEY = 'autoSaveEnabled';
const CATEGORIES_KEY = 'documentCategories';

// Default category
const DEFAULT_CATEGORY = 'General';

// Export the constant for use in other modules
export { DEFAULT_CATEGORY };

/**
 * Document Manager Class
 * Handles saving, loading, and managing documents with hybrid storage:
 * - API for authenticated users
 * - localStorage for anonymous users
 */
export class DocumentManager {
    // Delete a category (local or backend). Reassigns docs to 'General'.
    deleteCategory(category) {
        if (!category || category.trim().toLowerCase() === 'general') return Promise.resolve(false);
        if (this.isAuthenticated()) {
            // Backend: call API
            return fetch('/api/v1/documents/categories/' + encodeURIComponent(category), {
                method: 'DELETE',
                headers: this.getAuthHeaders(),
            })
            .then(res => {
                if (!res.ok) throw new Error('Failed to delete category');
                return this.getAllCategories().then(cats => { this.categories = cats; return true; });
            })
            .catch(e => {
                console.error('deleteCategory (backend) failed:', e);
                return false;
            });
        } else {
            // Local: update categories and reassign docs
            const idx = this.categories.indexOf(category);
            if (idx === -1) return Promise.resolve(false);
            this.categories.splice(idx, 1);
            // Reassign docs
            Object.values(this.documents).forEach(doc => {
                if (doc.category === category) doc.category = 'General';
            });
            this.saveCategories();
            this.saveDocuments();
            return Promise.resolve(true);
        }
    }
    constructor() {
        this.authManager = authManager;
        this.documents = this.loadDocuments();
        this.currentDocument = this.loadCurrentDocument();
        this.autoSaveEnabled = this.getAutoSavePreference();
        this.categories = this.loadCategories();

        // Initialize beforeunload handler
        this.initBeforeUnloadHandler();
    }

    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        return this.authManager.isAuthenticated();
    }

    /**
     * Get authentication headers for API requests
     */
    getAuthHeaders() {
        if (!this.isAuthenticated()) {
            return {};
        }
        return {
            'Authorization': `Bearer ${this.authManager.getToken()}`,
            'Content-Type': 'application/json'
        };
    }

    /**
     * Load all saved documents from localStorage
     */
    loadDocuments() {
        try {
            const docs = localStorage.getItem(DOCUMENTS_KEY);
            return docs ? JSON.parse(docs) : {};
        } catch (error) {
            console.error('Error loading documents:', error);
            return {};
        }
    }

    /**
     * Save documents to localStorage
     */
    saveDocuments() {
        try {
            localStorage.setItem(DOCUMENTS_KEY, JSON.stringify(this.documents));
        } catch (error) {
            console.error('Error saving documents:', error);
        }
    }

    /**
     * Load current document info from localStorage
     */
    loadCurrentDocument() {
        try {
            const current = localStorage.getItem(CURRENT_DOC_KEY);
            const parsed = current ? JSON.parse(current) : { id: null, name: 'Untitled Document', category: DEFAULT_CATEGORY };
            // Ensure category exists
            if (!parsed.category) {
                parsed.category = DEFAULT_CATEGORY;
            }
            return parsed;
        } catch (error) {
            console.error('Error loading current document:', error);
            return { id: null, name: 'Untitled Document', category: DEFAULT_CATEGORY };
        }
    }

    /**
     * Save current document info to localStorage
     */
    saveCurrentDocument() {
        try {
            localStorage.setItem(CURRENT_DOC_KEY, JSON.stringify(this.currentDocument));
        } catch (error) {
            console.error('Error saving current document:', error);
        }
    }

    /**
     * Get auto-save preference
     */
    getAutoSavePreference() {
        const pref = localStorage.getItem(AUTO_SAVE_KEY);
        return pref !== null ? JSON.parse(pref) : true;
    }

    /**
     * Set auto-save preference
     */
    setAutoSavePreference(enabled) {
        this.autoSaveEnabled = enabled;
        localStorage.setItem(AUTO_SAVE_KEY, JSON.stringify(enabled));
    }

    /**
     * Load categories from localStorage
     */
    loadCategories() {
        try {
            const categories = localStorage.getItem(CATEGORIES_KEY);
            const parsed = categories ? JSON.parse(categories) : [DEFAULT_CATEGORY];
            // Ensure default category always exists
            if (!parsed.includes(DEFAULT_CATEGORY)) {
                parsed.unshift(DEFAULT_CATEGORY);
            }
            return parsed;
        } catch (error) {
            console.error('Error loading categories:', error);
            return [DEFAULT_CATEGORY];
        }
    }

    /**
     * Save categories to localStorage
     */
    saveCategories() {
        try {
            localStorage.setItem(CATEGORIES_KEY, JSON.stringify(this.categories));
        } catch (error) {
            console.error('Error saving categories:', error);
        }
    }

    /**
     * Add a new category
     */
    addCategory(categoryName) {
        const trimmedName = categoryName.trim();
        if (!trimmedName) {
            console.warn('addCategory: empty or whitespace-only name');
            return false;
        }
        if (this.categories.includes(trimmedName)) {
            console.warn('addCategory: duplicate name:', trimmedName);
            return false;
        }
        this.categories.push(trimmedName);
        this.categories.sort((a, b) => {
            // Keep 'General' first
            if (a === DEFAULT_CATEGORY) return -1;
            if (b === DEFAULT_CATEGORY) return 1;
            return a.localeCompare(b);
        });
        this.saveCategories();
        console.info('addCategory: added', trimmedName, 'categories now:', this.categories);
        return true;
    }

    /**
     * Get all categories (hybrid: API for authenticated users, localStorage for anonymous)
     */
    async getAllCategories() {
        try {
            if (this.isAuthenticated()) {
                // Fetch from server for authenticated users
                const serverCategories = await this.getCategoriesFromServer();
                // Ensure we always return an array
                return Array.isArray(serverCategories) ? serverCategories : [DEFAULT_CATEGORY];
            } else {
                // Use localStorage for anonymous users
                return [...this.categories];
            }
        } catch (error) {
            console.error('Error getting categories:', error);
            // Fallback to localStorage
            return [...this.categories];
        }
    }

    /**
     * Get documents grouped by category
     */
    getDocumentsByCategory() {
        const allDocs = Object.values(this.documents);
        const grouped = {};

        // Initialize all categories
        this.categories.forEach(category => {
            grouped[category] = [];
        });

        // Group documents by category
        allDocs.forEach(doc => {
            const category = doc.category || DEFAULT_CATEGORY;
            if (!grouped[category]) {
                grouped[category] = [];
            }
            grouped[category].push(doc);
        });

        // Sort documents within each category by last modified
        Object.keys(grouped).forEach(category => {
            grouped[category].sort((a, b) =>
                new Date(b.lastModified) - new Date(a.lastModified)
            );
        });

        return grouped;
    }

    /**
     * Generate a unique ID for documents
     */
    generateId() {
        return 'doc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Save a document (hybrid: API for authenticated users, localStorage for anonymous)
     */
    async saveDocument(content, name = null, id = null, category = null) {
        try {
            // Use provided name or current document name
            const docName = name || this.currentDocument.name || 'Untitled Document';

            // Use provided category or default category
            const docCategory = category || this.currentDocument.category || DEFAULT_CATEGORY;

            if (this.isAuthenticated()) {
                // Save to server for authenticated users
                const serverDocId = typeof id === 'string' && id.startsWith('doc_') ? null : id;
                const savedDocument = await this.saveDocumentToServer(
                    content, docName, docCategory, serverDocId
                );

                // Update current document reference
                this.currentDocument = {
                    id: savedDocument.id,
                    name: savedDocument.name,
                    category: savedDocument.category
                };
                this.saveCurrentDocument();

                return savedDocument;
            } else {
                // Use localStorage for anonymous users
                const docId = id || this.currentDocument.id || this.generateId();

                // Ensure category exists in our categories list
                if (!this.categories.includes(docCategory)) {
                    this.addCategory(docCategory);
                }

                const document = {
                    id: docId,
                    name: docName,
                    content: content,
                    category: docCategory,
                    lastModified: new Date().toISOString(),
                    created: this.documents[docId]?.created || new Date().toISOString()
                };

                this.documents[docId] = document;
                this.currentDocument = { id: docId, name: docName, category: docCategory };

                this.saveDocuments();
                this.saveCurrentDocument();

                return document;
            }
        } catch (error) {
            console.error('Error saving document:', error);
            throw error;
        }
    }

    /**
     * Load a document by ID (hybrid: API for authenticated users, localStorage for anonymous)
     */
    async loadDocument(id) {
        try {
            if (this.isAuthenticated()) {
                // Load from server for authenticated users
                const document = await this.loadDocumentFromServer(id);
                this.currentDocument = {
                    id: document.id,
                    name: document.name,
                    category: document.category || DEFAULT_CATEGORY
                };
                this.saveCurrentDocument();
                return document;
            } else {
                // Load from localStorage for anonymous users
                const document = this.documents[id];
                if (document) {
                    this.currentDocument = {
                        id: document.id,
                        name: document.name,
                        category: document.category || DEFAULT_CATEGORY
                    };
                    this.saveCurrentDocument();
                    return document;
                }
                throw new Error('Document not found');
            }
        } catch (error) {
            console.error('Error loading document:', error);
            throw error;
        }
    }

    /**
     * Delete a document (hybrid: API for authenticated users, localStorage for anonymous)
     */
    async deleteDocument(id) {
        try {
            if (this.isAuthenticated()) {
                // Delete from server for authenticated users
                const success = await this.deleteDocumentFromServer(id);
                if (success && this.currentDocument.id == id) {
                    this.currentDocument = { id: null, name: 'Untitled Document', category: DEFAULT_CATEGORY };
                    this.saveCurrentDocument();
                }
                return success;
            } else {
                // Delete from localStorage for anonymous users
                if (this.documents[id]) {
                    delete this.documents[id];
                    this.saveDocuments();

                    // If we deleted the current document, reset to untitled
                    if (this.currentDocument.id === id) {
                        this.currentDocument = { id: null, name: 'Untitled Document', category: DEFAULT_CATEGORY };
                        this.saveCurrentDocument();
                    }

                    return true;
                }
                return false;
            }
        } catch (error) {
            console.error('Error deleting document:', error);
            throw error;
        }
    }

    /**
     * Get all saved documents, optionally filtered by category (hybrid storage)
     */
    async getAllDocuments(categoryFilter = null) {
        try {
            if (this.isAuthenticated()) {
                // Fetch from server for authenticated users
                const data = await this.fetchDocumentsFromServer(categoryFilter);
                return data.documents || [];
            } else {
                // Use localStorage for anonymous users
                let documents = Object.values(this.documents);

                if (categoryFilter && categoryFilter !== 'All') {
                    documents = documents.filter(doc =>
                        (doc.category || DEFAULT_CATEGORY) === categoryFilter
                    );
                }

                return documents.sort((a, b) =>
                    new Date(b.lastModified) - new Date(a.lastModified)
                );
            }
        } catch (error) {
            console.error('Error getting documents:', error);
            // Fallback to localStorage on error
            let documents = Object.values(this.documents);
            if (categoryFilter && categoryFilter !== 'All') {
                documents = documents.filter(doc =>
                    (doc.category || DEFAULT_CATEGORY) === categoryFilter
                );
            }
            return documents.sort((a, b) =>
                new Date(b.lastModified) - new Date(a.lastModified)
            );
        }
    }

    /**
     * Rename a document
     */
    renameDocument(id, newName, newCategory = null) {
        if (this.documents[id]) {
            this.documents[id].name = newName;
            this.documents[id].lastModified = new Date().toISOString();

            // Update category if provided
            if (newCategory !== null) {
                this.documents[id].category = newCategory;
            }

            if (this.currentDocument.id === id) {
                this.currentDocument.name = newName;
                if (newCategory !== null) {
                    this.currentDocument.category = newCategory;
                }
                this.saveCurrentDocument();
            }

            this.saveDocuments();
            return true;
        }
        return false;
    }

    /**
     * Create a new document
     */
    createNewDocument(name = 'Untitled Document', category = DEFAULT_CATEGORY) {
        this.currentDocument = { id: null, name: name, category: category };
        this.saveCurrentDocument();
        return this.currentDocument;
    }

    /**
     * Export current document as .md file
     */
    exportAsMarkdown(content, filename = null) {
        try {
            const name = filename || this.currentDocument.name || 'document';
            const fileName = name.endsWith('.md') ? name : `${name}.md`;

            const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
            saveAs(blob, fileName);
        } catch (error) {
            console.error('Error exporting markdown:', error);
            throw error;
        }
    }

    /**
     * Export preview as PDF using server-side generation
     */
    async exportAsPDF(filename = null) {
        const previewElement = document.querySelector('#preview .preview-scroll');
        if (!previewElement) {
            throw new Error('Preview element not found');
        }

        // Check if there's actual content
        if (!previewElement.innerHTML.trim()) {
            throw new Error('No content to export. Please add some content to the editor first.');
        }

        // Show sleek loading modal
        const loadingModal = this.showPDFLoadingModal();

        try {
            const documentName = this.currentDocument.name || 'Untitled Document';
            const fileName = filename || documentName;

            // Get current theme (detect dark mode)
            const isDarkMode = document.documentElement.classList.contains('dark-theme') //||
                            //   window.matchMedia('(prefers-color-scheme: dark)').matches;

            // Get the preview content
            const htmlContent = previewElement.innerHTML;

            // Prepare the request payload
            const requestData = {
                html_content: htmlContent,
                document_name: fileName,
                is_dark_mode: isDarkMode
            };

            // Send request to backend PDF export endpoint
            const response = await fetch(`${config.apiBaseUrl}/pdf/export`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || `Server error: ${response.status} ${response.statusText}`);
            }

            // Get the PDF blob
            const pdfBlob = await response.blob();

            // Create download link and trigger download
            const downloadUrl = window.URL.createObjectURL(pdfBlob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Clean up the blob URL
            window.URL.revokeObjectURL(downloadUrl);

            // Hide loading modal
            this.hidePDFLoadingModal(loadingModal);

        } catch (error) {
            this.hidePDFLoadingModal(loadingModal);
            console.error('PDF export failed:', error);
            throw error;
        }
    }

    /**
     * Show sleek PDF loading modal
     */
    showPDFLoadingModal() {
        const modal = document.createElement('div');
        modal.className = 'pdf-loading-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(4px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            animation: fadeIn 0.2s ease-out;
        `;

        const content = document.createElement('div');
        content.style.cssText = `
            background: var(--bs-body-bg, #ffffff);
            border: 1px solid var(--bs-border-color, #dee2e6);
            border-radius: 12px;
            padding: 32px 40px;
            text-align: center;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
            color: var(--bs-body-color, #212529);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 400px;
            animation: slideIn 0.3s ease-out;
        `;

        content.innerHTML = `
            <div style="margin-bottom: 16px; font-size: 48px;">📄</div>
            <h3 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 600;">Preparing PDF Export</h3>
            <p style="margin: 0; color: var(--bs-secondary-color, #6c757d); font-size: 14px;">
                Your document is being prepared for export...
            </p>
            <div style="margin-top: 20px;">
                <div class="spinner-border spinner-border-sm" role="status" style="color: var(--bs-primary, #0d6efd);">
                    <span class="visually-hidden">Loading...</span>
                </div>
            </div>
        `;

        modal.appendChild(content);
        document.body.appendChild(modal);

        // Add CSS animations if not already present
        if (!document.getElementById('pdf-modal-styles')) {
            const style = document.createElement('style');
            style.id = 'pdf-modal-styles';
            style.textContent = `
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes fadeOut {
                    from { opacity: 1; }
                    to { opacity: 0; }
                }
                @keyframes slideIn {
                    from { transform: scale(0.9) translateY(-10px); opacity: 0; }
                    to { transform: scale(1) translateY(0); opacity: 1; }
                }
            `;
            document.head.appendChild(style);
        }

        return modal;
    }

    /**
     * Hide PDF loading modal
     */
    hidePDFLoadingModal(modal) {
        if (modal && modal.parentNode) {
            modal.style.animation = 'fadeOut 0.2s ease-out forwards';
            setTimeout(() => {
                if (modal.parentNode) {
                    modal.parentNode.removeChild(modal);
                }
            }, 200);
        }
    }

    /**
     * Import .md file
     */
    async importMarkdownFile(file) {
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
     * Get document statistics
     */
    getDocumentStats(content) {
        const lines = content.split('\n').length;
        const words = content.trim() ? content.trim().split(/\s+/).length : 0;
        const characters = content.length;
        const charactersNoSpaces = content.replace(/\s/g, '').length;

        return {
            lines,
            words,
            characters,
            charactersNoSpaces
        };
    }

    /**
     * Search documents by content or name
     */
    searchDocuments(query) {
        const searchTerm = query.toLowerCase();
        return Object.values(this.documents).filter(doc =>
            doc.name.toLowerCase().includes(searchTerm) ||
            doc.content.toLowerCase().includes(searchTerm)
        );
    }

    /**
     * API Methods for Server-Side Document Operations
     */

    /**
     * Fetch documents from server
     */
    async fetchDocumentsFromServer(category = null) {
        try {
            const url = new URL(`${config.apiBaseUrl}/documents/`);
            if (category && category !== 'All') {
                url.searchParams.append('category', category);
            }

            const response = await fetch(url, {
                method: 'GET',
                headers: this.getAuthHeaders()
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch documents: ${response.status}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error fetching documents from server:', error);
            throw error;
        }
    }

    /**
     * Save document to server
     */
    async saveDocumentToServer(content, name, category = DEFAULT_CATEGORY, documentId = null) {
        try {
            const documentData = {
                name: name || 'Untitled Document',
                content: content,
                category: category || DEFAULT_CATEGORY
            };

            let response;
            if (documentId) {
                // Update existing document
                response = await fetch(`${config.apiBaseUrl}/documents/${documentId}`, {
                    method: 'PUT',
                    headers: this.getAuthHeaders(),
                    body: JSON.stringify(documentData)
                });
            } else {
                // Create new document
                response = await fetch(`${config.apiBaseUrl}/documents/`, {
                    method: 'POST',
                    headers: this.getAuthHeaders(),
                    body: JSON.stringify(documentData)
                });
            }

            if (!response.ok) {
                throw new Error(`Failed to save document: ${response.status}`);
            }

            const savedDocument = await response.json();
            return savedDocument;
        } catch (error) {
            console.error('Error saving document to server:', error);
            throw error;
        }
    }

    /**
     * Load document from server
     */
    async loadDocumentFromServer(documentId) {
        try {
            const response = await fetch(`${config.apiBaseUrl}/documents/${documentId}`, {
                method: 'GET',
                headers: this.getAuthHeaders()
            });

            if (!response.ok) {
                throw new Error(`Failed to load document: ${response.status}`);
            }

            const document = await response.json();
            return document;
        } catch (error) {
            console.error('Error loading document from server:', error);
            throw error;
        }
    }

    /**
     * Delete document from server
     */
    async deleteDocumentFromServer(documentId) {
        try {
            const response = await fetch(`${config.apiBaseUrl}/documents/${documentId}`, {
                method: 'DELETE',
                headers: this.getAuthHeaders()
            });

            if (!response.ok) {
                throw new Error(`Failed to delete document: ${response.status}`);
            }

            return true;
        } catch (error) {
            console.error('Error deleting document from server:', error);
            throw error;
        }
    }

    /**
     * Get categories from server
     */
    async getCategoriesFromServer() {
        try {
            const response = await fetch(`${config.apiBaseUrl}/documents/categories/`, {
                method: 'GET',
                headers: this.getAuthHeaders()
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch categories: ${response.status}`);
            }

            const categories = await response.json();

            // Ensure we always return an array
            if (Array.isArray(categories)) {
                return categories.length > 0 ? categories : [DEFAULT_CATEGORY];
            } else {
                console.warn('Server returned non-array categories:', categories);
                return [DEFAULT_CATEGORY];
            }
        } catch (error) {
            console.error('Error fetching categories from server:', error);
            return [DEFAULT_CATEGORY];
        }
    }

    /**
     * Migrate localStorage documents to server
     */
    async migrateLocalDocumentsToServer() {
        if (!this.isAuthenticated()) {
            return;
        }

        try {
            const localDocs = Object.values(this.documents);
            const migrationPromises = localDocs.map(async (doc) => {
                try {
                    await this.saveDocumentToServer(doc.content, doc.name, doc.category);
                    console.log(`Migrated document: ${doc.name}`);
                } catch (error) {
                    console.error(`Failed to migrate document ${doc.name}:`, error);
                }
            });

            await Promise.all(migrationPromises);

            // Clear local storage after successful migration
            this.documents = {};
            this.saveDocuments();
            console.log('Local documents migrated to server successfully');
        } catch (error) {
            console.error('Error during document migration:', error);
        }
    }

    /**
     * Handle user login - migrate localStorage documents to server
     */
    async onUserLogin() {
        if (!this.isAuthenticated()) {
            return;
        }

        try {
            // Check if there are any local documents to migrate
            const localDocs = Object.values(this.documents);
            if (localDocs.length > 0) {
                console.log(`Found ${localDocs.length} local documents to migrate`);
                await this.migrateLocalDocumentsToServer();
            }
        } catch (error) {
            console.error('Error during login migration:', error);
        }
    }

    /**
     * Force save current document state to server (if authenticated)
     */
    async forceSaveCurrentDocument() {
        if (!this.isAuthenticated()) {
            return null;
        }

        try {
            // Get current editor content if available
            let currentContent = '';
            if (window.editorInstance && typeof window.editorInstance.getValue === 'function') {
                currentContent = window.editorInstance.getValue();
            }

            // Only save if we have content and a document context
            if (currentContent.trim() || this.currentDocument.id) {
                const currentName = this.currentDocument.name || 'Untitled Document';
                const currentCategory = this.currentDocument.category || DEFAULT_CATEGORY;

                console.log('Force saving current document before logout...');

                const savedDocument = await this.saveDocument(
                    currentContent,
                    currentName,
                    this.currentDocument.id,
                    currentCategory
                );

                console.log('Document force-saved successfully:', savedDocument.name);
                return savedDocument;
            }
        } catch (error) {
            console.error('Error during forced document save:', error);
            throw error;
        }

        return null;
    }

    /**
     * Handle user logout - save current state then clear server data
     */
    async onUserLogout() {
        try {
            // Force save current document state before logout
            await this.forceSaveCurrentDocument();
        } catch (error) {
            console.error('Failed to save document during logout:', error);
            // Continue with logout even if save fails
        }

        // Reset to localStorage mode
        this.documents = this.loadDocuments();
        this.categories = this.loadCategories();
        console.log('User logged out, switched to localStorage mode');
    }

    /**
     * Handle browser/tab close - attempt to save current document
     */
    async onBeforeUnload() {
        if (this.isAuthenticated()) {
            try {
                // Attempt a quick save (non-blocking)
                await this.forceSaveCurrentDocument();
            } catch (error) {
                console.error('Failed to save document before page unload:', error);
            }
        }
    }

    /**
     * Initialize beforeunload handler
     */
    initBeforeUnloadHandler() {
        window.addEventListener('beforeunload', (event) => {
            if (this.isAuthenticated()) {
                // For authenticated users, try to save
                this.onBeforeUnload();

                // Show browser warning for unsaved changes
                event.preventDefault();
                event.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
                return 'You have unsaved changes. Are you sure you want to leave?';
            }
        });
    }
}

// Create singleton instance
export const documentManager = new DocumentManager();

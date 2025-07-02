import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

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
 * Handles saving, loading, and managing documents in localStorage
 */
export class DocumentManager {
    constructor() {
        this.documents = this.loadDocuments();
        this.currentDocument = this.loadCurrentDocument();
        this.autoSaveEnabled = this.getAutoSavePreference();
        this.categories = this.loadCategories();
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
        if (trimmedName && !this.categories.includes(trimmedName)) {
            this.categories.push(trimmedName);
            this.categories.sort((a, b) => {
                // Keep 'General' first
                if (a === DEFAULT_CATEGORY) return -1;
                if (b === DEFAULT_CATEGORY) return 1;
                return a.localeCompare(b);
            });
            this.saveCategories();
            return true;
        }
        return false;
    }

    /**
     * Get all categories
     */
    getAllCategories() {
        return [...this.categories];
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
     * Save a document
     */
    saveDocument(content, name = null, id = null, category = null) {
        try {
            // Use existing ID or generate new one
            const docId = id || this.currentDocument.id || this.generateId();

            // Use provided name or current document name
            const docName = name || this.currentDocument.name || 'Untitled Document';

            // Use provided category or default category
            const docCategory = category || this.documents[docId]?.category || DEFAULT_CATEGORY;

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
        } catch (error) {
            console.error('Error saving document:', error);
            throw error;
        }
    }

    /**
     * Load a document by ID
     */
    loadDocument(id) {
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

    /**
     * Delete a document
     */
    deleteDocument(id) {
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

    /**
     * Get all saved documents, optionally filtered by category
     */
    getAllDocuments(categoryFilter = null) {
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

    /**
     * Rename a document
     */
    renameDocument(id, newName) {
        if (this.documents[id]) {
            this.documents[id].name = newName;
            this.documents[id].lastModified = new Date().toISOString();

            if (this.currentDocument.id === id) {
                this.currentDocument.name = newName;
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
            const isDarkMode = document.documentElement.classList.contains('dark-theme') ||
                              window.matchMedia('(prefers-color-scheme: dark)').matches;

            // Get the preview content
            const htmlContent = previewElement.innerHTML;

            // Prepare the request payload
            const requestData = {
                html_content: htmlContent,
                document_name: fileName,
                is_dark_mode: isDarkMode
            };

            // Send request to backend PDF export endpoint
            const response = await fetch('http://localhost:8001/api/v1/pdf/export', {
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

}

// Create singleton instance
export const documentManager = new DocumentManager();

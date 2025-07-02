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
     * Export preview as PDF with proper text rendering
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

        // Get current theme
        const html = document.documentElement;
        const currentTheme = html.getAttribute('data-bs-theme') || 'light';

        // Show loading indicator
        const loadingNotification = this.showPDFLoadingNotification();

        try {
            // Create PDF with optimized settings
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4',
                compress: true
            });

            // Set background color based on theme
            const backgroundColor = currentTheme === 'dark' ? '#1e1e1e' : '#ffffff';
            pdf.setFillColor(backgroundColor);
            pdf.rect(0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight(), 'F');

            // Get page dimensions
            const pageWidth = pdf.internal.pageSize.getWidth();
            const margin = 15;

            // Use pdf.html() with better settings for emoji and formatting preservation
            await pdf.html(previewElement, {
                callback: (doc) => {
                    // Set PDF metadata
                    const name = this.currentDocument.name || 'Untitled Document';
                    doc.setProperties({
                        title: name,
                        creator: 'Markdown Manager',
                        author: 'User'
                    });

                    // Save the PDF
                    const fileName = filename || name;
                    const finalFileName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
                    doc.save(finalFileName);

                    // Hide loading indicator
                    this.hidePDFLoadingNotification(loadingNotification);
                },
                margin: [margin, margin, margin, margin],
                autoPaging: 'text',
                width: pageWidth - (2 * margin),
                windowWidth: 900, // Slightly wider for better content
                html2canvas: {
                    scale: 1.2, // Higher scale for better quality
                    useCORS: false,
                    allowTaint: false,
                    backgroundColor: backgroundColor,
                    logging: false,
                    removeContainer: true,
                    imageTimeout: 10000,
                    width: 900,
                    height: 1400,
                    letterRendering: true,
                    foreignObjectRendering: true,
                    // Better emoji and font handling
                    onclone: (clonedDoc, element) => {
                        // Load system fonts that support emojis
                        const style = clonedDoc.createElement('style');
                        style.textContent = `
                            @import url('https://fonts.googleapis.com/css2?family=Noto+Color+Emoji&display=swap');
                            * {
                                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif !important;
                                -webkit-font-smoothing: antialiased !important;
                                -moz-osx-font-smoothing: grayscale !important;
                                text-rendering: optimizeLegibility !important;
                            }
                            pre, code {
                                font-family: "SF Mono", "Monaco", "Inconsolata", "Roboto Mono", "Source Code Pro", "Menlo", "Consolas", "Courier New", monospace !important;
                                white-space: pre-wrap !important;
                                word-break: break-word !important;
                                background-color: ${currentTheme === 'dark' ? '#2d2d2d' : '#f8f9fa'} !important;
                                padding: 8px !important;
                                border-radius: 4px !important;
                            }
                            blockquote {
                                border-left: 4px solid #007bff !important;
                                padding-left: 16px !important;
                                margin-left: 0 !important;
                                color: ${currentTheme === 'dark' ? '#cccccc' : '#6c757d'} !important;
                            }
                        `;
                        clonedDoc.head.appendChild(style);
                        
                        // Wait for fonts to load
                        return new Promise(resolve => {
                            setTimeout(resolve, 2000);
                        });
                    }
                }
            });

        } catch (error) {
            // Hide loading indicator
            this.hidePDFLoadingNotification(loadingNotification);
            
            console.warn('Enhanced PDF export failed, using simple fallback:', error);
            
            // Use simple text-based fallback
            this.exportAsPDFSimple(filename);
        }
    }

    /**
     * Convert emojis to HTML entities for better PDF rendering
     */
    convertEmojisToHtmlEntities(element) {
        // Walk through all text nodes and convert emojis
        const walker = document.createTreeWalker(
            element,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );

        const textNodes = [];
        let node;
        while (node = walker.nextNode()) {
            textNodes.push(node);
        }

        textNodes.forEach(textNode => {
            const text = textNode.textContent;
            if (this.containsEmoji(text)) {
                // Convert emojis to HTML entities
                const convertedText = this.emojiToHtmlEntity(text);
                textNode.textContent = convertedText;
            }
        });
    }

    /**
     * Check if text contains emojis
     */
    containsEmoji(text) {
        // More comprehensive emoji regex that covers all common emoji ranges
        const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F018}-\u{1F270}]|[\u{238C}-\u{2454}]|[\u{20D0}-\u{20FF}]/u;
        return emojiRegex.test(text);
    }

    /**
     * Convert emojis to Unicode escape sequences
     */
    emojiToHtmlEntity(text) {
        // More comprehensive emoji replacement
        return text.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F018}-\u{1F270}]|[\u{238C}-\u{2454}]|[\u{20D0}-\u{20FF}]/gu, 
            (match) => {
                // Convert to Unicode code point and then to HTML entity
                const codePoint = match.codePointAt(0);
                return `&#${codePoint};`;
            }
        );
    }

    /**
     * Simple text-based PDF export
     */
    exportAsPDFSimple(filename = null) {
        try {
            const previewElement = document.querySelector('#preview .preview-scroll');
            if (!previewElement) {
                throw new Error('Preview element not found');
            }

            // Create PDF
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            const margin = 15;
            const pageWidth = pdf.internal.pageSize.getWidth();
            const contentWidth = pageWidth - (2 * margin);
            let yPosition = margin;
            const lineHeight = 6;
            
            // Set font
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(11);

            // Get text content and split into lines
            const textContent = previewElement.textContent || '';
            const lines = pdf.splitTextToSize(textContent, contentWidth);

            // Add lines to PDF with page breaks
            lines.forEach(line => {
                if (yPosition > pdf.internal.pageSize.getHeight() - margin) {
                    pdf.addPage();
                    yPosition = margin;
                }
                pdf.text(line, margin, yPosition);
                yPosition += lineHeight;
            });

            // Set metadata
            const name = this.currentDocument.name || 'Untitled Document';
            pdf.setProperties({
                title: name,
                creator: 'Markdown Manager',
                author: 'User'
            });

            // Save
            const fileName = filename || name;
            const finalFileName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
            pdf.save(finalFileName);

        } catch (error) {
            console.error('Simple PDF export failed:', error);
            throw error;
        }
    }

    /**
     * Original text-based PDF export as final fallback
     */
    exportAsPDFOriginal(filename = null) {
        const previewElement = document.querySelector('#preview .preview-scroll');
        if (!previewElement) {
            throw new Error('Preview element not found');
        }

        // Simple fallback: use textContent for PDF export
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        const margin = 15;
        const textContent = previewElement.textContent || '';
        const lines = pdf.splitTextToSize(textContent, pdf.internal.pageSize.getWidth() - (2 * margin));
        
        let yPosition = margin;
        const lineHeight = 6;
        const pageHeight = pdf.internal.pageSize.getHeight() - margin;

        // Add notice about formatting limitation
        pdf.setFont('helvetica', 'italic');
        pdf.setFontSize(10);
        pdf.text('Note: This is a simplified text export. Formatting and emojis may not display correctly.', margin, yPosition);
        yPosition += 10;

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(11);

        lines.forEach(line => {
            if (yPosition > pageHeight) {
                pdf.addPage();
                yPosition = margin;
            }
            pdf.text(line, margin, yPosition);
            yPosition += lineHeight;
        });

        const name = filename || this.currentDocument.name || 'document';
        const fileName = name.endsWith('.pdf') ? name : `${name}.pdf`;
        pdf.save(fileName);
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
     * Show PDF loading notification
     */
    showPDFLoadingNotification() {
        const notification = document.createElement('div');
        notification.className = 'pdf-loading-notification';
        notification.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 20px 30px;
            border-radius: 8px;
            z-index: 9999;
            text-align: center;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;
        notification.innerHTML = `
            <div style="margin-bottom: 10px;">📄 Generating PDF...</div>
            <div style="font-size: 14px; opacity: 0.8;">This may take a moment for large documents</div>
        `;
        document.body.appendChild(notification);
        return notification;
    }

    /**
     * Hide PDF loading notification
     */
    hidePDFLoadingNotification(notification) {
        if (notification && notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }
}

// Create singleton instance
export const documentManager = new DocumentManager();

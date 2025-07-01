import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// Constants for local storage keys
const DOCUMENTS_KEY = 'savedDocuments';
const CURRENT_DOC_KEY = 'currentDocument';
const AUTO_SAVE_KEY = 'autoSaveEnabled';

/**
 * Document Manager Class
 * Handles saving, loading, and managing documents in localStorage
 */
export class DocumentManager {
    constructor() {
        this.documents = this.loadDocuments();
        this.currentDocument = this.loadCurrentDocument();
        this.autoSaveEnabled = this.getAutoSavePreference();
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
            return current ? JSON.parse(current) : { id: null, name: 'Untitled Document' };
        } catch (error) {
            console.error('Error loading current document:', error);
            return { id: null, name: 'Untitled Document' };
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
     * Generate a unique ID for documents
     */
    generateId() {
        return 'doc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Save a document
     */
    saveDocument(content, name = null, id = null) {
        try {
            // Use existing ID or generate new one
            const docId = id || this.currentDocument.id || this.generateId();

            // Use provided name or current document name
            const docName = name || this.currentDocument.name || 'Untitled Document';

            const document = {
                id: docId,
                name: docName,
                content: content,
                lastModified: new Date().toISOString(),
                created: this.documents[docId]?.created || new Date().toISOString()
            };

            this.documents[docId] = document;
            this.currentDocument = { id: docId, name: docName };

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
            this.currentDocument = { id: document.id, name: document.name };
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
                this.currentDocument = { id: null, name: 'Untitled Document' };
                this.saveCurrentDocument();
            }

            return true;
        }
        return false;
    }

    /**
     * Get all saved documents
     */
    getAllDocuments() {
        return Object.values(this.documents).sort((a, b) =>
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
    createNewDocument(name = 'Untitled Document') {
        this.currentDocument = { id: null, name: name };
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
        try {
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

            // Define theme colors
            const themeColors = {
                dark: {
                    background: [30, 30, 30], // #1e1e1e
                    text: [255, 255, 255],    // #ffffff
                    heading: [255, 255, 255], // #ffffff
                    code: [248, 248, 242],    // #f8f8f2
                    codeBg: [45, 45, 45],     // #2d2d2d
                    link: [102, 179, 255],    // #66b3ff
                    border: [68, 68, 68],     // #444444
                    quote: [204, 204, 204]   // #cccccc
                },
                light: {
                    background: [255, 255, 255], // #ffffff
                    text: [0, 0, 0],            // #000000
                    heading: [0, 0, 0],         // #000000
                    code: [0, 0, 0],            // #000000
                    codeBg: [245, 245, 245],    // #f5f5f5
                    link: [0, 123, 255],        // #007bff
                    border: [222, 226, 230],    // #dee2e6
                    quote: [108, 117, 125]      // #6c757d
                }
            };

            const colors = themeColors[currentTheme];

            // Create PDF
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            // Set background color
            pdf.setFillColor(colors.background[0], colors.background[1], colors.background[2]);
            pdf.rect(0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight(), 'F');

            // PDF dimensions
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const margin = 15;
            const contentWidth = pageWidth - (2 * margin);
            let yPosition = margin;

            // Helper function to add new page if needed
            const checkPageBreak = (neededHeight) => {
                if (yPosition + neededHeight > pageHeight - margin) {
                    pdf.addPage();
                    pdf.setFillColor(colors.background[0], colors.background[1], colors.background[2]);
                    pdf.rect(0, 0, pageWidth, pageHeight, 'F');
                    yPosition = margin;
                }
            };

            // Helper function to wrap text
            const wrapText = (text, maxWidth, fontSize) => {
                pdf.setFontSize(fontSize);
                return pdf.splitTextToSize(text, maxWidth);
            };

            // Process each element in the preview
            const processElement = (element, level = 0) => {
                const tagName = element.tagName?.toLowerCase();
                const textContent = element.textContent?.trim();

                if (!textContent && !['img', 'hr', 'br'].includes(tagName)) {
                    return;
                }

                const indent = level * 5;
                const availableWidth = contentWidth - indent;

                switch (tagName) {
                    case 'h1':
                    case 'h2':
                    case 'h3':
                    case 'h4':
                    case 'h5':
                    case 'h6':
                        const headingSize = {
                            h1: 20, h2: 18, h3: 16, h4: 14, h5: 12, h6: 11
                        }[tagName];

                        checkPageBreak(headingSize * 0.5);
                        pdf.setFont('helvetica', 'bold');
                        pdf.setFontSize(headingSize);
                        pdf.setTextColor(colors.heading[0], colors.heading[1], colors.heading[2]);

                        const headingLines = wrapText(textContent, availableWidth, headingSize);
                        headingLines.forEach(line => {
                            pdf.text(line, margin + indent, yPosition);
                            yPosition += headingSize * 0.4;
                        });
                        yPosition += 5;
                        break;

                    case 'p':
                        checkPageBreak(12);
                        pdf.setFont('helvetica', 'normal');
                        pdf.setFontSize(11);
                        pdf.setTextColor(colors.text[0], colors.text[1], colors.text[2]);

                        const paragraphLines = wrapText(textContent, availableWidth, 11);
                        paragraphLines.forEach(line => {
                            pdf.text(line, margin + indent, yPosition);
                            yPosition += 5;
                        });
                        yPosition += 3;
                        break;

                    case 'pre':
                        const codeContent = element.textContent;
                        checkPageBreak(20);

                        // Code block background
                        pdf.setFillColor(colors.codeBg[0], colors.codeBg[1], colors.codeBg[2]);
                        const codeLines = codeContent.split('\n');
                        const codeHeight = codeLines.length * 4 + 6;
                        pdf.rect(margin + indent, yPosition - 3, availableWidth, codeHeight, 'F');

                        // Code text
                        pdf.setFont('courier', 'normal');
                        pdf.setFontSize(9);
                        pdf.setTextColor(colors.code[0], colors.code[1], colors.code[2]);

                        codeLines.forEach(line => {
                            pdf.text(line, margin + indent + 3, yPosition);
                            yPosition += 4;
                        });
                        yPosition += 8;
                        break;

                    case 'blockquote':
                        checkPageBreak(15);

                        // Quote border
                        pdf.setDrawColor(colors.border[0], colors.border[1], colors.border[2]);
                        pdf.setLineWidth(1);
                        pdf.line(margin + indent, yPosition - 2, margin + indent, yPosition + 12);

                        pdf.setFont('helvetica', 'italic');
                        pdf.setFontSize(11);
                        pdf.setTextColor(colors.quote[0], colors.quote[1], colors.quote[2]);

                        const quoteLines = wrapText(textContent, availableWidth - 5, 11);
                        quoteLines.forEach(line => {
                            pdf.text(line, margin + indent + 5, yPosition);
                            yPosition += 5;
                        });
                        yPosition += 5;
                        break;

                    case 'ul':
                    case 'ol':
                        // Process list items
                        const listItems = element.querySelectorAll('li');
                        listItems.forEach((li, index) => {
                            checkPageBreak(8);
                            pdf.setFont('helvetica', 'normal');
                            pdf.setFontSize(11);
                            pdf.setTextColor(colors.text[0], colors.text[1], colors.text[2]);

                            const bullet = tagName === 'ul' ? '•' : `${index + 1}.`;
                            const liText = li.textContent.trim();

                            pdf.text(bullet, margin + indent, yPosition);
                            const liLines = wrapText(liText, availableWidth - 10, 11);
                            liLines.forEach((line, lineIndex) => {
                                pdf.text(line, margin + indent + 10, yPosition + (lineIndex * 5));
                            });
                            yPosition += liLines.length * 5 + 2;
                        });
                        yPosition += 3;
                        break;

                    case 'hr':
                        checkPageBreak(8);
                        pdf.setDrawColor(colors.border[0], colors.border[1], colors.border[2]);
                        pdf.setLineWidth(0.5);
                        pdf.line(margin + indent, yPosition, margin + indent + availableWidth, yPosition);
                        yPosition += 8;
                        break;

                    case 'table':
                        // Simple table rendering
                        checkPageBreak(30);
                        const rows = element.querySelectorAll('tr');
                        const cellWidth = availableWidth / (rows[0]?.cells.length || 1);

                        rows.forEach((row, rowIndex) => {
                            const cells = row.querySelectorAll('td, th');
                            const isHeader = row.querySelector('th');

                            cells.forEach((cell, cellIndex) => {
                                const cellX = margin + indent + (cellIndex * cellWidth);

                                if (isHeader) {
                                    pdf.setFillColor(colors.codeBg[0], colors.codeBg[1], colors.codeBg[2]);
                                    pdf.rect(cellX, yPosition - 3, cellWidth, 8, 'F');
                                    pdf.setFont('helvetica', 'bold');
                                } else {
                                    pdf.setFont('helvetica', 'normal');
                                }

                                pdf.setFontSize(10);
                                pdf.setTextColor(colors.text[0], colors.text[1], colors.text[2]);

                                const cellText = cell.textContent.trim();
                                const cellLines = wrapText(cellText, cellWidth - 4, 10);
                                cellLines.forEach((line, lineIndex) => {
                                    pdf.text(line, cellX + 2, yPosition + (lineIndex * 4));
                                });
                            });
                            yPosition += 8;
                        });
                        yPosition += 5;
                        break;

                    default:
                        // Handle other text elements
                        if (textContent && !element.querySelector('*')) {
                            checkPageBreak(8);
                            pdf.setFont('helvetica', 'normal');
                            pdf.setFontSize(11);
                            pdf.setTextColor(colors.text[0], colors.text[1], colors.text[2]);

                            const lines = wrapText(textContent, availableWidth, 11);
                            lines.forEach(line => {
                                pdf.text(line, margin + indent, yPosition);
                                yPosition += 5;
                            });
                            yPosition += 2;
                        }
                        break;
                }
            };

            // Process all direct children of the preview element
            const children = Array.from(previewElement.children);
            children.forEach(child => {
                // Skip Mermaid diagrams for now (they need special handling)
                if (!child.classList.contains('mermaid')) {
                    processElement(child);
                }
            });

            // Handle Mermaid diagrams by capturing them as images
            const mermaidElements = previewElement.querySelectorAll('.mermaid');
            for (const mermaidEl of mermaidElements) {
                try {
                    checkPageBreak(50);

                    // Capture mermaid diagram as image
                    const canvas = await html2canvas(mermaidEl, {
                        scale: 2,
                        backgroundColor: currentTheme === 'dark' ? '#1e1e1e' : '#ffffff',
                        allowTaint: true
                    });

                    const imgData = canvas.toDataURL('image/png');
                    const imgWidth = Math.min(contentWidth, 150);
                    const imgHeight = (canvas.height * imgWidth) / canvas.width;

                    checkPageBreak(imgHeight);
                    pdf.addImage(imgData, 'PNG', margin, yPosition, imgWidth, imgHeight);
                    yPosition += imgHeight + 10;
                } catch (error) {
                    console.warn('Failed to capture Mermaid diagram:', error);
                    // Fallback to text representation
                    pdf.setFont('courier', 'normal');
                    pdf.setFontSize(9);
                    pdf.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
                    pdf.text('[Mermaid Diagram]', margin, yPosition);
                    yPosition += 10;
                }
            }

            // Save the PDF
            const name = filename || this.currentDocument.name || 'document';
            const fileName = name.endsWith('.pdf') ? name : `${name}.pdf`;
            pdf.save(fileName);

        } catch (error) {
            console.error('Error exporting PDF:', error);
            throw new Error(`PDF export failed: ${error.message}`);
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

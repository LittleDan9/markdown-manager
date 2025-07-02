import { documentManager, DEFAULT_CATEGORY } from './documentManager';

/**
 * UI Manager for Document Management
 * Handles all UI interactions related to document management
 */
export class DocumentUIManager {
    constructor(editor) {
        this.editor = editor;
        this.currentModalElement = null;

        // Wait for DOM to be fully ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.initializeEventListeners();
                this.updateDocumentTitle();
            });
        } else {
            // DOM is already ready
            this.initializeEventListeners();
            this.updateDocumentTitle();
        }
    }

    /**
     * Initialize event listeners for document management
     */
    initializeEventListeners() {
        console.log('Initializing document UI event listeners...');

        // File menu buttons - use event delegation to ensure they work
        const fileMenuButtons = {
            'newDocBtn': () => this.newDocument(),
            'saveDocBtn': () => this.saveDocument(),
            'loadDocBtn': () => this.showLoadModal(),
            'exportMdBtn': () => this.exportMarkdown(),
            'exportPdfBtn': () => this.exportPDF(),
            'importMdBtn': () => this.importMarkdown()
        };

        // Add event listeners for file menu buttons
        Object.entries(fileMenuButtons).forEach(([id, handler]) => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('click', (e) => {
                    e.preventDefault();
                    console.log(`Clicked ${id}`);
                    handler();
                });
                console.log(`Added listener for ${id}`);
            } else {
                console.warn(`Element with id '${id}' not found`);
            }
        });

        // Document title editing
        const titleElement = document.getElementById('documentTitle');
        if (titleElement) {
            titleElement.addEventListener('click', () => this.editDocumentTitle());
            titleElement.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.saveDocumentTitle();
                }
                if (e.key === 'Escape') {
                    this.cancelTitleEdit();
                }
            });
            console.log('Added listeners for document title');
        } else {
            console.warn('Document title element not found');
        }

        // Ensure Bootstrap dropdown is working
        const dropdownElement = document.getElementById('fileMenuDropdown');
        if (dropdownElement) {
            console.log('File menu dropdown element found');

            // Manual dropdown toggle if Bootstrap isn't working
            dropdownElement.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Dropdown clicked');
                const dropdownMenu = dropdownElement.nextElementSibling;
                if (dropdownMenu && dropdownMenu.classList.contains('dropdown-menu')) {
                    // Close other dropdowns first
                    document.querySelectorAll('.dropdown-menu.show').forEach(menu => {
                        if (menu !== dropdownMenu) {
                            menu.classList.remove('show');
                        }
                    });

                    dropdownMenu.classList.toggle('show');
                }
            });

            // Close dropdown when clicking outside
            document.addEventListener('click', (e) => {
                const dropdownMenu = dropdownElement.nextElementSibling;
                if (dropdownMenu &&
                    !dropdownElement.contains(e.target) &&
                    !dropdownMenu.contains(e.target)) {
                    dropdownMenu.classList.remove('show');
                }
            });

        } else {
            console.warn('File menu dropdown element not found');
        }

        console.log('Document UI event listeners initialized');
    }

    /**
     * Create a new document
     */
    newDocument() {
        if (this.hasUnsavedChanges()) {
            if (!confirm('You have unsaved changes. Do you want to continue without saving?')) {
                return;
            }
        }

        documentManager.createNewDocument();
        this.editor.setValue('');
        this.updateDocumentTitle();
    }

    /**
     * Save current document
     */
    saveDocument() {
        try {
            const content = this.editor.getValue();

            // Get current name from both manager and DOM (in case user edited title but didn't save it yet)
            const managerName = documentManager.currentDocument.name;
            const titleElement = document.getElementById('documentTitle');
            const domTitle = titleElement ? titleElement.textContent.trim() : managerName;

            // Sync the title if it's different
            if (domTitle !== managerName && domTitle && domTitle !== 'Untitled Document') {
                documentManager.currentDocument.name = domTitle;
                documentManager.saveCurrentDocument();
                console.log('Synced title from DOM:', domTitle);
            }

            const currentName = documentManager.currentDocument.name;
            console.log('Save document - Current name:', currentName, 'Has ID:', !!documentManager.currentDocument.id);

            // If no ID and name is still default or empty, show save as modal
            if (!documentManager.currentDocument.id &&
                (!currentName || currentName.trim() === '' || currentName === 'Untitled Document')) {
                this.showSaveAsModal();
                return;
            }

            // If we have a name but no ID, create new document with that name
            if (!documentManager.currentDocument.id && currentName && currentName.trim() && currentName !== 'Untitled Document') {
                const currentCategory = documentManager.currentDocument.category || DEFAULT_CATEGORY;
                const savedDoc = documentManager.saveDocument(content, currentName.trim(), null, currentCategory);
                this.showNotification('Document saved successfully!', 'success');
                this.updateDocumentTitle();
                return;
            }

            // If we have both name and ID, update existing document
            if (documentManager.currentDocument.id) {
                const currentCategory = documentManager.currentDocument.category || DEFAULT_CATEGORY;
                documentManager.saveDocument(content, currentName, documentManager.currentDocument.id, currentCategory);
                this.showNotification('Document saved successfully!', 'success');
                this.updateDocumentTitle();
                return;
            }

        } catch (error) {
            this.showNotification('Error saving document: ' + error.message, 'error');
        }
    }

    /**
     * Show save as modal
     */
    showSaveAsModal() {
        // Get the current title from both the document manager and the DOM element
        const managerName = documentManager.currentDocument.name || 'Untitled Document';
        const titleElement = document.getElementById('documentTitle');
        const domTitle = titleElement ? titleElement.textContent.trim() : managerName;

        // Use the DOM title if it's different from the manager (user may have edited it)
        const currentName = domTitle !== managerName ? domTitle : managerName;

        console.log('Save As Modal - Manager name:', managerName, 'DOM title:', domTitle, 'Using:', currentName);

        // Only show the current name if it's not the default
        const displayName = (currentName === 'Untitled Document' || !currentName.trim()) ? '' : currentName;

        // Get current category and all available categories
        const currentCategory = documentManager.currentDocument.category || DEFAULT_CATEGORY;
        const categories = documentManager.getAllCategories();

        const categoryOptions = categories.map(category =>
            `<option value="${this.escapeHtml(category)}" ${category === currentCategory ? 'selected' : ''}>${this.escapeHtml(category)}</option>`
        ).join('');

        this.showModal('Save Document', `
            <div class="mb-3">
                <label for="saveDocName" class="form-label">Document Name</label>
                <input type="text" class="form-control" id="saveDocName"
                       value="${this.escapeHtml(displayName)}" placeholder="Enter document name">
                <div class="form-text">Enter a name for your document (cannot be "Untitled Document")</div>
            </div>
            <div class="mb-3">
                <label for="saveDocCategory" class="form-label">Category</label>
                <div class="input-group">
                    <select class="form-select" id="saveDocCategory">
                        ${categoryOptions}
                    </select>
                    <button class="btn btn-outline-secondary" type="button" id="newCategoryBtn">New</button>
                </div>
                <div class="form-text">Select a category or create a new one</div>
            </div>
            <div class="mb-3" id="newCategoryDiv" style="display: none;">
                <label for="newCategoryName" class="form-label">New Category Name</label>
                <div class="input-group">
                    <input type="text" class="form-control" id="newCategoryName" placeholder="Enter category name">
                    <button class="btn btn-outline-success" type="button" id="addCategoryBtn">Add</button>
                    <button class="btn btn-outline-secondary" type="button" id="cancelCategoryBtn">Cancel</button>
                </div>
            </div>
        `, [
            {
                text: 'Cancel',
                class: 'btn-secondary',
                action: () => this.closeModal()
            },
            {
                text: 'Save',
                class: 'btn-primary',
                action: () => this.performSaveAs()
            }
        ]);

        // Focus on input and select all text
        setTimeout(() => {
            const input = document.getElementById('saveDocName');
            const categorySelect = document.getElementById('saveDocCategory');
            const newCategoryBtn = document.getElementById('newCategoryBtn');
            const newCategoryDiv = document.getElementById('newCategoryDiv');
            const newCategoryName = document.getElementById('newCategoryName');
            const addCategoryBtn = document.getElementById('addCategoryBtn');
            const cancelCategoryBtn = document.getElementById('cancelCategoryBtn');

            if (input) {
                input.focus();
                if (displayName) {
                    input.select();
                }

                // Handle Enter key to save
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        this.performSaveAs();
                    }
                });

                // Real-time validation
                input.addEventListener('input', (e) => {
                    const value = e.target.value.trim();
                    const saveButton = document.querySelector('.custom-modal-footer .btn-primary');
                    const helpText = document.querySelector('.form-text');

                    if (!value || value === 'Untitled Document') {
                        saveButton.disabled = true;
                        helpText.textContent = 'Please enter a valid document name (cannot be empty or "Untitled Document")';
                        helpText.className = 'form-text text-danger';
                    } else {
                        saveButton.disabled = false;
                        helpText.textContent = 'Enter a name for your document (cannot be "Untitled Document")';
                        helpText.className = 'form-text text-muted';
                    }
                });

                // Trigger initial validation
                input.dispatchEvent(new Event('input'));
            }

            // Category management event listeners
            if (newCategoryBtn) {
                newCategoryBtn.addEventListener('click', () => {
                    newCategoryDiv.style.display = 'block';
                    newCategoryBtn.disabled = true;
                    newCategoryName.focus();
                });
            }

            if (cancelCategoryBtn) {
                cancelCategoryBtn.addEventListener('click', () => {
                    newCategoryDiv.style.display = 'none';
                    newCategoryBtn.disabled = false;
                    newCategoryName.value = '';
                });
            }

            if (addCategoryBtn) {
                addCategoryBtn.addEventListener('click', () => {
                    const categoryName = newCategoryName.value.trim();
                    if (categoryName) {
                        if (documentManager.addCategory(categoryName)) {
                            // Add the new category to the select dropdown
                            const option = document.createElement('option');
                            option.value = categoryName;
                            option.textContent = categoryName;
                            option.selected = true;
                            categorySelect.appendChild(option);

                            // Hide the new category form
                            newCategoryDiv.style.display = 'none';
                            newCategoryBtn.disabled = false;
                            newCategoryName.value = '';

                            this.showNotification(`Category "${categoryName}" added successfully!`, 'success');
                        } else {
                            this.showNotification('Category already exists or invalid name', 'error');
                        }
                    } else {
                        this.showNotification('Please enter a category name', 'error');
                        newCategoryName.focus();
                    }
                });
            }

            if (newCategoryName) {
                newCategoryName.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        addCategoryBtn.click();
                    }
                    if (e.key === 'Escape') {
                        cancelCategoryBtn.click();
                    }
                });
            }
        }, 100);
    }

    /**
     * Perform save as action
     */
    performSaveAs() {
        const nameInput = document.getElementById('saveDocName');
        const categorySelect = document.getElementById('saveDocCategory');
        const name = nameInput?.value.trim();
        const category = categorySelect?.value || DEFAULT_CATEGORY;

        if (!name) {
            this.showNotification('Please enter a document name', 'error');
            nameInput?.focus();
            return;
        }

        if (name === 'Untitled Document') {
            this.showNotification('Cannot save with the default document name. Please choose a different name.', 'error');
            nameInput?.focus();
            nameInput?.select();
            return;
        }

        try {
            const content = this.editor.getValue();
            documentManager.saveDocument(content, name, null, category);
            this.showNotification('Document saved successfully!', 'success');
            this.updateDocumentTitle();
            this.closeModal();
        } catch (error) {
            this.showNotification('Error saving document: ' + error.message, 'error');
        }
    }

    /**
     * Show load document modal
     */
    showLoadModal() {
        const allDocuments = documentManager.getAllDocuments();

        if (allDocuments.length === 0) {
            this.showNotification('No saved documents found', 'info');
            return;
        }

        const categories = documentManager.getAllCategories();
        const categoryOptions = ['All', ...categories].map(category =>
            `<option value="${this.escapeHtml(category)}">${this.escapeHtml(category)}</option>`
        ).join('');

        this.showModal('Load Document', `
            <div class="mb-3">
                <label for="categoryFilter" class="form-label">Filter by Category</label>
                <select class="form-select" id="categoryFilter">
                    ${categoryOptions}
                </select>
            </div>
            <div class="document-list" style="max-height: 400px; overflow-y: auto;" id="documentsList">
                <!-- Documents will be populated here -->
            </div>
        `, [
            {
                text: 'Cancel',
                class: 'btn-secondary',
                action: () => this.closeModal()
            }
        ]);

        // Initialize the document list
        this.updateDocumentsList('All');

        // Add event listeners
        const categoryFilter = document.getElementById('categoryFilter');
        if (categoryFilter) {
            categoryFilter.addEventListener('change', (e) => {
                this.updateDocumentsList(e.target.value);
            });
        }

        // Add event listeners for document actions
        const documentListElement = document.getElementById('documentsList');
        if (documentListElement) {
            documentListElement.addEventListener('click', (e) => {
                const button = e.target.closest('[data-doc-action]');
                if (button) {
                    const action = button.dataset.docAction;
                    const docId = button.dataset.docId;

                    switch (action) {
                        case 'load':
                            this.loadDocument(docId);
                            break;
                        case 'rename':
                            this.renameDocument(docId);
                            break;
                        case 'delete':
                            this.deleteDocument(docId);
                            break;
                    }
                }
            });
        }
    }

    /**
     * Update the documents list based on category filter
     */
    updateDocumentsList(categoryFilter) {
        const documents = documentManager.getAllDocuments(categoryFilter === 'All' ? null : categoryFilter);
        const documentsList = document.getElementById('documentsList');

        if (!documentsList) return;

        if (documents.length === 0) {
            documentsList.innerHTML = `
                <div class="text-center p-4 text-muted">
                    <i class="bi bi-folder-x"></i>
                    <p class="mb-0">No documents found in this category</p>
                </div>
            `;
            return;
        }

        const documentsHtml = documents.map(doc => {
            const category = doc.category || DEFAULT_CATEGORY;
            return `
                <div class="document-item d-flex justify-content-between align-items-center p-2 border-bottom">
                    <div class="flex-grow-1">
                        <h6 class="mb-1">${this.escapeHtml(doc.name)}</h6>
                        <small class="text-muted">
                            Category: <span class="badge bg-secondary">${this.escapeHtml(category)}</span>
                            • Modified: ${new Date(doc.lastModified).toLocaleString()}
                        </small>
                    </div>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary" data-doc-action="load" data-doc-id="${doc.id}">Load</button>
                        <button class="btn btn-outline-secondary" data-doc-action="rename" data-doc-id="${doc.id}">Rename</button>
                        <button class="btn btn-outline-danger" data-doc-action="delete" data-doc-id="${doc.id}">Delete</button>
                    </div>
                </div>
            `;
        }).join('');

        documentsList.innerHTML = documentsHtml;
    }

    /**
     * Load a specific document
     */
    loadDocument(id) {
        try {
            const doc = documentManager.loadDocument(id);
            this.editor.setValue(doc.content);
            this.updateDocumentTitle();
            this.closeModal();
            this.showNotification('Document loaded successfully!', 'success');
        } catch (error) {
            this.showNotification('Error loading document: ' + error.message, 'error');
        }
    }

    /**
     * Delete a document
     */
    deleteDocument(id) {
        const doc = documentManager.documents[id];
        if (!doc) return;

        if (confirm(`Are you sure you want to delete "${doc.name}"?`)) {
            try {
                documentManager.deleteDocument(id);
                this.showNotification('Document deleted successfully!', 'success');
                // Refresh the modal while maintaining current filter
                const categoryFilter = document.getElementById('categoryFilter');
                const currentFilter = categoryFilter ? categoryFilter.value : 'All';
                this.updateDocumentsList(currentFilter);
                this.updateDocumentTitle();
            } catch (error) {
                this.showNotification('Error deleting document: ' + error.message, 'error');
            }
        }
    }

    /**
     * Rename a document
     */
    renameDocument(id) {
        const doc = documentManager.documents[id];
        if (!doc) return;

        const newName = prompt('Enter new name:', doc.name);
        if (newName && newName.trim() && newName.trim() !== doc.name) {
            try {
                documentManager.renameDocument(id, newName.trim());
                this.showNotification('Document renamed successfully!', 'success');
                // Refresh the modal while maintaining current filter
                const categoryFilter = document.getElementById('categoryFilter');
                const currentFilter = categoryFilter ? categoryFilter.value : 'All';
                this.updateDocumentsList(currentFilter);
                this.updateDocumentTitle();
            } catch (error) {
                this.showNotification('Error renaming document: ' + error.message, 'error');
            }
        }
    }

    /**
     * Export document as Markdown
     */
    exportMarkdown() {
        try {
            const content = this.editor.getValue();
            documentManager.exportAsMarkdown(content);
            this.showNotification('Markdown file exported successfully!', 'success');
        } catch (error) {
            this.showNotification('Error exporting markdown: ' + error.message, 'error');
        }
    }

    /**
     * Export preview as PDF
     */
    async exportPDF() {
        try {
            await documentManager.exportAsPDF();
        } catch (error) {
            this.showNotification('Error exporting PDF: ' + error.message, 'error');
        }
    }

    /**
     * Import Markdown file
     */
    importMarkdown() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.md,.markdown,.txt';

        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                const { content, name } = await documentManager.importMarkdownFile(file);

                if (this.hasUnsavedChanges()) {
                    if (!confirm('You have unsaved changes. Do you want to continue?')) {
                        return;
                    }
                }

                documentManager.createNewDocument(name);
                this.editor.setValue(content);
                this.updateDocumentTitle();
                this.showNotification('File imported successfully!', 'success');
            } catch (error) {
                this.showNotification('Error importing file: ' + error.message, 'error');
            }
        };

        input.click();
    }

    /**
     * Edit document title
     */
    editDocumentTitle() {
        const titleElement = document.getElementById('documentTitle');
        if (!titleElement) return;

        // Store the current document name for editing
        const currentName = documentManager.currentDocument.name;

        // Replace content with plain text for editing
        titleElement.textContent = currentName;
        titleElement.contentEditable = true;
        titleElement.focus();

        // Select all text
        const range = document.createRange();
        range.selectNodeContents(titleElement);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);

        titleElement.classList.add('editing');

        // Show helpful tooltip
        titleElement.title = 'Press Enter to save, Escape to cancel';
    }

    /**
     * Save document title
     */
    saveDocumentTitle() {
        const titleElement = document.getElementById('documentTitle');
        if (!titleElement) return;

        const newTitle = titleElement.textContent.trim();
        const oldName = documentManager.currentDocument.name;

        console.log('Saving title - Old:', oldName, 'New:', newTitle);

        // Validate the new title
        if (!newTitle) {
            this.showNotification('Document name cannot be empty', 'error');
            this.cancelTitleEdit();
            return;
        }

        if (newTitle === 'Untitled Document') {
            this.showNotification('Cannot use "Untitled Document" as document name', 'error');
            this.cancelTitleEdit();
            return;
        }

        // Always update the document manager with the new title
        if (newTitle !== oldName) {
            documentManager.currentDocument.name = newTitle;
            documentManager.saveCurrentDocument();
            console.log('Updated document manager name to:', newTitle);

            // If this is a saved document, update it
            if (documentManager.currentDocument.id) {
                try {
                    documentManager.renameDocument(documentManager.currentDocument.id, newTitle);
                    this.showNotification('Document renamed and saved!', 'success');
                } catch (error) {
                    this.showNotification('Error renaming document: ' + error.message, 'error');
                }
            } else {
                // If not saved yet, inform user about auto-save potential
                if (this.editor.getValue().trim()) {
                    this.showNotification(`Document name changed to "${newTitle}". Auto-save enabled.`, 'info');
                }
            }
        }

        this.finishTitleEdit();
    }

    /**
     * Cancel title edit
     */
    cancelTitleEdit() {
        this.updateDocumentTitle();
        this.finishTitleEdit();
    }

    /**
     * Finish title editing
     */
    finishTitleEdit() {
        const titleElement = document.getElementById('documentTitle');
        if (!titleElement) return;

        titleElement.contentEditable = false;
        titleElement.classList.remove('editing');
        titleElement.blur();
        titleElement.title = 'Click to edit';
    }

    /**
     * Update document title in UI
     */
    updateDocumentTitle() {
        const titleElement = document.getElementById('documentTitle');
        if (titleElement) {
            const currentDoc = documentManager.currentDocument;
            const category = currentDoc.category || DEFAULT_CATEGORY;

            // Show category only if it's not the default category
            if (category === DEFAULT_CATEGORY) {
                titleElement.textContent = currentDoc.name;
            } else {
                titleElement.innerHTML = `${this.escapeHtml(currentDoc.name)} <span class="badge bg-secondary ms-1">${this.escapeHtml(category)}</span>`;
            }
        }
    }

    /**
     * Check if there are unsaved changes
     */
    hasUnsavedChanges() {
        if (!documentManager.currentDocument.id) {
            return this.editor.getValue().trim() !== '';
        }

        const savedDoc = documentManager.documents[documentManager.currentDocument.id];
        if (!savedDoc) return true;

        return this.editor.getValue() !== savedDoc.content;
    }

    /**
     * Show a modal dialog
     */
    showModal(title, body, buttons = []) {
        // Remove existing modal
        this.closeModal();

        const modalHTML = `
            <div class="custom-modal" id="documentModal">
                <div class="custom-modal-backdrop"></div>
                <div class="custom-modal-dialog">
                    <div class="custom-modal-content">
                        <div class="custom-modal-header">
                            <h5 class="custom-modal-title">${this.escapeHtml(title)}</h5>
                            <button type="button" class="custom-modal-close" data-action="close">×</button>
                        </div>
                        <div class="custom-modal-body">
                            ${body}
                        </div>
                        <div class="custom-modal-footer">
                            ${buttons.map((btn, index) => `
                                <button type="button" class="btn ${btn.class}" data-action="button-${index}">
                                    ${this.escapeHtml(btn.text)}
                                </button>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.currentModalElement = document.getElementById('documentModal');

        // Add event listeners for buttons
        buttons.forEach((btn, index) => {
            const buttonElement = this.currentModalElement.querySelector(`[data-action="button-${index}"]`);
            if (buttonElement) {
                buttonElement.addEventListener('click', () => {
                    btn.action();
                });
            }
        });

        // Add event listener for close button
        const closeButton = this.currentModalElement.querySelector('[data-action="close"]');
        if (closeButton) {
            closeButton.addEventListener('click', () => this.closeModal());
        }

        // Show the modal with animation
        setTimeout(() => {
            this.currentModalElement.classList.add('show');
        }, 10);

        // Handle backdrop click to close
        const backdrop = this.currentModalElement.querySelector('.custom-modal-backdrop');
        backdrop.addEventListener('click', () => this.closeModal());

        // Handle escape key to close
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
    }

    /**
     * Close modal
     */
    closeModal() {
        if (this.currentModalElement) {
            // Add closing animation
            this.currentModalElement.classList.add('closing');

            setTimeout(() => {
                if (this.currentModalElement) {
                    this.currentModalElement.remove();
                    this.currentModalElement = null;
                }
            }, 300); // Match CSS transition duration
        }
    }

    /**
     * Show notification
     */
    showNotification(message, type = 'info') {
        // Remove existing notifications
        document.querySelectorAll('.notification').forEach(n => n.remove());

        const notificationHTML = `
            <div class="notification alert alert-${type === 'error' ? 'danger' : type} alert-dismissible fade show"
                 style="position: fixed; top: 20px; right: 20px; z-index: 9999; max-width: 300px;">
                ${this.escapeHtml(message)}
                <button type="button" class="btn-close" onclick="this.parentElement.remove()"></button>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', notificationHTML);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            document.querySelector('.notification')?.remove();
        }, 5000);
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Auto-save functionality
     */
    setupAutoSave() {
        if (!documentManager.autoSaveEnabled) return;

        let autoSaveTimeout;

        this.editor.onDidChangeModelContent(() => {
            clearTimeout(autoSaveTimeout);
            autoSaveTimeout = setTimeout(() => {
                const content = this.editor.getValue();
                const currentName = documentManager.currentDocument.name;

                // Auto-save if document has an ID (already saved)
                if (documentManager.currentDocument.id) {
                    try {
                        const currentCategory = documentManager.currentDocument.category || DEFAULT_CATEGORY;
                        documentManager.saveDocument(content, currentName, documentManager.currentDocument.id, currentCategory);
                        this.showSubtleNotification('Auto-saved');
                    } catch (error) {
                        console.error('Auto-save failed:', error);
                    }
                }
                // Auto-save if document has a valid custom name and has content
                else if (currentName &&
                         currentName.trim() &&
                         currentName !== 'Untitled Document' &&
                         content.trim()) {
                    try {
                        const currentCategory = documentManager.currentDocument.category || DEFAULT_CATEGORY;
                        const savedDoc = documentManager.saveDocument(content, currentName.trim(), null, currentCategory);
                        this.updateDocumentTitle();
                        this.showSubtleNotification(`Auto-saved as "${currentName}"`);
                    } catch (error) {
                        console.error('Auto-save failed:', error);
                    }
                }
            }, 2000); // Auto-save after 2 seconds of inactivity
        });
    }

    /**
     * Show subtle notification (less intrusive)
     */
    showSubtleNotification(message) {
        // Remove existing subtle notifications
        document.querySelectorAll('.subtle-notification').forEach(n => n.remove());

        const notificationHTML = `
            <div class="subtle-notification"
                 style="position: fixed; bottom: 20px; right: 20px; z-index: 9999;
                        background: rgba(0,0,0,0.7); color: white; padding: 8px 12px;
                        border-radius: 4px; font-size: 12px; opacity: 0; transition: opacity 0.3s;">
                ${this.escapeHtml(message)}
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', notificationHTML);

        const notification = document.querySelector('.subtle-notification');

        // Fade in
        setTimeout(() => notification.style.opacity = '1', 10);

        // Fade out and remove
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 300);
        }, 1500);
    }
}

// Export for global access
export let documentUI = null;

export function initDocumentUI(editor) {
    documentUI = new DocumentUIManager(editor);
    return documentUI;
}

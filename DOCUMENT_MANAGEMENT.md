# Document Management Features

This document describes the new document management capabilities added to the Mermaid Editor.

## Features

### 1. Document Storage
- **Save Documents**: Save your work to browser local storage with custom names
- **Load Documents**: Retrieve previously saved documents
- **Auto-Save**: Automatically save changes to already saved documents (enabled by default)
- **New Document**: Create a new document (with unsaved changes warning)

### 2. File Operations
- **Import Markdown**: Import `.md`, `.markdown`, or `.txt` files from your device
- **Export as Markdown**: Save current content as a `.md` file to your device
- **Export as PDF**: Export the rendered preview as a PDF file

### 3. Document Management
- **Rename Documents**: Click on the document title to edit it, or use the rename option in the load dialog
- **Delete Documents**: Remove unwanted documents from storage
- **Document List**: View all saved documents with creation/modification dates

## How to Use

### File Menu
The new **File** dropdown in the toolbar provides access to all document operations:

- **New Document**: Creates a new document (warns about unsaved changes)
- **Save**: Saves the current document (prompts for name if new)
- **Load Document**: Opens a dialog showing all saved documents
- **Import Markdown**: Opens file picker to import markdown files
- **Export as Markdown**: Downloads current content as `.md` file
- **Export as PDF**: Downloads the preview pane as PDF

### Document Title
- Click on the document title (next to "Mermaid Editor") to edit the name
- Press Enter to save, Escape to cancel

### Auto-Save
- Auto-save is enabled by default for saved documents
- Changes are automatically saved after 2 seconds of inactivity
- A subtle notification appears when auto-save occurs

## Libraries Used

The following libraries were added to support document management:

1. **file-saver** (^2.0.5): For downloading files (.md export)
2. **jspdf** (^2.5.2): For PDF generation
3. **html2canvas** (^1.4.1): For capturing preview content as image for PDF

## Storage

- Documents are stored in browser's localStorage
- Each document includes: ID, name, content, creation date, modification date
- Current document state is preserved across browser sessions
- Legacy editor content is automatically migrated to the new system

## Browser Compatibility

- All features work in modern browsers (Chrome, Firefox, Safari, Edge)
- localStorage must be available and enabled
- PDF export requires canvas support

## Tips

1. **Naming**: Use descriptive names for your documents for easy identification
2. **Backup**: Consider occasionally exporting important documents as .md files for backup
3. **Organization**: The document list is sorted by modification date (newest first)
4. **Search**: The load dialog shows all documents - you can use browser search (Ctrl/Cmd+F) to find specific documents
5. **PDF Quality**: For best PDF quality, ensure your content is fully rendered before exporting

## Keyboard Shortcuts

- **Ctrl/Cmd + S**: Quick save (if document is already saved)
- **Ctrl/Cmd + N**: New document
- **Enter**: Save document title when editing
- **Escape**: Cancel document title editing

## Troubleshooting

### Documents Not Saving
- Check if localStorage is enabled in your browser
- Ensure you have sufficient storage space
- Try refreshing the page and attempting to save again

### PDF Export Issues
- Ensure the preview pane is fully loaded before exporting
- Complex Mermaid diagrams may take longer to render
- Check browser console for any error messages

### Import Issues
- Ensure the file is a valid text file (.md, .markdown, .txt)
- File must be UTF-8 encoded
- Very large files may cause performance issues

## Data Management

### Clearing Data
To clear all saved documents:
1. Open browser developer tools (F12)
2. Go to Application/Storage tab
3. Find localStorage for your domain
4. Delete keys starting with 'savedDocuments' and 'currentDocument'

### Export All Data
Currently, there's no bulk export feature. To backup all documents:
1. Use the Load Document dialog
2. Load each document individually
3. Export each as markdown

This feature may be added in future updates.

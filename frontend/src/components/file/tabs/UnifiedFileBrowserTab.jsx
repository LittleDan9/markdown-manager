import React, { useState, useEffect, useMemo, useRef } from "react";
import UnifiedFileBrowser from "../../shared/FileBrowser/UnifiedFileBrowser";
import { RootFileBrowserProvider } from "../../../services/fileBrowser/FileBrowserProviders";
import { useUnifiedFileOpening } from "../../../services/core/UnifiedFileOpeningService";

export default function UnifiedFileBrowserTab({
  documents,
  categories,
  onFileOpen,
  _onDocumentDelete,
  onModalHide,
  // GitHub-specific props removed - now handled by separate modal
  _initialRepository = null,
  _setContent = null,
  _setDocumentTitle = null,
  _showSuccess = null,
  _showError = null
}) {
  const [initialPath, setInitialPath] = useState('/');
  const [currentPath, setCurrentPath] = useState('/');

  // Preserve selected file across modal openings
  const [selectedFile, setSelectedFile] = useState(null);

  // Unified file opening hook
  const { openFromFileNode, isOpening, lastError } = useUnifiedFileOpening();

  // Refs to track previous data for stable provider creation
  const prevDocumentsRef = useRef();
  const prevCategoriesRef = useRef();
  const providerRef = useRef();

  // Create root file browser provider - only recreate when data actually changes
  const currentProvider = useMemo(() => {
    const documentsChanged = !prevDocumentsRef.current ||
      prevDocumentsRef.current.length !== documents?.length ||
      prevDocumentsRef.current.some((doc, i) => doc.id !== documents[i]?.id);
    const categoriesChanged = !prevCategoriesRef.current ||
      prevCategoriesRef.current.length !== categories?.length ||
      prevCategoriesRef.current.some((cat, i) => cat !== categories[i]);

    if (documents && categories && (documentsChanged || categoriesChanged || !providerRef.current)) {
      console.log('🏠 Creating root file browser provider (data changed)');
      prevDocumentsRef.current = documents;
      prevCategoriesRef.current = categories;
      providerRef.current = new RootFileBrowserProvider(documents, categories, { filters: { fileTypes: [] } });
    }

    return providerRef.current;
  }, [documents, categories]);

  // Set initial path when provider is created
  useEffect(() => {
    if (currentProvider) {
      const defaultPath = currentProvider.getDefaultPath ? currentProvider.getDefaultPath() : '/';
      setInitialPath(defaultPath);
      setCurrentPath(defaultPath);
      console.log('📍 Setting root path:', defaultPath);
    }
  }, [currentProvider]);

  // Function to track current path changes
  const handlePathChange = (path) => {
    setCurrentPath(path);
    console.log('📍 Current path changed to:', path);
  };

  const handleFileSelect = (file) => {
    console.log('👆 File selected for preview:', file);
    setSelectedFile(file);
  };

  const handleFileOpen = async (file) => {
    console.log('📂 UnifiedFileBrowserTab handleFileOpen:', file);

    // Clear selected file when opening a document
    setSelectedFile(null);

    // Handle local documents (now includes synced GitHub repos)
    const doc = documents?.find((d) => d.id === file.documentId);
    if (doc) {
      onFileOpen(doc);
      onModalHide();
    } else {
      // Fallback: try unified file opening service
      try {
        console.log('🔍 Opening file using unified service:', file);
        const document = await openFromFileNode(file, currentProvider);

        console.log('📄 Document received:', JSON.stringify(document, null, 2));
        onFileOpen(document);
        onModalHide();
      } catch (error) {
        console.error('❌ Failed to open file:', error);
        // Errors are handled by the useUnifiedFileOpening hook
      }
    }
  };

  // Show loading state while provider is being created
  if (!currentProvider) {
    return (
      <div className="d-flex justify-content-center align-items-center p-4">
        <div className="text-muted">
          <i className="bi bi-folder2 me-2"></i>
          Loading file browser...
        </div>
      </div>
    );
  }

  return (
    <div className="unified-file-browser-container">
      {/* Unified File Browser - Shows both local documents and GitHub repositories */}
      <div className="file-browser-content">
        <UnifiedFileBrowser
          key="unified-browser"
          dataProvider={currentProvider}
          initialSelectedFile={selectedFile}
          onFileSelect={handleFileSelect}  // Single-click: Preview
          onFileOpen={handleFileOpen}      // Double-click: Open in editor
          onPathChange={handlePathChange}   // Track path changes
          initialPath={initialPath}
          breadcrumbType="local"
          breadcrumbData={{
            categories: categories,
            documents: documents,
            showGitHub: true
          }}
          config={{
            allowMultiSelect: false,
            showPreview: true,
            showActions: true,
            showBreadcrumb: true
          }}
          className="unified-browser"
          style={{ height: '500px' }}
        />
      </div>

      {/* Loading/Error States for file operations */}
      {isOpening && (
        <div className="text-center p-3">
          <div className="spinner-border spinner-border-sm me-2" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          Opening file...
        </div>
      )}

      {lastError && (
        <div className="alert alert-danger small mt-2">
          <strong>Error:</strong> {lastError.message}
        </div>
      )}
    </div>
  );
}
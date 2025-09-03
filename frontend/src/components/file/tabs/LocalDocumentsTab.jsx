import React, { useState, useEffect } from "react";
import { Card } from "react-bootstrap";
import UnifiedFileBrowser from "../../shared/FileBrowser/UnifiedFileBrowser";
import { LocalDocumentsProvider } from "../../../services/FileBrowserProviders";

export default function LocalDocumentsTab({
  documents,
  categories,
  onFileOpen,
  onDocumentDelete,
  onModalHide
}) {
  const [localDocumentsProvider, setLocalDocumentsProvider] = useState(null);

  // Create local documents provider when documents change
  useEffect(() => {
    if (documents && categories) {
      console.log('Creating LocalDocumentsProvider with:', { documents: documents?.length, categories: categories?.length });
      const provider = new LocalDocumentsProvider({ documents, categories });
      setLocalDocumentsProvider(provider);
    }
  }, [documents, categories]);

  const handleFileOpen = (file) => {
    console.log('LocalDocumentsTab handleFileOpen:', file);
    const doc = documents?.find((d) => d.id === file.documentId);
    if (doc) {
      onFileOpen(doc);
      onModalHide();
    }
  };

  // Show loading state while provider is being created
  if (!localDocumentsProvider) {
    return (
      <div className="d-flex justify-content-center align-items-center p-4">
        <div className="text-muted">
          <i className="bi bi-folder2 me-2"></i>
          Loading documents...
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      flex: 1,
      minHeight: 0
    }}>
      {/* Local Documents Header for visual consistency */}
      <Card className="mb-3 border-0 shadow-sm">
        <Card.Body className="p-3">
          <div className="d-flex align-items-center justify-content-between">
            <div className="d-flex align-items-center">
              <i className="bi bi-folder2-open text-primary me-2" style={{ fontSize: '1.1rem' }}></i>
              <div>
                <h6 className="mb-0 fw-semibold">My Documents</h6>
                <small className="text-muted">
                  {documents?.length || 0} document{documents?.length !== 1 ? 's' : ''} 
                  {categories?.length ? ` across ${categories.length} categor${categories.length !== 1 ? 'ies' : 'y'}` : ''}
                </small>
              </div>
            </div>
            <div className="text-muted">
              <i className="bi bi-hdd" style={{ fontSize: '1.2rem' }}></i>
            </div>
          </div>
        </Card.Body>
      </Card>

      <UnifiedFileBrowser
        dataProvider={localDocumentsProvider}
        onFileOpen={handleFileOpen}
        config={{
          showActions: false,
          showBreadcrumb: true,
          showTreeBreadcrumb: false
        }}
        breadcrumbType="local"
        breadcrumbData={{ 
          categories: categories,
          documents: documents 
        }}
      />
    </div>
  );
}

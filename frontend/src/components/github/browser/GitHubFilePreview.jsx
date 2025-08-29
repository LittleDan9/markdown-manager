import React from 'react';
import { Card, Alert, Spinner } from 'react-bootstrap';

export default function GitHubFilePreview({ selectedFile, fileContent, loading }) {
  const isMarkdownFile = (filename) => {
    return /\.(md|markdown)$/i.test(filename);
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const renderPreview = () => {
    if (!selectedFile) {
      return (
        <Alert variant="info" className="m-4">
          <i className="bi bi-info-circle me-2"></i>
          Select a file from the tree to preview its contents.
        </Alert>
      );
    }

    if (selectedFile.type === 'dir') {
      return (
        <Alert variant="secondary" className="m-4">
          <i className="bi bi-folder me-2"></i>
          <strong>{selectedFile.name}</strong> is a directory.
          <br />
          <small className="text-muted">
            Expand it in the file tree to browse its contents.
          </small>
        </Alert>
      );
    }

    if (!isMarkdownFile(selectedFile.name)) {
      return (
        <Alert variant="warning" className="m-4">
          <i className="bi bi-file-earmark me-2"></i>
          <strong>{selectedFile.name}</strong> is not a markdown file.
          <br />
          <small className="text-muted">
            Only .md and .markdown files can be imported.
          </small>
        </Alert>
      );
    }

    if (loading) {
      return (
        <div className="text-center p-4">
          <Spinner />
          <div className="mt-2 small text-muted">Loading file content...</div>
        </div>
      );
    }

    return (
      <div className="h-100 d-flex flex-column">
        <div className="p-3 border-bottom">
          <div className="d-flex align-items-center justify-content-between">
            <div>
              <h6 className="mb-1">
                <i className="bi bi-file-earmark-text me-2"></i>
                {selectedFile.name}
              </h6>
              <small className="text-muted">
                {formatFileSize(selectedFile.size)} • Ready to import
              </small>
            </div>
            <i className="bi bi-check-circle text-success fs-5" title="Can be imported"></i>
          </div>
        </div>
        
        <div className="flex-grow-1 overflow-auto file-preview-content">
          <pre className="p-3 mb-0 h-100 overflow-auto">
            <code>{fileContent}</code>
          </pre>
        </div>
      </div>
    );
  };

  return (
    <Card className="h-100 border-0 rounded-0">
      <Card.Header className="py-2">
        <small className="text-muted">
          <i className="bi bi-eye me-1"></i>
          Preview
        </small>
      </Card.Header>
      <Card.Body className="p-0 h-100 d-flex flex-column">
        {renderPreview()}
      </Card.Body>
    </Card>
  );
}

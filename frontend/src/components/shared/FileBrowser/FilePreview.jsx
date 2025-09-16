/**
 * File Preview Component - Shows content of selected file
 * Abstracted from GitHub file preview for universal use with existing styling
 */

import React, { useState, useEffect } from 'react';
import { Card, Alert, Spinner, Badge, Button } from 'react-bootstrap';

export default function FilePreview({
  file,
  dataProvider,
  config
}) {
  const [fileContent, setFileContent] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (file && file.type === 'file' && dataProvider) {
      loadFileContent();
    } else {
      setFileContent('');
    }
  }, [file, dataProvider]);

  const loadFileContent = async () => {
    setLoading(true);
    try {
      const content = await dataProvider.getFileContent(file);
      setFileContent(content);
    } catch (error) {
      console.error('Failed to load file content:', error);
      setFileContent('');
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (size) => {
    if (!size) return '-';
    
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  const renderFileInfo = () => {
    if (!file) return null;

    const isFolder = file.type === 'folder';

    return (
      <div className="file-info-section p-3 border-bottom">
        <div className="d-flex align-items-center mb-2">
          <i className={`bi ${isFolder ? 'bi-folder-fill' : 'bi-file-text'} fs-4 me-2`}></i>
          <div className="flex-grow-1">
            <h6 className="mb-0">{file.name}</h6>
            <small className="text-muted">{file.path}</small>
          </div>
        </div>

        <div className="file-metadata">
          <div className="d-flex flex-wrap gap-2 mb-2">
            <Badge bg={file.source === 'local' ? 'primary' : 'secondary'}>
              {file.source}
            </Badge>
            <Badge bg={isFolder ? 'info' : 'light'} text={isFolder ? 'white' : 'dark'}>
              {isFolder ? 'Folder' : 'File'}
            </Badge>
          </div>

          {!isFolder && (
            <div className="file-details">
              {file.size !== undefined && (
                <div className="detail-item">
                  <small className="text-muted">Size: </small>
                  <small>{formatFileSize(file.size)}</small>
                </div>
              )}
              {file.lastModified && (
                <div className="detail-item">
                  <small className="text-muted">Modified: </small>
                  <small>{new Date(file.lastModified).toLocaleString()}</small>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderFileContent = () => {
    if (!file || file.type === 'folder') {
      return (
        <div className="text-center text-muted p-4">
          <i className="bi bi-folder display-6 d-block mb-2 opacity-50"></i>
          <p>Select a file to preview its content</p>
        </div>
      );
    }

    if (loading) {
      return (
        <div className="d-flex justify-content-center align-items-center p-4">
          <Spinner 
            animation="border" 
            role="status" 
            variant="primary"
          >
            <span className="visually-hidden">Loading content...</span>
          </Spinner>
        </div>
      );
    }

    if (!fileContent) {
      return (
        <div className="text-center text-muted p-4">
          <i className="bi bi-file-text display-6 d-block mb-2 opacity-50"></i>
          <p>No content available</p>
        </div>
      );
    }

    // Simple content preview - could be enhanced with syntax highlighting
    return (
      <div className="file-content-preview">
        <pre className="content-preview p-3">{fileContent}</pre>
      </div>
    );
  };

  return (
    <div className="file-browser-preview">
      {/* Header */}
      <div className="preview-header p-2">
        <small className="text-muted">
          <i className="bi bi-eye me-1"></i>
          Preview
        </small>
      </div>

      {/* File Info */}
      {renderFileInfo()}

      {/* Content */}
      <div className="preview-content">
        {renderFileContent()}
      </div>
    </div>
  );
}

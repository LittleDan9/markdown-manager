/**
 * File Browser Actions Component - Action buttons for file operations
 * Abstracted from GitHub browser actions for universal use
 */

import React from 'react';
import { Button, ButtonGroup } from 'react-bootstrap';

export default function FileBrowserActions({
  selectedFile,
  selectedFiles,
  onFileOpen,
  onMultiSelect,
  config
}) {
  const handleFileOpen = () => {
    if (onFileOpen && selectedFile) {
      onFileOpen(selectedFile);
    }
  };

  const isMarkdownFile = (filename) => {
    return filename && (filename.toLowerCase().endsWith('.md') || filename.toLowerCase().endsWith('.markdown'));
  };

  const renderOpenButton = () => {
    if (!selectedFile || selectedFile.type !== 'file') {
      return null;
    }

    return (
      <Button
        variant="primary"
        onClick={handleFileOpen}
        disabled={!isMarkdownFile(selectedFile.name)}
      >
        <i className="bi bi-box-arrow-in-right me-1"></i>
        Open File
      </Button>
    );
  };

  return (
    <div className="file-browser-actions p-2 d-flex align-items-center justify-content-between">
      <div className="flex-grow-1">
        {selectedFile && (
          <small className="text-muted">
            <i className="bi bi-info-circle me-1"></i>
            {selectedFile.type === 'file' ? 'File' : 'Folder'} selected: {selectedFile.name}
          </small>
        )}
        {selectedFiles && selectedFiles.length > 1 && (
          <small className="text-muted">
            <i className="bi bi-info-circle me-1"></i>
            {selectedFiles.length} files selected
          </small>
        )}
      </div>

      <ButtonGroup>
        {renderOpenButton()}
      </ButtonGroup>
    </div>
  );
}

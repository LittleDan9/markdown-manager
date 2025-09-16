/**
 * File Browser Actions Component - Action buttons for file operations
 * Abstracted from GitHub browser actions for universal use
 */

import React from 'react';
import { Button, ButtonGroup } from 'react-bootstrap';
import { isMarkdownFile } from '../../../utils/fileBrowserUtils';

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

  const renderOpenButton = () => {
    if (!selectedFile || selectedFile.type !== 'file') {
      return (
        <Button
          variant="outline-secondary"
          disabled
          size="sm"
        >
          <i className="bi bi-box-arrow-in-right me-1"></i>
          Open File
        </Button>
      );
    }

    const isMarkdown = isMarkdownFile(selectedFile);
    
    return (
      <Button
        variant={isMarkdown ? "primary" : "outline-secondary"}
        onClick={handleFileOpen}
        disabled={!isMarkdown}
        size="sm"
      >
        <i className="bi bi-box-arrow-in-right me-1"></i>
        Open File
      </Button>
    );
  };

  return (
    <div className="file-browser-actions d-flex align-items-center justify-content-between">
      <div className="flex-grow-1">
        {selectedFile ? (
          <small className="text-muted">
            <i className="bi bi-info-circle me-1"></i>
            {selectedFile.type === 'file' ? (
              <>
                File selected: <strong>{selectedFile.name}</strong>
                {isMarkdownFile(selectedFile) ? (
                  <span className="text-success ms-2">
                    <i className="bi bi-check-circle me-1"></i>
                    Can be opened
                  </span>
                ) : (
                  <span className="text-warning ms-2">
                    <i className="bi bi-exclamation-triangle me-1"></i>
                    Only Markdown files can be opened
                  </span>
                )}
              </>
            ) : (
              <>Folder selected: <strong>{selectedFile.name}</strong></>
            )}
          </small>
        ) : (
          <small className="text-muted">
            <i className="bi bi-cursor me-1"></i>
            Select a file to open it, or double-click to open directly
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

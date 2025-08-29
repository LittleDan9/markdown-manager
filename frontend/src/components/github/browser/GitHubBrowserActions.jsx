import React, { useState } from 'react';
import { Button, Spinner } from 'react-bootstrap';
import { useNotification } from '../../NotificationProvider';
import gitHubApi from '../../../api/gitHubApi';

export default function GitHubBrowserActions({ 
  repository, 
  selectedFile, 
  selectedBranch, 
  canImport, 
  onClose 
}) {
  const [importing, setImporting] = useState(false);
  const { showSuccess, showError } = useNotification();

  const handleImport = async () => {
    if (!canImport || !selectedFile) return;

    try {
      setImporting(true);
      
      await gitHubApi.importFile({
        repository_id: repository.id,
        file_path: selectedFile.path,
        branch: selectedBranch,
        file_name: selectedFile.name
      });

      showSuccess(`Successfully imported ${selectedFile.name}`);
      onClose();
    } catch (err) {
      console.error('Import failed:', err);
      showError('Failed to import file. Please try again.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="d-flex justify-content-between align-items-center w-100">
      <div className="text-muted small">
        {selectedFile ? (
          <>
            <i className="bi bi-file-earmark me-1"></i>
            {selectedFile.path}
            {canImport && (
              <span className="text-success ms-2">
                <i className="bi bi-check-circle me-1"></i>
                Ready to import
              </span>
            )}
          </>
        ) : (
          'No file selected'
        )}
      </div>
      
      <div>
        <Button 
          variant="secondary" 
          onClick={onClose}
          disabled={importing}
          className="me-2"
        >
          Cancel
        </Button>
        
        <Button
          variant="primary"
          onClick={handleImport}
          disabled={!canImport || importing}
        >
          {importing ? (
            <>
              <Spinner size="sm" className="me-2" />
              Importing...
            </>
          ) : (
            <>
              <i className="bi bi-download me-2"></i>
              Import File
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

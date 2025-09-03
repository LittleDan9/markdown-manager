import React, { useState, useEffect } from 'react';
import { Modal, Alert } from 'react-bootstrap';
import { useNotification } from '../../NotificationProvider';
import gitHubApi from '../../../api/gitHubApi';
import { isMarkdownFile } from '../../../utils/fileBrowserUtils';
import UnifiedFileBrowser from '../../shared/FileBrowser/UnifiedFileBrowser';
import { GitHubProvider } from '../../../services/FileBrowserProviders';
import GitHubBrowserHeader from './GitHubBrowserHeader';

export default function GitHubRepositoryBrowser({ 
  show, 
  onHide, 
  repository, 
  accountId 
}) {
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [provider, setProvider] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [importing, setImporting] = useState(false);
  const { showError, showSuccess } = useNotification();

  // Reset state when modal opens/closes or repository changes
  useEffect(() => {
    if (show && repository) {
      loadBranches();
      setSelectedFile(null);
      setError(null);
    }
  }, [show, repository]);

  // Create GitHub provider when branch is selected
  useEffect(() => {
    if (selectedBranch && repository) {
      const githubProvider = new GitHubProvider(repository, selectedBranch);
      setProvider(githubProvider);
    }
  }, [selectedBranch, repository]);

  // Load repository branches
  const loadBranches = async () => {
    try {
      setLoading(true);
      const branchData = await gitHubApi.getRepositoryBranches(repository.id);
      setBranches(branchData);
      
      // Set default branch
      const defaultBranch = branchData.find(b => b.name === repository.default_branch) || branchData[0];
      if (defaultBranch) {
        setSelectedBranch(defaultBranch.name);
      }
    } catch (err) {
      setError('Failed to load repository branches');
      showError('Failed to load branches');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (file) => {
    setSelectedFile(file);
  };

  const handleFileImport = async (file) => {
    if (!file || file.type !== 'file' || !isMarkdownFile(file)) {
      return;
    }

    try {
      setImporting(true);
      
      await gitHubApi.importDocument(
        repository.id,
        file.path,
        selectedBranch
      );

      showSuccess(`Successfully imported ${file.name}`);
      onHide();
    } catch (err) {
      console.error('Import failed:', err);
      showError('Failed to import file. Please try again.');
    } finally {
      setImporting(false);
    }
  };

  const canImportFile = () => {
    return selectedFile && 
           selectedFile.type === 'file' && 
           isMarkdownFile(selectedFile);
  };

  if (!repository) return null;

  return (
    <Modal 
      show={show} 
      onHide={onHide} 
      size="xl" 
      className="github-repository-browser"
      dialogClassName="open-file-modal-scroll"
      style={{ '--bs-modal-width': '90vw' }}
    >
      <Modal.Header closeButton>
        <Modal.Title>
          <i className="bi bi-folder-open me-2"></i>
          Browse Repository: {repository.name}
        </Modal.Title>
      </Modal.Header>

      <Modal.Body style={{ 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        padding: 0
      }}>
        {error && (
          <Alert variant="danger" className="m-3 mb-0">
            {error}
          </Alert>
        )}

        <GitHubBrowserHeader
          repository={repository}
          branches={branches}
          selectedBranch={selectedBranch}
          onBranchChange={setSelectedBranch}
          loading={loading}
        />

        {provider ? (
          <div style={{ 
            flex: 1, 
            display: 'flex', 
            flexDirection: 'column',
            minHeight: 0,
            padding: '1rem'
          }}>
            <UnifiedFileBrowser
              dataProvider={provider}
              onFileSelect={handleFileSelect}
              onFileOpen={handleFileImport}
              config={{
                allowMultiSelect: false,
                showPreview: true,
                showActions: false,
                defaultView: 'tree',
                filters: {
                  fileTypes: ['.md', '.markdown', '.txt'],
                  sources: ['github']
                }
              }}
              showHeader={false}
              showActions={false}
              className="github-browser-content"
            />
          </div>
        ) : (
          <div className="d-flex justify-content-center align-items-center p-4">
            <span className="text-muted">Select a branch to browse files</span>
          </div>
        )}
      </Modal.Body>

      <Modal.Footer>
        <div className="d-flex justify-content-between align-items-center w-100">
          <div className="text-muted small">
            {selectedFile ? (
              <>
                <i className="bi bi-file-earmark me-1"></i>
                {selectedFile.path}
                {canImportFile() && (
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
            <button 
              type="button"
              className="btn btn-secondary me-2" 
              onClick={onHide}
              disabled={importing}
            >
              Cancel
            </button>
            
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => handleFileImport(selectedFile)}
              disabled={!canImportFile() || importing}
            >
              {importing ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                  Importing...
                </>
              ) : (
                <>
                  <i className="bi bi-download me-2"></i>
                  Import File
                </>
              )}
            </button>
          </div>
        </div>
      </Modal.Footer>
    </Modal>
  );
}

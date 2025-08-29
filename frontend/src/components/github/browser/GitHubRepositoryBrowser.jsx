import React, { useState, useEffect } from 'react';
import { Modal, Row, Col, Alert } from 'react-bootstrap';
import { useNotification } from '../../NotificationProvider';
import gitHubApi from '../../../api/gitHubApi';
import { isMarkdownFile } from '../../../utils/githubUtils';
import GitHubBrowserHeader from './GitHubBrowserHeader';
import GitHubFileTree from './GitHubFileTree';
import GitHubFileList from './GitHubFileList';
import GitHubBrowserActions from './GitHubBrowserActions';

export default function GitHubRepositoryBrowser({ 
  show, 
  onHide, 
  repository, 
  accountId 
}) {
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [fileTree, setFileTree] = useState([]);
  const [currentPath, setCurrentPath] = useState('');
  const [currentFileList, setCurrentFileList] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { showError } = useNotification();

  // Reset state when modal opens/closes or repository changes
  useEffect(() => {
    if (show && repository) {
      loadBranches();
      setSelectedFile(null);
      setFileContent('');
      setCurrentPath('');
      setCurrentFileList([]);
      setError(null);
    }
  }, [show, repository]);

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

  // Load file tree when branch changes
  useEffect(() => {
    if (selectedBranch && repository) {
      loadFileTree();
    }
  }, [selectedBranch, repository]);

  const loadFileTree = async () => {
    try {
      setLoading(true);
      const contents = await gitHubApi.getRepositoryContents(
        repository.id, 
        '', // root path
        selectedBranch
      );
      setFileTree(contents);
      setCurrentFileList(contents); // Initialize file list with root contents
    } catch (err) {
      setError('Failed to load repository contents');
      showError('Failed to load repository contents');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (file) => {
    setSelectedFile(file);
    
    // If it's a directory clicked in the tree, update the file list to show its contents
    if (file.type === 'dir') {
      try {
        setLoading(true);
        const contents = await gitHubApi.getRepositoryContents(
          repository.id,
          file.path,
          selectedBranch
        );
        setCurrentFileList(contents);
        setCurrentPath(file.path);
      } catch (err) {
        setError('Failed to load folder contents');
        showError('Failed to load folder contents');
      } finally {
        setLoading(false);
      }
    } else {
      // For files, just update selection - don't load content until import
      setFileContent('');
    }
  };

  // Separate handler for file list navigation (directories only)
  const handleFileListNavigate = async (file) => {
    if (file.type === 'dir') {
      try {
        setLoading(true);
        const contents = await gitHubApi.getRepositoryContents(
          repository.id,
          file.path,
          selectedBranch
        );
        setCurrentFileList(contents);
        setCurrentPath(file.path);
        // Also update selection to sync with tree
        setSelectedFile(file);
      } catch (err) {
        setError('Failed to load folder contents');
        showError('Failed to load folder contents');
      } finally {
        setLoading(false);
      }
    } else {
      // For files, just update selection - don't load content until import
      setSelectedFile(file);
      setFileContent('');
    }
  };

  // Navigate to a specific path in the file list
  const handleNavigateToPath = async (path) => {
    try {
      setLoading(true);
      const contents = await gitHubApi.getRepositoryContents(
        repository.id,
        path,
        selectedBranch
      );
      setCurrentFileList(contents);
      setCurrentPath(path);
      
      // Create a virtual folder object to sync with tree selection
      if (path) {
        const folderParts = path.split('/');
        const folderName = folderParts[folderParts.length - 1];
        const virtualFolder = {
          name: folderName,
          path: path,
          type: 'dir'
        };
        setSelectedFile(virtualFolder);
      } else {
        // If navigating to root, clear selection
        setSelectedFile(null);
      }
    } catch (err) {
      setError('Failed to load folder contents');
      showError('Failed to load folder contents');
    } finally {
      setLoading(false);
    }
  };

  const canImportFile = () => {
    return selectedFile && 
           selectedFile.type === 'file' && 
           isMarkdownFile(selectedFile.name);
  };

  if (!repository) return null;

  return (
    <Modal 
      show={show} 
      onHide={onHide} 
      size="xl" 
      className="github-repository-browser"
      dialogClassName="modal-90w"
    >
      <Modal.Header closeButton>
        <Modal.Title>
          <i className="bi bi-folder-open me-2"></i>
          Browse Repository: {repository.name}
        </Modal.Title>
      </Modal.Header>

      <Modal.Body className="p-0">
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

        <div className="d-flex">
          <div className="border-end" style={{ width: '30%' }}>
            <GitHubFileTree
              fileTree={fileTree}
              selectedFile={selectedFile}
              onFileSelect={handleFileSelect}
              loading={loading}
              repository={repository}
              branch={selectedBranch}
            />
          </div>
          
          <div style={{ width: '70%' }}>
            <GitHubFileList
              fileTree={currentFileList}
              selectedFile={selectedFile}
              onFileSelect={handleFileListNavigate}
              onNavigateToPath={handleNavigateToPath}
              loading={loading}
              currentPath={currentPath}
            />
          </div>
        </div>
      </Modal.Body>

      <Modal.Footer>
        <GitHubBrowserActions
          repository={repository}
          selectedFile={selectedFile}
          selectedBranch={selectedBranch}
          canImport={canImportFile()}
          onClose={onHide}
        />
      </Modal.Footer>
    </Modal>
  );
}

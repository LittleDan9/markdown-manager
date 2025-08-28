import React, { useState, useEffect } from 'react';
import { Modal, Button, Alert, Spinner, ListGroup, Breadcrumb, Form } from 'react-bootstrap';
import { useNotification } from '../NotificationProvider';
import gitHubApi from '../../api/gitHubApi';
import documentsApi from '../../api/documentsApi';

export default function GitHubFileBrowser({
  show,
  onHide,
  onFileImported,
  initialRepository = null
}) {
  const [repositories, setRepositories] = useState([]);
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [currentPath, setCurrentPath] = useState('');
  const [pathContents, setPathContents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState('main');
  const { showSuccess, showError } = useNotification();

  useEffect(() => {
    if (show) {
      if (initialRepository) {
        // Skip repository selection and go directly to the specified repository
        setRepositories([initialRepository]); // Set just this repository in the list
        selectRepository(initialRepository);
      } else {
        loadRepositories();
      }
    } else {
      // Reset state when modal closes
      setSelectedRepo(null);
      setCurrentPath('');
      setPathContents([]);
      setBranches([]);
      setSelectedBranch('main');
    }
  }, [show, initialRepository]);

  const loadRepositories = async () => {
    setLoading(true);
    try {
      const repos = await gitHubApi.getRepositories();
      setRepositories(repos);
    } catch (error) {
      console.error('Failed to load repositories:', error);
      showError('Failed to load GitHub repositories');
    } finally {
      setLoading(false);
    }
  };

  const selectRepository = async (repo) => {
    setSelectedRepo(repo);
    setCurrentPath('');
    setLoading(true);

    try {
      // Load branches for the repository
      const branchesData = await gitHubApi.getBranches(repo.id);
      setBranches(branchesData);

      // Set default branch
      const defaultBranch = branchesData.find(b => b.is_default);
      const branch = defaultBranch ? defaultBranch.name : (repo.default_branch || 'main');
      setSelectedBranch(branch);

      // Load root contents
      await loadPath('', repo, branch);
    } catch (error) {
      console.error('Failed to load repository:', error);
      showError('Failed to load repository contents');
    } finally {
      setLoading(false);
    }
  };

  const loadPath = async (path, repo = selectedRepo, branch = selectedBranch) => {
    if (!repo) return;

    setLoading(true);
    try {
      const contents = await gitHubApi.getRepositoryContents(repo.id, path, branch);
      setPathContents(contents);
      setCurrentPath(path);
    } catch (error) {
      console.error('Failed to load path contents:', error);
      showError('Failed to load folder contents');
    } finally {
      setLoading(false);
    }
  };

  const navigateToPath = (path) => {
    loadPath(path);
  };

  const navigateUp = () => {
    if (currentPath) {
      const parentPath = currentPath.split('/').slice(0, -1).join('/');
      loadPath(parentPath);
    }
  };

  const onBranchChange = (branch) => {
    setSelectedBranch(branch);
    loadPath(currentPath, selectedRepo, branch);
  };

  const importFile = async (file) => {
    if (file.type !== 'file') return;

    // Check if it's a markdown file
    if (!file.name.toLowerCase().match(/\.(md|markdown)$/)) {
      showError('Only Markdown files (.md, .markdown) can be imported');
      return;
    }

    setImporting(true);
    try {
      const importData = {
        repository_id: selectedRepo.id,
        file_path: file.path,
        branch: selectedBranch,
        document_name: file.name.replace(/\.(md|markdown)$/i, '') // Remove extension for document name
      };

      const result = await gitHubApi.importFile(importData);

      showSuccess(`Successfully imported "${file.name}"`);
      onFileImported?.(result);
      onHide();
    } catch (error) {
      console.error('Failed to import file:', error);
      showError('Failed to import file from GitHub');
    } finally {
      setImporting(false);
    }
  };

  const openFile = async (file) => {
    if (!file.document_id) {
      showError('Document ID not found');
      return;
    }

    setImporting(true);
    try {
      // Use the standard document API instead of GitHub-specific API
      const result = await documentsApi.getDocument(file.document_id);

      showSuccess(`Opened "${file.name}"`);
      onFileImported?.(result); // The documentsApi returns the document directly
      onHide();
    } catch (error) {
      console.error('Failed to open document:', error);
      showError('Failed to open document');
    } finally {
      setImporting(false);
    }
  };

  const handleFileAction = (item) => {
    if (item.type === 'dir') {
      navigateToPath(item.path);
    } else if (isMarkdownFile(item)) {
      if (item.is_imported) {
        openFile(item);
      } else {
        importFile(item);
      }
    }
  };

  const renderBreadcrumb = () => {
    if (!selectedRepo) return null;

    const pathParts = currentPath ? currentPath.split('/') : [];

    return (
      <Breadcrumb className="mb-3">
        <Breadcrumb.Item
          active={!currentPath}
          onClick={() => {
            if (currentPath) {
              loadPath('');
            } else if (initialRepository) {
              // If we're at the root of an initially selected repository, close the modal
              onHide();
            }
          }}
          style={{ cursor: currentPath || initialRepository ? 'pointer' : 'default' }}
        >
          {selectedRepo.name}
        </Breadcrumb.Item>
        {pathParts.map((part, index) => {
          const isLast = index === pathParts.length - 1;
          const fullPath = pathParts.slice(0, index + 1).join('/');

          return (
            <Breadcrumb.Item
              key={fullPath}
              active={isLast}
              onClick={() => !isLast && loadPath(fullPath)}
              style={{ cursor: !isLast ? 'pointer' : 'default' }}
            >
              {part}
            </Breadcrumb.Item>
          );
        })}
      </Breadcrumb>
    );
  };

  const getFileIcon = (item) => {
    if (item.type === 'dir') {
      return '📁';
    } else if (item.name.toLowerCase().match(/\.(md|markdown)$/)) {
      return '📄';
    } else {
      return '📎';
    }
  };

  const isMarkdownFile = (item) => {
    return item.type === 'file' && item.name.toLowerCase().match(/\.(md|markdown)$/);
  };

  const sortPathContents = (contents) => {
    return [...contents].sort((a, b) => {
      // First, separate directories and files
      if (a.type === 'dir' && b.type === 'file') return -1;
      if (a.type === 'file' && b.type === 'dir') return 1;
      
      // Then sort alphabetically by name within each type
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    });
  };

  return (
    <Modal show={show} onHide={onHide} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>
          <i className="bi bi-github me-2"></i>
          Browse GitHub Files
        </Modal.Title>
      </Modal.Header>

      <Modal.Body style={{ minHeight: '500px' }}>
        {!selectedRepo ? (
          // Repository selection
          <div>
            <h6 className="mb-3">Select a Repository</h6>
            {loading ? (
              <div className="text-center py-4">
                <Spinner animation="border" />
                <div className="mt-2">Loading repositories...</div>
              </div>
            ) : repositories.length === 0 ? (
              <Alert variant="info">
                <i className="bi bi-info-circle me-2"></i>
                No repositories found. Make sure you have GitHub repositories accessible with your account.
              </Alert>
            ) : (
              <ListGroup>
                {repositories.map((repo) => (
                  <ListGroup.Item
                    key={repo.id}
                    action
                    onClick={() => selectRepository(repo)}
                    className="d-flex justify-content-between align-items-center"
                  >
                    <div>
                      <div className="fw-semibold">
                        <i className={`bi ${repo.private ? 'bi-lock' : 'bi-unlock'} me-2`}></i>
                        {repo.name}
                      </div>
                      <small className="text-muted">{repo.full_name}</small>
                      {repo.description && (
                        <div className="small text-muted mt-1">{repo.description}</div>
                      )}
                    </div>
                    <i className="bi bi-chevron-right"></i>
                  </ListGroup.Item>
                ))}
              </ListGroup>
            )}
          </div>
        ) : (
          // File browser
          <div>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={() => {
                  if (initialRepository) {
                    // If we started with a specific repository, close the modal
                    onHide();
                  } else {
                    // Otherwise, go back to repository selection
                    setSelectedRepo(null);
                    loadRepositories();
                  }
                }}
              >
                <i className="bi bi-arrow-left me-1"></i>
                {initialRepository ? 'Close' : 'Back to Repositories'}
              </Button>

              {branches.length > 1 && (
                <Form.Select
                  size="sm"
                  style={{ width: 'auto' }}
                  value={selectedBranch}
                  onChange={(e) => onBranchChange(e.target.value)}
                >
                  {branches.map((branch) => (
                    <option key={branch.name} value={branch.name}>
                      {branch.name} {branch.is_default ? '(default)' : ''}
                    </option>
                  ))}
                </Form.Select>
              )}
            </div>

            {renderBreadcrumb()}

            {loading ? (
              <div className="text-center py-4">
                <Spinner animation="border" />
                <div className="mt-2">Loading contents...</div>
              </div>
            ) : (
              <div>
                {currentPath && (
                  <ListGroup.Item
                    action
                    onClick={navigateUp}
                    className="border-0 ps-0 text-muted"
                  >
                    <i className="bi bi-arrow-up me-2"></i>
                    .. (up)
                  </ListGroup.Item>
                )}

                <ListGroup variant="flush">
                  {sortPathContents(pathContents).map((item) => (
                    <ListGroup.Item
                      key={item.path}
                      action={item.type === 'dir' || isMarkdownFile(item)}
                      onClick={() => handleFileAction(item)}
                      className="d-flex justify-content-between align-items-center"
                      style={{
                        cursor: item.type === 'dir' || isMarkdownFile(item) ? 'pointer' : 'default',
                        opacity: !isMarkdownFile(item) && item.type === 'file' ? 0.6 : 1
                      }}
                    >
                      <div className="d-flex align-items-center">
                        <span className="me-3" style={{ fontSize: '1.2em' }}>
                          {getFileIcon(item)}
                        </span>
                        <div>
                          <div className="d-flex align-items-center">
                            {item.name}
                            {item.is_imported && (
                              <span className="badge bg-success ms-2 small">Imported</span>
                            )}
                          </div>
                          {item.type === 'file' && !isMarkdownFile(item) && (
                            <small className="text-muted">Not a markdown file</small>
                          )}
                          {item.type === 'file' && item.size && (
                            <small className="text-muted ms-2">
                              {(item.size / 1024).toFixed(1)} KB
                            </small>
                          )}
                        </div>
                      </div>

                      {item.type === 'dir' && (
                        <i className="bi bi-chevron-right"></i>
                      )}

                      {isMarkdownFile(item) && (
                        <Button
                          variant={item.is_imported ? "outline-success" : "outline-primary"}
                          size="sm"
                          disabled={importing}
                        >
                          {importing ? (
                            <Spinner animation="border" size="sm" />
                          ) : (
                            <>
                              <i className={`bi ${item.is_imported ? 'bi-folder-open' : 'bi-download'} me-1`}></i>
                              {item.is_imported ? 'Open' : 'Import'}
                            </>
                          )}
                        </Button>
                      )}
                    </ListGroup.Item>
                  ))}
                </ListGroup>

                {pathContents.length === 0 && (
                  <div className="text-center py-4 text-muted">
                    <i className="bi bi-folder2-open" style={{ fontSize: '2rem' }}></i>
                    <div className="mt-2">This folder is empty</div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onHide} disabled={importing}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

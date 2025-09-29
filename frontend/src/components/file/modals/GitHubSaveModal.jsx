import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Alert, Spinner, Row, Col, InputGroup } from 'react-bootstrap';
import PropTypes from 'prop-types';
import { useNotification } from '@/components/NotificationProvider';
import gitHubApi from '@/api/gitHubApi';

function GitHubSaveModal({ show, onHide, document, onSaveSuccess }) {
  const [repositories, setRepositories] = useState([]);
  const [branches, setBranches] = useState([]);
  const [selectedRepository, setSelectedRepository] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('main');
  const [createNewBranch, setCreateNewBranch] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [baseBranch, setBaseBranch] = useState('main');
  const [filePath, setFilePath] = useState('');
  const [commitMessage, setCommitMessage] = useState('');
  const [repositoryStatus, setRepositoryStatus] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [error, setError] = useState('');
  const { showSuccess, showError } = useNotification();

  // Load repositories on modal open
  useEffect(() => {
    if (show) {
      loadRepositories();
      // Set default file path and commit message
      if (document) {
        const defaultName = document.name || 'Untitled Document';
        setFilePath(defaultName.endsWith('.md') ? defaultName : `${defaultName}.md`);
        setCommitMessage(`Add ${defaultName}`);
      }
      // Reset branch creation state
      setCreateNewBranch(false);
      setNewBranchName('');
      setBaseBranch('main');
    }
  }, [show, document]);

  // Load branches when repository changes
  useEffect(() => {
    if (selectedRepository) {
      loadBranches(selectedRepository);
      loadRepositoryStatus(selectedRepository);
    }
  }, [selectedRepository]);

  const loadRepositories = async () => {
    try {
      setLoadingRepos(true);
      setError('');
      const repos = await gitHubApi.getUserRepositoriesForSave();
      setRepositories(repos);

      if (repos.length > 0) {
        // Auto-select first repository
        setSelectedRepository(repos[0].id.toString());
      }
    } catch (err) {
      setError(`Failed to load repositories: ${err.message}`);
      showError('Failed to load GitHub repositories');
    } finally {
      setLoadingRepos(false);
    }
  };

  const loadBranches = async (repoId) => {
    try {
      setLoadingBranches(true);
      const branchData = await gitHubApi.getRepositoryBranchesForSave(repoId);
      setBranches(branchData);

      // Set default branch
      const defaultBranch = branchData.find(b => b.name === 'main') ||
                           branchData.find(b => b.name === 'master') ||
                           branchData[0];
      if (defaultBranch) {
        setSelectedBranch(defaultBranch.name);
        setBaseBranch(defaultBranch.name);
      }
    } catch (err) {
      setError(`Failed to load branches: ${err.message}`);
      showError('Failed to load repository branches');
    } finally {
      setLoadingBranches(false);
    }
  };

  const loadRepositoryStatus = async (repoId) => {
    try {
      setLoadingStatus(true);
      const status = await gitHubApi.getRepositoryStatus(repoId);
      setRepositoryStatus(status);
    } catch (err) {
      // Don't show error for status check - it's not critical
      console.warn('Failed to load repository status:', err.message);
      setRepositoryStatus(null);
    } finally {
      setLoadingStatus(false);
    }
  };

  const handleSave = async () => {
    if (!selectedRepository || !filePath.trim()) {
      setError('Please select a repository and enter a file path');
      return;
    }

    const targetBranch = createNewBranch ? newBranchName.trim() : selectedBranch;

    if (!targetBranch) {
      setError(createNewBranch ? 'Please enter a new branch name' : 'Please select a branch');
      return;
    }

    if (createNewBranch && !baseBranch) {
      setError('Please select a base branch for the new branch');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const saveData = {
        repository_id: parseInt(selectedRepository),
        file_path: filePath.trim(),
        branch: targetBranch,
        commit_message: commitMessage.trim() || `Add ${document.name || 'document'}`,
        create_branch: createNewBranch,
        base_branch: createNewBranch ? baseBranch : undefined
      };

      const result = await gitHubApi.saveDocumentToGitHub(document.id, saveData);

      showSuccess(`Document saved to GitHub successfully`);

      if (onSaveSuccess) {
        onSaveSuccess(result);
      }

      onHide();
    } catch (err) {
      const errorMessage = err.message || 'Failed to save document to GitHub';
      setError(errorMessage);
      showError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setError('');
    setSelectedRepository('');
    setSelectedBranch('main');
    setCreateNewBranch(false);
    setNewBranchName('');
    setBaseBranch('main');
    setFilePath('');
    setCommitMessage('');
    setBranches([]);
    setRepositoryStatus(null);
    onHide();
  };

  const selectedRepo = repositories.find(r => r.id.toString() === selectedRepository);

  return (
    <Modal show={show} onHide={handleClose} size="lg" centered className="github-save-modal">
      <Modal.Header closeButton>
        <Modal.Title>
          <i className="bi bi-github me-2"></i>
          Save to GitHub
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {error && <Alert variant="danger">{error}</Alert>}

        <Form>
          <Form.Group className="mb-3">
            <Form.Label>Source Document</Form.Label>
            <Form.Control
              type="text"
              value={document?.name || 'Untitled Document'}
              disabled
            />
            <Form.Text className="text-muted">
              The local document that will be saved to GitHub
            </Form.Text>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Repository *</Form.Label>
            {loadingRepos ? (
              <div className="text-center py-3">
                <Spinner animation="border" size="sm" className="me-2" />
                Loading repositories...
              </div>
            ) : repositories.length === 0 ? (
              <Alert variant="warning" className="mb-0">
                <div>
                  <strong>No selected repositories found.</strong>
                </div>
                <div className="mt-2">
                  To save documents to GitHub, you need to:
                  <ol className="mt-1 mb-0">
                    <li>Connect a GitHub account</li>
                    <li>Select repositories to use for document management</li>
                  </ol>
                </div>
                <div className="mt-2">
                  <small className="text-muted">
                    Go to GitHub settings to select repositories for document storage.
                  </small>
                </div>
              </Alert>
            ) : (
              <Form.Select
                value={selectedRepository}
                onChange={(e) => setSelectedRepository(e.target.value)}
                required
              >
                <option value="">Select a repository...</option>
                {repositories.map((repo) => (
                  <option key={repo.id} value={repo.id}>
                    {repo.full_name} {repo.is_private ? '(Private)' : '(Public)'}
                  </option>
                ))}
              </Form.Select>
            )}
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Branch *</Form.Label>
            {loadingBranches ? (
              <div className="text-center py-2">
                <Spinner animation="border" size="sm" className="me-2" />
                Loading branches...
              </div>
            ) : (
              <>
                <div className="github-save-branch-options mb-3">
                  <Form.Check
                    type="radio"
                    id="existing-branch"
                    name="branch-type"
                    label="Use existing branch"
                    checked={!createNewBranch}
                    onChange={() => setCreateNewBranch(false)}
                    disabled={!selectedRepository}
                    className="mb-2"
                  />
                  <Form.Check
                    type="radio"
                    id="new-branch"
                    name="branch-type"
                    label="Create new branch"
                    checked={createNewBranch}
                    onChange={() => setCreateNewBranch(true)}
                    disabled={!selectedRepository}
                  />
                </div>

                {!createNewBranch ? (
                  <Form.Select
                    value={selectedBranch}
                    onChange={(e) => setSelectedBranch(e.target.value)}
                    required
                    disabled={!selectedRepository || createNewBranch}
                  >
                    <option value="">Select a branch...</option>
                    {branches.map((branch) => (
                      <option key={branch.name} value={branch.name}>
                        {branch.name}
                      </option>
                    ))}
                  </Form.Select>
                ) : (
                  <>
                    {repositoryStatus && repositoryStatus.needs_attention && (
                      <Alert variant="warning" className="mb-3">
                        <div className="d-flex align-items-start">
                          <i className="bi bi-exclamation-triangle-fill me-2 mt-1"></i>
                          <div>
                            <strong>Repository has uncommitted changes</strong>
                            <div className="mt-1">
                              {repositoryStatus.status_message}
                            </div>
                            {repositoryStatus.modified_files.length > 0 && (
                              <div className="mt-2">
                                <small>Modified files: {repositoryStatus.modified_files.join(', ')}</small>
                              </div>
                            )}
                            {repositoryStatus.staged_files.length > 0 && (
                              <div className="mt-1">
                                <small>Staged files: {repositoryStatus.staged_files.join(', ')}</small>
                              </div>
                            )}
                          </div>
                        </div>
                      </Alert>
                    )}
                    <div className="github-save-new-branch-form">
                      <Row className="g-3">
                        <Col md={6}>
                          <Form.Label className="fw-semibold text-muted">New Branch Name *</Form.Label>
                          <Form.Control
                            type="text"
                            placeholder="feature/my-new-branch"
                            value={newBranchName}
                            onChange={(e) => setNewBranchName(e.target.value)}
                            required
                          />
                        </Col>
                        <Col md={6}>
                          <Form.Label className="fw-semibold text-muted">Base Branch *</Form.Label>
                          <Form.Select
                            value={baseBranch}
                            onChange={(e) => setBaseBranch(e.target.value)}
                            required
                          >
                            <option value="">Select base branch...</option>
                            {branches.map((branch) => (
                              <option key={branch.name} value={branch.name}>
                                {branch.name}
                              </option>
                            ))}
                          </Form.Select>
                        </Col>
                      </Row>
                      <Form.Text className="text-muted d-flex align-items-center mt-2">
                        <i className="bi bi-info-circle me-2"></i>
                        A new branch will be created from the base branch before saving the file.
                      </Form.Text>
                    </div>
                  </>
                )}
              </>
            )}
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>File Path *</Form.Label>
            <InputGroup>
              <Form.Control
                type="text"
                placeholder="docs/my-document.md"
                value={filePath}
                onChange={(e) => setFilePath(e.target.value)}
                required
              />
              {!filePath.endsWith('.md') && (
                <InputGroup.Text>.md</InputGroup.Text>
              )}
            </InputGroup>
            <Form.Text className="text-muted">
              Path where the file will be saved in the repository. Don't include leading slash.
            </Form.Text>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Commit Message</Form.Label>
            <Form.Control
              type="text"
              placeholder="Add document"
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
            />
            <Form.Text className="text-muted">
              Optional commit message (default: "Add {document?.name || 'document'}")
            </Form.Text>
          </Form.Group>

          {selectedRepo && (
            <div className="github-save-repo-info mt-3">
              <div className="card">
                <div className="card-header py-2">
                  <h6 className="card-title mb-0 d-flex align-items-center">
                    <i className="bi bi-info-circle text-primary me-2"></i>
                    Save Summary
                  </h6>
                </div>
                <div className="card-body py-2">
                  <div className="row g-2 small">
                    <div className="col-6">
                      <div className="d-flex align-items-center mb-1">
                        <i className="bi bi-github me-2"></i>
                        <strong>{selectedRepo.name}</strong>
                      </div>
                      <div className="d-flex align-items-center">
                        <i className={`bi ${selectedRepo.is_private ? 'bi-lock' : 'bi-globe'} me-2`}></i>
                        <span className={`badge ${selectedRepo.is_private ? 'bg-warning' : 'bg-success'}`}>
                          {selectedRepo.is_private ? 'Private' : 'Public'}
                        </span>
                      </div>
                    </div>
                    <div className="col-6">
                      <div className="d-flex align-items-center mb-1">
                        <i className="bi bi-git me-2"></i>
                        <code className="small">
                          {createNewBranch
                            ? `${newBranchName || 'new-branch'}`
                            : selectedBranch || 'main'
                          }
                        </code>
                      </div>
                      {filePath && (
                        <div className="d-flex align-items-center">
                          <i className="bi bi-file-earmark-text me-2"></i>
                          <code className="small text-truncate">
                            {filePath.endsWith('.md') ? filePath : `${filePath}.md`}
                          </code>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Form>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="success"
          onClick={handleSave}
          disabled={
            loading ||
            !selectedRepository ||
            !filePath.trim() ||
            (createNewBranch ? (!newBranchName.trim() || !baseBranch) : !selectedBranch)
          }
        >
          {loading ? (
            <>
              <Spinner animation="border" size="sm" className="me-2" />
              Saving...
            </>
          ) : (
            <>
              <i className="bi bi-cloud-upload me-2"></i>
              Save to GitHub
            </>
          )}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

GitHubSaveModal.propTypes = {
  show: PropTypes.bool.isRequired,
  onHide: PropTypes.func.isRequired,
  document: PropTypes.object,
  onSaveSuccess: PropTypes.func
};

export default GitHubSaveModal;
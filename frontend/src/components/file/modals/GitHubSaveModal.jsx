import React, { useState, useEffect, useCallback } from 'react';
import { Modal, Button, Form, Alert, Spinner, Row, Col, InputGroup, Badge, ProgressBar } from 'react-bootstrap';
import PropTypes from 'prop-types';
import { useNotification } from '@/components/NotificationProvider';
import { useGitHubSettings } from '@/providers/GitHubSettingsProvider';
import { useDocumentContext } from '@/providers/DocumentContextProvider.jsx';
import gitHubApi from '@/api/gitHubApi';
import documentsApi from '@/api/documentsApi';

function GitHubSaveModal({ show, onHide, document, onSaveSuccess }) {
  const { currentDocument } = useDocumentContext();
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
  const [_loadingStatus, setLoadingStatus] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [error, setError] = useState('');

  // Phase 6: Diagram conversion state
  const [convertDiagrams, setConvertDiagrams] = useState(null); // null = use settings default
  const [conversionProgress, setConversionProgress] = useState(null);
  const [conversionResult, setConversionResult] = useState(null);

  const { showSuccess, showError, showInfo } = useNotification();
  const { settings: githubSettings, loading: settingsLoading } = useGitHubSettings();

  const loadRepositories = useCallback(async () => {
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
  }, [showError]);

  const loadBranches = useCallback(async (repoId) => {
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
  }, [showError]);

  const loadRepositoryStatus = useCallback(async (repoId) => {
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
  }, []);

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

      // Phase 6: Reset diagram conversion state
      setConvertDiagrams(null); // Use settings default
      setConversionProgress(null);
      setConversionResult(null);
    }
  }, [show, document, loadRepositories]);

  // Load branches when repository changes
  useEffect(() => {
    if (selectedRepository) {
      loadBranches(selectedRepository);
      loadRepositoryStatus(selectedRepository);
    }
  }, [selectedRepository, loadBranches, loadRepositoryStatus]);

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
      setConversionProgress({ stage: 'preparing', message: 'Preparing document...' });

      // Determine if we should convert diagrams
      const shouldConvert = convertDiagrams !== null ? convertDiagrams : githubSettings?.auto_convert_diagrams;

      const saveData = {
        repository_id: parseInt(selectedRepository),
        file_path: filePath.trim(),
        branch: targetBranch,
        commit_message: commitMessage.trim() || `Add ${document.name || 'document'}`,
        create_branch: createNewBranch,
        base_branch: createNewBranch ? baseBranch : undefined,
        auto_convert_diagrams: shouldConvert
      };

      if (shouldConvert) {
        setConversionProgress({
          stage: 'converting',
          message: 'Converting advanced diagrams to GitHub-compatible format...'
        });
      }

      // Use the new documentsApi method that supports diagram conversion
      const result = await documentsApi.saveToGitHubWithDiagrams(document.id, {
        ...saveData,
        convertDiagrams: shouldConvert,
        diagramFormat: githubSettings?.diagram_format || 'png',
        document_content: currentDocument?.content || ''
      });

      setConversionResult(result);

      if (result.success) {
        let successMessage = 'Document saved to GitHub successfully';
        if (result.diagrams_converted > 0) {
          successMessage += ` with ${result.diagrams_converted} diagram${result.diagrams_converted !== 1 ? 's' : ''} converted`;
        }
        showSuccess(successMessage);

        if (result.errors && result.errors.length > 0) {
          showInfo(`Note: ${result.errors.length} warning(s) occurred during save`);
        }

        if (onSaveSuccess) {
          onSaveSuccess(result);
        }

        onHide();
      } else {
        const errorMessage = result.errors?.join('; ') || 'Failed to save document to GitHub';
        setError(errorMessage);
        showError(errorMessage);
      }
    } catch (err) {
      const errorMessage = err.message || 'Failed to save document to GitHub';
      setError(errorMessage);
      showError(errorMessage);
    } finally {
      setLoading(false);
      setConversionProgress(null);
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

    // Phase 6: Reset diagram conversion state
    setConvertDiagrams(null);
    setConversionProgress(null);
    setConversionResult(null);

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
              Path where the file will be saved in the repository. Don&apos;t include leading slash.
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
              Optional commit message (default: &quot;Add {document?.name || 'document'}&quot;)
            </Form.Text>
          </Form.Group>

          {/* Phase 6: Diagram Conversion Settings */}
          <Form.Group className="mb-3">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <Form.Label className="mb-0">
                <i className="bi bi-diagram-3 me-2"></i>
                Diagram Conversion
              </Form.Label>
              {!settingsLoading && githubSettings && (
                <Badge bg={githubSettings.auto_convert_diagrams ? 'success' : 'secondary'} className="ms-2">
                  Default: {githubSettings.auto_convert_diagrams ? 'Enabled' : 'Disabled'}
                </Badge>
              )}
            </div>

            <div className="diagram-conversion-options">
              <Form.Check
                type="radio"
                id="convert-auto"
                name="diagram-conversion"
                label={
                  <span>
                    Use my default setting
                    {githubSettings && (
                      <small className="text-muted d-block">
                        {githubSettings.auto_convert_diagrams
                          ? 'Auto-convert to ' + (githubSettings.diagram_format?.toUpperCase() || 'PNG')
                          : 'Keep original Mermaid syntax'
                        }
                      </small>
                    )}
                  </span>
                }
                checked={convertDiagrams === null}
                onChange={() => setConvertDiagrams(null)}
                className="mb-2"
              />
              <Form.Check
                type="radio"
                id="convert-enable"
                name="diagram-conversion"
                label={
                  <span>
                    Convert advanced diagrams
                    <small className="text-muted d-block">
                      Convert architecture-beta and custom icons to static images for GitHub compatibility
                    </small>
                  </span>
                }
                checked={convertDiagrams === true}
                onChange={() => setConvertDiagrams(true)}
                className="mb-2"
              />
              <Form.Check
                type="radio"
                id="convert-disable"
                name="diagram-conversion"
                label={
                  <span>
                    Keep original syntax
                    <small className="text-muted d-block">
                      Save Mermaid diagrams as-is (may not render properly on GitHub)
                    </small>
                  </span>
                }
                checked={convertDiagrams === false}
                onChange={() => setConvertDiagrams(false)}
              />
            </div>
          </Form.Group>

          {/* Phase 6: Conversion Progress */}
          {conversionProgress && (
            <Alert variant="info" className="mb-3">
              <div className="d-flex align-items-center">
                <Spinner animation="border" size="sm" className="me-3" />
                <div className="flex-grow-1">
                  <div className="fw-semibold">{conversionProgress.stage === 'preparing' ? 'Preparing' : 'Converting Diagrams'}</div>
                  <div className="small text-muted">{conversionProgress.message}</div>
                  {conversionProgress.stage === 'converting' && (
                    <ProgressBar animated now={100} className="mt-2" style={{ height: '4px' }} />
                  )}
                </div>
              </div>
            </Alert>
          )}

          {/* Phase 6: Conversion Result Summary */}
          {conversionResult && conversionResult.diagrams_converted > 0 && (
            <Alert variant="success" className="mb-3">
              <div className="d-flex align-items-start">
                <i className="bi bi-check-circle-fill text-success me-2 mt-1"></i>
                <div>
                  <div className="fw-semibold">
                    {conversionResult.diagrams_converted} diagram{conversionResult.diagrams_converted !== 1 ? 's' : ''} converted successfully
                  </div>
                  {conversionResult.converted_diagrams && conversionResult.converted_diagrams.length > 0 && (
                    <div className="mt-2">
                      <small className="text-muted">Converted files:</small>
                      <ul className="list-unstyled mt-1 mb-0">
                        {conversionResult.converted_diagrams.slice(0, 3).map((diagram, index) => (
                          <li key={index} className="small">
                            <code>{diagram.filename}</code> ({diagram.format.toUpperCase()}, {(diagram.size / 1024).toFixed(1)}KB)
                          </li>
                        ))}
                        {conversionResult.converted_diagrams.length > 3 && (
                          <li className="small text-muted">
                            ...and {conversionResult.converted_diagrams.length - 3} more
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </Alert>
          )}

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
              {conversionProgress ? (
                conversionProgress.stage === 'preparing' ? 'Preparing...' : 'Converting & Saving...'
              ) : (
                'Saving...'
              )}
            </>
          ) : (
            <>
              <i className="bi bi-cloud-upload me-2"></i>
              Save to GitHub
              {convertDiagrams === true || (convertDiagrams === null && githubSettings?.auto_convert_diagrams) ? (
                <Badge bg="light" text="dark" className="ms-2">+Convert</Badge>
              ) : null}
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
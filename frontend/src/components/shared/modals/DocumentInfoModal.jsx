import React from "react";
import { Modal, Button, Badge, Table, Card } from "react-bootstrap";

function DocumentInfoModal({ show, onHide, document, gitStatus }) {
  const handleClose = () => {
    onHide();
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      // Could add a toast notification here
    });
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  const formatFileSize = (content) => {
    if (!content) return '0 B';
    const bytes = new Blob([content]).size;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getWordCount = (content) => {
    if (!content) return 0;
    return content.trim().split(/\s+/).filter(word => word.length > 0).length;
  };

  const getLineCount = (content) => {
    if (!content) return 0;
    return content.split('\n').length;
  };

  const getMarkdownElements = (content) => {
    if (!content) return { headers: 0, links: 0, images: 0, codeBlocks: 0 };

    const headers = (content.match(/^#{1,6}\s/gm) || []).length;
    const links = (content.match(/\[.*?\]\(.*?\)/g) || []).length;
    const images = (content.match(/!\[.*?\]\(.*?\)/g) || []).length;
    const codeBlocks = (content.match(/```[\s\S]*?```/g) || []).length;

    return { headers, links, images, codeBlocks };
  };

  const getRepositoryIcon = (repoType) => {
    switch (repoType) {
      case 'github':
        return <i className="bi bi-github"></i>;
      case 'local':
        return <i className="bi bi-folder text-primary"></i>;
      default:
        return <i className="bi bi-question-circle text-muted"></i>;
    }
  };

  return (
    <Modal
      show={show}
      onHide={handleClose}
      size="lg"
      centered
      backdrop={true}
      keyboard={true}
    >
      <Modal.Header closeButton>
        <Modal.Title className="d-flex align-items-center">
          {document?.repository_type === 'github' ? (
            <i className="bi bi-github me-2"></i>
          ) : (
            <i className="bi bi-info-circle text-primary me-2"></i>
          )}
          Document Information
          {document?.repository_type === 'github' && (
            <Badge bg="primary" className="ms-2">
              <i className="bi bi-github me-1"></i>
              GitHub
            </Badge>
          )}
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {document && (
          <div className="row">
            {/* Document Details */}
            <div className="col-md-6">
              <Card className="mb-3">
                <Card.Header>
                  <i className="bi bi-file-earmark-text me-2 text-primary"></i>
                  Document Details
                </Card.Header>
                <Card.Body>
                  <Table size="sm" className="mb-0">
                    <tbody>
                      <tr>
                        <td className="fw-bold">
                          <i className="bi bi-tag text-success me-2"></i>
                          Name:
                        </td>
                        <td>
                          <span className="fw-medium">{document.name}</span>
                          <Button
                            variant="link"
                            size="sm"
                            className="p-0 ms-2"
                            onClick={() => copyToClipboard(document.name)}
                            title="Copy to clipboard"
                          >
                            <i className="bi bi-clipboard"></i>
                          </Button>
                        </td>
                      </tr>
                      <tr>
                        <td className="fw-bold">
                          <i className="bi bi-key text-warning me-2"></i>
                          ID:
                        </td>
                        <td>
                          <code>{document.id}</code>
                          <Button
                            variant="link"
                            size="sm"
                            className="p-0 ms-2"
                            onClick={() => copyToClipboard(document.id.toString())}
                            title="Copy to clipboard"
                          >
                            <i className="bi bi-clipboard"></i>
                          </Button>
                        </td>
                      </tr>
                      <tr>
                        <td className="fw-bold">
                          <i className="bi bi-collection text-info me-2"></i>
                          Category:
                        </td>
                        <td>
                          {document.repository_type === 'github' ? (
                            <div className="d-flex align-items-center">
                              <i className="bi bi-github me-2"></i>
                              <span className="text-muted">GitHub Repository</span>
                            </div>
                          ) : (
                            <Badge bg="secondary">{document.category || 'General'}</Badge>
                          )}
                        </td>
                      </tr>
                      <tr>
                        <td className="fw-bold">
                          <i className="bi bi-calendar-plus text-success me-2"></i>
                          Created:
                        </td>
                        <td>
                          <small className="text-muted">
                            {formatDate(document.created_at)}
                          </small>
                        </td>
                      </tr>
                      <tr>
                        <td className="fw-bold">
                          <i className="bi bi-calendar-check text-primary me-2"></i>
                          Updated:
                        </td>
                        <td>
                          <small className="text-muted">
                            {formatDate(document.updated_at)}
                          </small>
                        </td>
                      </tr>
                      {document.last_opened_at && (
                        <tr>
                          <td className="fw-bold">
                            <i className="bi bi-eye text-info me-2"></i>
                            Last Opened:
                          </td>
                          <td>
                            <small className="text-muted">
                              {formatDate(document.last_opened_at)}
                            </small>
                          </td>
                        </tr>
                      )}
                      {document.is_shared && (
                        <tr>
                          <td className="fw-bold">
                            <i className="bi bi-share text-warning me-2"></i>
                            Sharing:
                          </td>
                          <td>
                            <Badge bg="warning" text="dark">
                              <i className="bi bi-people me-1"></i>
                              Shared
                            </Badge>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </Table>
                </Card.Body>
              </Card>

              <Card className="mb-3">
                <Card.Header>
                  <i className="bi bi-bar-chart me-2 text-success"></i>
                  Content Statistics
                </Card.Header>
                <Card.Body>
                  <Table size="sm" className="mb-0">
                    <tbody>
                      <tr>
                        <td className="fw-bold">
                          <i className="bi bi-type text-primary me-2"></i>
                          Word Count:
                        </td>
                        <td>
                          <Badge bg="primary" className="me-2">
                            {getWordCount(document.content).toLocaleString()}
                          </Badge>
                          {getWordCount(document.content) > 1000 && (
                            <small className="text-muted">
                              (~{Math.ceil(getWordCount(document.content) / 250)} min read)
                            </small>
                          )}
                        </td>
                      </tr>
                      <tr>
                        <td className="fw-bold">
                          <i className="bi bi-list-ol text-info me-2"></i>
                          Line Count:
                        </td>
                        <td>
                          <Badge bg="info" text="dark">
                            {getLineCount(document.content).toLocaleString()}
                          </Badge>
                        </td>
                      </tr>
                      <tr>
                        <td className="fw-bold">
                          <i className="bi bi-file-earmark text-success me-2"></i>
                          File Size:
                        </td>
                        <td>
                          <Badge bg="success">
                            {formatFileSize(document.content)}
                          </Badge>
                        </td>
                      </tr>
                      <tr>
                        <td className="fw-bold">
                          <i className="bi bi-textarea-t text-warning me-2"></i>
                          Characters:
                        </td>
                        <td>
                          <Badge bg="warning" text="dark">
                            {(document.content?.length || 0).toLocaleString()}
                          </Badge>
                        </td>
                      </tr>
                      {document.content && getMarkdownElements(document.content) && (
                        <>
                          <tr>
                            <td className="fw-bold">
                              <i className="bi bi-hash text-secondary me-2"></i>
                              Headers:
                            </td>
                            <td>
                              <Badge bg="secondary">
                                {getMarkdownElements(document.content).headers}
                              </Badge>
                            </td>
                          </tr>
                          <tr>
                            <td className="fw-bold">
                              <i className="bi bi-link text-primary me-2"></i>
                              Links:
                            </td>
                            <td>
                              <Badge bg="info" text="dark">
                                {getMarkdownElements(document.content).links}
                              </Badge>
                            </td>
                          </tr>
                          <tr>
                            <td className="fw-bold">
                              <i className="bi bi-image text-info me-2"></i>
                              Images:
                            </td>
                            <td>
                              <Badge bg="warning" text="dark">
                                {getMarkdownElements(document.content).images}
                              </Badge>
                            </td>
                          </tr>
                          <tr>
                            <td className="fw-bold">
                              <i className="bi bi-code-square text-dark me-2"></i>
                              Code Blocks:
                            </td>
                            <td>
                              <Badge bg="secondary">
                                {getMarkdownElements(document.content).codeBlocks}
                              </Badge>
                            </td>
                          </tr>
                        </>
                      )}
                    </tbody>
                  </Table>
                </Card.Body>
              </Card>
            </div>

            {/* Repository & Git Details */}
            <div className="col-md-6">
              <Card className="mb-3">
                <Card.Header>
                  {document.repository_type === 'github' ? (
                    <>
                      <i className="bi bi-github me-2"></i>
                      GitHub Repository
                    </>
                  ) : (
                    <>
                      <i className="bi bi-folder me-2 text-warning"></i>
                      File System
                    </>
                  )}
                </Card.Header>
                <Card.Body>
                  <Table size="sm" className="mb-0">
                    <tbody>
                      {document.repository_type === 'github' && document.github_repository ? (
                        <>
                          <tr>
                            <td className="fw-bold">Repository:</td>
                            <td>
                              <div className="d-flex align-items-center">
                                <i className="bi bi-github me-2"></i>
                                <span className="fw-medium">{document.github_repository.full_name}</span>
                                <Button
                                  variant="link"
                                  size="sm"
                                  className="p-0 ms-2"
                                  onClick={() => copyToClipboard(document.github_repository.full_name)}
                                  title="Copy repository name"
                                >
                                  <i className="bi bi-clipboard"></i>
                                </Button>
                              </div>
                              {document.github_repository.description && (
                                <small className="text-muted d-block mt-1">
                                  {document.github_repository.description}
                                </small>
                              )}
                            </td>
                          </tr>
                          <tr>
                            <td className="fw-bold">Owner:</td>
                            <td>
                              <Badge bg="primary" className="me-2">
                                <i className="bi bi-person me-1"></i>
                                {document.github_repository.owner}
                              </Badge>
                              {document.github_repository.is_private && (
                                <Badge bg="warning" text="dark">
                                  <i className="bi bi-lock me-1"></i>
                                  Private
                                </Badge>
                              )}
                            </td>
                          </tr>
                          <tr>
                            <td className="fw-bold">Branch:</td>
                            <td>
                              <Badge bg="info" text="dark">
                                <i className="bi bi-git me-1"></i>
                                {document.github_branch || document.github_repository.default_branch || 'main'}
                              </Badge>
                              {document.github_branch && document.github_branch !== document.github_repository.default_branch && (
                                <small className="text-muted ms-2">
                                  (default: {document.github_repository.default_branch || 'main'})
                                </small>
                              )}
                            </td>
                          </tr>
                          <tr>
                            <td className="fw-bold">File Path:</td>
                            <td>
                              <small className="font-monospace text-break">
                                <i className="bi bi-file-earmark-text me-1"></i>
                                {document.github_file_path || 'N/A'}
                              </small>
                              {document.github_file_path && (
                                <Button
                                  variant="link"
                                  size="sm"
                                  className="p-0 ms-2"
                                  onClick={() => copyToClipboard(document.github_file_path)}
                                  title="Copy file path"
                                >
                                  <i className="bi bi-clipboard"></i>
                                </Button>
                              )}
                            </td>
                          </tr>
                          {document.github_sha && (
                            <tr>
                              <td className="fw-bold">Commit SHA:</td>
                              <td>
                                <code className="small">{document.github_sha.substring(0, 8)}...</code>
                                <Button
                                  variant="link"
                                  size="sm"
                                  className="p-0 ms-2"
                                  onClick={() => copyToClipboard(document.github_sha)}
                                  title="Copy full SHA"
                                >
                                  <i className="bi bi-clipboard"></i>
                                </Button>
                              </td>
                            </tr>
                          )}
                          {document.github_sync_status && (
                            <tr>
                              <td className="fw-bold">Sync Status:</td>
                              <td>
                                <Badge
                                  bg={document.github_sync_status === 'synced' ? 'success' :
                                      document.github_sync_status === 'error' ? 'danger' : 'warning'}
                                >
                                  <i className={`bi ${
                                    document.github_sync_status === 'synced' ? 'bi-check-circle' :
                                    document.github_sync_status === 'error' ? 'bi-exclamation-circle' :
                                    'bi-clock'
                                  } me-1`}></i>
                                  {document.github_sync_status}
                                </Badge>
                              </td>
                            </tr>
                          )}
                          {document.last_github_sync_at && (
                            <tr>
                              <td className="fw-bold">Last Synced:</td>
                              <td>
                                <small className="text-muted">
                                  <i className="bi bi-clock me-1"></i>
                                  {formatDate(document.last_github_sync_at)}
                                </small>
                              </td>
                            </tr>
                          )}
                        </>
                      ) : (
                        <>
                          <tr>
                            <td className="fw-bold">File Path:</td>
                            <td>
                              <small className="font-monospace text-break">
                                {document.file_path || 'N/A'}
                              </small>
                              {document.file_path && (
                                <Button
                                  variant="link"
                                  size="sm"
                                  className="p-0 ms-2"
                                  onClick={() => copyToClipboard(document.file_path)}
                                  title="Copy to clipboard"
                                >
                                  <i className="bi bi-clipboard"></i>
                                </Button>
                              )}
                            </td>
                          </tr>
                          <tr>
                            <td className="fw-bold">Folder:</td>
                            <td>
                              <small className="font-monospace">
                                {document.folder_path || 'N/A'}
                              </small>
                            </td>
                          </tr>
                          <tr>
                            <td className="fw-bold">Repository:</td>
                            <td>
                              <div className="d-flex align-items-center">
                                {getRepositoryIcon(document.repository_type)}
                                <span className="ms-2">
                                  {document.repository_type || 'local'}
                                </span>
                              </div>
                            </td>
                          </tr>
                        </>
                      )}
                    </tbody>
                  </Table>
                </Card.Body>
              </Card>

              {/* Git Status */}
              {gitStatus && (
                <Card className="mb-3">
                  <Card.Header>
                    <i className="bi bi-git me-2 text-danger"></i>
                    Git Status
                    {gitStatus.repository_type === 'github' && (
                      <Badge bg="primary" className="ms-2">
                        <i className="bi bi-github me-1"></i>
                        GitHub
                      </Badge>
                    )}
                  </Card.Header>
                  <Card.Body>
                    <Table size="sm" className="mb-0">
                      <tbody>
                        <tr>
                          <td className="fw-bold">
                            <i className="bi bi-git text-info me-2"></i>
                            Branch:
                          </td>
                          <td>
                            <Badge bg="primary">
                              <i className="bi bi-diagram-3 me-1"></i>
                              {gitStatus.current_branch}
                            </Badge>
                          </td>
                        </tr>
                        <tr>
                          <td className="fw-bold">
                            <i className="bi bi-check-circle text-success me-2"></i>
                            Status:
                          </td>
                          <td>
                            {gitStatus.has_uncommitted_changes || gitStatus.has_staged_changes || gitStatus.has_untracked_files ? (
                              <Badge bg="warning" text="dark">
                                <i className="bi bi-exclamation-circle me-1"></i>
                                Has Changes
                              </Badge>
                            ) : (
                              <Badge bg="success">
                                <i className="bi bi-check-circle me-1"></i>
                                Clean
                              </Badge>
                            )}
                          </td>
                        </tr>
                        {gitStatus.modified_files && gitStatus.modified_files.length > 0 && (
                          <tr>
                            <td className="fw-bold">
                              <i className="bi bi-pencil text-warning me-2"></i>
                              Modified:
                            </td>
                            <td>
                              <Badge bg="warning" text="dark">
                                <i className="bi bi-file-earmark-diff me-1"></i>
                                {gitStatus.modified_files.length}
                              </Badge>
                            </td>
                          </tr>
                        )}
                        {gitStatus.staged_files && gitStatus.staged_files.length > 0 && (
                          <tr>
                            <td className="fw-bold">
                              <i className="bi bi-plus-circle text-info me-2"></i>
                              Staged:
                            </td>
                            <td>
                              <Badge bg="info">
                                <i className="bi bi-file-earmark-plus me-1"></i>
                                {gitStatus.staged_files.length}
                              </Badge>
                            </td>
                          </tr>
                        )}
                        {gitStatus.untracked_files && gitStatus.untracked_files.length > 0 && (
                          <tr>
                            <td className="fw-bold">
                              <i className="bi bi-question-circle text-secondary me-2"></i>
                              Untracked:
                            </td>
                            <td>
                              <Badge bg="secondary">
                                <i className="bi bi-file-earmark-question me-1"></i>
                                {gitStatus.untracked_files.length}
                              </Badge>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </Table>
                  </Card.Body>
                </Card>
              )}
            </div>
          </div>
        )}

        {!document && (
          <div className="text-center py-4">
            <i className="bi bi-exclamation-triangle text-warning" style={{ fontSize: '2rem' }}></i>
            <p className="mt-2">No document information available</p>
          </div>
        )}
      </Modal.Body>

      <Modal.Footer>
        <div className="d-flex justify-content-between w-100">
          <small className="text-muted">
            <i className="bi bi-info-circle me-1"></i>
            Click <i className="bi bi-clipboard"></i> icons to copy values
          </small>
          <Button variant="secondary" onClick={handleClose}>
            Close
          </Button>
        </div>
      </Modal.Footer>
    </Modal>
  );
}

export default DocumentInfoModal;
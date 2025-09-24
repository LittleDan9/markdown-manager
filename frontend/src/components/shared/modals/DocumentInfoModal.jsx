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

  const getRepositoryIcon = (repoType) => {
    switch (repoType) {
      case 'github':
        return <i className="bi bi-github text-dark"></i>;
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
        <Modal.Title>
          <i className="bi bi-info-circle me-2"></i>
          Document Information
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {document && (
          <div className="row">
            {/* Document Details */}
            <div className="col-md-6">
              <Card className="mb-3">
                <Card.Header>
                  <i className="bi bi-file-earmark-text me-2"></i>
                  Document Details
                </Card.Header>
                <Card.Body>
                  <Table size="sm" className="mb-0">
                    <tbody>
                      <tr>
                        <td className="fw-bold">Name:</td>
                        <td>
                          {document.name}
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
                        <td className="fw-bold">ID:</td>
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
                        <td className="fw-bold">Category:</td>
                        <td>
                          <Badge bg="secondary">{document.category || 'General'}</Badge>
                        </td>
                      </tr>
                      <tr>
                        <td className="fw-bold">Created:</td>
                        <td>{formatDate(document.created_at)}</td>
                      </tr>
                      <tr>
                        <td className="fw-bold">Updated:</td>
                        <td>{formatDate(document.updated_at)}</td>
                      </tr>
                    </tbody>
                  </Table>
                </Card.Body>
              </Card>

              <Card className="mb-3">
                <Card.Header>
                  <i className="bi bi-bar-chart me-2"></i>
                  Content Statistics
                </Card.Header>
                <Card.Body>
                  <Table size="sm" className="mb-0">
                    <tbody>
                      <tr>
                        <td className="fw-bold">Word Count:</td>
                        <td>{getWordCount(document.content).toLocaleString()}</td>
                      </tr>
                      <tr>
                        <td className="fw-bold">Line Count:</td>
                        <td>{getLineCount(document.content).toLocaleString()}</td>
                      </tr>
                      <tr>
                        <td className="fw-bold">File Size:</td>
                        <td>{formatFileSize(document.content)}</td>
                      </tr>
                      <tr>
                        <td className="fw-bold">Characters:</td>
                        <td>{(document.content?.length || 0).toLocaleString()}</td>
                      </tr>
                    </tbody>
                  </Table>
                </Card.Body>
              </Card>
            </div>

            {/* Repository & Git Details */}
            <div className="col-md-6">
              <Card className="mb-3">
                <Card.Header>
                  <i className="bi bi-folder me-2"></i>
                  File System
                </Card.Header>
                <Card.Body>
                  <Table size="sm" className="mb-0">
                    <tbody>
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
                      {document.github_repository_id && (
                        <tr>
                          <td className="fw-bold">GitHub Repo ID:</td>
                          <td>
                            <code>{document.github_repository_id}</code>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </Table>
                </Card.Body>
              </Card>

              {/* Git Status */}
              {gitStatus && (
                <Card className="mb-3">
                  <Card.Header>
                    <i className="bi bi-git me-2"></i>
                    Git Status
                  </Card.Header>
                  <Card.Body>
                    <Table size="sm" className="mb-0">
                      <tbody>
                        <tr>
                          <td className="fw-bold">Branch:</td>
                          <td>
                            <Badge bg="primary">{gitStatus.current_branch}</Badge>
                          </td>
                        </tr>
                        <tr>
                          <td className="fw-bold">Status:</td>
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
                            <td className="fw-bold">Modified:</td>
                            <td>
                              <Badge bg="warning">{gitStatus.modified_files.length}</Badge>
                            </td>
                          </tr>
                        )}
                        {gitStatus.staged_files && gitStatus.staged_files.length > 0 && (
                          <tr>
                            <td className="fw-bold">Staged:</td>
                            <td>
                              <Badge bg="info">{gitStatus.staged_files.length}</Badge>
                            </td>
                          </tr>
                        )}
                        {gitStatus.untracked_files && gitStatus.untracked_files.length > 0 && (
                          <tr>
                            <td className="fw-bold">Untracked:</td>
                            <td>
                              <Badge bg="secondary">{gitStatus.untracked_files.length}</Badge>
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
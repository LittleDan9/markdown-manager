// Attachment Browser Component
import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal, Button, Row, Col, Badge, Form, InputGroup,
  Alert, Spinner, ProgressBar, Table
} from 'react-bootstrap';
import { useNotification } from '@/components/NotificationProvider';
import attachmentsApi from '@/api/attachmentsApi';
import AttachmentUploadModal from './AttachmentUploadModal';

function getFileIcon(filename) {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf':
      return 'bi-file-earmark-pdf text-danger';
    case 'csv':
      return 'bi-file-earmark-spreadsheet text-success';
    default:
      return 'bi-file-earmark-text text-primary';
  }
}

function getScanBadge(status) {
  switch (status) {
    case 'clean':
      return <Badge bg="success">Clean</Badge>;
    case 'infected':
      return <Badge bg="danger">Infected</Badge>;
    case 'error':
      return <Badge bg="warning">Scan Error</Badge>;
    default:
      return <Badge bg="secondary">Pending</Badge>;
  }
}

function getQuotaVariant(percentage) {
  if (percentage >= 95) return 'danger';
  if (percentage >= 80) return 'warning';
  return 'success';
}

export default function AttachmentBrowserModal({
  show,
  onHide,
  documentId,
  onAttachmentSelected,
}) {
  const [attachments, setAttachments] = useState([]);
  const [filteredAttachments, setFilteredAttachments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState(documentId ? 'document' : 'library');
  const [quota, setQuota] = useState(null);
  const [total, setTotal] = useState(0);
  const [showUploadModal, setShowUploadModal] = useState(false);

  const { showSuccess, showError } = useNotification();

  const loadAttachments = useCallback(async () => {
    if (!show) return;
    setLoading(true);
    try {
      let data;
      if (viewMode === 'document' && documentId) {
        data = await attachmentsApi.getDocumentAttachments(documentId);
        setQuota(null);
      } else {
        data = await attachmentsApi.getUserAttachments(1, 100);
        setQuota(data.quota);
      }
      setAttachments(data.items || []);
      setTotal(data.total || 0);
    } catch (error) {
      showError('Failed to load attachments');
      console.error('Failed to load attachments:', error);
    } finally {
      setLoading(false);
    }
  }, [show, viewMode, documentId, showError]);

  useEffect(() => {
    loadAttachments();
  }, [loadAttachments]);

  useEffect(() => {
    if (!searchTerm) {
      setFilteredAttachments(attachments);
      return;
    }
    const term = searchTerm.toLowerCase();
    setFilteredAttachments(
      attachments.filter(a => a.original_filename.toLowerCase().includes(term))
    );
  }, [attachments, searchTerm]);

  const handleDelete = async (attachment) => {
    if (!window.confirm(`Delete "${attachment.original_filename}"?`)) return;
    try {
      await attachmentsApi.deleteAttachment(attachment.id);
      showSuccess('Attachment deleted');
      loadAttachments();
    } catch (error) {
      showError('Failed to delete attachment');
    }
  };

  const handleInsertLink = (attachment) => {
    if (onAttachmentSelected) {
      onAttachmentSelected(attachment);
    }
  };

  const handleView = (attachment) => {
    const url = attachmentsApi.getViewUrl(attachment.id);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleDownload = (attachment) => {
    const url = attachmentsApi.getDownloadUrl(attachment.id);
    const link = document.createElement('a');
    link.href = url;
    link.download = attachment.original_filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleUploadComplete = () => {
    loadAttachments();
  };

  const handleClose = () => {
    setSearchTerm('');
    onHide();
  };

  return (
    <>
      <Modal show={show && !showUploadModal} onHide={handleClose} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            <i className="bi bi-paperclip me-2"></i>
            Attachments
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {/* View mode tabs & search */}
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div>
              {documentId && (
                <div className="btn-group btn-group-sm">
                  <button
                    className={`btn ${viewMode === 'document' ? 'btn-primary' : 'btn-outline-primary'}`}
                    onClick={() => setViewMode('document')}
                  >
                    This Document
                  </button>
                  <button
                    className={`btn ${viewMode === 'library' ? 'btn-primary' : 'btn-outline-primary'}`}
                    onClick={() => setViewMode('library')}
                  >
                    All Attachments
                  </button>
                </div>
              )}
            </div>
            <Button
              variant="outline-primary"
              size="sm"
              onClick={() => setShowUploadModal(true)}
              disabled={!documentId}
            >
              <i className="bi bi-upload me-1"></i> Upload
            </Button>
          </div>

          {/* Search */}
          <InputGroup size="sm" className="mb-3">
            <InputGroup.Text>
              <i className="bi bi-search"></i>
            </InputGroup.Text>
            <Form.Control
              placeholder="Search attachments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </InputGroup>

          {/* Quota bar (library view) */}
          {quota && (
            <div className="mb-3">
              <div className="d-flex justify-content-between small text-muted mb-1">
                <span>
                  {attachmentsApi.formatFileSize(quota.used_bytes)} of{' '}
                  {attachmentsApi.formatFileSize(quota.quota_bytes)} used
                </span>
                <span>{quota.percentage_used}%</span>
              </div>
              <ProgressBar
                now={quota.percentage_used}
                variant={getQuotaVariant(quota.percentage_used)}
                style={{ height: '6px' }}
              />
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="text-center py-4">
              <Spinner animation="border" size="sm" className="me-2" />
              Loading attachments...
            </div>
          )}

          {/* Empty state */}
          {!loading && filteredAttachments.length === 0 && (
            <Alert variant="info" className="text-center">
              <i className="bi bi-paperclip me-2"></i>
              {searchTerm
                ? 'No attachments match your search'
                : viewMode === 'document'
                ? 'No attachments on this document yet'
                : 'No attachments uploaded yet'}
            </Alert>
          )}

          {/* Attachment list */}
          {!loading && filteredAttachments.length > 0 && (
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <Table hover size="sm" className="mb-0">
                <thead>
                  <tr>
                    <th>File</th>
                    <th>Size</th>
                    <th>Scan</th>
                    <th>Date</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAttachments.map((attachment) => (
                    <tr key={attachment.id}>
                      <td>
                        <div className="d-flex align-items-center">
                          <i className={`bi ${getFileIcon(attachment.original_filename)} me-2`}></i>
                          <span className="text-truncate" style={{ maxWidth: '200px' }}>
                            {attachment.original_filename}
                          </span>
                        </div>
                      </td>
                      <td className="text-nowrap small">
                        {attachmentsApi.formatFileSize(attachment.file_size_bytes)}
                      </td>
                      <td>{getScanBadge(attachment.scan_status)}</td>
                      <td className="text-nowrap small">
                        {new Date(attachment.created_at).toLocaleDateString()}
                      </td>
                      <td className="text-end text-nowrap">
                        <Button
                          variant="outline-primary"
                          size="sm"
                          className="me-1"
                          onClick={() => handleView(attachment)}
                          title="View in browser"
                        >
                          <i className="bi bi-eye"></i>
                        </Button>
                        <Button
                          variant="outline-secondary"
                          size="sm"
                          className="me-1"
                          onClick={() => handleDownload(attachment)}
                          title="Download"
                        >
                          <i className="bi bi-download"></i>
                        </Button>
                        {onAttachmentSelected && (
                          <Button
                            variant="outline-success"
                            size="sm"
                            className="me-1"
                            onClick={() => handleInsertLink(attachment)}
                            title="Insert link in editor"
                          >
                            <i className="bi bi-link-45deg"></i>
                          </Button>
                        )}
                        <Button
                          variant="outline-danger"
                          size="sm"
                          onClick={() => handleDelete(attachment)}
                          title="Delete"
                        >
                          <i className="bi bi-trash"></i>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}

          {/* Total info */}
          {!loading && total > 0 && (
            <div className="text-muted small mt-2">
              {total} attachment{total !== 1 ? 's' : ''}
              {searchTerm && ` (${filteredAttachments.length} matching)`}
            </div>
          )}
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={handleClose}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      <AttachmentUploadModal
        show={showUploadModal}
        onHide={() => setShowUploadModal(false)}
        documentId={documentId}
        onAttachmentUploaded={handleUploadComplete}
      />
    </>
  );
}

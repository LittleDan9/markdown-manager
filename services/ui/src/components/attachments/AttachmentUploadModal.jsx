// Attachment Upload Component
import React, { useState, useRef, useCallback } from 'react';
import { Modal, Button, Alert, ProgressBar, Badge, Row, Col, Card } from 'react-bootstrap';
import { useNotification } from '@/components/NotificationProvider';
import attachmentsApi from '@/api/attachmentsApi';

const ACCEPTED_EXTENSIONS = '.pdf,.txt,.csv,.log';
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

const ALLOWED_TYPES = [
  'application/pdf',
  'text/plain',
  'text/csv',
];

function isAllowedFile(file) {
  if (ALLOWED_TYPES.includes(file.type)) return true;
  const ext = file.name.split('.').pop()?.toLowerCase();
  return ['pdf', 'txt', 'csv', 'log'].includes(ext);
}

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

export default function AttachmentUploadModal({ show, onHide, documentId, onAttachmentUploaded }) {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  const fileInputRef = useRef();
  const { showSuccess, showError } = useNotification();

  const handleFileSelect = useCallback((selectedFiles) => {
    const validFiles = Array.from(selectedFiles).filter(file => {
      if (!isAllowedFile(file)) {
        showError(`${file.name} is not a supported file type. Allowed: PDF, TXT, CSV, LOG`);
        return false;
      }
      if (file.size > MAX_FILE_SIZE) {
        showError(`${file.name} is too large (max 20 MB)`);
        return false;
      }
      return true;
    });
    setFiles(prev => [...prev, ...validFiles]);
  }, [showError]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  }, [handleFileSelect]);

  const handleFileInputChange = useCallback((e) => {
    handleFileSelect(e.target.files);
  }, [handleFileSelect]);

  const removeFile = useCallback((index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleUpload = async () => {
    if (files.length === 0 || !documentId) return;

    setUploading(true);
    setUploadResults(null);

    const results = [];

    for (const file of files) {
      try {
        const result = await attachmentsApi.uploadAttachment(documentId, file);
        results.push({ filename: file.name, success: true, attachment: result.attachment });
      } catch (error) {
        const detail = error.response?.data?.detail || error.message;
        results.push({ filename: file.name, success: false, error: detail });
      }
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    setUploadResults({ results, successful_uploads: successful, failed_uploads: failed });

    if (successful > 0) {
      showSuccess(`Uploaded ${successful} attachment${successful > 1 ? 's' : ''}`);
      results.forEach(r => {
        if (r.success && r.attachment && onAttachmentUploaded) {
          onAttachmentUploaded(r.attachment);
        }
      });
    }
    if (failed > 0) {
      showError(`Failed to upload ${failed} file${failed > 1 ? 's' : ''}`);
    }

    setUploading(false);
  };

  const handleClose = () => {
    if (!uploading) {
      setFiles([]);
      setUploadResults(null);
      onHide();
    }
  };

  return (
    <Modal show={show} onHide={handleClose} size="lg" backdrop="static">
      <Modal.Header closeButton={!uploading}>
        <Modal.Title>
          <i className="bi bi-paperclip me-2"></i>
          Upload Attachments
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {!uploadResults && (
          <>
            <div
              className={`border-2 border-dashed rounded p-4 text-center mb-3 ${
                dragOver ? 'border-primary bg-primary bg-opacity-10' : 'border-secondary'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              style={{ cursor: 'pointer' }}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="my-3">
                <i className="bi bi-cloud-upload display-4 text-muted"></i>
                <div className="mt-2">
                  <strong>Drag and drop files here</strong>
                </div>
                <div className="text-muted">or click to browse</div>
                <div className="small text-muted mt-1">
                  Supported: PDF, TXT, CSV, LOG (max 20 MB each)
                </div>
              </div>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileInputChange}
              multiple
              accept={ACCEPTED_EXTENSIONS}
              style={{ display: 'none' }}
            />

            {files.length > 0 && (
              <div className="mb-3">
                <h6>Selected Files ({files.length})</h6>
                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {files.map((file, index) => (
                    <div key={index} className="d-flex align-items-center justify-content-between border rounded p-2 mb-2">
                      <div className="d-flex align-items-center">
                        <i className={`bi ${getFileIcon(file.name)} me-2`}></i>
                        <div>
                          <div className="fw-medium">{file.name}</div>
                          <div className="small text-muted">
                            {attachmentsApi.formatFileSize(file.size)}
                          </div>
                        </div>
                      </div>
                      {!uploading && (
                        <Button variant="outline-danger" size="sm" onClick={() => removeFile(index)}>
                          <i className="bi bi-x"></i>
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {uploading && (
              <div className="mb-3">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span>Uploading & scanning...</span>
                </div>
                <ProgressBar animated now={100} />
                <div className="small text-muted mt-1">
                  <i className="bi bi-shield-check me-1"></i>
                  Files are being virus-scanned before storage
                </div>
              </div>
            )}
          </>
        )}

        {uploadResults && (
          <div>
            <Alert variant={uploadResults.failed_uploads > 0 ? 'warning' : 'success'}>
              <h6>Upload Complete</h6>
              <div>
                <Badge bg="success" className="me-2">
                  {uploadResults.successful_uploads} successful
                </Badge>
                {uploadResults.failed_uploads > 0 && (
                  <Badge bg="danger">
                    {uploadResults.failed_uploads} failed
                  </Badge>
                )}
              </div>
            </Alert>

            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {uploadResults.results.map((result, index) => (
                <Card key={index} className={`mb-2 ${result.success ? 'border-success' : 'border-danger'}`}>
                  <Card.Body className="py-2">
                    <Row className="align-items-center">
                      <Col xs="auto">
                        <i className={`bi bi-${result.success ? 'check-circle text-success' : 'x-circle text-danger'}`}></i>
                      </Col>
                      <Col>
                        <div className="fw-medium">{result.filename}</div>
                        {result.success && result.attachment && (
                          <div className="small text-muted">
                            {attachmentsApi.formatFileSize(result.attachment.file_size_bytes)}
                            {result.attachment.scan_status === 'clean' && (
                              <Badge bg="success" className="ms-2">Scan: Clean</Badge>
                            )}
                          </div>
                        )}
                        {!result.success && (
                          <div className="small text-danger">{result.error}</div>
                        )}
                      </Col>
                    </Row>
                  </Card.Body>
                </Card>
              ))}
            </div>
          </div>
        )}
      </Modal.Body>

      <Modal.Footer>
        {!uploadResults && (
          <>
            <Button variant="secondary" onClick={handleClose} disabled={uploading}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleUpload}
              disabled={files.length === 0 || uploading || !documentId}
            >
              {uploading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" />
                  Uploading...
                </>
              ) : (
                <>
                  <i className="bi bi-upload me-2"></i>
                  Upload {files.length > 0 ? `${files.length} file${files.length > 1 ? 's' : ''}` : 'Files'}
                </>
              )}
            </Button>
          </>
        )}

        {uploadResults && (
          <Button variant="primary" onClick={handleClose}>
            Done
          </Button>
        )}
      </Modal.Footer>
    </Modal>
  );
}

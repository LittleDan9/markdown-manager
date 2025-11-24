// Image Upload Component
import React, { useState, useRef, useCallback } from 'react';
import { Modal, Button, Form, Alert, ProgressBar, Badge, Row, Col, Card } from 'react-bootstrap';
import { useNotification } from '@/components/NotificationProvider';
import imageApi from '@/api/imageApi';

export default function ImageUploadModal({ show, onHide, onImageUploaded }) {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResults, setUploadResults] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [optimizeForPdf, setOptimizeForPdf] = useState(true);
  const [createThumbnail, setCreateThumbnail] = useState(true);
  
  const fileInputRef = useRef();
  const { showSuccess, showError } = useNotification();

  const handleFileSelect = useCallback((selectedFiles) => {
    const validFiles = Array.from(selectedFiles).filter(file => {
      // Check file type
      if (!file.type.startsWith('image/')) {
        showError(`${file.name} is not a valid image file`);
        return false;
      }
      
      // Check file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        showError(`${file.name} is too large (max 10MB)`);
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
    if (files.length === 0) {
      showError('Please select at least one image to upload');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadResults(null);

    try {
      const options = {
        optimizeForPdf,
        createThumbnail
      };

      let results;
      if (files.length === 1) {
        // Single file upload
        const result = await imageApi.uploadImage(files[0], options);
        results = {
          successful_uploads: 1,
          failed_uploads: 0,
          results: [{
            filename: files[0].name,
            success: true,
            image: result.image
          }]
        };
      } else {
        // Multiple file upload
        results = await imageApi.uploadMultipleImages(files, options);
      }

      setUploadResults(results);
      
      if (results.successful_uploads > 0) {
        showSuccess(`Successfully uploaded ${results.successful_uploads} image${results.successful_uploads > 1 ? 's' : ''}`);
        
        // Call callback for each successful upload
        if (onImageUploaded) {
          results.results.forEach(result => {
            if (result.success && result.image) {
              onImageUploaded(result.image);
            }
          });
        }
      }

      if (results.failed_uploads > 0) {
        showError(`Failed to upload ${results.failed_uploads} image${results.failed_uploads > 1 ? 's' : ''}`);
      }

    } catch (error) {
      console.error('Upload failed:', error);
      showError('Failed to upload images: ' + (error.response?.data?.detail || error.message));
    } finally {
      setUploading(false);
      setUploadProgress(100);
    }
  };

  const handleClose = () => {
    if (!uploading) {
      setFiles([]);
      setUploadResults(null);
      setUploadProgress(0);
      onHide();
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Modal show={show} onHide={handleClose} size="lg" backdrop="static">
      <Modal.Header closeButton={!uploading}>
        <Modal.Title>Upload Images</Modal.Title>
      </Modal.Header>
      
      <Modal.Body>
        {!uploadResults && (
          <>
            {/* Drag and Drop Area */}
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
                  <strong>Drag and drop images here</strong>
                </div>
                <div className="text-muted">or click to browse files</div>
                <div className="small text-muted mt-1">
                  Supported formats: JPEG, PNG, GIF, WebP, BMP, TIFF (max 10MB each)
                </div>
              </div>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileInputChange}
              multiple
              accept="image/*"
              style={{ display: 'none' }}
            />

            {/* Upload Options */}
            <Row className="mb-3">
              <Col md={6}>
                <Form.Check
                  type="checkbox"
                  label="Optimize for PDF"
                  checked={optimizeForPdf}
                  onChange={(e) => setOptimizeForPdf(e.target.checked)}
                  disabled={uploading}
                />
                <Form.Text className="text-muted">
                  Resize and compress for 8.5x11 paper printing
                </Form.Text>
              </Col>
              <Col md={6}>
                <Form.Check
                  type="checkbox"
                  label="Create thumbnails"
                  checked={createThumbnail}
                  onChange={(e) => setCreateThumbnail(e.target.checked)}
                  disabled={uploading}
                />
                <Form.Text className="text-muted">
                  Generate 200x200 preview thumbnails
                </Form.Text>
              </Col>
            </Row>

            {/* Selected Files */}
            {files.length > 0 && (
              <div className="mb-3">
                <h6>Selected Files ({files.length})</h6>
                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {files.map((file, index) => (
                    <div key={index} className="d-flex align-items-center justify-content-between border rounded p-2 mb-2">
                      <div>
                        <div className="fw-medium">{file.name}</div>
                        <div className="small text-muted">{formatFileSize(file.size)}</div>
                      </div>
                      {!uploading && (
                        <Button
                          variant="outline-danger"
                          size="sm"
                          onClick={() => removeFile(index)}
                        >
                          <i className="bi bi-x"></i>
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Upload Progress */}
            {uploading && (
              <div className="mb-3">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span>Uploading...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <ProgressBar now={uploadProgress} animated />
              </div>
            )}
          </>
        )}

        {/* Upload Results */}
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
                        {result.success && result.image && (
                          <div className="small text-muted">
                            {result.image.width}x{result.image.height} • {formatFileSize(result.image.file_size)}
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
              disabled={files.length === 0 || uploading}
            >
              {uploading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" />
                  Uploading...
                </>
              ) : (
                <>
                  <i className="bi bi-upload me-2"></i>
                  Upload {files.length > 0 ? `${files.length} image${files.length > 1 ? 's' : ''}` : 'Images'}
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
// Image Browser Component
import React, { useState, useEffect, useCallback } from 'react';
import { Modal, Button, Row, Col, Card, Badge, Form, InputGroup, Alert, Spinner } from 'react-bootstrap';
import { useNotification } from '@/components/NotificationProvider';
import imageApi from '@/api/imageApi';
import ImageUploadModal from './ImageUploadModal';
import AuthenticatedImage from './AuthenticatedImage';

export default function ImageBrowserModal({ show, onHide, onImageSelected, allowMultiple = false }) {
  const [images, setImages] = useState([]);
  const [filteredImages, setFilteredImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedImages, setSelectedImages] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [stats, setStats] = useState(null);

  const { showSuccess, showError } = useNotification();

  const loadImages = useCallback(async () => {
    if (!show) return;

    setLoading(true);
    try {
      const response = await imageApi.listImages();
      setImages(response.images || []);
      setStats(response.statistics);
    } catch (error) {
      console.error('Failed to load images:', error);
      // Don't show error for empty image list (404 might be expected for new users)
      if (error.response?.status !== 404) {
        showError('Failed to load images: ' + (error.response?.data?.detail || error.message));
      }
      // Set empty arrays on error to prevent reload loops
      setImages([]);
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [show, showError]);

  useEffect(() => {
    loadImages();
  }, [loadImages]);

  // Filter and sort images
  useEffect(() => {
    const filtered = images.filter(image =>
      image.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (image.original_filename && image.original_filename.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    // Sort images
    filtered.sort((a, b) => {
      let valueA, valueB;

      switch (sortBy) {
        case 'filename':
          valueA = a.filename.toLowerCase();
          valueB = b.filename.toLowerCase();
          break;
        case 'file_size':
          valueA = a.file_size || 0;
          valueB = b.file_size || 0;
          break;
        case 'created_at':
        default:
          valueA = new Date(a.created_at || 0);
          valueB = new Date(b.created_at || 0);
          break;
      }

      if (sortOrder === 'asc') {
        return valueA < valueB ? -1 : valueA > valueB ? 1 : 0;
      } else {
        return valueA > valueB ? -1 : valueA < valueB ? 1 : 0;
      }
    });

    setFilteredImages(filtered);
  }, [images, searchTerm, sortBy, sortOrder]);

  const handleImageClick = useCallback((image) => {
    if (allowMultiple) {
      setSelectedImages(prev => {
        const newSet = new Set(prev);
        if (newSet.has(image.filename)) {
          newSet.delete(image.filename);
        } else {
          newSet.add(image.filename);
        }
        return newSet;
      });
    } else {
      // Single selection - call callback immediately
      if (onImageSelected) {
        onImageSelected(image);
      }
      onHide();
    }
  }, [allowMultiple, onImageSelected, onHide]);

  const handleSelectAll = useCallback(() => {
    if (selectedImages.size === filteredImages.length) {
      setSelectedImages(new Set());
    } else {
      setSelectedImages(new Set(filteredImages.map(img => img.filename)));
    }
  }, [selectedImages.size, filteredImages]);

  const handleSelectImages = useCallback(() => {
    if (selectedImages.size === 0) {
      showError('Please select at least one image');
      return;
    }

    const selectedImageObjects = images.filter(img => selectedImages.has(img.filename));

    if (onImageSelected) {
      if (allowMultiple) {
        onImageSelected(selectedImageObjects);
      } else {
        onImageSelected(selectedImageObjects[0]);
      }
    }

    onHide();
  }, [selectedImages, images, onImageSelected, allowMultiple, showError, onHide]);

  const handleDeleteImage = useCallback(async (image, event) => {
    event.stopPropagation();

    if (!confirm(`Are you sure you want to delete "${image.filename}"?`)) {
      return;
    }

    try {
      await imageApi.deleteImage(image.filename);
      showSuccess(`Deleted ${image.filename}`);
      loadImages(); // Reload the list
    } catch (error) {
      console.error('Failed to delete image:', error);
      showError('Failed to delete image: ' + (error.response?.data?.detail || error.message));
    }
  }, [showSuccess, showError, loadImages]);

  const handleImageUploaded = useCallback((_newImage) => {
    // Refresh the image list
    loadImages();
  }, [loadImages]);

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <>
      <Modal show={show} onHide={onHide} size="xl" backdrop="static">
        <Modal.Header closeButton>
          <Modal.Title>
            Image Browser
            {stats && (
              <span className="ms-2">
                <Badge bg="secondary">{stats.total_images} images</Badge>
                <Badge bg="info" className="ms-1">{stats.total_size_mb} MB</Badge>
              </span>
            )}
          </Modal.Title>
        </Modal.Header>

        <Modal.Body style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          {/* Controls */}
          <Row className="mb-3">
            <Col md={6}>
              <InputGroup>
                <InputGroup.Text>
                  <i className="bi bi-search"></i>
                </InputGroup.Text>
                <Form.Control
                  type="text"
                  placeholder="Search images..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </InputGroup>
            </Col>
            <Col md={3}>
              <Form.Select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="created_at">Created Date</option>
                <option value="filename">Filename</option>
                <option value="file_size">File Size</option>
              </Form.Select>
            </Col>
            <Col md={3}>
              <Form.Select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </Form.Select>
            </Col>
          </Row>

          {allowMultiple && filteredImages.length > 0 && (
            <Row className="mb-3">
              <Col>
                <div className="d-flex align-items-center">
                  <Form.Check
                    type="checkbox"
                    label={`Select All (${selectedImages.size}/${filteredImages.length})`}
                    checked={selectedImages.size === filteredImages.length}
                    indeterminate={selectedImages.size > 0 && selectedImages.size < filteredImages.length}
                    onChange={handleSelectAll}
                  />
                </div>
              </Col>
            </Row>
          )}

          {loading && (
            <div className="text-center py-5">
              <Spinner animation="border" />
              <div className="mt-2">Loading images...</div>
            </div>
          )}

          {!loading && filteredImages.length === 0 && (
            <Alert variant="info" className="text-center">
              {images.length === 0 ? (
                <>
                  <i className="bi bi-images display-4 d-block mb-2"></i>
                  <h5>No images uploaded yet</h5>
                  <p>Upload your first image to get started!</p>
                </>
              ) : (
                <>
                  <i className="bi bi-search display-4 d-block mb-2"></i>
                  <h5>No images match your search</h5>
                  <p>Try adjusting your search terms.</p>
                </>
              )}
            </Alert>
          )}

          {/* Image Grid */}
          {!loading && filteredImages.length > 0 && (
            <Row>
              {filteredImages.map((image) => (
                <Col key={image.filename} xs={12} sm={6} md={4} lg={3} className="mb-3">
                  <Card
                    className={`h-100 image-card ${selectedImages.has(image.filename) ? 'border-primary' : ''}`}
                    style={{ cursor: 'pointer' }}
                    onClick={() => handleImageClick(image)}
                  >
                    {/* Image Preview */}
                    <div style={{ position: 'relative', paddingTop: '75%', overflow: 'hidden' }}>
                      <AuthenticatedImage
                        filename={image.filename}
                        useThumbnail={true}
                        alt={image.original_filename || image.filename}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover'
                        }}
                        loading="lazy"
                      />

                      {/* Selection indicator */}
                      {allowMultiple && selectedImages.has(image.filename) && (
                        <div
                          style={{
                            position: 'absolute',
                            top: '8px',
                            right: '8px',
                            background: 'rgba(13, 110, 253, 0.9)',
                            borderRadius: '50%',
                            padding: '4px',
                            color: 'white'
                          }}
                        >
                          <i className="bi bi-check"></i>
                        </div>
                      )}

                      {/* Delete button */}
                      <Button
                        variant="danger"
                        size="sm"
                        style={{
                          position: 'absolute',
                          top: '8px',
                          left: '8px',
                          padding: '2px 6px'
                        }}
                        onClick={(e) => handleDeleteImage(image, e)}
                      >
                        <i className="bi bi-trash"></i>
                      </Button>
                    </div>

                    <Card.Body className="p-2">
                      <div className="small">
                        <div className="fw-medium text-truncate" title={image.original_filename || image.filename}>
                          {image.original_filename || image.filename}
                        </div>
                        <div className="text-muted">
                          {image.width}×{image.height} • {formatFileSize(image.file_size)}
                        </div>
                        <div className="text-muted">
                          {formatDate(image.created_at)}
                        </div>
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
              ))}
            </Row>
          )}
        </Modal.Body>

        <Modal.Footer>
          <div className="me-auto">
            <Button variant="outline-primary" onClick={() => setShowUploadModal(true)}>
              <i className="bi bi-plus-circle me-2"></i>
              Upload Images
            </Button>
          </div>

          <Button variant="secondary" onClick={onHide}>
            Cancel
          </Button>

          {allowMultiple && (
            <Button
              variant="primary"
              onClick={handleSelectImages}
              disabled={selectedImages.size === 0}
            >
              Select {selectedImages.size > 0 ? `${selectedImages.size} ` : ''}Image{selectedImages.size !== 1 ? 's' : ''}
            </Button>
          )}
        </Modal.Footer>
      </Modal>

      {/* Upload Modal */}
      <ImageUploadModal
        show={showUploadModal}
        onHide={() => setShowUploadModal(false)}
        onImageUploaded={handleImageUploaded}
      />
    </>
  );
}
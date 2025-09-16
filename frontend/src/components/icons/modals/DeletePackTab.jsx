import React, { useState } from 'react';
import { Card, ListGroup, Badge, Button, Alert, Spinner, Modal } from 'react-bootstrap';
import { useNotification } from '../../NotificationProvider';
import iconsApi from '../../../api/iconsApi';

export default function DeletePackTab({ iconPacks, onReloadData }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [packToDelete, setPackToDelete] = useState(null);

  const { showSuccess, showError } = useNotification();

  const handleDeleteClick = (pack) => {
    setPackToDelete(pack);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!packToDelete) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await iconsApi.deleteIconPack(packToDelete.name);
      
      setSuccess(`Successfully deleted icon pack "${packToDelete.display_name}"`);
      showSuccess(`Icon pack "${packToDelete.display_name}" deleted successfully!`);
      
      // Close modal and reset state
      setShowDeleteModal(false);
      setPackToDelete(null);
      
      // Reload data via parent
      onReloadData();

    } catch (err) {
      const errorMessage = err.message || 'Failed to delete icon pack';
      setError(errorMessage);
      showError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
    setPackToDelete(null);
    setError('');
  };

  return (
    <>
      <Card>
        <Card.Header className="d-flex justify-content-between align-items-center">
          <h5 className="mb-0">Delete Icon Packs</h5>
          <Badge bg="warning" text="dark">
            <i className="bi bi-exclamation-triangle me-1"></i>
            Danger Zone
          </Badge>
        </Card.Header>
        <Card.Body>
          {error && <Alert variant="danger">{error}</Alert>}
          {success && <Alert variant="success">{success}</Alert>}

          <Alert variant="warning" className="mb-3">
            <i className="bi bi-exclamation-triangle me-2"></i>
            <strong>Warning:</strong> Deleting an icon pack will permanently remove all icons in that pack. 
            This action cannot be undone. Make sure you have backups if needed.
          </Alert>

          {iconPacks.length === 0 ? (
            <div className="text-center text-muted py-4">
              <i className="bi bi-collection display-4"></i>
              <p className="mt-2">No icon packs available to delete</p>
            </div>
          ) : (
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <ListGroup variant="flush">
                {iconPacks.map(pack => (
                  <ListGroup.Item key={pack.id}>
                    <div className="d-flex justify-content-between align-items-start">
                      <div className="flex-grow-1">
                        <div className="d-flex align-items-center mb-2">
                          <h6 className="mb-0 me-2">{pack.display_name}</h6>
                          <Badge bg="primary" pill className="me-2">
                            {pack.icon_count} icons
                          </Badge>
                          <Badge bg="secondary" pill>
                            {pack.category}
                          </Badge>
                        </div>
                        <p className="mb-1 text-muted">{pack.description}</p>
                        <small className="text-muted">
                          Pack ID: {pack.name}
                        </small>
                      </div>
                      <div className="ms-3">
                        <Button
                          variant="outline-danger"
                          size="sm"
                          onClick={() => handleDeleteClick(pack)}
                          disabled={loading}
                        >
                          <i className="bi bi-trash me-1"></i>
                          Delete Pack
                        </Button>
                      </div>
                    </div>
                  </ListGroup.Item>
                ))}
              </ListGroup>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Delete Confirmation Modal */}
      <Modal show={showDeleteModal} onHide={handleDeleteCancel} centered>
        <Modal.Header closeButton>
          <Modal.Title className="text-danger">
            <i className="bi bi-exclamation-triangle me-2"></i>
            Confirm Deletion
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {packToDelete && (
            <div>
              <p>
                Are you sure you want to delete the icon pack <strong>"{packToDelete.display_name}"</strong>?
              </p>
              <Card className="mb-3">
                <Card.Body>
                  <dl className="row mb-0">
                    <dt className="col-sm-4">Pack Name:</dt>
                    <dd className="col-sm-8">{packToDelete.name}</dd>
                    
                    <dt className="col-sm-4">Display Name:</dt>
                    <dd className="col-sm-8">{packToDelete.display_name}</dd>
                    
                    <dt className="col-sm-4">Category:</dt>
                    <dd className="col-sm-8">
                      <Badge bg="secondary">{packToDelete.category}</Badge>
                    </dd>
                    
                    <dt className="col-sm-4">Icon Count:</dt>
                    <dd className="col-sm-8">
                      <Badge bg="primary" pill>{packToDelete.icon_count} icons</Badge>
                    </dd>
                    
                    {packToDelete.description && (
                      <>
                        <dt className="col-sm-4">Description:</dt>
                        <dd className="col-sm-8">{packToDelete.description}</dd>
                      </>
                    )}
                  </dl>
                </Card.Body>
              </Card>
              <Alert variant="danger" className="mb-0">
                <i className="bi bi-exclamation-triangle me-2"></i>
                <strong>This action is permanent and cannot be undone!</strong>
                <br />
                All {packToDelete.icon_count} icons in this pack will be permanently deleted.
              </Alert>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button 
            variant="secondary" 
            onClick={handleDeleteCancel}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button 
            variant="danger" 
            onClick={handleDeleteConfirm}
            disabled={loading}
          >
            {loading ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Deleting...
              </>
            ) : (
              <>
                <i className="bi bi-trash me-2"></i>
                Delete Pack
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}

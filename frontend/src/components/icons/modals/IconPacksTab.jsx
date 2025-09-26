import React, { useState } from 'react';
import { Card, ListGroup, Badge, Button, Modal, Form, Alert, Spinner } from 'react-bootstrap';
import iconsApi from '../../../api/iconsApi';
import { adminIconsApi } from '../../../api/admin';
import { useNotification } from '../../NotificationProvider';
import ConfirmModal from '../../shared/modals/ConfirmModal';

export default function IconPacksTab({ iconPacks, onReloadData, loading: initialLoading = false }) {
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingPack, setEditingPack] = useState(null);
  const [packToDelete, setPackToDelete] = useState(null);
  const [editForm, setEditForm] = useState({
    name: '',
    displayName: '',
    category: '',
    description: ''
  });
  const [loading, setLoading] = useState(false);
  const [keyChangeWarning, setKeyChangeWarning] = useState(false);

  const { showSuccess, showError } = useNotification();

  const handleEdit = (pack) => {
    setEditingPack(pack);
    setEditForm({
      name: pack.name,
      displayName: pack.display_name,
      category: pack.category,
      description: pack.description || ''
    });
    setKeyChangeWarning(pack.name !== editForm.name);
    setShowEditModal(true);
  };

  const handleDelete = (pack) => {
    setPackToDelete(pack);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async (action) => {
    if (action !== 'delete' || !packToDelete) {
      setShowDeleteModal(false);
      setPackToDelete(null);
      return;
    }

    setLoading(true);
    try {
      await adminIconsApi.deleteIconPack(packToDelete.name);

      showSuccess(`Icon pack "${packToDelete.display_name}" deleted successfully!`);
      setShowDeleteModal(false);
      setPackToDelete(null);

      if (onReloadData) {
        onReloadData();
      }
    } catch (error) {
      console.error('Failed to delete icon pack:', error);
      showError(`Failed to delete icon pack: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFormChange = (field, value) => {
    setEditForm(prev => ({
      ...prev,
      [field]: value
    }));

    // Check if name (key) is changing
    if (field === 'name' && editingPack) {
      setKeyChangeWarning(value !== editingPack.name);
    }
  };

  const handleUpdate = async () => {
    if (!editingPack) return;

    setLoading(true);
    try {
      // Prepare metadata for efficient update (no icons affected)
      const metadata = {
        name: editForm.name,
        display_name: editForm.displayName,
        category: editForm.category,
        description: editForm.description
      };

      await adminIconsApi.updateIconPackMetadata(editingPack.name, metadata);

      showSuccess(`Icon pack "${editForm.displayName}" updated successfully!`);
      setShowEditModal(false);
      setEditingPack(null);

      if (onReloadData) {
        onReloadData();
      }
    } catch (error) {
      console.error('Failed to update icon pack:', error);
      showError(`Failed to update icon pack: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="icon-pack-tab">
      <div className="container-fluid">
        <div className="row justify-content-center">
          <div className="col-lg-10 col-xl-8">
            <Card>
              <Card.Header>
                <h5>Existing Icon Packs</h5>
              </Card.Header>
        <Card.Body>
          {initialLoading ? (
            <div className="loading-state">
              <Spinner animation="border" />
              <p className="mt-2">Loading icon packs...</p>
            </div>
          ) : iconPacks.length === 0 ? (
            <div className="empty-state">
              <i className="bi bi-collection empty-icon"></i>
              <h6>No Icon Packs Found</h6>
              <p>Install some icon packs to get started with your icon library.</p>
            </div>
          ) : (
            <div className="icon-packs-list">
              <ListGroup variant="flush">
                {iconPacks.map(pack => (
                  <ListGroup.Item key={pack.id}>
                    <div className="row align-items-center">
                      {/* Icon and Info Column */}
                      <div className="col-md-6">
                        <div className="pack-header">
                          <div className="pack-icon">
                            <i className="bi bi-collection"></i>
                          </div>
                          <div className="pack-info">
                            <h6 className="pack-name mb-1">{pack.display_name}</h6>
                            <p className="pack-description mb-1">{pack.description || 'No description available'}</p>
                            <small className="pack-details text-muted">
                              Pack: {pack.name} | Category: {pack.category}
                            </small>
                          </div>
                        </div>
                      </div>

                      {/* Badges Column */}
                      <div className="col-md-3">
                        <div className="pack-badges">
                          <Badge bg="primary" pill className="me-2">
                            {pack.icon_count} icons
                          </Badge>
                          <Badge bg="secondary">
                            {pack.category}
                          </Badge>
                        </div>
                      </div>

                      {/* Actions Column */}
                      <div className="col-md-3 text-end">
                        <div className="pack-actions">
                          <Button
                            variant="link"
                            size="sm"
                            className="text-muted p-1 me-2"
                            onClick={() => handleEdit(pack)}
                            disabled={loading}
                            title="Edit pack"
                          >
                            <i className="bi bi-pencil"></i>
                          </Button>
                          <Button
                            variant="link"
                            size="sm"
                            className="text-muted p-1"
                            onClick={() => handleDelete(pack)}
                            disabled={loading}
                            title="Delete pack"
                          >
                            <i className="bi bi-trash"></i>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </ListGroup.Item>
                ))}
              </ListGroup>
            </div>
          )}
        </Card.Body>
      </Card>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        show={showDeleteModal}
        onHide={() => setShowDeleteModal(false)}
        onAction={handleConfirmDelete}
        title="Delete Icon Pack"
        icon={<i className="bi bi-exclamation-triangle-fill text-danger me-2"></i>}
        buttons={[
          {
            text: 'Cancel',
            variant: 'secondary',
            action: 'cancel'
          },
          {
            text: loading ? 'Deleting...' : 'Delete Pack',
            variant: 'danger',
            action: 'delete',
            disabled: loading,
            icon: loading ? null : 'bi bi-trash'
          }
        ]}
      >
        {packToDelete && (
          <div>
            <p>
              Are you sure you want to delete the icon pack <strong>"{packToDelete.display_name}"</strong>?
            </p>
            <Card className="mb-3">
              <Card.Body>
                <div className="d-flex align-items-center">
                  <div className="me-3">
                    <i className="bi bi-collection display-6 text-primary"></i>
                  </div>
                  <div>
                    <h6 className="mb-1">{packToDelete.display_name}</h6>
                    <p className="mb-1 text-muted">{packToDelete.description || 'No description'}</p>
                    <div className="d-flex gap-2">
                      <Badge bg="primary" pill>{packToDelete.icon_count} icons</Badge>
                      <Badge bg="secondary">{packToDelete.category}</Badge>
                    </div>
                    <small className="text-muted d-block mt-1">Pack ID: {packToDelete.name}</small>
                  </div>
                </div>
              </Card.Body>
            </Card>
            <Alert variant="danger" className="mb-0">
              <i className="bi bi-exclamation-triangle me-2"></i>
              <strong>This action cannot be undone!</strong>
              <br />
              All {packToDelete.icon_count} icons in this pack will be permanently deleted.
            </Alert>
          </div>
        )}
      </ConfirmModal>

      {/* Edit Modal */}
      <Modal show={showEditModal} onHide={() => setShowEditModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Edit Icon Pack</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {keyChangeWarning && (
            <Alert variant="warning">
              <Alert.Heading>⚠️ Pack Key Change Detected</Alert.Heading>
              <p>
                You are changing the pack name/key from <strong>{editingPack?.name}</strong> to <strong>{editForm.name}</strong>.
              </p>
              <p className="mb-0">
                This will automatically update all documents that reference icons from this pack
                (e.g., <code>{editingPack?.name}:icon-name</code> → <code>{editForm.name}:icon-name</code>).
              </p>
            </Alert>
          )}

          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Pack Name (Key) *</Form.Label>
              <Form.Control
                type="text"
                value={editForm.name}
                onChange={(e) => handleFormChange('name', e.target.value)}
                placeholder="pack-name"
                required
              />
              <Form.Text className="text-muted">
                Used as the identifier in icon references: <code>{editForm.name}:icon-name</code>
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Display Name *</Form.Label>
              <Form.Control
                type="text"
                value={editForm.displayName}
                onChange={(e) => handleFormChange('displayName', e.target.value)}
                placeholder="Pack Display Name"
                required
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Category *</Form.Label>
              <Form.Control
                type="text"
                value={editForm.category}
                onChange={(e) => handleFormChange('category', e.target.value)}
                placeholder="general"
                required
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Description</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={editForm.description}
                onChange={(e) => handleFormChange('description', e.target.value)}
                placeholder="Optional description for the icon pack"
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowEditModal(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleUpdate}
            disabled={loading || !editForm.name || !editForm.displayName || !editForm.category}
          >
            {loading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                Updating...
              </>
            ) : (
              'Update Pack'
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
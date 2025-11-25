import React, { useState } from 'react';
import { Card, Button, Modal, Form, Alert, Spinner, Row, Col } from 'react-bootstrap';
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

  const handleEditPack = (pack) => {
    setEditingPack(pack);
    setEditForm({
      name: pack.name,
      displayName: pack.display_name,
      category: pack.category,
      description: pack.description || ''
    });
    setKeyChangeWarning(false);
    setShowEditModal(true);
  };

  const handleDeletePack = (pack) => {
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
      showSuccess(`Icon pack &quot;${packToDelete.display_name}&quot; deleted successfully!`);
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

    if (field === 'name' && editingPack) {
      setKeyChangeWarning(value !== editingPack.name);
    }
  };

  const handleUpdate = async () => {
    if (!editingPack) return;

    setLoading(true);
    try {
      const metadata = {
        name: editForm.name,
        display_name: editForm.displayName,
        category: editForm.category,
        description: editForm.description
      };

      await adminIconsApi.updateIconPackMetadata(editingPack.name, metadata);
      showSuccess(`Icon pack &quot;${editForm.displayName}&quot; updated successfully!`);
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
    <div className="icon-packs-tab">
      {/* Icon Packs Management */}
      <Card className="shadow-sm border-0">
        <Card.Header className="bg-dark text-white border-0">
          <h6 className="mb-0 fw-semibold">
            <i className="bi bi-collection me-2"></i>
            Icon Packs ({iconPacks.length})
          </h6>
        </Card.Header>
        <Card.Body className="p-0">
          {initialLoading ? (
            <div className="loading-state text-center py-5">
              <Spinner animation="border" variant="primary" />
              <p className="mt-3 mb-0">Loading icon packs...</p>
            </div>
          ) : iconPacks.length === 0 ? (
            <div className="empty-state text-center py-5">
              <i className="bi bi-collection display-3 text-muted mb-3 opacity-50"></i>
              <h6>No Icon Packs Found</h6>
              <p className="text-muted mb-0">Install some icon packs to get started with your icon library.</p>
            </div>
          ) : (
            <div className="packs-scroll-container" style={{ maxHeight: '600px', overflowY: 'auto' }}>
              <div className="p-4">
                <Row className="g-3">
                  {iconPacks.map(pack => (
                    <Col key={pack.id} md={6} lg={4} xl={3}>
                      <Card className="pack-card h-100 shadow-sm border-0">
                        <Card.Header className="bg-body-secondary border-0 p-3">
                          <div className="d-flex justify-content-between align-items-center">
                            <div className="pack-icon-display">
                              <i className="bi bi-collection fs-4 text-primary"></i>
                            </div>
                            <div className="pack-actions">
                              <Button
                                variant="outline-secondary"
                                size="sm"
                                onClick={() => handleEditPack(pack)}
                                className="me-1"
                                title="Edit pack"
                              >
                                <i className="bi bi-pencil"></i>
                              </Button>
                              <Button
                                variant="outline-danger"
                                size="sm"
                                onClick={() => handleDeletePack(pack)}
                                title="Delete pack"
                              >
                                <i className="bi bi-trash"></i>
                              </Button>
                            </div>
                          </div>
                        </Card.Header>
                        <Card.Body className="p-3">
                          <h6 className="card-title mb-2 text-truncate" title={pack.display_name}>
                            {pack.display_name}
                          </h6>
                          <div className="pack-details">
                            <div className="d-flex justify-content-between align-items-center mb-2">
                              <span className="badge bg-primary bg-opacity-10 text-primary">
                                {pack.category}
                              </span>
                              <small className="text-muted">
                                {pack.icons_count} icon{pack.icons_count !== 1 ? 's' : ''}
                              </small>
                            </div>
                            <div className="pack-meta small text-muted">
                              <div className="mb-1">
                                <strong>Key:</strong> <code className="bg-light px-1 rounded">{pack.name}</code>
                              </div>
                              {pack.description && (
                                <div className="pack-description text-truncate" title={pack.description}>
                                  {pack.description}
                                </div>
                              )}
                            </div>
                          </div>
                        </Card.Body>
                        <Card.Footer className="bg-transparent border-0 p-3 pt-0">
                          <div className="d-grid">
                            <Button
                              variant="outline-primary"
                              size="sm"
                              onClick={() => window.open(`/api/admin/icons/packs/${pack.name}/preview`, '_blank')}
                            >
                              <i className="bi bi-eye me-1"></i>
                              Preview Icons
                            </Button>
                          </div>
                        </Card.Footer>
                      </Card>
                    </Col>
                  ))}
                </Row>
              </div>
            </div>
          )}
        </Card.Body>
      </Card>

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
            text: 'Delete Pack',
            variant: 'danger',
            action: 'delete'
          }
        ]}
      >
        {packToDelete && (
          <p>
            Are you sure you want to delete the icon pack{' '}
            <strong>&quot;{packToDelete.display_name}&quot;</strong>?
          </p>
        )}
        <Alert variant="warning" className="small">
          <i className="bi bi-exclamation-triangle me-1"></i>
          This action cannot be undone. All icons in this pack will be permanently removed.
        </Alert>
      </ConfirmModal>

      {/* Edit Icon Pack Modal */}
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
                {/* eslint-disable-next-line react/no-unescaped-entities */}
                (e.g., <code>{editingPack?.name}:icon-name</code> &rarr; <code>{editForm.name}:icon-name</code>).
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
                {/* eslint-disable-next-line react/no-unescaped-entities */}
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
                placeholder="Optional description of the icon pack..."
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
                <Spinner animation="border" size="sm" className="me-2" />
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

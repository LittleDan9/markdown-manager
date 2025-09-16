import React, { useState } from 'react';
import { Card, ListGroup, Badge, Button, Modal, Form, Alert, Spinner } from 'react-bootstrap';
import iconsApi from '../../../api/iconsApi';
import { useNotification } from '../../NotificationProvider';

export default function IconPacksTab({ iconPacks, onReloadData, loading: initialLoading = false }) {
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPack, setEditingPack] = useState(null);
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

      await iconsApi.updateIconPackMetadata(editingPack.name, metadata);
      
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
    <>
      <Card>
        <Card.Header>
          <h5 className="mb-0">Existing Icon Packs</h5>
        </Card.Header>
        <Card.Body>
          {initialLoading ? (
            <div className="text-center py-4">
              <Spinner animation="border" />
              <p className="mt-2 text-muted">Loading icon packs...</p>
            </div>
          ) : iconPacks.length === 0 ? (
            <div className="text-center text-muted py-4">
              <i className="bi bi-collection display-4"></i>
              <p className="mt-2">No icon packs found</p>
            </div>
          ) : (
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <ListGroup variant="flush">
                {iconPacks.map(pack => (
                  <ListGroup.Item key={pack.id} className="d-flex justify-content-between align-items-center">
                    <div className="flex-grow-1">
                      <h6 className="mb-1">{pack.display_name}</h6>
                      <p className="mb-1 text-muted">{pack.description}</p>
                      <small className="text-muted">
                        Pack: {pack.name} | Category: {pack.category}
                      </small>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      <Badge bg="primary" pill>
                        {pack.icon_count} icons
                      </Badge>
                      <Button
                        variant="outline-secondary"
                        size="sm"
                        onClick={() => handleEdit(pack)}
                      >
                        <i className="bi bi-pencil-square"></i>
                      </Button>
                    </div>
                  </ListGroup.Item>
                ))}
              </ListGroup>
            </div>
          )}
        </Card.Body>
      </Card>

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
    </>
  );
}

import React, { useState, useEffect, useCallback } from 'react';
import { Modal, ListGroup, Badge, Spinner, Button } from 'react-bootstrap';
import collaborationApi from '@/api/collaborationApi';

/**
 * SharedWithMeModal — displays documents shared with the current user.
 * Lets the user open a shared document.
 */
export default function SharedWithMeModal({ show, onHide, onOpen }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!show) return;
    setLoading(true);
    try {
      const data = await collaborationApi.getSharedWithMe();
      setDocuments(data);
    } catch {
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [show]);

  useEffect(() => { load(); }, [load]);

  const handleOpen = (doc) => {
    if (onOpen) onOpen(doc);
    onHide();
  };

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>
          <i className="bi bi-people me-2"></i>
          Shared with Me
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {loading ? (
          <div className="text-center py-4">
            <Spinner animation="border" size="sm" className="me-2" />
            Loading shared documents...
          </div>
        ) : documents.length === 0 ? (
          <div className="text-muted text-center py-4">
            <i className="bi bi-inbox" style={{ fontSize: '2rem' }}></i>
            <p className="mt-2 mb-0">No documents have been shared with you yet.</p>
          </div>
        ) : (
          <ListGroup variant="flush">
            {documents.map((doc) => (
              <ListGroup.Item
                key={doc.document_id}
                action
                onClick={() => handleOpen({ id: doc.document_id, name: doc.document_name })}
                className="d-flex align-items-center"
              >
                <div className="flex-grow-1">
                  <div className="fw-medium">{doc.document_name}</div>
                  <small className="text-muted">
                    Shared by {doc.owner_name}
                    {doc.updated_at && ` · Updated ${new Date(doc.updated_at).toLocaleDateString()}`}
                  </small>
                </div>
                <Badge bg={doc.role === 'editor' ? 'primary' : 'secondary'}>
                  {doc.role}
                </Badge>
              </ListGroup.Item>
            ))}
          </ListGroup>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>Close</Button>
      </Modal.Footer>
    </Modal>
  );
}

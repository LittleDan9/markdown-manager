import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, InputGroup, Alert, Spinner } from 'react-bootstrap';

const ShareModal = ({ show, onHide, document, onShare, onUnshare }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState('');

  // Update shareUrl when document changes
  useEffect(() => {
    if (document?.share_token) {
      const url = `${window.location.origin}/shared/${document.share_token}`;
      setShareUrl(url);
    } else {
      setShareUrl('');
    }
  }, [document?.share_token, document?.is_shared]);

  const handleEnableSharing = async () => {
    setIsLoading(true);
    try {
      const result = await onShare(document.id);
      if (result.share_url) {
        setShareUrl(result.share_url);
      } else if (result.share_token) {
        setShareUrl(`${window.location.origin}/shared/${result.share_token}`);
      }
    } catch (error) {
      console.error('Failed to enable sharing:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisableSharing = async () => {
    setIsLoading(true);
    try {
      await onUnshare(document.id);
      setShareUrl('');
    } catch (error) {
      console.error('Failed to disable sharing:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      // Add a visual feedback - you could replace this with a toast notification
      const button = document.querySelector('[title="Copy to clipboard"]');
      if (button) {
        const originalContent = button.innerHTML;
        button.innerHTML = '<i class="bi bi-check-circle text-success"></i>';
        setTimeout(() => {
          button.innerHTML = originalContent;
        }, 2000);
      }
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const isShared = document?.is_shared || shareUrl;

  return (
    <Modal show={show} onHide={onHide} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>
          <i className="bi bi-share me-2"></i>
          Share Document
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="mb-3">
          <h6>{document?.name || 'Untitled Document'}</h6>
          <small className="text-muted">Category: {document?.category || 'General'}</small>
        </div>

        {!isShared ? (
          <div>
            <Alert variant="info">
              <i className="bi bi-info-circle me-2"></i>
              Create a shareable link that allows anyone to view this document (read-only).
              The link will always show the current version of the document.
            </Alert>
            <div className="d-grid">
              <Button 
                variant="primary" 
                onClick={handleEnableSharing}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Spinner
                      as="span"
                      animation="border"
                      size="sm"
                      role="status"
                      aria-hidden="true"
                      className="me-2"
                    />
                    Generating link...
                  </>
                ) : (
                  <>
                    <i className="bi bi-link me-2"></i>
                    Generate Share Link
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <Alert variant="success">
              <i className="bi bi-check-circle me-2"></i>
              Document sharing is enabled. Anyone with this link can view the document.
            </Alert>
            
            <Form.Group className="mb-3">
              <Form.Label>Share Link</Form.Label>
              <InputGroup>
                <Form.Control
                  type="text"
                  value={shareUrl}
                  readOnly
                  onClick={(e) => e.target.select()}
                />
                <Button 
                  variant="outline-secondary" 
                  onClick={handleCopyToClipboard}
                  title="Copy to clipboard"
                >
                  <i className="bi bi-clipboard"></i>
                </Button>
              </InputGroup>
              <Form.Text className="text-muted">
                This link provides read-only access and always shows the current version.
              </Form.Text>
            </Form.Group>

            <Alert variant="warning" className="mb-3">
              <i className="bi bi-exclamation-triangle me-2"></i>
              <strong>Important:</strong> This link does not expire and will remain accessible 
              until you disable sharing. Only share with trusted individuals.
            </Alert>

            <div className="d-grid">
              <Button 
                variant="danger" 
                onClick={handleDisableSharing}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Spinner
                      as="span"
                      animation="border"
                      size="sm"
                      role="status"
                      aria-hidden="true"
                      className="me-2"
                    />
                    Disabling...
                  </>
                ) : (
                  <>
                    <i className="bi bi-x-circle me-2"></i>
                    Disable Sharing
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default ShareModal;

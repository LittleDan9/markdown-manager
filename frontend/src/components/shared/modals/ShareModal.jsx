import React, { useState, useEffect, useRef } from 'react';
import { Modal, Button, Form, InputGroup, Alert, Spinner } from 'react-bootstrap';
import { useNotification } from '../../NotificationProvider';
import { serviceFactory } from '@/services/injectors';

const ShareModal = ({ show, onHide, document, onShare, onUnshare }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [localSharingEnabled, setLocalSharingEnabled] = useState(false);
  const { showSuccess, showError } = useNotification();
  const copyButtonRef = useRef(null);
  const copyService = serviceFactory.createCopyService();

  /**
   * Generate share URL using current domain
   * Always constructs URL from frontend to ensure it matches the current domain
   */
  const generateShareUrl = (shareToken) => {
    if (!shareToken) return '';
    return `${window.location.origin}/shared/${shareToken}`;
  };

  // Update shareUrl when document changes
  useEffect(() => {
    if (document?.share_token && document?.is_shared) {
      setShareUrl(generateShareUrl(document.share_token));
      setLocalSharingEnabled(true);
    } else if (!document?.is_shared) {
      // Only clear if sharing is explicitly disabled
      setShareUrl('');
      setLocalSharingEnabled(false);
    }
  }, [document?.share_token, document?.is_shared]);

  // Reset local state when modal is opened/closed
  useEffect(() => {
    if (!show) {
      setLocalSharingEnabled(false);
    }
  }, [show]);

  const handleEnableSharing = async () => {
    setIsLoading(true);
    try {
      const result = await onShare(document.id);

      // Backend now only returns share_token, construct URL on frontend
      if (result.share_token) {
        const newShareUrl = generateShareUrl(result.share_token);
        setShareUrl(newShareUrl);
        setLocalSharingEnabled(true);
        showSuccess('Share link generated successfully!');
      } else {
        throw new Error('No share token received from server');
      }
    } catch (error) {
      console.error('Failed to enable sharing:', error);
      showError('Failed to generate share link. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisableSharing = async () => {
    setIsLoading(true);
    try {
      await onUnshare(document.id);
      setShareUrl('');
      setLocalSharingEnabled(false);
      showSuccess('Document sharing disabled successfully!');
      // Close the modal after successfully disabling sharing
      setTimeout(() => {
        onHide();
      }, 1000); // Small delay to show the success message
    } catch (error) {
      console.error('Failed to disable sharing:', error);
      showError('Failed to disable sharing. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyToClipboard = async () => {
    if (!shareUrl) {
      showError('No URL to copy');
      return;
    }

    const success = await copyService.copyToClipboard(shareUrl, copyButtonRef.current);

    if (!success) {
      showError('Failed to copy link to clipboard. Please copy manually.');
    }
  };

  // Determine if sharing is currently enabled
  // Prioritize local state (immediate) over document state (eventual)
  const isShared = localSharingEnabled || (document?.is_shared && document?.share_token && Boolean(shareUrl));

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
                  ref={copyButtonRef}
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

import React, { useState } from 'react';
import { Button } from 'react-bootstrap';
import ShareModal from '@/components/shared/modals/ShareModal';
import { useDocumentContext } from '@/providers/DocumentContextProvider.jsx';
import { useAuth } from '@/providers/AuthProvider';
import { useNotification } from '@/components/NotificationProvider';
import { serviceFactory } from '@/services/injectors';
import PropTypes from 'prop-types';

function ShareButton({ className = '', size = 'sm' }) {
  const { currentDocument, isDefaultDoc } = useDocumentContext();
  const { isAuthenticated } = useAuth();
  const { showError } = useNotification();
  const [showShareModal, setShowShareModal] = useState(false);

  const documentService = serviceFactory.createDocumentService();

  const handleShare = () => {
    if (isDefaultDoc) {
      showError("Please save the document before sharing.");
      return;
    }
    setShowShareModal(true);
  };

  const handleEnableSharing = async (documentId) => {
    try {
      const result = await documentService.enableDocumentSharing(documentId);
      return result;
    } catch (error) {
      showError(`Failed to enable sharing: ${error.message}`);
      throw error;
    }
  };

  const handleDisableSharing = async (documentId) => {
    try {
      await documentService.disableDocumentSharing(documentId);
      return true;
    } catch (error) {
      showError(`Failed to disable sharing: ${error.message}`);
      throw error;
    }
  };

  // Don't render if user is not authenticated
  if (!isAuthenticated) {
    return null;
  }

  return (
    <>
      <Button
        size={size}
        variant="outline-secondary"
        className={className}
        disabled={isDefaultDoc}
        onClick={handleShare}
        title="Share Document"
        data-bs-toggle="tooltip"
        data-bs-placement="bottom"
      >
        <i className="bi bi-share"></i>
      </Button>

      <ShareModal
        show={showShareModal}
        onHide={() => setShowShareModal(false)}
        document={currentDocument}
        onShare={handleEnableSharing}
        onUnshare={handleDisableSharing}
      />
    </>
  );
}

ShareButton.propTypes = {
  className: PropTypes.string,
  size: PropTypes.string,
};

export default ShareButton;
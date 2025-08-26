import React from 'react';
import PropTypes from 'prop-types';
import { Modal } from 'react-bootstrap';
import { IconBrowser } from '../LazyComponents'; // Use lazy-loaded version
import LoadingOverlay from '../LoadingOverlay';

/**
 * AppModals - Component that manages all app-level modals
 * Centralizes modal management for the main application
 */
function AppModals({
  showIconBrowser,
  onHideIconBrowser,
  migrationStatus
}) {
  return (
    <>
      {/* Icon Browser Modal */}
      <Modal
        show={showIconBrowser}
        onHide={onHideIconBrowser}
        size="xl"
        scrollable
        data-bs-theme={document.documentElement.getAttribute('data-bs-theme')}
      >
        <Modal.Header closeButton className="border-bottom">
          <Modal.Title>Icon Browser</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ minHeight: '70vh' }} className="p-0">
          {/* Only render IconBrowser when modal is actually shown */}
          {showIconBrowser && <IconBrowser />}
        </Modal.Body>
      </Modal>

      {/* Migration Loading Overlay */}
      <LoadingOverlay
        show={migrationStatus === 'checking' || migrationStatus === 'migrating'}
        text={migrationStatus === 'checking' ? 'Checking for documents to migrate...' : 'Migrating your documents...'}
      />
    </>
  );
}

AppModals.propTypes = {
  showIconBrowser: PropTypes.bool.isRequired,
  onHideIconBrowser: PropTypes.func.isRequired,
  migrationStatus: PropTypes.string.isRequired,
};

export default AppModals;

import React, { useState } from 'react';
import { Modal, Nav, Tab } from 'react-bootstrap';
import PropTypes from 'prop-types';
import OrphansTab from './OrphansTab';
import AdminStorageTab from './AdminStorageTab';

function AdminModal({ show, onHide }) {
  const [activeTab, setActiveTab] = useState('orphans');

  return (
    <Modal
      show={show}
      onHide={onHide}
      size="lg"
      aria-labelledby="admin-modal-title"
      backdrop="static"
    >
      <Modal.Header closeButton>
        <Modal.Title id="admin-modal-title">
          Admin Panel
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <Tab.Container activeKey={activeTab} onSelect={setActiveTab}>
          <Nav variant="tabs" className="mb-3">
            <Nav.Item>
              <Nav.Link eventKey="orphans">
                Orphaned Documents
              </Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link eventKey="storage">
                <i className="bi bi-hdd me-2"></i>
                Storage Management
              </Nav.Link>
            </Nav.Item>
            {/* Future admin tabs can be added here */}
            {/* <Nav.Item>
              <Nav.Link eventKey="users">
                User Management
              </Nav.Link>
            </Nav.Item> */}
          </Nav>

          <Tab.Content>
            <Tab.Pane eventKey="orphans">
              <OrphansTab />
            </Tab.Pane>
            <Tab.Pane eventKey="storage">
              <AdminStorageTab />
            </Tab.Pane>
            {/* Future tab content can be added here */}
          </Tab.Content>
        </Tab.Container>
      </Modal.Body>
    </Modal>
  );
}

AdminModal.propTypes = {
  show: PropTypes.bool.isRequired,
  onHide: PropTypes.func.isRequired,
};

export default AdminModal;
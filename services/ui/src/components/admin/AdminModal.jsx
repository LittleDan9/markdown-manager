import React, { useState } from 'react';
import { Modal, Nav, Tab } from 'react-bootstrap';
import PropTypes from 'prop-types';
import AdminStorageTab from './AdminStorageTab';
import UserManagementTab from './UserManagementTab';

function AdminModal({ show, onHide }) {
  const [activeTab, setActiveTab] = useState('users');

  return (
    <Modal
      show={show}
      onHide={onHide}
      size="xl"
      scrollable
      centered
      aria-labelledby="admin-modal-title"
      dialogClassName="admin-modal"
    >
      <Modal.Header closeButton>
        <Modal.Title id="admin-modal-title">
          Admin Panel
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <Tab.Container
          activeKey={activeTab}
          onSelect={setActiveTab}
          className="tab-container"
        >
          <Nav variant="tabs" className="mb-3">
            <Nav.Item>
              <Nav.Link eventKey="users">
                <i className="bi bi-people me-2"></i>
                User Management
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
              <Nav.Link eventKey="system">
                System Settings
              </Nav.Link>
            </Nav.Item> */}
          </Nav>

          <Tab.Content className="tab-content">
            <Tab.Pane eventKey="users" className="tab-pane">
              <UserManagementTab />
            </Tab.Pane>
            <Tab.Pane eventKey="storage" className="tab-pane">
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
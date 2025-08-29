import React, { useState } from 'react';
import { Modal, Nav, Tab } from 'react-bootstrap';
import { GitHubAccountsTab, GitHubRepositoriesTab, GitHubCacheSyncTab } from '../index';

export default function GitHubModal({ show, onHide }) {
  const [activeTab, setActiveTab] = useState('accounts');

  return (
    <Modal show={show} onHide={onHide} size="xl" className="github-modal">
      <Modal.Header closeButton>
        <Modal.Title>
          <i className="bi bi-github me-2"></i>
          GitHub Integration
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Tab.Container activeKey={activeTab} onSelect={setActiveTab}>
          <Nav variant="tabs" className="mb-3">
            <Nav.Item>
              <Nav.Link eventKey="accounts">
                <i className="bi bi-person-circle me-2"></i>
                Accounts
              </Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link eventKey="repositories">
                <i className="bi bi-folder-open me-2"></i>
                Repositories
              </Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link eventKey="performance">
                <i className="bi bi-speedometer2 me-2"></i>
                Cache & Synchronization
              </Nav.Link>
            </Nav.Item>
          </Nav>

          <Tab.Content>
            <Tab.Pane eventKey="accounts">
              <GitHubAccountsTab />
            </Tab.Pane>
            <Tab.Pane eventKey="repositories">
              <GitHubRepositoriesTab />
            </Tab.Pane>
            <Tab.Pane eventKey="performance">
              <GitHubCacheSyncTab />
            </Tab.Pane>
          </Tab.Content>
        </Tab.Container>
      </Modal.Body>
    </Modal>
  );
}

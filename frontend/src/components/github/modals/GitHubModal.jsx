import React, { useState, useEffect } from 'react';
import { Modal, Nav, Tab } from 'react-bootstrap';
import { GitHubAccountsTab, GitHubRepositoriesTab, GitHubCacheSyncTab } from '../index';
import GitHubSettingsTab from '../tabs/GitHubSettingsTab';
import { useGitHubAccounts } from '../../../hooks/github/useGitHubAccounts';
import useFileModal from '../../../hooks/ui/useFileModal';

export default function GitHubModal({ show, onHide }) {
  const [activeTab, setActiveTab] = useState('accounts');
  const { accounts, loading: accountsLoading, loadAccounts } = useGitHubAccounts();
  const { openGitHubTab } = useFileModal();

  // Reset to accounts tab if current tab becomes unavailable
  useEffect(() => {
    if (!accountsLoading && accounts.length === 0) {
      if (activeTab !== 'accounts') {
        setActiveTab('accounts');
      }
    }
  }, [accounts, accountsLoading, activeTab]);

  const handleAccountsChange = (updatedAccounts) => {
    // Refresh the accounts from the hook to keep them in sync
    loadAccounts();
  };

  const handleRepositoryBrowse = (repository) => {
    // Close the GitHub System Modal and open FileOpen Modal to GitHub tab
    // with a callback to reopen this modal when FileOpen Modal closes
    const returnCallback = () => {
      // Small delay to ensure proper modal transition
      setTimeout(() => {
        // We need to trigger showing this modal again
        // This will be handled by the parent component that opens GitHubModal
        if (window.gitHubModalReturnCallback) {
          window.gitHubModalReturnCallback();
        }
      }, 100);
    };

    onHide();
    openGitHubTab(repository, returnCallback);
  };

  const hasAccounts = !accountsLoading && accounts.length > 0;

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
          <Nav variant="tabs">
            <Nav.Item>
              <Nav.Link eventKey="accounts">
                <i className="bi bi-person-circle me-2"></i>
                Accounts
              </Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link eventKey="settings">
                <i className="bi bi-gear me-2"></i>
                Settings
              </Nav.Link>
            </Nav.Item>
            {hasAccounts && (
              <Nav.Item>
                <Nav.Link eventKey="repositories">
                  <i className="bi bi-folder-open me-2"></i>
                  Repositories
                </Nav.Link>
              </Nav.Item>
            )}
            {hasAccounts && (
              <Nav.Item>
                <Nav.Link eventKey="performance">
                  <i className="bi bi-speedometer2 me-2"></i>
                  Cache & Synchronization
                </Nav.Link>
              </Nav.Item>
            )}
          </Nav>

          <Tab.Content>
            <Tab.Pane eventKey="accounts">
              <GitHubAccountsTab onAccountsChange={handleAccountsChange} />
            </Tab.Pane>
            <Tab.Pane eventKey="settings" className="github-settings-tab">
              <GitHubSettingsTab />
            </Tab.Pane>
            {hasAccounts && (
              <Tab.Pane eventKey="repositories">
                <GitHubRepositoriesTab
                  key={`repositories-${accounts.length}`}
                  onRepositoryBrowse={handleRepositoryBrowse}
                />
              </Tab.Pane>
            )}
            {hasAccounts && (
              <Tab.Pane eventKey="performance">
                <GitHubCacheSyncTab
                  key={`performance-${accounts.length}`}
                  isActive={activeTab === 'performance'}
                />
              </Tab.Pane>
            )}
          </Tab.Content>
        </Tab.Container>
      </Modal.Body>
    </Modal>
  );
}

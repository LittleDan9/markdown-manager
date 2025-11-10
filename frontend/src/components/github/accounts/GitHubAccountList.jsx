import React, { useState } from 'react';
import { Card, Badge } from 'react-bootstrap';
import { formatLastSync } from '../../../utils/githubUtils';
import gitHubApi from '../../../api/gitHubApi';
import ConfirmModal from '../../shared/modals/ConfirmModal';

/**
 * GitHub Account List Component
 * Displays connected accounts as simple cards
 */
const GitHubAccountList = ({
  accounts,
  loading,
  onDeleteAccount
}) => {
  const [deletingAccountId, setDeletingAccountId] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState(null);

  const handleDeleteClick = (accountId, accountName) => {
    setAccountToDelete({ id: accountId, name: accountName });
    setShowConfirmModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!accountToDelete) return;

    try {
      setDeletingAccountId(accountToDelete.id);
      setShowConfirmModal(false);
      await gitHubApi.disconnectAccount(accountToDelete.id);

      // Call parent callback to update the UI
      if (onDeleteAccount) {
        onDeleteAccount(accountToDelete.id);
      }
    } catch (error) {
      console.error('Failed to delete account:', error);
      alert('Failed to disconnect account. Please try again.');
    } finally {
      setDeletingAccountId(null);
      setAccountToDelete(null);
    }
  };

  const handleCancelDelete = () => {
    setShowConfirmModal(false);
    setAccountToDelete(null);
  };
  if (accounts.length === 0) {
    return null;
  }

  return (
    <div className="github-account-list">
      {accounts.map((account) => (
        <Card key={account.id} className="mb-3">
          <Card.Body>
            <div className="d-flex align-items-start">
              {account.avatar_url ? (
                <img
                  src={account.avatar_url}
                  alt={account.username}
                  width="48"
                  height="48"
                  className="rounded-circle me-3"
                />
              ) : (
                <i className="bi bi-github fs-3 me-3"></i>
              )}
              <div className="flex-grow-1">
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <div>
                    <h6 className="mb-1">{account.display_name || account.username}</h6>
                    <div className="text-muted">
                      @{account.username}
                      {account.email && ` • ${account.email}`}
                    </div>
                  </div>
                  <Badge
                    bg={account.is_active ? 'success' : 'danger'}
                    className="ms-2"
                  >
                    {account.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>

                <div className="d-flex justify-content-between align-items-end">
                  <div>
                    {account.repository_count > 0 && (
                      <div className="small text-muted">
                        <div>
                          <i className="bi bi-folder me-1"></i>
                          {account.repository_count} repositories
                        </div>
                        <div>
                          <i className="bi bi-clock me-1"></i>
                          Last sync: {formatLastSync(account.last_sync)}
                        </div>
                      </div>
                    )}
                  </div>
                  <button
                    className="btn btn-outline-danger btn-sm"
                    onClick={() => handleDeleteClick(account.id, account.display_name || account.username)}
                    disabled={loading || deletingAccountId === account.id}
                    title="Disconnect GitHub account"
                  >
                    {deletingAccountId === account.id ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                        Removing...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-trash me-1"></i>
                        Remove
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </Card.Body>
        </Card>
      ))}

      <ConfirmModal
        show={showConfirmModal}
        onHide={handleCancelDelete}
        onAction={(action) => {
          if (action === 'confirm') {
            handleConfirmDelete();
          } else {
            handleCancelDelete();
          }
        }}
        title="Disconnect GitHub Account"
        message={`Are you sure you want to disconnect ${accountToDelete?.name}? This will remove all synced repositories and cannot be undone.`}
        icon={<i className="bi bi-exclamation-triangle-fill text-warning me-2"></i>}
        buttons={[
          {
            text: 'Cancel',
            variant: 'secondary',
            action: 'cancel'
          },
          {
            text: 'Disconnect',
            variant: 'danger',
            action: 'confirm',
            icon: 'bi-trash'
          }
        ]}
      />
    </div>
  );
};

export default GitHubAccountList;

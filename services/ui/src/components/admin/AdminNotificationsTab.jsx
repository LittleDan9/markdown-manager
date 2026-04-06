import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Form, Button, Spinner, Badge, Alert } from 'react-bootstrap';
import { adminNotificationsApi, adminUsersApi } from '../../api/admin';
import { useNotification } from '../NotificationProvider';
import { render } from '@/services/rendering/MarkdownRenderer';

const CATEGORIES = [
  { value: 'info', label: 'Info', icon: 'bi-info-circle', variant: 'info' },
  { value: 'success', label: 'Success', icon: 'bi-check-circle', variant: 'success' },
  { value: 'warning', label: 'Warning', icon: 'bi-exclamation-triangle', variant: 'warning' },
  { value: 'error', label: 'Error', icon: 'bi-x-circle', variant: 'danger' },
];

export default function AdminNotificationsTab() {
  const { showSuccess, showError } = useNotification();

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState('info');
  const [detail, setDetail] = useState('');
  const [detailMode, setDetailMode] = useState('write'); // 'write' | 'preview'
  const [target, setTarget] = useState('all'); // 'all' | 'specific'
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [usersLoading, setUsersLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const data = await adminUsersApi.getAllUsers({ limit: 200, active_only: true });
      setUsers(data || []);
    } catch {
      setUsers([]);
    } finally {
      setUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const filteredUsers = useMemo(() => {
    if (!userSearch.trim()) return users;
    const q = userSearch.toLowerCase();
    return users.filter(u =>
      (u.full_name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q)
    );
  }, [users, userSearch]);

  const detailHtml = useMemo(() => {
    if (detailMode !== 'preview' || !detail.trim()) return '';
    return render(detail);
  }, [detail, detailMode]);

  const toggleUser = (userId) => {
    setSelectedUserIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) return;
    if (target === 'specific' && selectedUserIds.length === 0) {
      showError('Select at least one user.');
      return;
    }

    setSending(true);
    try {
      const result = await adminNotificationsApi.sendNotification({
        title: title.trim(),
        message: message.trim(),
        category,
        detail: detail.trim() || null,
        userIds: target === 'specific' ? selectedUserIds : null,
      });
      showSuccess(`Notification sent to ${result.recipients} user(s).`);
      setTitle('');
      setMessage('');
      setDetail('');
      setDetailMode('write');
      setSelectedUserIds([]);
      setTarget('all');
      setCategory('info');
    } catch (error) {
      showError(`Failed to send: ${error.message}`);
    } finally {
      setSending(false);
    }
  };

  const canSend = title.trim() && message.trim() && (target === 'all' || selectedUserIds.length > 0);

  return (
    <div className="admin-notifications-tab">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h6 className="mb-0 fw-semibold">
          <i className="bi bi-megaphone me-2" />
          Send Notification
        </h6>
      </div>

      {/* Target */}
      <Form.Group className="mb-3">
        <Form.Label className="fw-medium small">Recipients</Form.Label>
        <div className="d-flex gap-3">
          <Form.Check
            type="radio"
            id="target-all"
            label="All active users"
            checked={target === 'all'}
            onChange={() => setTarget('all')}
          />
          <Form.Check
            type="radio"
            id="target-specific"
            label="Specific users"
            checked={target === 'specific'}
            onChange={() => setTarget('specific')}
          />
        </div>
      </Form.Group>

      {/* User Selector */}
      {target === 'specific' && (
        <div className="mb-3 admin-user-selector">
          {selectedUserIds.length > 0 && (
            <div className="d-flex flex-wrap gap-1 mb-2">
              {selectedUserIds.map(id => {
                const u = users.find(u => u.id === id);
                return (
                  <Badge
                    key={id}
                    bg="primary"
                    className="d-inline-flex align-items-center gap-1 user-badge"
                  >
                    {u?.full_name || u?.email || `User #${id}`}
                    <i
                      className="bi bi-x-lg"
                      role="button"
                      onClick={() => toggleUser(id)}
                    />
                  </Badge>
                );
              })}
            </div>
          )}
          <Form.Control
            type="text"
            size="sm"
            placeholder="Search users..."
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            className="mb-2"
          />
          <div className="user-list-scroll">
            {usersLoading ? (
              <div className="text-center py-2">
                <Spinner animation="border" size="sm" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-muted text-center py-2 small">No users found</div>
            ) : (
              filteredUsers.map(u => (
                <div
                  key={u.id}
                  className={`user-list-item d-flex align-items-center gap-2 ${selectedUserIds.includes(u.id) ? 'selected' : ''}`}
                  onClick={() => toggleUser(u.id)}
                >
                  <Form.Check
                    type="checkbox"
                    checked={selectedUserIds.includes(u.id)}
                    onChange={() => toggleUser(u.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="flex-grow-1" style={{ minWidth: 0 }}>
                    <div className="small fw-medium text-truncate">{u.full_name || 'Unnamed'}</div>
                    <div className="small text-muted text-truncate">{u.email}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Category */}
      <Form.Group className="mb-3">
        <Form.Label className="fw-medium small">Category</Form.Label>
        <div className="d-flex gap-2">
          {CATEGORIES.map(c => (
            <Button
              key={c.value}
              variant={category === c.value ? c.variant : `outline-${c.variant}`}
              size="sm"
              onClick={() => setCategory(c.value)}
            >
              <i className={`bi ${c.icon} me-1`} />
              {c.label}
            </Button>
          ))}
        </div>
      </Form.Group>

      {/* Title */}
      <Form.Group className="mb-3">
        <Form.Label className="fw-medium small">Title *</Form.Label>
        <Form.Control
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Notification title"
          maxLength={255}
        />
      </Form.Group>

      {/* Message (short summary) */}
      <Form.Group className="mb-3">
        <Form.Label className="fw-medium small">Message *</Form.Label>
        <Form.Control
          as="textarea"
          rows={2}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Brief summary shown in the notification dropdown"
          maxLength={500}
        />
        <Form.Text className="text-muted">Shown in the notification list. Keep it concise.</Form.Text>
      </Form.Group>

      {/* Detail (markdown) */}
      <Form.Group className="mb-3">
        <Form.Label className="fw-medium small">
          Detail
          <span className="text-muted fw-normal ms-1">(optional, Markdown)</span>
        </Form.Label>
        <div className="markdown-editor">
          <div className="markdown-editor-tabs">
            <button
              type="button"
              className={`markdown-editor-tab ${detailMode === 'write' ? 'active' : ''}`}
              onClick={() => setDetailMode('write')}
            >
              <i className="bi bi-pencil me-1" />
              Write
            </button>
            <button
              type="button"
              className={`markdown-editor-tab ${detailMode === 'preview' ? 'active' : ''}`}
              onClick={() => setDetailMode('preview')}
            >
              <i className="bi bi-eye me-1" />
              Preview
            </button>
          </div>
          <div className="markdown-editor-body">
            {detailMode === 'write' ? (
              <Form.Control
                as="textarea"
                rows={8}
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                placeholder="Expanded detail shown when the user clicks the notification. Supports Markdown."
                className="markdown-editor-textarea"
              />
            ) : (
              <div className="markdown-editor-preview notification-detail-content">
                {detail.trim() ? (
                  <div dangerouslySetInnerHTML={{ __html: detailHtml }} />
                ) : (
                  <div className="text-muted">Nothing to preview</div>
                )}
              </div>
            )}
          </div>
        </div>
      </Form.Group>

      {/* Send */}
      <div className="d-flex align-items-center gap-3">
        <Button
          variant="primary"
          onClick={handleSend}
          disabled={!canSend || sending}
        >
          {sending ? (
            <>
              <Spinner animation="border" size="sm" className="me-2" />
              Sending...
            </>
          ) : (
            <>
              <i className="bi bi-send me-2" />
              {target === 'all' ? 'Broadcast to All Users' : `Send to ${selectedUserIds.length} User(s)`}
            </>
          )}
        </Button>
        {target === 'all' && (
          <Alert variant="info" className="mb-0 py-1 px-2 small d-inline-flex align-items-center">
            <i className="bi bi-info-circle me-1" />
            This will notify all active users.
          </Alert>
        )}
      </div>
    </div>
  );
}

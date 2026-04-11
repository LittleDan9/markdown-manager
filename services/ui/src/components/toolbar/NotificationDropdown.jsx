import React, { useState, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Offcanvas, Badge, Button, ButtonGroup, Form } from 'react-bootstrap';
import { formatDistanceToNow } from 'date-fns';

const SEVERITY_ORDER = ['error', 'warning', 'info', 'success'];

const SEVERITY_CONFIG = {
  error: { icon: 'bi-x-circle', label: 'Errors', dotClass: 'notification-severity-dot--error' },
  warning: { icon: 'bi-exclamation-triangle', label: 'Warnings', dotClass: 'notification-severity-dot--warning' },
  info: { icon: 'bi-info-circle', label: 'Info', dotClass: 'notification-severity-dot--info' },
  success: { icon: 'bi-check-circle', label: 'Success', dotClass: 'notification-severity-dot--success' },
};

const VIEW_KEY = 'notification-drawer-view';

function getHighestSeverity(notifications) {
  for (const severity of SEVERITY_ORDER) {
    if (notifications.some(n => !n.is_read && n.category === severity)) return severity;
  }
  return null;
}

function getBadgeBg(severity) {
  switch (severity) {
    case 'error': return 'danger';
    case 'warning': return 'warning';
    default: return 'primary';
  }
}

/**
 * NotificationDropdown — Slide-out notification drawer (Offcanvas).
 */
function NotificationDropdown({
  notifications,
  unreadCount,
  onMarkRead,
  onMarkAllRead,
  onDelete,
  onClearAll,
  onViewDetail,
}) {
  const [show, setShow] = useState(false);
  const [viewMode, setViewMode] = useState(() => {
    try { return localStorage.getItem(VIEW_KEY) || 'timeline'; } catch { return 'timeline'; }
  });
  const [unreadOnly, setUnreadOnly] = useState(false);

  const handleViewChange = useCallback((mode) => {
    setViewMode(mode);
    try { localStorage.setItem(VIEW_KEY, mode); } catch { /* silent */ }
  }, []);

  const highestSeverity = useMemo(() => getHighestSeverity(notifications), [notifications]);
  const badgeBg = useMemo(() => getBadgeBg(highestSeverity), [highestSeverity]);

  const filtered = useMemo(() => {
    if (unreadOnly) return notifications.filter(n => !n.is_read);
    return notifications;
  }, [notifications, unreadOnly]);

  const grouped = useMemo(() => {
    if (viewMode !== 'severity') return null;
    const groups = {};
    for (const sev of SEVERITY_ORDER) groups[sev] = [];
    for (const n of filtered) {
      const cat = SEVERITY_ORDER.includes(n.category) ? n.category : 'info';
      groups[cat].push(n);
    }
    return groups;
  }, [filtered, viewMode]);

  return (
    <>
      <Button
        variant="outline-secondary"
        size="sm"
        title="Notifications"
        className="position-relative"
        onClick={() => setShow(true)}
      >
        <i className="bi bi-bell" />
        {unreadCount > 0 && (
          <Badge
            bg={badgeBg}
            pill
            className="position-absolute top-0 start-100 translate-middle"
            style={{ fontSize: '0.6em' }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
      </Button>

      <Offcanvas
        show={show}
        onHide={() => setShow(false)}
        placement="start"
        scroll
        backdrop={false}
        className="notification-drawer"
      >
        <Offcanvas.Header closeButton className="notification-drawer-header">
          <Offcanvas.Title className="notification-drawer-title">
            <i className="bi bi-bell me-2" />
            Notifications
            {unreadCount > 0 && (
              <Badge bg={badgeBg} pill className="ms-2" style={{ fontSize: '0.7em' }}>
                {unreadCount}
              </Badge>
            )}
          </Offcanvas.Title>
        </Offcanvas.Header>

        <div className="notification-drawer-controls px-3 py-2">
          <div className="d-flex justify-content-between align-items-center">
            <ButtonGroup size="sm">
              <Button
                variant={viewMode === 'timeline' ? 'primary' : 'outline-secondary'}
                onClick={() => handleViewChange('timeline')}
              >
                <i className="bi bi-clock me-1" />Timeline
              </Button>
              <Button
                variant={viewMode === 'severity' ? 'primary' : 'outline-secondary'}
                onClick={() => handleViewChange('severity')}
              >
                <i className="bi bi-funnel me-1" />By Severity
              </Button>
            </ButtonGroup>
            <Form.Check
              type="switch"
              id="unread-filter"
              label="Unread"
              checked={unreadOnly}
              onChange={(e) => setUnreadOnly(e.target.checked)}
              className="notification-unread-toggle"
            />
          </div>
          <div className="d-flex gap-2 mt-2">
            {unreadCount > 0 && (
              <button
                className="btn btn-link btn-sm p-0 text-decoration-none notification-action-btn"
                onClick={onMarkAllRead}
              >
                Mark all read
              </button>
            )}
            {notifications.length > 0 && (
              <button
                className="btn btn-link btn-sm p-0 text-decoration-none notification-action-btn notification-action-btn--danger"
                onClick={onClearAll}
              >
                Clear all
              </button>
            )}
          </div>
        </div>

        <Offcanvas.Body className="notification-drawer-body p-0">
          {filtered.length === 0 ? (
            <div className="text-center notification-empty py-5">
              <i className="bi bi-bell-slash d-block mb-2" style={{ fontSize: '2em' }} />
              {unreadOnly ? 'No unread notifications' : 'No notifications'}
            </div>
          ) : viewMode === 'severity' && grouped ? (
            SEVERITY_ORDER.map((sev) => {
              const items = grouped[sev];
              if (items.length === 0) return null;
              const config = SEVERITY_CONFIG[sev];
              return (
                <div key={sev} className="notification-group">
                  <div className={`notification-group-divider notification-group-divider--${sev}`} />
                  <div className="notification-group-heading px-3 py-2">
                    <i className={`bi ${config.icon} me-1`} />
                    <span>{config.label}</span>
                    <Badge bg="secondary" pill className="ms-2" style={{ fontSize: '0.7em' }}>
                      {items.length}
                    </Badge>
                  </div>
                  {items.map((n) => (
                    <NotificationItem
                      key={n.id}
                      notification={n}
                      onMarkRead={onMarkRead}
                      onDelete={onDelete}
                      onViewDetail={onViewDetail}
                    />
                  ))}
                </div>
              );
            })
          ) : (
            filtered.slice(0, 50).map((n) => (
              <NotificationItem
                key={n.id}
                notification={n}
                onMarkRead={onMarkRead}
                onDelete={onDelete}
                onViewDetail={onViewDetail}
              />
            ))
          )}
        </Offcanvas.Body>
      </Offcanvas>
    </>
  );
}

function NotificationItem({ notification, onMarkRead, onDelete, onViewDetail }) {
  const config = SEVERITY_CONFIG[notification.category] || SEVERITY_CONFIG.info;
  const timeAgo = formatDistanceToNow(new Date(notification.created_at), { addSuffix: true });

  const handleClick = () => {
    if (notification.has_detail && onViewDetail) {
      onViewDetail(notification);
    } else if (!notification.is_read) {
      onMarkRead(notification.id);
    }
  };

  return (
    <div
      className={`d-flex align-items-start gap-2 px-3 py-2 notification-item ${!notification.is_read ? 'notification-item--unread' : ''} ${notification.has_detail ? 'notification-item--expandable' : ''}`}
      onClick={handleClick}
    >
      <span className={`notification-severity-dot ${config.dotClass} mt-1 flex-shrink-0`} />
      <div className="flex-grow-1" style={{ minWidth: 0 }}>
        <div className="d-flex justify-content-between align-items-start">
          <strong className={`small notification-title ${!notification.is_read ? '' : 'fw-normal'}`}>
            {notification.title}
          </strong>
          <button
            className="btn btn-link btn-sm p-0 notification-dismiss flex-shrink-0 ms-1"
            onClick={(e) => { e.stopPropagation(); onDelete(notification.id); }}
            title="Dismiss"
          >
            <i className="bi bi-x" />
          </button>
        </div>
        <div className="small notification-message">{notification.message}</div>
        <div className="d-flex justify-content-between align-items-center">
          <div className="small notification-time">{timeAgo}</div>
          {notification.has_detail && (
            <span className="small notification-detail-hint">
              <i className="bi bi-arrow-up-right-square me-1" />
              Details
            </span>
          )}
        </div>
      </div>
      {!notification.is_read && (
        <span className="badge rounded-pill bg-primary" style={{ width: 8, height: 8, padding: 0, marginTop: 6 }}>&nbsp;</span>
      )}
    </div>
  );
}

NotificationDropdown.propTypes = {
  notifications: PropTypes.array.isRequired,
  unreadCount: PropTypes.number.isRequired,
  onMarkRead: PropTypes.func.isRequired,
  onMarkAllRead: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  onClearAll: PropTypes.func.isRequired,
  onViewDetail: PropTypes.func,
};

NotificationItem.propTypes = {
  notification: PropTypes.object.isRequired,
  onMarkRead: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  onViewDetail: PropTypes.func,
};

export default NotificationDropdown;

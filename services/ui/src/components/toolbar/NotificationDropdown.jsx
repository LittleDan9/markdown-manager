import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Dropdown, Badge } from 'react-bootstrap';
import { formatDistanceToNow } from 'date-fns';

/**
 * NotificationDropdown — Toolbar dropdown showing recent notifications.
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

  const handleToggle = (isOpen) => {
    setShow(isOpen);
  };

  return (
    <Dropdown show={show} onToggle={handleToggle} align="end">
      <Dropdown.Toggle
        variant="outline-secondary"
        size="sm"
        id="notification-dropdown"
        title="Notifications"
        className="position-relative"
      >
        <i className="bi bi-bell" />
        {unreadCount > 0 && (
          <Badge
            bg="danger"
            pill
            className="position-absolute top-0 start-100 translate-middle"
            style={{ fontSize: '0.6em' }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
      </Dropdown.Toggle>

      <Dropdown.Menu className="notification-dropdown-menu">
        <div className="d-flex justify-content-between align-items-center px-3 py-2 notification-header">
          <strong>Notifications</strong>
          <div className="d-flex gap-2">
            {unreadCount > 0 && (
              <button
                className="btn btn-link btn-sm p-0 text-decoration-none notification-action-btn"
                onClick={(e) => { e.stopPropagation(); onMarkAllRead(); }}
              >
                Mark all read
              </button>
            )}
            {notifications.length > 0 && (
              <button
                className="btn btn-link btn-sm p-0 text-decoration-none notification-action-btn notification-action-btn--danger"
                onClick={(e) => { e.stopPropagation(); onClearAll(); }}
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {notifications.length === 0 ? (
          <div className="text-center notification-empty py-4">
            <i className="bi bi-bell-slash d-block mb-2" style={{ fontSize: '1.5em' }} />
            No notifications
          </div>
        ) : (
          notifications.slice(0, 20).map((n) => (
            <NotificationItem
              key={n.id}
              notification={n}
              onMarkRead={onMarkRead}
              onDelete={onDelete}
              onViewDetail={onViewDetail}
            />
          ))
        )}
      </Dropdown.Menu>
    </Dropdown>
  );
}

function NotificationItem({ notification, onMarkRead, onDelete, onViewDetail }) {
  const categoryIcons = {
    info: 'bi-info-circle text-info',
    success: 'bi-check-circle text-success',
    warning: 'bi-exclamation-triangle text-warning',
    error: 'bi-x-circle text-danger',
  };

  const icon = categoryIcons[notification.category] || categoryIcons.info;
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
      <i className={`bi ${icon} mt-1`} />
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

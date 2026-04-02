import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { Modal, Spinner } from 'react-bootstrap';
import { formatDistanceToNow } from 'date-fns';
import { render } from '@/services/rendering/MarkdownRenderer';

const categoryConfig = {
  info: { icon: 'bi-info-circle', variant: 'text-info', label: 'Info' },
  success: { icon: 'bi-check-circle', variant: 'text-success', label: 'Success' },
  warning: { icon: 'bi-exclamation-triangle', variant: 'text-warning', label: 'Warning' },
  error: { icon: 'bi-x-circle', variant: 'text-danger', label: 'Error' },
};

function NotificationDetailModal({ show, onHide, notification, loading }) {
  const config = categoryConfig[notification?.category] || categoryConfig.info;

  const detailHtml = useMemo(() => {
    if (!notification?.detail) return '';
    return render(notification.detail);
  }, [notification?.detail]);

  const timeAgo = notification?.created_at
    ? formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })
    : '';

  return (
    <Modal show={show} onHide={onHide} centered size="lg" className="notification-detail-modal">
      <Modal.Header closeButton>
        <Modal.Title className="d-flex align-items-center gap-2">
          <i className={`bi ${config.icon} ${config.variant}`} />
          <span>{notification?.title || 'Notification'}</span>
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {loading ? (
          <div className="text-center py-4">
            <Spinner animation="border" size="sm" className="me-2" />
            Loading details...
          </div>
        ) : (
          <>
            <div className="notification-detail-meta mb-3">
              <span className={`badge bg-${config.variant.replace('text-', '')} me-2`}>
                {config.label}
              </span>
              <small className="text-muted">{timeAgo}</small>
            </div>
            {notification?.message && (
              <p className="notification-detail-message">{notification.message}</p>
            )}
            {detailHtml && (
              <div
                className="notification-detail-content"
                dangerouslySetInnerHTML={{ __html: detailHtml }}
              />
            )}
          </>
        )}
      </Modal.Body>
    </Modal>
  );
}

NotificationDetailModal.propTypes = {
  show: PropTypes.bool.isRequired,
  onHide: PropTypes.func.isRequired,
  notification: PropTypes.object,
  loading: PropTypes.bool,
};

export default NotificationDetailModal;

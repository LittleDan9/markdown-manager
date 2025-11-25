import React from 'react';
import ConfirmModal from './modals/ConfirmModal';
import PropTypes from 'prop-types';

/**
 * ConfirmationDialog - Standardized confirmation dialog component
 * Provides consistent confirmation UX across the application
 */
function ConfirmationDialog({
  show,
  onHide,
  onConfirm,
  title = 'Confirm Action',
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmVariant = 'primary',
  cancelVariant = 'secondary',
  icon,
  loading = false,
  children,
  ...props
}) {
  const buttons = [
    {
      text: cancelText,
      variant: cancelVariant,
      action: 'cancel',
      disabled: loading
    },
    {
      text: confirmText,
      variant: confirmVariant,
      action: 'confirm',
      disabled: loading,
      autoFocus: true
    }
  ];

  const handleAction = (action) => {
    if (action === 'confirm' && onConfirm) {
      onConfirm();
    } else if (action === 'cancel' && onHide) {
      onHide();
    }
  };

  return (
    <ConfirmModal
      show={show}
      onHide={onHide}
      onAction={handleAction}
      title={title}
      message={message}
      buttons={buttons}
      icon={icon}
      {...props}
    >
      {children}
    </ConfirmModal>
  );
}

ConfirmationDialog.propTypes = {
  show: PropTypes.bool.isRequired,
  onHide: PropTypes.func,
  onConfirm: PropTypes.func,
  title: PropTypes.string,
  message: PropTypes.string,
  confirmText: PropTypes.string,
  cancelText: PropTypes.string,
  confirmVariant: PropTypes.string,
  cancelVariant: PropTypes.string,
  icon: PropTypes.element,
  loading: PropTypes.bool,
  children: PropTypes.node
};

export default ConfirmationDialog;
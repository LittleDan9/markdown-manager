import React from "react";
import { Modal, Button } from "react-bootstrap";

function ConfirmModal({
  show,
  onCancel,
  onConfirm,
  title = "Confirm Action",
  message = "",
  confirmText = "Confirm",
  confirmVariant = "danger",
  cancelText = "Cancel",
  cancelVariant = "secondary",
  icon = <i className="bi bi-exclamation-triangle-fill text-warning me-2"></i>,
}) {
  return (
    <Modal show={show} onHide={onCancel} centered>
      <Modal.Header closeButton>
        <Modal.Title>
          {icon}&nbsp;
          {title}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="mb-0">{message}</p>
      </Modal.Body>
      <Modal.Footer>
        <Button variant={cancelVariant} onClick={onCancel}>
          {cancelText}
        </Button>
        <Button variant={confirmVariant} onClick={onConfirm}>
          {confirmText}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export default ConfirmModal;

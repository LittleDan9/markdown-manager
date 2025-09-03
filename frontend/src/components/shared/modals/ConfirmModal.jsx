import React from "react";
import { Modal, Button } from "react-bootstrap";

function ConfirmModal({
  show,
  onHide,
  onAction,
  title = "Confirm Action",
  message = "",
  buttons,
  icon = <i className="bi bi-exclamation-triangle-fill text-warning me-2"></i>,
  footer,
  children,
}) {
  // Prefer onHide for all close actions
  const handleClose = () => {
    if (onHide) onHide();
    else if (onAction) onAction("cancel");
  };
  return (
    <Modal
      show={show}
      onHide={handleClose}
      centered
      backdrop={true}
      keyboard={true}
    >
      <Modal.Header closeButton onHide={handleClose}>
        <Modal.Title>
          {icon}&nbsp;
          {title}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {children ? children : <div className="mb-0">{message}</div>}
      </Modal.Body>
      <Modal.Footer>
        {footer
          ? footer
          : buttons && buttons.map((btn, idx) => (
              <Button
                key={btn.action || idx}
                variant={btn.variant || "secondary"}
                onClick={() => onAction && onAction(btn.action)}
                autoFocus={btn.autoFocus}
                disabled={btn.disabled}
              >
                {btn.icon && typeof btn.icon === "string" && <i className={`${btn.icon} me-1`}></i>}
                {btn.text}
              </Button>
            ))}
      </Modal.Footer>
    </Modal>
  );
}

export default ConfirmModal;

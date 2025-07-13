import React from "react";
import { Modal, Button, Form, Alert } from "react-bootstrap";

function PasswordResetVerifyModal({
  show,
  onHide,
  password,
  confirmPassword,
  onPasswordChange,
  onConfirmPasswordChange,
  loading,
  error,
  success,
  onSubmit
}) {
  return (
    <Modal show={show} onHide={onHide} centered>
      <Form onSubmit={onSubmit} autoComplete="off">
        <Modal.Header closeButton>
          <Modal.Title id="passwordResetConfirmModalLabel">
            <i className="bi bi-key me-2"></i>Set New Password
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="text-muted mb-3">Enter your new password below.</p>
          <Form.Group className="mb-3" controlId="newPasswordReset">
            <Form.Label>New Password</Form.Label>
            <Form.Control
              type="password"
              value={password}
              onChange={onPasswordChange}
              required
              minLength={6}
              autoFocus
            />
          </Form.Group>
          <Form.Group className="mb-3" controlId="confirmPasswordReset">
            <Form.Label>Confirm New Password</Form.Label>
            <Form.Control
              type="password"
              value={confirmPassword}
              onChange={onConfirmPasswordChange}
              required
            />
          </Form.Group>
          {error && (
            <Alert variant="danger" className="py-2">
              {error}
            </Alert>
          )}
          {success && (
            <Alert variant="success" className="py-2">
              {success}
            </Alert>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={loading || !password || !confirmPassword}>
            {loading ? "Updating..." : "Update Password"}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

export default PasswordResetVerifyModal;

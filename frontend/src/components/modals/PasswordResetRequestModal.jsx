
import React, { useState } from "react";
import { Modal, Button, Form, Alert } from "react-bootstrap";

function PasswordResetRequestModal({
  show,
  onHide,
  email,
  onEmailChange,
  loading,
  error,
  success,
  onSubmit
}) {
  return (
    <Modal show={show} onHide={onHide} centered>
      <Form onSubmit={onSubmit} autoComplete="off">
        <Modal.Header closeButton>
          <Modal.Title id="passwordResetModalLabel">
            <i className="bi bi-key me-2"></i>Reset Password
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="text-muted mb-3">
            Enter your email address and we'll send you a link to reset your password.
          </p>
          <Form.Group className="mb-3" controlId="resetEmail">
            <Form.Label>Email</Form.Label>
            <Form.Control
              type="email"
              value={email}
              onChange={onEmailChange}
              required
              autoFocus
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
          <Button type="submit" variant="primary" disabled={loading || !email}>
            {loading ? "Sending..." : "Send Reset Link"}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

export default PasswordResetRequestModal;


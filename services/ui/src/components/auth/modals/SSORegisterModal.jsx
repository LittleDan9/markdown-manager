import React, { useState, useRef } from "react";
import { Modal, Button, Form, Row, Col, Alert, Badge } from "react-bootstrap";

/**
 * SSO Registration Modal — shown when a cross-app SSO token exists
 * but no local account matches the email. Email is pre-filled and read-only;
 * user provides name + password to create a linked account.
 */
function SSORegisterModal({ show, onHide, onRegister, email, issuer, error }) {
  const firstNameRef = useRef(null);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    display_name: "",
    password: "",
    confirm_password: "",
  });
  const [passwordMatchError, setPasswordMatchError] = useState("");

  const handleChange = (e) => {
    const { id, value } = e.target;
    setForm({ ...form, [id]: value });

    if (id === "password" || id === "confirm_password") {
      if (
        (id === "password" && value !== form.confirm_password) ||
        (id === "confirm_password" && value !== form.password)
      ) {
        setPasswordMatchError("Passwords do not match.");
      } else {
        setPasswordMatchError("");
      }
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.first_name || !form.last_name) {
      return;
    }
    if (!form.password || form.password.length < 6) {
      setPasswordMatchError("Password must be at least 6 characters.");
      return;
    }
    if (form.password !== form.confirm_password) {
      setPasswordMatchError("Passwords do not match.");
      return;
    }
    if (onRegister) {
      onRegister({
        ...form,
        email,
        confirm_email: email,
      });
    }
  };

  const issuerLabel = issuer === "team-manager" ? "Team Manager" : issuer || "another app";

  return (
    <Modal show={show} onHide={onHide} centered onEntered={() => firstNameRef.current?.focus()}>
      <Modal.Header closeButton>
        <Modal.Title>
          <i className="bi bi-link-45deg me-2"></i>Link Your Account
        </Modal.Title>
      </Modal.Header>
      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          <Alert variant="info" className="d-flex align-items-center gap-2">
            <i className="bi bi-info-circle"></i>
            <span>
              You're signed in on <strong>{issuerLabel}</strong> as{" "}
              <Badge bg="primary">{email}</Badge>.
              Create an account here to link them.
            </span>
          </Alert>

          <Form.Group className="mb-3" controlId="sso_email">
            <Form.Label>Email</Form.Label>
            <Form.Control type="email" value={email} readOnly disabled />
          </Form.Group>

          <Row className="mb-3">
            <Col md={6}>
              <Form.Group controlId="first_name">
                <Form.Label>First Name</Form.Label>
                <Form.Control
                  type="text"
                  value={form.first_name}
                  onChange={handleChange}
                  required
                  ref={firstNameRef}
                />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group controlId="last_name">
                <Form.Label>Last Name</Form.Label>
                <Form.Control
                  type="text"
                  value={form.last_name}
                  onChange={handleChange}
                  required
                />
              </Form.Group>
            </Col>
          </Row>

          <Form.Group className="mb-3" controlId="display_name">
            <Form.Label>Display Name (Optional)</Form.Label>
            <Form.Control
              type="text"
              value={form.display_name}
              onChange={handleChange}
              placeholder="How you'd like to be shown in the app"
            />
          </Form.Group>

          <Form.Group className="mb-3" controlId="password">
            <Form.Label>Password</Form.Label>
            <Form.Control
              type="password"
              value={form.password}
              onChange={handleChange}
              required
              minLength={6}
            />
            <Form.Text>Password must be at least 6 characters long.</Form.Text>
          </Form.Group>

          <Form.Group className="mb-3" controlId="confirm_password">
            <Form.Label>Confirm Password</Form.Label>
            <Form.Control
              type="password"
              value={form.confirm_password}
              onChange={handleChange}
              required
              minLength={6}
            />
          </Form.Group>

          {passwordMatchError && <Alert variant="danger">{passwordMatchError}</Alert>}
          {error && <Alert variant="danger">{error}</Alert>}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>
            Skip
          </Button>
          <Button type="submit" variant="primary">
            <i className="bi bi-link-45deg me-1"></i>Create & Link Account
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

export default SSORegisterModal;

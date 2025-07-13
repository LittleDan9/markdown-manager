import React, { useState } from "react";
import { Modal, Button, Form, Row, Col, Alert } from "react-bootstrap";

function RegisterModal({ show, onHide, onRegister, error }) {
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    display_name: "",
    email: "",
    confirm_email: "",
    password: "",
    bio: ""
  });
  const [emailMatchError, setEmailMatchError] = useState("");

  const handleChange = (e) => {
    const { id, value } = e.target;
    setForm({ ...form, [e.target.id]: e.target.value });

    if (id === "email" || id === "confirm_email") {
      if (
        (id === "email" && value !== form.confirm_email) ||
        (id === "confirm_email" && value !== form.email)
      ) {
        setEmailMatchError("Email addresses do not match.");
      } else {
        setEmailMatchError("");
      }
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (form.email !== form.confirm_email) {
      setEmailMatchError("Email addresses do not match.");
      return;
    } ``
    if (onRegister) onRegister(form);
  };

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title id="registerModalLabel">
          <i className="bi bi-person-plus me-2"></i>Create Account
        </Modal.Title>
      </Modal.Header>
      <Form id="registerForm" onSubmit={handleSubmit}>
        <Modal.Body>
          <Row className="mb-3">
            <Col md={6}>
              <Form.Group controlId="first_name">
                <Form.Label>First Name</Form.Label>
                <Form.Control type="text" value={form.first_name} onChange={handleChange} />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group controlId="last_name">
                <Form.Label>Last Name</Form.Label>
                <Form.Control type="text" value={form.last_name} onChange={handleChange} />
              </Form.Group>
            </Col>
          </Row>
          <Form.Group className="mb-3" controlId="display_name">
            <Form.Label>Display Name (Optional)</Form.Label>
            <Form.Control type="text" value={form.display_name} onChange={handleChange} placeholder="How you'd like to be shown in the app" />
          </Form.Group>
          <Form.Group className="mb-3" controlId="email">
            <Form.Label>Email</Form.Label>
            <Form.Control type="email" value={form.email} onChange={handleChange} required />
          </Form.Group>
          <Form.Group className="mb-3" controlId="confirm_email">
            <Form.Label>Confirm Email</Form.Label>
            <Form.Control
              type="email"
              value={form.confirm_email}
              onChange={handleChange}
              required
            />
          </Form.Group>
          <Form.Group className="mb-3" controlId="password">
            <Form.Label>Password</Form.Label>
            <Form.Control type="password" value={form.password} onChange={handleChange} required minLength={6} />
            <Form.Text>Password must be at least 6 characters long.</Form.Text>
          </Form.Group>
          <Form.Group className="mb-3" controlId="bio">
            <Form.Label>Bio (Optional)</Form.Label>
            <Form.Control as="textarea" rows={2} value={form.bio} onChange={handleChange} placeholder="Tell us a bit about yourself..." />
          </Form.Group>
          {error && <Alert variant="danger">{error}</Alert>}
          {emailMatchError && <Alert variant="danger">{emailMatchError}</Alert>}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>Cancel</Button>
          <Button type="submit" variant="primary">Create Account</Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

export default RegisterModal;

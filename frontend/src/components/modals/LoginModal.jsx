import React, { useState } from "react";
import { Modal, Button, Form, Alert } from "react-bootstrap";

function LoginModal({ show, onHide, onLogin, onForgotPassword }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      // TODO: Replace with actual login logic
      if (!email || !password) {
        setError("Email and password are required.");
      } else {
        await (onLogin ? onLogin({ email, password }) : Promise.resolve());
        setEmail("");
        setPassword("");
        onHide();
      }
    } catch (err) {
      setError(err.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = (e) => {
    e.preventDefault();
    console.log("p-"+ email);
    if (onForgotPassword) onForgotPassword(email);
    onHide();
  };

  const handleClose = () => {
    setError("");
    setEmail("");
    setPassword("");
    onHide();
  };

  return (
    <Modal show={show} onHide={handleClose} centered>
      <Modal.Header closeButton>
        <Modal.Title id="loginModalLabel">
          <i className="bi bi-box-arrow-in-right me-2"></i>Login
        </Modal.Title>
      </Modal.Header>
      <Form onSubmit={handleSubmit} autoComplete="on">
        <Modal.Body>
          <Form.Group className="mb-3" controlId="loginEmail">
            <Form.Label>Email</Form.Label>
            <Form.Control
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </Form.Group>
          <Form.Group className="mb-3" controlId="loginPassword">
            <Form.Label>Password</Form.Label>
            <Form.Control
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Form.Group>
          <div className="mb-3 text-end">
            <a
              href="#"
              id="forgotPasswordLink"
              className="text-decoration-none"
              onClick={handleForgot}
            >
              <i className="bi bi-key me-1"></i>Forgot Password?
            </a>
          </div>
          {error && (
            <Alert variant="danger" id="loginError">
              {error}
            </Alert>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

export default LoginModal;

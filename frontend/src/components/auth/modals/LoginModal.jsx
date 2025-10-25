import React, { useState, useEffect } from "react";
import { Modal, Button, Form, Alert, InputGroup } from "react-bootstrap";

function LoginModal({ show, onHide, onLogin, onForgotPassword, email: emailProp }) {
  const [email, setEmail] = useState(emailProp || "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // Update email field if emailProp changes while modal is open
  useEffect(() => {
    if (show) {
      setEmail(emailProp || "");
    }
  }, [emailProp, show]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      // TODO: Replace with actual login logic
      if (!email || !password) {
        setError("Email and password are required.");
      } else {
        await (onLogin ? onLogin(email, password) : Promise.resolve());
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
            <InputGroup>
              <InputGroup.Text>
                <i className="bi bi-envelope"></i>
              </InputGroup.Text>
              <Form.Control
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </InputGroup>
          </Form.Group>
          <Form.Group className="mb-3" controlId="loginPassword">
            <Form.Label>Password</Form.Label>
            <InputGroup>
              <InputGroup.Text>
                <i className="bi bi-key"></i>
              </InputGroup.Text>
              <Form.Control
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <Button
                variant="outline-secondary"
                onClick={() => setShowPassword(!showPassword)}
                type="button"
              >
                <i className={`bi bi-eye${showPassword ? '-slash' : ''}`}></i>
              </Button>
            </InputGroup>
          </Form.Group>
          <div className="mb-3 text-end">
            <a
              href="#"
              id="forgotPasswordLink"
              className="text-decoration-none"
              onClick={handleForgot}
            >
              <i className="bi bi-question-circle me-1"></i>Forgot Password?
            </a>
          </div>
          {error && (
            <Alert variant="danger" id="loginError">
              <i className="bi bi-exclamation-triangle me-2"></i>
              {error}
            </Alert>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleClose} disabled={loading}>
            <i className="bi bi-x-lg me-2"></i>Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={loading}>
            {loading ? (
              <>
                <i className="bi bi-arrow-clockwise me-2 spin"></i>
                Logging in...
              </>
            ) : (
              <>
                <i className="bi bi-box-arrow-in-right me-2"></i>Login
              </>
            )}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

export default LoginModal;

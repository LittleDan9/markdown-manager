import React, { useState, useEffect } from "react";
import { Modal, Button, Form, Alert } from "react-bootstrap";

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
      setError(""); // Clear any previous errors when modal opens
    }
  }, [emailProp, show]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (!email || !password) {
        setError("Email and password are required.");
        return;
      }

      if (onLogin) {
        const result = await onLogin(email, password);

        if (result?.success || result?.mfaRequired) {
          // Login successful or MFA required - modal will be closed by AuthProvider
          setEmail("");
          setPassword("");
          onHide();
        } else if (result?.error) {
          // Login failed - show error and keep modal open
          setError(result.error);
        } else if (result === undefined) {
          // Legacy case - assume success and close modal
          setEmail("");
          setPassword("");
          onHide();
        } else {
          // Unknown error case
          setError("Login failed. Please try again.");
        }
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
            <div className="input-group">
              <span className="input-group-text">
                <i className="bi bi-envelope"></i>
              </span>
              <Form.Control
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                autoFocus
              />
            </div>
          </Form.Group>
          <Form.Group className="mb-3" controlId="loginPassword">
            <Form.Label>Password</Form.Label>
            <div className="input-group">
              <span className="input-group-text">
                <i className="bi bi-key"></i>
              </span>
              <Form.Control
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
              />
              <button
                className="btn btn-outline-secondary"
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? "Hide password" : "Show password"}
              >
                <i className={`bi bi-eye${showPassword ? '-slash' : ''}`}></i>
              </button>
            </div>
          </Form.Group>
          <div className="mb-3 text-end">
            <a
              href="#"
              id="forgotPasswordLink"
              className="text-decoration-none text-muted small"
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
        <Modal.Footer className="d-flex justify-content-between">
          <Button variant="outline-secondary" onClick={handleClose} disabled={loading}>
            <i className="bi bi-x-lg me-2"></i>Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={loading} className="px-4">
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

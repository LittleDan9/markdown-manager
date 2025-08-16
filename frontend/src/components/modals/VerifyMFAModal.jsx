import React, { useState } from "react";
import { Modal, Button, Form, Alert, Spinner } from "react-bootstrap";

function VerifyMFAModal({ show, onHide, onVerify, onBack, loading: propLoading, error: propError }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Allow parent to control loading/error, but fallback to local state
  const isLoading = propLoading !== undefined ? propLoading : loading;
  const displayError = propError !== undefined ? propError : error;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (!code.match(/^\d{6,8}$/)) {
        setError("Please enter a valid 6- or 8-digit code.");
        setLoading(false);
        return;
      }
      await (onVerify ? onVerify(code) : Promise.resolve());
    } catch (err) {
      setError(err.message || "Verification failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleInput = (e) => {
    // Only allow digits
    setCode(e.target.value.replace(/\D/g, ""));
  };

  const handleBack = (e) => {
    e.preventDefault();
    setCode("");
    setError("");
    if (onBack) onBack();
  };

  const handleClose = () => {
    setCode("");
    setError("");
    if (onHide) onHide();
  };

  return (
    <Modal show={show} onHide={handleClose} centered>
      <Modal.Header closeButton>
        <Modal.Title id="mfaVerificationModalLabel">
          <i className="bi bi-shield-check me-2"></i>Two-Factor Authentication
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="text-center mb-4">
          <i className="bi bi-smartphone" style={{ fontSize: "2rem", color: "#0d6efd" }}></i>
          <h6 className="mt-3">Enter Authentication Code</h6>
          <p className="text-muted">
            Enter the 6-digit code from your authenticator app or use a backup code.
          </p>
        </div>
        <Form id="mfaVerificationForm" onSubmit={handleSubmit} autoComplete="off">
          <Form.Group className="mb-3">
            <Form.Control
              type="text"
              className="form-control form-control-lg text-center"
              id="mfaLoginCode"
              placeholder="000000"
              maxLength={8}
              pattern="[0-9]{6,8}"
              required
              value={code}
              onChange={handleInput}
              autoFocus
              inputMode="numeric"
            />
            <Form.Text>
              Enter a 6-digit code from your authenticator app or an 8-digit backup code.
            </Form.Text>
          </Form.Group>
          {displayError && (
            <Alert variant="danger" id="mfaLoginError">
              {displayError}
            </Alert>
          )}
          <Button
            type="submit"
            className="w-100"
            variant="primary"
            id="mfaVerifyLoginBtn"
            disabled={isLoading}
          >
            {isLoading && <Spinner animation="border" size="sm" className="me-2" />}Verify and Sign In
          </Button>
        </Form>
        <div className="text-center mt-3">
          <Button
            variant="link"
            size="sm"
            id="mfaBackToLogin"
            onClick={handleBack}
            disabled={isLoading}
          >
            <i className="bi bi-arrow-left me-1"></i>Back to Login
          </Button>
        </div>
      </Modal.Body>
    </Modal>
  );
}

export default VerifyMFAModal;

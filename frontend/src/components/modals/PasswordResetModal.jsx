import React, { useState } from "react";
import { Modal, Accordion, Button, Form, Alert, ProgressBar, Spinner } from "react-bootstrap";

function PasswordResetModal({ show, onHide, onReset, devMode }) {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Reset all state on modal open/close
  React.useEffect(() => {
    if (show) {
      setStep(1);
      setEmail("");
      setCode("");
      setNewPassword("");
      setConfirmNewPassword("");
      setLoading(false);
      setError("");
      setSuccess("");
    }
  }, [show]);

  // Step 1: Request reset
  const handleRequest = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const result = await onReset.request(email);
      if (result.debug_token || devMode) {
        // If debug_token is present, set code to it for auto-fill
        if (result.debug_token) {
          setCode(result.debug_token);
        }
        setSuccess("Development Mode: Skipping code entry. Proceed to set new password.");
        setStep(3);
      } else {
        setSuccess(result.message || "Check your email for the reset code.");
        setStep(2);
      }
    } catch (err) {
      setError(err.message || "Failed to send reset email.");
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify code
  const handleVerify = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const result = await onReset.verify(email, code);
      if (result.success) {
        setSuccess("Code verified. Please set your new password.");
        setStep(3);
      } else {
        setError(result.message || "Invalid code.");
      }
    } catch (err) {
      setError(err.message || "Failed to verify code.");
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Set new password
  const handleSetPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    if (newPassword !== confirmNewPassword) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters long.");
      setLoading(false);
      return;
    }
    try {
      const result = await onReset.setPassword({ email, code, newPassword });
      if (result.success) {
        setSuccess("Password has been reset successfully! You can now login.");
        setTimeout(() => {
          onHide();
        }, 1500);
      } else {
        setError(result.message || "Failed to reset password.");
      }
    } catch (err) {
      setError(err.message || "Failed to reset password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title id="passwordResetModalLabel">
          <i className="bi bi-key me-2"></i>Reset Password
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <ProgressBar now={step * 33.3} label={`Step ${step} of 3`} className="mb-3" />
        <Accordion activeKey={`step${step}`} alwaysOpen>
          {/* Step 1: Email */}
          <Accordion.Item eventKey="step1">
            <Accordion.Header>Step 1: Enter Email</Accordion.Header>
            <Accordion.Body>
              <Form onSubmit={handleRequest} autoComplete="off">
                <Form.Group className="mb-3" controlId="resetEmail">
                  <Form.Label>Email</Form.Label>
                  <Form.Control
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </Form.Group>
                {error && <Alert variant="danger" className="py-2">{error}</Alert>}
                {success && <Alert variant="success" className="py-2">{success}</Alert>}
                <div className="d-flex justify-content-end">
                  <Button type="submit" variant="primary" disabled={loading || !email}>
                    {loading ? <Spinner animation="border" size="sm" className="me-2" /> : null}
                    Send Reset Link
                  </Button>
                </div>
              </Form>
            </Accordion.Body>
          </Accordion.Item>
          {/* Step 2: Code */}
          <Accordion.Item eventKey="step2">
            <Accordion.Header>Step 2: Enter Verification Code</Accordion.Header>
            <Accordion.Body>
              <Form onSubmit={handleVerify} autoComplete="off">
                <Form.Group className="mb-3" controlId="resetCode">
                  <Form.Label>Verification Code</Form.Label>
                  <Form.Control
                    type="text"
                    value={code}
                    onChange={e => setCode(e.target.value)}
                    required
                    autoFocus
                  />
                </Form.Group>
                {error && <Alert variant="danger" className="py-2">{error}</Alert>}
                {success && <Alert variant="success" className="py-2">{success}</Alert>}
                <div className="d-flex justify-content-between">
                  <Button variant="secondary" onClick={() => setStep(1)} disabled={loading}>Back</Button>
                  <Button type="submit" variant="primary" disabled={loading || !code}>
                    {loading ? <Spinner animation="border" size="sm" className="me-2" /> : null}
                    Verify Code
                  </Button>
                </div>
              </Form>
            </Accordion.Body>
          </Accordion.Item>
          {/* Step 3: New Password */}
          <Accordion.Item eventKey="step3">
            <Accordion.Header>Step 3: Set New Password</Accordion.Header>
            <Accordion.Body>
              <Form onSubmit={handleSetPassword} autoComplete="off">
                <Form.Group className="mb-3" controlId="newPasswordReset">
                  <Form.Label>New Password</Form.Label>
                  <Form.Control
                    type="password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                    autoFocus
                  />
                </Form.Group>
                <Form.Group className="mb-3" controlId="confirmPasswordReset">
                  <Form.Label>Confirm New Password</Form.Label>
                  <Form.Control
                    type="password"
                    value={confirmNewPassword}
                    onChange={e => setConfirmNewPassword(e.target.value)}
                    required
                  />
                </Form.Group>
                {error && <Alert variant="danger" className="py-2">{error}</Alert>}
                {success && <Alert variant="success" className="py-2">{success}</Alert>}
                <div className="d-flex justify-content-between">
                  <Button variant="secondary" onClick={() => setStep(devMode ? 1 : 2)} disabled={loading}>Back</Button>
                  <Button type="submit" variant="primary" disabled={loading || !newPassword || !confirmNewPassword}>
                    {loading ? <Spinner animation="border" size="sm" className="me-2" /> : null}
                    Update Password
                  </Button>
                </div>
              </Form>
            </Accordion.Body>
          </Accordion.Item>
        </Accordion>
      </Modal.Body>
    </Modal>
  );
}

export default PasswordResetModal;

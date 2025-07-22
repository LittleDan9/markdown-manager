import React, { useState } from "react";
import { Card, Button, Alert, Spinner, Collapse } from "react-bootstrap";
import userApi from "../../js/api/userApi";
import { useAuth } from "../../context/AuthProvider";
import { useNotification } from "../NotificationProvider";

function DisableMFASection({ setActiveTab }) {
  const { user, setUser } = useAuth();
  const [showDisable, setShowDisable] = useState(false);
  const [disableLoading, setDisableLoading] = useState(false);
  const [disableError, setDisableError] = useState("");
  const { showSuccess, showError } = useNotification();

  const handleDisableClick = () => {
    setShowDisable(true);
    setDisableError("");
  };

  const handleCancelDisable = () => {
    setShowDisable(false);
    setDisableError("");
  };

  const handleDisableSubmit = async (e) => {
    e.preventDefault();
    setDisableLoading(true);
    setDisableError("");
    const password = e.target.disableMFAPassword.value;
    const code = e.target.disableMFACode.value;
    try {
      await userApi.disableMFA(password, code);
      setShowDisable(false);
    } catch (err) {
      setDisableError(err.message || "Failed to disable MFA.");
    } finally {
      setDisableLoading(false);
      showSuccess("Two-factor authentication disabled successfully.");
      setUser({ ...user, mfa_enabled: false });
      if (setActiveTab) setActiveTab('security-settings');
    }
  };

  return (
    <Card className="mt-3">
      <Card.Header>
        <h6 className="mb-0">
          <i className="bi bi-shield-x me-2"></i>Disable MFA
        </h6>
      </Card.Header>
      <Card.Body>
        <p className="card-text">
          Disabling two-factor authentication will make your account less secure. Only disable MFA if you're having trouble accessing your account.
        </p>
        <Button variant="outline-danger" id="mfaDetailsDisableBtn" onClick={handleDisableClick}>
          <i className="bi bi-shield-x me-2"></i>Disable Two-Factor Authentication
        </Button>
        <Collapse in={showDisable}>
          <div className="mt-3">
            <Card border="danger">
              <Card.Header className="bg-danger text-white">
                <h6 className="mb-0">
                  <i className="bi bi-exclamation-triangle me-2"></i>Disable Two-Factor Authentication
                </h6>
              </Card.Header>
              <Card.Body>
                <Alert variant="warning" className="mb-3">
                  <i className="bi bi-exclamation-triangle me-2"></i> <strong>Warning:</strong> Disabling two-factor authentication will make your account less secure.
                </Alert>
                <form id="disableMFAFormSubmit" onSubmit={handleDisableSubmit} autoComplete="off">
                  <div className="mb-3">
                    <label htmlFor="disableMFAPassword" className="form-label">Current Password</label>
                    <input type="password" className="form-control" id="disableMFAPassword" name="disableMFAPassword" required disabled={disableLoading} />
                  </div>
                  <div className="mb-3">
                    <label htmlFor="disableMFACode" className="form-label">Authentication Code</label>
                    <input className="form-control" id="disableMFACode" name="disableMFACode" placeholder="Enter TOTP code or backup code" maxLength={8} required disabled={disableLoading} />
                    <div className="form-text">Enter a 6-digit code from your authenticator app or an 8-digit backup code.</div>
                  </div>
                  <Collapse in={!!disableError}>
                    <div>{disableError && <Alert variant="danger" id="disableMFAError">{disableError}</Alert>}</div>
                  </Collapse>
                  <div className="d-flex justify-content-end gap-2">
                    <Button type="submit" variant="danger" id="confirmDisableMFABtn" disabled={disableLoading}>
                      {disableLoading && <Spinner animation="border" size="sm" className="me-2" />} Disable MFA
                    </Button>
                    <Button type="button" variant="secondary" id="cancelDisableMFABtn" onClick={handleCancelDisable} disabled={disableLoading}>
                      Cancel
                    </Button>
                  </div>
                </form>
              </Card.Body>
            </Card>
          </div>
        </Collapse>
      </Card.Body>
    </Card>
  );
}

export default DisableMFASection;

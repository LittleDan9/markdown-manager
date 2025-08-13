import React, { useState } from "react";
import { Form, Card, Button, Alert } from "react-bootstrap";
import MFAModal from "./MFAModal";
import userApi from "../../api/userApi";
import { useAuth } from "../../context/AuthContext";
import { useNotification } from "../NotificationProvider";
import { set } from "lodash";

function SecurityTab({ form, handleChange, tabError, success, handlePasswordSubmit, setActiveTab }) {
  const { user , setUser, enableMFA} = useAuth();
  const [showMFAModal, setShowMFAModal] = useState(false);
  const [setupData, setSetupData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState(1);
  const [verifiedCode, setVerifiedCode] = useState("");
  const { showSuccess, showError } = useNotification();
  const [backupCodes, setBackupCodes] = useState([]);


  // Enable MFA handler
  const handleSetupMFA = async () => {
    setLoading(true);
    setError("");
    try {
      // Call backend to start setup and get QR/secret
      const data = await userApi.setupMFA();
      console.log(data);
      setSetupData(data);
      setShowMFAModal(true);

      setStep(1);
    } catch (err) {
      setError(err.message || "Failed to start MFA setup.");
    } finally {
      setLoading(false);
    }
  };

  // Modal step handlers
  // Step 2: TOTP verification
  const handleVerify = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const code = e.target.verifyCode.value;
      const res = await userApi.verifyMFASetup(code);
      console.log(res);
      if (res.success) {
        setVerifiedCode(code);
        setStep(3);
      } else {
        setError("Invalid code. Try again.");
      }
    } catch (err) {
      console.error(err)
      setError("Verification failed.");
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Password confirmation
  const handleEnable = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const password = e.target.enablePassword.value;
      // Use verifiedCode from previous step
      if (!verifiedCode) {
        setError("Please verify your TOTP code first.");
        return;
      }
      // Confirm MFA enable with password and verified TOTP code
      const response = await enableMFA(password, verifiedCode);
      if (response.success) {
        // Fetch backup codes for step 4
        setBackupCodes(response.backup_codes);
        setStep(4);
      } else {
        setError("Validation failed!");
      }
    } catch (err) {
      setError(err.message || "Failed to enable MFA.");
    } finally {
      setLoading(false);
    }
  };

  // Step 4: Complete setup
  const handleComplete = () => {
    setShowMFAModal(false);
    showSuccess("MFA setup completed successfully.");
    if (setActiveTab) setActiveTab('mfa-details');
  };
  return (
    <>
      <Form id="passwordForm" className="mt-3" onSubmit={handlePasswordSubmit}>
        <Form.Group className="mb-3" controlId="currentPassword">
          <Form.Label>Current Password</Form.Label>
          <Form.Control type="password" value={form.currentPassword} onChange={handleChange} required />
        </Form.Group>
        <Form.Group className="mb-3" controlId="newPassword">
          <Form.Label>New Password</Form.Label>
          <Form.Control type="password" value={form.newPassword} onChange={handleChange} required minLength={6} />
        </Form.Group>
        <Form.Group className="mb-3" controlId="confirmPassword">
          <Form.Label>Confirm New Password</Form.Label>
          <Form.Control type="password" value={form.confirmPassword} onChange={handleChange} required />
        </Form.Group>
        {tabError && <Alert variant="danger">{tabError}</Alert>}
        {success && <Alert variant="success">{success}</Alert>}
        <div className="d-flex justify-content-end gap-2">
          <Button type="submit" variant="primary">Update Password</Button>
        </div>
      </Form>
      <hr className="my-4" />
      <Form id="mfaForm" className="mt-3">
        {user?.mfa_enabled ? (
          <Card border="success" className="mb-4">
            <Card.Body>
              <div className="d-flex align-items-center">
                <div className="flex-grow-1">
                  <h6 className="card-title mb-1">
                    <i className="bi bi-shield-check text-success me-2"></i>
                    Two-Factor Authentication Enabled
                  </h6>
                  <p className="card-text text-muted mb-0">
                    Your account is protected with two-factor authentication.
                  <Button
                    variant="link"
                    className="text-primary p-0"
                    style={{ textDecoration: "none", textAlign: "left" }}
                    onClick={() => setActiveTab('mfa-details')}
                  >
                    View the MFA Details tab for backup codes and additional options.
                  </Button>
                  </p>
                </div>
              </div>
            </Card.Body>
          </Card>
        ) : (
          <Card border="warning" className="mb-4">
            <Card.Body>
              <div className="d-flex align-items-center">
                <div className="flex-grow-1">
                  <h6 className="card-title mb-1">
                    <i className="bi bi-shield-exclamation text-warning me-2"></i>
                    Two-Factor Authentication Disabled
                  </h6>
                  <p className="card-text text-muted mb-0">
                    Secure your account with an extra layer of protection using your phone or authenticator app.
                  </p>
                </div>
                <Button
                  variant="outline-success"
                  className="ms-3"
                  id="mfaEnableBtn"
                  onClick={handleSetupMFA}
                  disabled={loading}
                >
                  <i className="bi bi-shield-plus me-2"></i>Enable 2FA
                </Button>
              </div>
            </Card.Body>
          </Card>
        )}
      </Form>
      <hr className="my-4" />
      <Card className="mb-3" border="danger">
        <Card.Header className="bg-danger text-white">
          <h6 className="mb-0"><i className="bi bi-exclamation-triangle me-2"></i>Danger Zone</h6>
        </Card.Header>
        <Card.Body>
          <p className="card-text">Once you delete your account, there is no going back. Please be certain.</p>
          <Button type="button" variant="outline-danger" id="deleteAccountBtn">Delete Account</Button>
        </Card.Body>
      </Card>

      <MFAModal
        show={showMFAModal}
        onHide={() => setShowMFAModal(false)}
        setupData={setupData}
        onVerify={handleVerify}
        onEnable={handleEnable}
        onComplete={handleComplete}
        backupCodes={backupCodes}
        loading={loading}
        error={error}
        step={step}
        onStepChange={setStep}
      />
    </>
  );
}

export default SecurityTab;

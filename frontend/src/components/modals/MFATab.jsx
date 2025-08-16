import React, { useState, useEffect } from "react";
import { Alert } from "react-bootstrap";
import MFAModal from "./MFAModal";
import BackupCodesSection from "./BackupCodesSection";
import DisableMFASection from "./DisableMFASection";
import userApi from "../../api/userApi";
import { useAuth } from "../../context/AuthContext";
import { useNotification } from "../NotificationProvider";

function MFATab({ setActiveTab }) {
  const [showMFAModal, setShowMFAModal] = useState(false);
  const [setupData, setSetupData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState(1);
  const [backupCodes, setBackupCodes] = useState([]);
  const { showSuccess, showError } = useNotification();
  const { user, setUser } = useAuth();

  // Enable MFA handler
  const handleEnableMFA = async () => {
    setLoading(true);
    setError("");
    try {
      // Call backend to start setup and get QR/secret
      const data = await userApi.setupMFA();
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
      if (res.success) {
        setStep(3);
      } else {
        setError("Invalid code. Try again.");
      }
    } catch (err) {
      setError(err.message || "Verification failed.");
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
      const res = await userApi.enableMFA(password);
      if (res.success) {
        // Fetch backup codes for step 4
        const codesRes = await userApi.getBackupCodes();
        console.log("Backup Codes:", codesRes.backup_codes);
        setBackupCodes(Array.isArray(codesRes.backup_codes) ? codesRes.backup_codes : []);
        setUser({ ...user, mfa_enabled: true });
        if (setActiveTab) setActiveTab('security-settings');
        showSuccess("Two-factor authentication enabled successfully.");
        setStep(4);
      } else {
        setError("Password incorrect.");
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
    // Optionally refresh user state here
  };


  return (
    <div className="mt-3">
      <h5 className="mb-3">
        <i className="bi bi-shield-check text-success me-2"></i>
        Two-Factor Authentication Details
      </h5>
      <Alert variant="success">
        <i className="bi bi-check-circle me-2"></i>
        Your account is protected with two-factor authentication using TOTP (Time-based One-time Password).
      </Alert>
      <BackupCodesSection />
      <DisableMFASection setActiveTab={setActiveTab} />
      {/* MFA Setup Modal */}
      <MFAModal
        show={showMFAModal}
        onHide={() => setShowMFAModal(false)}
        setupData={setupData}
        backupCodes={backupCodes}
        onVerify={handleVerify}
        onEnable={handleEnable}
        onComplete={handleComplete}
        loading={loading}
        error={error}
        step={step}
        onStepChange={setStep}
      />
    </div>
  );
}

export default MFATab;

import React, { useState } from "react";
import { Card, Button, Alert, Spinner, Collapse } from "react-bootstrap";
import userApi from "../../../api/userApi";

function BackupCodesSection() {
  const [showRegenerate, setShowRegenerate] = useState(false);
  const [regenLoading, setRegenLoading] = useState(false);
  const [regenError, setRegenError] = useState("");
  const [codes, setCodes] = useState([]);
  const [showCodes, setShowCodes] = useState(false);
  const [codesError, setCodesError] = useState("");

  const handleViewCodes = async () => {
    if (!showCodes) {
      setCodesError("");
      try {
        const result = await userApi.getBackupCodes();
        setCodes(Array.isArray(result.backup_codes) ? result.backup_codes : []);
        setShowCodes(true);
      } catch (err) {
        setCodesError(err.message || "Failed to load backup codes.");
      }
    } else {
      setShowCodes(false);
    }
  };

  const handleRegenerateClick = () => {
    setShowRegenerate(true);
    setRegenError("");
  };

  const handleCancelRegenerate = () => {
    setShowRegenerate(false);
    setRegenError("");
  };

  const handleRegenerateSubmit = async (e) => {
    e.preventDefault();
    setRegenLoading(true);
    setRegenError("");
    const code = e.target.regenerateTotpCode.value;
    try {
      const result = await userApi.regenerateBackupCodes(code);
      setCodes(result.backup_codes || []);
      setShowRegenerate(false);
      setShowCodes(true);
    } catch (err) {
      setRegenError(err.message || "Failed to regenerate codes.");
    } finally {
      setRegenLoading(false);
    }
  };

  const handleDownloadCodes = () => {
    let codeList = codes;
    if (!Array.isArray(codeList) && codeList && codeList.backup_codes) {
      codeList = codeList.backup_codes;
    }
    const blob = new Blob([codeList.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "backup-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrintCodes = () => {
    let codeList = codes;
    if (!Array.isArray(codeList) && codeList && codeList.backup_codes) {
      codeList = codeList.backup_codes;
    }
    const win = window.open("", "_blank");
    win.document.write(`<pre>${codeList.join("\n")}</pre>`);
    win.print();
    win.close();
  };

  return (
    <Card className="mb-3">
      <Card.Header>
        <h6 className="mb-0">
          <i className="bi bi-key me-2"></i>Backup Codes
        </h6>
      </Card.Header>
      <Card.Body>
        <p className="card-text">
          Backup codes can be used to access your account if you lose your authenticator device. Each backup code can only be used once.
        </p>
        <div className="d-flex gap-2 mb-3">
          <Button variant="primary" id="mfaDetailsBackupCodesBtn" onClick={handleViewCodes}>
            <i className={`bi ${showCodes ? "bi-eye-slash" : "bi-eye"} me-2`}></i>
            {showCodes ? "Hide Backup Codes" : "View Backup Codes"}
          </Button>
          <Button variant="outline-warning" id="mfaDetailsRegenerateCodesBtn" onClick={handleRegenerateClick}>
            <i className="bi bi-arrow-clockwise me-2"></i>Regenerate Codes
          </Button>
        </div>
        <Collapse in={showRegenerate}>
          <div>
            <Card border="warning" className="mb-3">
              <Card.Header className="bg-warning text-dark">
                <h6 className="mb-0">
                  <i className="bi bi-exclamation-triangle me-2"></i>Regenerate Backup Codes
                </h6>
              </Card.Header>
              <Card.Body>
                <Alert variant="warning">
                  <strong>Warning:</strong> This will invalidate all existing backup codes. Make sure you have access to your authenticator app.
                </Alert>
                <form onSubmit={handleRegenerateSubmit} id="regenerateCodesFormSubmit">
                  <div className="mb-3">
                    <label htmlFor="regenerateTotpCode" className="form-label">
                      <i className="bi bi-shield-check me-1"></i> Enter your current TOTP code
                    </label>
                    <input
                      className="form-control font-monospace"
                      id="regenerateTotpCode"
                      name="regenerateTotpCode"
                      placeholder="000000"
                      maxLength={6}
                      pattern="[0-9]{6}"
                      required
                      autoComplete="one-time-code"
                      disabled={regenLoading}
                    />
                    <div className="form-text">Enter the 6-digit code from your authenticator app.</div>
                  </div>
                  <Collapse in={!!regenError}>
                    <div>{regenError && <Alert variant="danger">{regenError}</Alert>}</div>
                  </Collapse>
                  <div className="d-flex gap-2">
                    <Button type="submit" variant="warning" id="confirmRegenerateBtn" disabled={regenLoading}>
                      {regenLoading && <Spinner animation="border" size="sm" className="me-2" />}<i className="bi bi-arrow-clockwise me-2"></i>Generate New Codes
                    </Button>
                    <Button type="button" variant="secondary" id="cancelRegenerateBtn" onClick={handleCancelRegenerate} disabled={regenLoading}>
                      Cancel
                    </Button>
                  </div>
                </form>
              </Card.Body>
            </Card>
          </div>
        </Collapse>
        <Collapse in={!!codesError}>
          <div>{codesError && <Alert variant="danger">{codesError}</Alert>}</div>
        </Collapse>
        <Collapse in={showCodes}>
          <div className="mt-3">
            <Alert variant="warning">
              <strong><i className="bi bi-exclamation-triangle me-2"></i>Important:</strong> These backup codes can be used to access your account if you lose your authenticator device. Store them securely and do not share them with anyone.
            </Alert>
            <Alert variant="info">
              Each code can only be used once. You have {codes.length} codes remaining.
            </Alert>
            <div className="backup-codes-grid mb-3">
              {codes.map((code, idx) => (
                <span key={idx} className="badge bg-light text-dark font-monospace p-2 m-1">{code}</span>
              ))}
            </div>
            <div className="d-flex gap-2 flex-wrap">
              <Button variant="secondary" id="downloadBackupCodes" onClick={handleDownloadCodes}>
                <i className="bi bi-download me-2"></i>Download Codes
              </Button>
              <Button variant="secondary" id="printBackupCodes" onClick={handlePrintCodes}>
                <i className="bi bi-printer me-2"></i>Print Codes
              </Button>
            </div>
          </div>
        </Collapse>
      </Card.Body>
    </Card>
  );
}

export default BackupCodesSection;

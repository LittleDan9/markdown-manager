import React, { useState } from "react";
import { Modal, Accordion, Card, Button, Alert, Spinner, Form, ProgressBar } from "react-bootstrap";

function MFAModal({ show, onHide, setupData, backupCodes = [], onVerify, onEnable, onComplete, loading, error, step, onStepChange }) {
  // step: 1=QR, 2=Verify, 3=Password, 4=Backup Codes
  return (
    <Modal show={show} onHide={onHide} size="lg" centered backdrop="static">
      <Modal.Header closeButton>
        <Modal.Title id="mfaSetupModalLabel">
          <i className="bi bi-shield-plus me-2"></i>Enable Two-Factor Authentication
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <ProgressBar now={step * 25} label={`Step ${step} of 4`} className="mb-3" />
        <Accordion activeKey={`step${step}`} alwaysOpen>
          {/* Step 1: QR Code */}
          <Accordion.Item eventKey="step1">
            <Accordion.Header><i className="bi bi-qr-code me-2"></i>Step 1: Scan QR Code</Accordion.Header>
            <Accordion.Body>
              <p>Use your authenticator app to scan this QR code:</p>
              <div className="row">
                <div className="col-md-6 text-center">
                  <img src={setupData?.qr_code_data_url} alt="QR Code" className="img-fluid border rounded" style={{ maxWidth: 200 }} />
                </div>
                <div className="col-md-6">
                  <Form.Group>
                    <Form.Label>Can't scan? Enter this code manually:</Form.Label>
                    <Form.Control type="text" value={setupData?.secret || ""} readOnly className="font-monospace" />
                  </Form.Group>
                  <Alert variant="info" className="mt-2">
                    <i className="bi bi-info-circle me-1"></i>Recommended apps: Google Authenticator, Authy, or 1Password
                  </Alert>
                </div>
              </div>
              <div className="text-end mt-4">
                <Button variant="primary" onClick={() => onStepChange(2)} disabled={loading}>Next: Verify Setup <i className="bi bi-arrow-right ms-1"></i></Button>
              </div>
            </Accordion.Body>
          </Accordion.Item>
          {/* Step 2: TOTP Verification */}
          <Accordion.Item eventKey="step2">
            <Accordion.Header><i className="bi bi-shield-check me-2"></i>Step 2: Verify Setup</Accordion.Header>
            <Accordion.Body>
              <Form onSubmit={onVerify} className="mb-3">
                <Form.Group>
                  <Form.Label>Enter the 6-digit code from your authenticator app:</Form.Label>
                  <Form.Control
                    type="text"
                    className="form-control form-control-lg text-center"
                    id="mfaVerifyCode"
                    name="verifyCode"
                    placeholder="000000"
                    maxLength={6}
                    pattern="[0-9]{6}"
                    required
                  />
                </Form.Group>
                {error && <Alert variant="danger" className="mt-2">{error}</Alert>}
                <div className="d-flex justify-content-between mt-4">
                  <Button variant="secondary" onClick={() => onStepChange(1)}><i className="bi bi-arrow-left me-1"></i>Back</Button>
                  <Button type="submit" variant="primary" disabled={loading}>{loading ? <Spinner animation="border" size="sm" className="me-2" /> : null}Verify Code</Button>
                </div>
              </Form>
            </Accordion.Body>
          </Accordion.Item>
          {/* Step 3: Password Confirmation */}
          <Accordion.Item eventKey="step3">
            <Accordion.Header><i className="bi bi-key me-2"></i>Step 3: Confirm Password</Accordion.Header>
            <Accordion.Body>
              <Form onSubmit={onEnable} className="mb-3">
                <Form.Group>
                  <Form.Label>Current Password</Form.Label>
                  <Form.Control type="password" required name="enablePassword" />
                </Form.Group>
                {error && <Alert variant="danger" className="mt-2">{error}</Alert>}
                <div className="d-flex justify-content-between mt-4">
                  <Button variant="secondary" onClick={() => onStepChange(2)}><i className="bi bi-arrow-left me-1"></i>Back</Button>
                  <Button type="submit" variant="success" disabled={loading}>{loading ? <Spinner animation="border" size="sm" className="me-2" /> : null}<i className="bi bi-shield-plus me-2"></i>Enable Two-Factor Authentication</Button>
                </div>
              </Form>
            </Accordion.Body>
          </Accordion.Item>
          {/* Step 4: Backup Codes */}
          <Accordion.Item eventKey="step4">
            <Accordion.Header><i className="bi bi-shield-check me-2"></i>Step 4: Save Backup Codes</Accordion.Header>
            <Accordion.Body>
              <Alert variant="warning">
                <h6><i className="bi bi-key me-2"></i>Save Your Backup Codes</h6>
                <p>These one-time backup codes can be used to access your account if you lose your device:</p>
                <div className="backup-codes-grid">
                  {backupCodes.length > 0
                    ? backupCodes.map((code, idx) => (
                        <span key={idx} className="badge bg-light text-dark font-monospace p-2 m-1">{code}</span>
                      ))
                    : <span className="text-muted">No backup codes available.</span>
                  }
                </div>
              </Alert>
              <div className="text-center mt-4">
                <Button variant="success" onClick={onComplete}><i className="bi bi-check-lg me-1"></i>Complete Setup</Button>
              </div>
            </Accordion.Body>
          </Accordion.Item>
        </Accordion>
      </Modal.Body>
    </Modal>
  );
}

export default MFAModal;

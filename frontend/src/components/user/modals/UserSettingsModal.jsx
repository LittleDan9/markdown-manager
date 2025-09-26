import React, { useState } from "react";
import { Modal, Nav, Tab, Card, Alert } from "react-bootstrap";
import ProfileInfoTab from "./ProfileInfoTab";
import SecurityTab from "../../security/modals/SecurityTab";
import MFATab from "../../security/modals/MFATab";
import DictionaryTab from "../../dictionary/modals/DictionaryTab";
import MarkdownLintTab from "../../linting/modals/MarkdownLintTab";
import StorageTab from "../../storage/StorageTab";

import userApi from "../../../api/userApi";
import { useAuth } from "../../../providers/AuthProvider";

function UserSettingsModal({ show, onHide, defaultActiveKey = "profile-info", activeTab, setActiveTab, guestMode = false, onOpenFileModal }) {
  const { user, setUser } = useAuth();
  const [form, setForm] = useState({
    profileFirstName: user.first_name || "",
    profileLastName: user.last_name || "",
    profileDisplayName: user.display_name || "",
    profileEmail: user.email || "",
    profileBio: user.bio || "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  // Profile Info Tab handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const response = await userApi.updateProfileInfo({
        first_name: form.profileFirstName,
        last_name: form.profileLastName,
        display_name: form.profileDisplayName,
        bio: form.profileBio
      });
      setUser(response);
      setSuccess("Profile updated successfully.");
    } catch (err) {
      setError(err.message || "Failed to update profile.");
    } finally {
      setLoading(false);
    }
  };

  // Security Tab handler
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (form.newPassword !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await userApi.updatePassword(form.currentPassword, form.newPassword);
      setSuccess("Password updated successfully.");
      form.currentPassword = "";
      form.newPassword = "";
      form.confirmPassword = "";
    } catch (err) {
      setError(err.message || "Failed to update password.");
    } finally {
      setLoading(false);
    }
  };

  // MFA Details Tab handlers (example: backup codes)
  const [backupCodes, setBackupCodes] = useState([]);
  const [mfaError, setMfaError] = useState("");
  const [mfaSuccess, setMfaSuccess] = useState("");
  const [mfaLoading, setMfaLoading] = useState(false);

  const handleViewBackupCodes = async () => {
    setMfaError("");
    setMfaSuccess("");
    setMfaLoading(true);
    try {
      const codes = await userApi.getBackupCodes();
      setBackupCodes(codes);
      setMfaSuccess("Backup codes loaded.");
    } catch (err) {
      setMfaError(err.message || "Failed to load backup codes.");
    } finally {
      setMfaLoading(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title id="profileModalLabel">
          <i className={guestMode ? "bi bi-book me-2" : "bi bi-person me-2"}></i>
          {guestMode ? "Custom Dictionary" : "Profile"}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Tab.Container activeKey={activeTab} onSelect={setActiveTab}>
          <Nav variant="tabs" id="profileTabs">
            {!guestMode && (
              <Nav.Item>
                <Nav.Link eventKey="profile-info">
                  <i className="bi bi-person me-1"></i>Profile Info
                </Nav.Link>
              </Nav.Item>
            )}
            {!guestMode && (
              <Nav.Item>
                <Nav.Link eventKey="security-settings">
                  <i className="bi bi-shield-lock me-1"></i>Security
                </Nav.Link>
              </Nav.Item>
            )}
            {!guestMode && user?.mfa_enabled && (
              <Nav.Item>
                <Nav.Link eventKey="mfa-details">
                  <i className="bi bi-key me-1"></i>MFA Details
                </Nav.Link>
              </Nav.Item>
            )}
            <Nav.Item>
              <Nav.Link eventKey="dictionary">
                <i className="bi bi-book me-1"></i>Dictionary
              </Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link eventKey="markdown-lint">
                <i className="bi bi-check2-square me-1"></i>Markdown Linting
              </Nav.Link>
            </Nav.Item>
            {!guestMode && (
              <Nav.Item>
                <Nav.Link eventKey="storage">
                  <i className="bi bi-hdd me-1"></i>Storage
                </Nav.Link>
              </Nav.Item>
            )}
          </Nav>
          <Tab.Content id="profileTabContent">
            {!guestMode && (
              <Tab.Pane eventKey="profile-info">
                <ProfileInfoTab
                  form={form}
                  handleChange={e => setForm({ ...form, [e.target.id]: e.target.value })}
                  error={error}
                  success={success}
                  handleSubmit={handleSubmit}
                />
              </Tab.Pane>
            )}
            {!guestMode && (
              <Tab.Pane eventKey="security-settings">
                <SecurityTab
                  form={form}
                  handleChange={e => setForm({ ...form, [e.target.id]: e.target.value })}
                  error={error}
                  success={success}
                  handlePasswordSubmit={handlePasswordSubmit}
                  setActiveTab={setActiveTab}
                />
              </Tab.Pane>
            )}
            {!guestMode && (
              <Tab.Pane eventKey="mfa-details">
                <MFATab setActiveTab={setActiveTab} />
              </Tab.Pane>
            )}
            <Tab.Pane eventKey="dictionary">
              <DictionaryTab />
            </Tab.Pane>
            <Tab.Pane eventKey="markdown-lint">
              <MarkdownLintTab />
            </Tab.Pane>
            {!guestMode && (
              <Tab.Pane eventKey="storage">
                <StorageTab />
              </Tab.Pane>
            )}
          </Tab.Content>
        </Tab.Container>
      </Modal.Body>
    </Modal>
  );
}

export default UserSettingsModal;

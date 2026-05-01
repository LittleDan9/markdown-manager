import React from "react";
import { Modal, Nav, Tab } from "react-bootstrap";
import ProfileInfoTab from "./ProfileInfoTab";
import SecurityTab from "../../security/modals/SecurityTab";
import MFATab from "../../security/modals/MFATab";
import DictionaryTab from "../../dictionary/modals/DictionaryTab";
import MarkdownLintTab from "../../linting/modals/MarkdownLintTab";
import SpellCheckTab from "../../editor/spell-check/SpellCheckTab";
import StorageTab from "../../storage/StorageTab";
import DisplayTab from "./DisplayTab";
import CodeFencesTab from "./CodeFencesTab";
import AIProvidersTab from "./AIProvidersTab";
import useProfileForm from "./useProfileForm";

import { useAuth } from "../../../providers/AuthProvider";

function UserSettingsModal({ show, onHide, defaultActiveKey: _defaultActiveKey = "profile-info", activeTab, setActiveTab, guestMode = false, onOpenFileModal: _onOpenFileModal }) {
  const { user } = useAuth();
  const { form, error, success, handleChange, handleSubmit, handlePasswordSubmit } = useProfileForm();

  return (
    <Modal show={show} onHide={onHide} size="xl" scrollable centered dialogClassName="user-settings-modal">
      <Modal.Header closeButton>
        <Modal.Title id="profileModalLabel">
          <i className="bi bi-gear me-2"></i>Settings
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Tab.Container activeKey={activeTab} onSelect={setActiveTab}>
          <div className="user-settings-layout">
            <Nav className="user-settings-sidebar flex-column">
              {!guestMode && (
                <Nav.Item>
                  <Nav.Link eventKey="profile-info">
                    <i className="bi bi-person me-2"></i>Profile Info
                  </Nav.Link>
                </Nav.Item>
              )}
              {!guestMode && (
                <Nav.Item>
                  <Nav.Link eventKey="security-settings">
                    <i className="bi bi-shield-lock me-2"></i>Security
                  </Nav.Link>
                </Nav.Item>
              )}
              {!guestMode && user?.mfa_enabled && (
                <Nav.Item>
                  <Nav.Link eventKey="mfa-details">
                    <i className="bi bi-key me-2"></i>MFA Details
                  </Nav.Link>
                </Nav.Item>
              )}
              <Nav.Item>
                <Nav.Link eventKey="dictionary">
                  <i className="bi bi-book me-2"></i>Dictionary
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="markdown-lint">
                  <i className="bi bi-check2-square me-2"></i>Linting
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="spell-check">
                  <i className="bi bi-spellcheck me-2"></i>Spell Check
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="display">
                  <i className="bi bi-layout-text-sidebar me-2"></i>Display
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="code-fences">
                  <i className="bi bi-code-square me-2"></i>Code Fences
                </Nav.Link>
              </Nav.Item>
              {!guestMode && (
                <Nav.Item>
                  <Nav.Link eventKey="storage">
                    <i className="bi bi-hdd me-2"></i>Storage
                  </Nav.Link>
                </Nav.Item>
              )}
              {!guestMode && (
                <Nav.Item>
                  <Nav.Link eventKey="ai-providers">
                    <i className="bi bi-robot me-2"></i>AI Providers
                  </Nav.Link>
                </Nav.Item>
              )}
            </Nav>
            <div className="user-settings-content">
              <Tab.Content>
                {!guestMode && (
                  <Tab.Pane eventKey="profile-info">
                    <ProfileInfoTab
                      form={form}
                      handleChange={handleChange}
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
                      handleChange={handleChange}
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
                <Tab.Pane eventKey="spell-check">
                  <SpellCheckTab />
                </Tab.Pane>
                <Tab.Pane eventKey="display">
                  <DisplayTab />
                </Tab.Pane>
                <Tab.Pane eventKey="code-fences">
                  <CodeFencesTab />
                </Tab.Pane>
                {!guestMode && (
                  <Tab.Pane eventKey="storage">
                    <StorageTab />
                  </Tab.Pane>
                )}
                {!guestMode && (
                  <Tab.Pane eventKey="ai-providers">
                    <AIProvidersTab />
                  </Tab.Pane>
                )}
              </Tab.Content>
            </div>
          </div>
        </Tab.Container>
      </Modal.Body>
    </Modal>
  );
}

export default UserSettingsModal;


import React, { useState, useEffect } from "react";
import { Dropdown } from "react-bootstrap";
import ThemeToggle from "./ThemeToggle";
import { useNotification } from "../NotificationProvider";
import { useAuth } from "../../providers/AuthProvider";
import UserSettingsModal from "../user/modals/UserSettingsModal";
import GitHubModal from "../github/modals/GitHubModal";
import IconManagementModal from "../icons/modals/IconManagementModal";
import AdminModal from "../admin/AdminModal";
import GitManagementModal from "../git/GitManagementModal";
import SpellCheckSettingsModal from "../editor/spell-check/SpellCheckSettingsModal";
import { useTheme } from "../../providers/ThemeProvider";

function UserMenuLoggedIn() {
  const { showSuccess, showError } = useNotification();
  const { user, setUser, logout, autosaveEnabled, setAutosaveEnabled, syncPreviewScrollEnabled, setSyncPreviewScrollEnabled, autoCommitEnabled, setAutoCommitEnabled } = useAuth();
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showGitHubModal, setShowGitHubModal] = useState(false);
  const [showIconModal, setShowIconModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [showGitModal, setShowGitModal] = useState(false);
  const [showSpellCheckModal, setShowSpellCheckModal] = useState(false);
  const [activeTab, setActiveTab] = useState("profile-info");
  const { toggleTheme } = useTheme();

  // Set up return callback for FileOpen Modal → GitHub Modal navigation
  useEffect(() => {
    window.gitHubModalReturnCallback = () => {
      setShowGitHubModal(true);
    };

    return () => {
      delete window.gitHubModalReturnCallback;
    };
  }, []);

  const handleProfile = () => {
    setActiveTab("profile-info");
    setShowSettingsModal(true);
  };

  const handleSecurity = () => {
    setActiveTab("security-settings");
    setShowSettingsModal(true);
  };

  const handleMFA = () => {
    setActiveTab("mfa-details");
    setShowSettingsModal(true);
  };

  const handleDictionary = () => {
    setActiveTab("dictionary");
    setShowSettingsModal(true);
  };

  const handleMarkdownLinting = () => {
    setActiveTab("markdown-lint");
    setShowSettingsModal(true);
  };

  const handleStorage = () => {
    setActiveTab("storage");
    setShowSettingsModal(true);
  };

  const handleSpellCheck = () => {
    setShowSpellCheckModal(true);
  };

  const handleGitHub = () => {
    setShowGitHubModal(true);
  };

  const handleGitManagement = () => {
    setShowGitModal(true);
  };

  const handleIconManagement = () => {
    setShowIconModal(true);
  };

  const handleAdmin = () => {
    setShowAdminModal(true);
  };

  const handleLogout = () => {
    logout().then(() => {
      showSuccess("You have been logged out.");
    });
    // localStorage.removeItem("authToken");
    // localStorage.removeItem("tokenType");
    // setUser(null);
    // showSuccess("You have been logged out.");
  };

  return (
    <>
      <Dropdown.Menu>
        <Dropdown.Item id="profileBtn" onClick={handleProfile}>
          <i className="bi bi-person me-2"></i>Profile
        </Dropdown.Item>
        <Dropdown.Item id="settingsBtn" onClick={handleSecurity}>
          <i className="bi bi-gear me-2"></i>Security
        </Dropdown.Item>
        {user.mfa_enabled && (
          <Dropdown.Item id="mfaBtn" onClick={handleMFA}>
            <i className="bi bi-shield-lock me-2"></i>MFA
          </Dropdown.Item>
        )}
        <Dropdown.Item id="dictionaryBtn" onClick={handleDictionary}>
          <i className="bi bi-book me-2"></i>Dictionary
        </Dropdown.Item>
        <Dropdown.Item id="markdownLintingBtn" onClick={handleMarkdownLinting}>
          <i className="bi bi-check2-square me-2"></i>Markdown Linting
        </Dropdown.Item>
        <Dropdown.Item id="storageBtn" onClick={handleStorage}>
          <i className="bi bi-hdd me-2"></i>Storage
        </Dropdown.Item>
        <Dropdown.Item id="spellCheckBtn" onClick={handleSpellCheck}>
          <i className="bi bi-spellcheck me-2"></i>Spell Check
        </Dropdown.Item>
        <Dropdown.Divider />
        <Dropdown.Item
          onClick={() => setAutosaveEnabled((prev) => !prev)}
          aria-checked={autosaveEnabled}
          role="menuitemcheckbox"
        >
          {autosaveEnabled ? (
            <i className="bi bi-toggle-on text-success me-2"></i>
          ) : (
            <i className="bi bi-toggle-off text-secondary me-2"></i>
          )}
          Autosave
        </Dropdown.Item>
        <Dropdown.Item
          onClick={() => setSyncPreviewScrollEnabled((prev) => !prev)}
          aria-checked={syncPreviewScrollEnabled}
          role="menuitemcheckbox"
        >
          {syncPreviewScrollEnabled ? (
            <i className="bi bi-toggle-on text-success me-2"></i>
          ) : (
            <i className="bi bi-toggle-off text-secondary me-2"></i>
          )}
          Sync Preview Scroll
        </Dropdown.Item>
        <Dropdown.Item
          onClick={() => setAutoCommitEnabled((prev) => !prev)}
          aria-checked={autoCommitEnabled}
          role="menuitemcheckbox"
        >
          {autoCommitEnabled ? (
            <i className="bi bi-toggle-on text-success me-2"></i>
          ) : (
            <i className="bi bi-toggle-off text-secondary me-2"></i>
          )}
          Auto-commit on Save
        </Dropdown.Item>
        <Dropdown.Divider />
        <Dropdown.Item id="githubBtn" onClick={handleGitHub}>
          <i className="bi bi-github me-2"></i>GitHub
        </Dropdown.Item>
        <Dropdown.Item id="gitManagementBtn" onClick={handleGitManagement}>
          <i className="bi bi-git me-2"></i>Git Management
        </Dropdown.Item>
        {user.is_admin && (
          <Dropdown.Item id="iconManagementBtn" onClick={handleIconManagement}>
            <i className="bi bi-images me-2"></i>Icon Management
          </Dropdown.Item>
        )}
        {user.is_admin && (
          <Dropdown.Item id="adminBtn" onClick={handleAdmin}>
            <i className="bi bi-shield-fill-check text-danger me-2"></i>
            <span className="text-danger">Admin</span>
          </Dropdown.Item>
        )}
        <Dropdown.Divider />
        <Dropdown.Item id="themeToggleBtnUser" onClick={toggleTheme}>
          <ThemeToggle idPrefix="userMenu"/>
        </Dropdown.Item>
        <Dropdown.Divider />
        <Dropdown.Item id="logoutBtn" onClick={handleLogout}>
          <i className="bi bi-box-arrow-right me-2"></i>Logout
        </Dropdown.Item>
      </Dropdown.Menu>
      <UserSettingsModal
        show={showSettingsModal}
        onHide={() => setShowSettingsModal(false)}
        defaultActiveKey={activeTab}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />
      <GitHubModal
        show={showGitHubModal}
        onHide={() => setShowGitHubModal(false)}
      />
      <GitManagementModal
        show={showGitModal}
        onHide={() => setShowGitModal(false)}
      />
      <IconManagementModal
        show={showIconModal}
        onHide={() => setShowIconModal(false)}
      />
      <AdminModal
        show={showAdminModal}
        onHide={() => setShowAdminModal(false)}
      />
      <SpellCheckSettingsModal
        show={showSpellCheckModal}
        onHide={() => setShowSpellCheckModal(false)}
        settings={{
          spelling: true,
          grammar: true,
          style: true,
          readability: true,
          styleGuide: 'none',
          language: 'en-US'
        }}
        onSettingsChange={(newSettings) => {
          // For global settings, we could save to localStorage or user preferences
          console.log('Global spell check settings changed:', newSettings);
        }}
      />
    </>
  );
}

export default UserMenuLoggedIn;

import React, { useState, useEffect, useCallback } from "react";
import { Dropdown } from "react-bootstrap";
import ThemeToggle from "./ThemeToggle";
import { useNotification } from "../NotificationProvider";
import { useAuth } from "../../providers/AuthProvider";
import UserSettingsModal from "../user/modals/UserSettingsModal";
import GitHubModal from "../github/modals/GitHubModal";
import IconManagementModal from "../icons/modals/IconManagementModal";
import AdminModal from "../admin/AdminModal";
import GitManagementModal from "../git/GitManagementModal";
import SystemHealthModal from "../system/SystemHealthModal";
import ImageBrowserModal from "../images/ImageBrowserModal";
import { useImageManagement } from "@/hooks/image/useImageManagement";
import { useTheme } from "../../providers/ThemeProvider";
import { useDocumentContext } from "../../providers/DocumentContextProvider";
import LogLevelController from "@/components/LogLevelController";

function UserMenuLoggedIn() {
  const { showSuccess, showError: _showError } = useNotification();
  const { user, setUser: _setUser, logout, autosaveEnabled, setAutosaveEnabled, syncPreviewScrollEnabled, setSyncPreviewScrollEnabled, autoCommitEnabled, setAutoCommitEnabled } = useAuth();
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showGitHubModal, setShowGitHubModal] = useState(false);
  const [showIconModal, setShowIconModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [showGitModal, setShowGitModal] = useState(false);
  const [showSystemHealthModal, setShowSystemHealthModal] = useState(false);
  const [showImageBrowserModal, setShowImageBrowserModal] = useState(false);
  const [activeTab, setActiveTab] = useState("profile-info");
  const { toggleTheme } = useTheme();
  const { setShowChatDrawer, setChatHelpMode } = useDocumentContext();
  const { generateMarkdown } = useImageManagement();

  // Set up return callback for FileOpen Modal → GitHub Modal navigation
  useEffect(() => {
    window.gitHubModalReturnCallback = () => {
      // Only reopen if not already showing to prevent unnecessary re-renders
      setShowGitHubModal(prev => {
        if (!prev) {
          console.log('Reopening GitHub modal via callback');
          return true;
        }
        return prev;
      });
    };

    return () => {
      delete window.gitHubModalReturnCallback;
    };
  }, []);

  // Listen for openSettings events from editor toolbar buttons
  useEffect(() => {
    const handler = (e) => {
      if (e.detail?.tab) {
        setActiveTab(e.detail.tab);
        setShowSettingsModal(true);
      }
    };
    window.addEventListener('openSettings', handler);
    return () => window.removeEventListener('openSettings', handler);
  }, []);

  const handleSettings = () => {
    setActiveTab("profile-info");
    setShowSettingsModal(true);
  };

  const handleSystemHealth = () => {
    setShowSystemHealthModal(true);
  };

  const handleImageManager = () => {
    setShowImageBrowserModal(true);
  };

  const handleImageSelected = useCallback((image) => {
    if (image && window.editorInstance) {
      const editor = window.editorInstance;
      const selection = editor.getSelection();
      const markdown = generateMarkdown(image, 'Image', '');

      if (selection) {
        editor.executeEdits('insert-image', [{
          range: selection,
          text: markdown
        }]);
      }

      editor.focus();
    }
  }, [generateMarkdown]);

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

  // Memoize modal hide handlers to prevent unnecessary re-renders
  const handleSettingsModalHide = useCallback(() => setShowSettingsModal(false), []);
  const handleGitHubModalHide = useCallback(() => setShowGitHubModal(false), []);
  const handleGitModalHide = useCallback(() => setShowGitModal(false), []);
  const handleIconModalHide = useCallback(() => setShowIconModal(false), []);
  const handleAdminModalHide = useCallback(() => setShowAdminModal(false), []);
  const handleSystemHealthModalHide = useCallback(() => setShowSystemHealthModal(false), []);
  const handleImageBrowserModalHide = useCallback(() => setShowImageBrowserModal(false), []);

  return (
    <>
      <Dropdown.Menu>
        <Dropdown.Item id="settingsBtn" onClick={handleSettings}>
          <i className="bi bi-gear me-2"></i>Settings
        </Dropdown.Item>
        <Dropdown.Item id="imageManagerBtn" onClick={handleImageManager}>
          <i className="bi bi-file-image me-2"></i>Image Manager
        </Dropdown.Item>
        <Dropdown.Item id="systemHealthBtn" onClick={handleSystemHealth}>
          <i className="bi bi-activity me-2"></i>System Health
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
          Auto-commit on Session Close
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
        <LogLevelController />
        <Dropdown.Divider />
        <Dropdown.Item onClick={() => { setChatHelpMode(true); setShowChatDrawer(true); }}>
          <i className="bi bi-question-circle me-2"></i>Help
        </Dropdown.Item>
        <Dropdown.Item id="logoutBtn" onClick={handleLogout}>
          <i className="bi bi-box-arrow-right me-2"></i>Logout
        </Dropdown.Item>
      </Dropdown.Menu>
      <UserSettingsModal
        show={showSettingsModal}
        onHide={handleSettingsModalHide}
        defaultActiveKey={activeTab}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />
      <GitHubModal
        show={showGitHubModal}
        onHide={handleGitHubModalHide}
      />
      <GitManagementModal
        show={showGitModal}
        onHide={handleGitModalHide}
      />
      <IconManagementModal
        show={showIconModal}
        onHide={handleIconModalHide}
      />
      <AdminModal
        show={showAdminModal}
        onHide={handleAdminModalHide}
      />
      <SystemHealthModal
        show={showSystemHealthModal}
        onHide={handleSystemHealthModalHide}
        isAdmin={user?.is_admin || false}
      />
      <ImageBrowserModal
        show={showImageBrowserModal}
        onHide={handleImageBrowserModalHide}
        onImageSelected={handleImageSelected}
        allowMultiple={false}
      />
    </>
  );
}

export default UserMenuLoggedIn;
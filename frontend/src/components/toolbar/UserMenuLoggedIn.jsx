
import React, { useState } from "react";
import { Dropdown } from "react-bootstrap";
import ThemeToggle from "./ThemeToggle";
import { useNotification } from "../NotificationProvider";
import { useAuth } from "../../context/AuthProvider";
import UserSettingsModal from "../modals/UserSettingsModal";
import { useTheme } from "../../context/ThemeContext";

function UserMenuLoggedIn() {
  const { showSuccess, showError } = useNotification();
  const { user, setUser } = useAuth();
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [activeTab, setActiveTab] = useState("profile-info");
  const { toggleTheme } = useTheme();

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

  const handleLogout = () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("tokenType");
    setUser(null);
    showSuccess("You have been logged out.");
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
    </>
  );
}

export default UserMenuLoggedIn;
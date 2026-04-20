import React, { useState } from "react";
import { Dropdown } from "react-bootstrap";
import ThemeToggle from "@/components/toolbar/ThemeToggle";
import { useTheme } from "@/providers/ThemeProvider";
import { useDocumentContext } from "@/providers/DocumentContextProvider.jsx";
import RegisterModal from "@/components/auth/modals/RegisterModal";
import UserSettingsModal from "@/components/user/modals/UserSettingsModal";
import SystemHealthModal from "@/components/system/SystemHealthModal";
import UserAPI from "@/api/userApi";
import { useNotification } from "@/components/NotificationProvider";
import { useAuth } from "@/providers/AuthProvider";

function UserMenuLoggedOut() {
  const { toggleTheme } = useTheme();
  const { isSharedView, setShowChatDrawer, setChatHelpMode } = useDocumentContext();
  const {
    setUser,
    login: _login,
    setShowLoginModal,
    setShowMFAModal,
    pendingEmail,
    setPendingEmail,
    pendingPassword,
    setPendingPassword,
    mfaLoading: _mfaLoading,
    mfaError: _mfaError,
    verifyMFA: _verifyMFA,
    setLoginEmail,
  } = useAuth();
  const { showSuccess, showError: _showError } = useNotification();
  const [showRegister, setShowRegister] = useState(false);
  const [registerError, setRegisterError] = useState("");

  const [showDictionaryModal, setShowDictionaryModal] = useState(false);
  const [dictionaryActiveTab, setDictionaryActiveTab] = useState('dictionary');
  const [showSystemHealthModal, setShowSystemHealthModal] = useState(false);


  const handleShowRegister = () => {
    setShowRegister(true);
    setRegisterError("");
  };
  const handleHideRegister = () => {
    setShowRegister(false);
    setRegisterError("");
  };

  const handleRegister = (formData) => {
    console.log("Registering user:", formData);
    UserAPI.register(formData)
      .then((response) => {
        console.log("Registration successful:", response);
        setShowRegister(false);
        showSuccess("Registration successful! Please log in.");
        setLoginEmail(formData.email || "");
        setShowLoginModal(true);
      })
      .catch((error) => {
        console.error("Registration error:", error);
        setRegisterError(error.message || "Registration failed.");
      });
  }

  const _handleVerify = async (code) => {
    try {
      // Use pendingEmail and pendingPassword
      const response = await UserAPI.loginMFA(pendingEmail, pendingPassword, code);
      console.log("MFA Response:", response);
      if (response) {
        // MFA successful
        setShowMFAModal(false);
        setPendingEmail("");
        setPendingPassword("");
        localStorage.setItem("authToken", response.access_token);
        localStorage.setItem("tokenType", response.token_type);
        const user = response.user || {};
        setUser(user);
        console.log(user);
        setShowLoginModal(false);
        setShowMFAModal(false);
        showSuccess(`Welcome back, ${user.display_name}`);
      } else {
        // Error is handled by AuthProvider
      }
    } catch (error) {
      // Error is handled by AuthProvider
    }
  };

  const handleDictionary = () => {
    setDictionaryActiveTab('dictionary');
    setShowDictionaryModal(true);
  };

  const handleSpellCheck = () => {
    setDictionaryActiveTab('spell-check');
    setShowDictionaryModal(true);
  };

  const handleSystemHealth = () => {
    setShowSystemHealthModal(true);
  };

  return (
    <>
    <Dropdown.Menu>
      <Dropdown.Item id="loginBtn" onClick={e => {
        e.preventDefault();
        setShowLoginModal(true);
      }}>
        <i className="bi bi-box-arrow-in-right me-2"></i>Login
      </Dropdown.Item>
      <Dropdown.Item id="registerBtn" onClick={handleShowRegister}>
        <i className="bi bi-person-plus me-2"></i>Sign Up
      </Dropdown.Item>
      {!isSharedView && (
        <>
          <Dropdown.Divider />
          <Dropdown.Item id="dictionaryBtn" onClick={handleDictionary}>
            <i className="bi bi-book me-2"></i>Dictionary
          </Dropdown.Item>
          <Dropdown.Item id="spellCheckBtn" onClick={handleSpellCheck}>
            <i className="bi bi-spellcheck me-2"></i>Spell Check
          </Dropdown.Item>
          <Dropdown.Item id="systemHealthBtn" onClick={handleSystemHealth}>
            <i className="bi bi-activity me-2"></i>System Health
          </Dropdown.Item>
        </>
      )}
      <Dropdown.Divider />
      <Dropdown.Item onClick={() => { setChatHelpMode(true); setShowChatDrawer(true); }}>
        <i className="bi bi-question-circle me-2"></i>Help
      </Dropdown.Item>
      <Dropdown.Item id="themeToggleBtnUser" onClick={toggleTheme}>
        <ThemeToggle idPrefix="userMenu" />
      </Dropdown.Item>
    </Dropdown.Menu>
    <RegisterModal
      show={showRegister}
      onHide={handleHideRegister}
      onRegister={handleRegister}
      error={registerError}
    />
    <UserSettingsModal
      show={showDictionaryModal}
      onHide={() => setShowDictionaryModal(false)}
      defaultActiveKey={dictionaryActiveTab}
      activeTab={dictionaryActiveTab}
      setActiveTab={setDictionaryActiveTab}
      guestMode={true}
    />
    <SystemHealthModal
      show={showSystemHealthModal}
      onHide={() => setShowSystemHealthModal(false)}
      isAdmin={false}
    />
    </>
  );
}

export default UserMenuLoggedOut;
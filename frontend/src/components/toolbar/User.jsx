import React, { useState } from "react";
import { Dropdown } from "react-bootstrap";
import LoginModal from "../modals/LoginModal";
import VerifyMFAModal from "../modals/VerifyMFAModal";
import UserAPI from "../../js/api/userApi";
import { useNotification } from "../NotificationProvider";


function UserToolbar({ handleThemeToggle, theme }) {
  const [showLogin, setShowLogin] = useState(false);
  const [showMFA, setShowMFA] = useState(false);
  const [mfaLoading, setMFAloading] = useState(false);
  const [mfaError, setMFAError] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [pendingPassword, setPendingPassword] = useState("");
  const { showSuccess, showError } = useNotification();
  // MFA Handlers
  const handleShowMFA = () => {
    setShowMFA(true);
    setMFAError("");
    setMFAloading(false);
  };

  const handleVerify = async (code) => {
    setMFAloading(true);
    setMFAError("");
    try {
      // Use pendingEmail and pendingPassword
      const response = await UserAPI.loginMFA(pendingEmail, pendingPassword, code);
      if (response) {
        // MFA successful
        setShowMFA(false);
        setPendingEmail("");
        setPendingPassword("");
        localStorage.setItem("authToken", response.token);
        localStorage.setItem("tokenType", response.token_type);
        const user = response.user || {};
        console.dir(user);
        showSuccess(`Welcome back, ${user.display_name}`);
      } else {
        setMFAError(response.message || "Verification failed.");
      }
    } catch (error) {
      setMFAError(error.message || "Verification failed.");
    } finally {
      setMFAloading(false);
    }
  };

  const handleBack = () => {
    setShowMFA(false);
    handleShowLogin();
  };

  const handleShowLogin = (e) => {
    if (e) e.preventDefault();
    setShowLogin(true);
  };

  const handleLoginModalClose = () => setShowLogin(false);

  const handleLoginSubmit = async ({ email, password }) => {
    const loginResponse = await UserAPI.login(email, password);
    if (loginResponse.mfa_required){
      setShowLogin(false);
      setPendingEmail(email);
      setPendingPassword(password);
      handleShowMFA();
      return;
    }
    // ...handle normal login success...
    setShowLogin(false);
  };

  const handleForgotPassword = (email) => {
    // TODO: Implement forgot password logic
    setShowLogin(false);
  };

  const handleRegister = (e) => {
    e.preventDefault();
    // TODO: Implement register logic
  };

  const userDisplayName = "Guest";

  return (
    <>
    <Dropdown align="end" id="userDropdown">
      <Dropdown.Toggle
        variant="outline-secondary"
        size="sm"
        className="d-flex align-items-center gap-2"
        id="userMenuDropdown"
      >
        <i className="bi bi-person-circle"></i>
        <span id="userDisplayName">{userDisplayName}</span>
      </Dropdown.Toggle>
      <Dropdown.Menu>
        <Dropdown.Item id="loginBtn" onClick={handleShowLogin}>
          <i className="bi bi-box-arrow-in-right me-2"></i>Login
        </Dropdown.Item>
        <Dropdown.Item id="registerBtn" onClick={handleRegister}>
          <i className="bi bi-person-plus me-2"></i>Sign Up
        </Dropdown.Item>
        <Dropdown.Divider />
        <Dropdown.Item id="themeToggleBtn" onClick={handleThemeToggle}>
          <i
            id="themeIcon"
            className={`bi me-2 ${theme === "dark" ? "bi-sun-fill" : "bi-moon-fill"}`}
          ></i>
          <span id="themeText">{theme === "dark" ? "Light Theme" : "Dark Theme"}</span>
        </Dropdown.Item>
      </Dropdown.Menu>
    </Dropdown>
    <LoginModal
      show={showLogin}
      onHide={handleLoginModalClose}
      onLogin={handleLoginSubmit}
      onForgotPassword={handleForgotPassword}
    />
    <VerifyMFAModal
      show={showMFA}
      onHide={() => setShowMFA(false)}
      onVerify={handleVerify}
      onBack={handleBack}
      loading={mfaLoading}
      error={mfaError}
    />
    </>
  );
}

export default UserToolbar;

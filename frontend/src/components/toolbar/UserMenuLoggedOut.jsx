import React, { useState } from "react";
import { Dropdown } from "react-bootstrap";
import ThemeToggle from "./ThemeToggle";
import { toggleTheme, useTheme } from "../../context/ThemeContext";
import LoginModal from "../modals/LoginModal";
import VerifyMFAModal from "../modals/VerifyMFAModal";
import PasswordResetModal from "../modals/PasswordResetModal";
import RegisterModal from "../modals/RegisterModal";
import UserAPI from "../../js/api/userApi";
import { useNotification } from "../NotificationProvider";
import { useUser } from "../../context/UserContext";

function UserMenuLoggedOut() {
  const { toggleTheme } = useTheme();
  const [showLogin, setShowLogin] = useState(false);
  const [showMFA, setShowMFA] = useState(false);
  const [mfaLoading, setMFAloading] = useState(false);
  const [mfaError, setMFAError] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [pendingPassword, setPendingPassword] = useState("");
  const { setUser } = useUser();
  const { showSuccess, showError } = useNotification();
  const [showRegister, setShowRegister] = useState(false);
  const [registerError, setRegisterError] = useState("");
  const [showPasswordResetModal, setShowPasswordResetModal] = useState(false);
  const [devMode, setDevMode] = useState(false);

  // Listen for passwordResetTokenFound event from legacy JS
  React.useEffect(() => {
    const handler = (e) => {
      setPasswordResetToken(e.detail.resetToken);
      setShowPasswordResetVerify(true);
    };
    window.addEventListener("passwordResetTokenFound", handler);
    return () => window.removeEventListener("passwordResetTokenFound", handler);
  }, []);
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
      })
      .catch((error) => {
        console.error("Registration error:", error);
        setRegisterError(error.message || "Registration failed.");
      });
  };

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
      console.log("MFA Response:", response);
      if (response) {
        // MFA successful
        setShowMFA(false);
        setPendingEmail("");
        setPendingPassword("");
        localStorage.setItem("authToken", response.access_token);
        localStorage.setItem("tokenType", response.token_type);
        const user = response.user || {};
        setUser(user);
        console.log(user);
        setShowLogin(false);
        setShowMFA(false);
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
    console.log("Showing login modal");
    setShowLogin(true);
  };

  const handleLoginModalClose = () => setShowLogin(false);

  const handleLoginSubmit = async ({ email, password }) => {
    try{
      const loginResponse = await UserAPI.login(email, password);
      console.log(loginResponse)
      if (loginResponse.mfa_required){
        setShowLogin(false);
        setPendingEmail(email);
        setPendingPassword(password);
        handleShowMFA();
        return;
      }
      localStorage.setItem("authToken", loginResponse.access_token);
      localStorage.setItem("tokenType", loginResponse.token_type);
      const user = loginResponse.user || {};
      setUser(user);
      showSuccess(`Welcome back, ${user.display_name}`);
      setShowLogin(false);
    }catch (e) {
      showError(e.message || "Login failed. Please try again.");
    }
  };

  const handleForgotPassword = (email) => {
    setShowLogin(false);
    setShowPasswordResetModal(true);
  };

  const onEmailChange = (e) => {
    setPasswordResetEmail(e.target.value);
  };

  // Password reset logic for modal
  const passwordResetApi = {
    request: async (email) => {
      const res = await UserAPI.resetPassword(email);
      console.log(res);
      if (res.debug_token) setDevMode(true);
      return res;
    },
    verify: async () => {
      // No API call for step 2; always succeed (just UI step)
      return { success: true };
    },
    setPassword: async ({ code, newPassword }) => {
      // Step 3: Pass code (token) and new password to backend
      const res = await UserAPI.resetPasswordVerify(code, newPassword);
      if (res && (res.message || res.success)) return { success: true };
      return { success: false, message: res?.message || "Failed to reset password." };
    },
  };
  return (
    <>
    <Dropdown.Menu>
      <Dropdown.Item id="loginBtn" onClick={handleShowLogin}>
        <i className="bi bi-box-arrow-in-right me-2"></i>Login
      </Dropdown.Item>
      <Dropdown.Item id="registerBtn" onClick={handleShowRegister}>
        <i className="bi bi-person-plus me-2"></i>Sign Up
      </Dropdown.Item>
      <Dropdown.Divider />
      <Dropdown.Item id="themeToggleBtnUser" onClick={toggleTheme}>
        <ThemeToggle idPrefix="userMenu" />
      </Dropdown.Item>
    </Dropdown.Menu>
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
    <PasswordResetModal
      show={showPasswordResetModal}
      onHide={() => setShowPasswordResetModal(false)}
      onReset={passwordResetApi}
      devMode={devMode}
    />
    <RegisterModal
      show={showRegister}
      onHide={handleHideRegister}
      onRegister={handleRegister}
      error={registerError}
    />
    </>
  );
}

export default UserMenuLoggedOut;
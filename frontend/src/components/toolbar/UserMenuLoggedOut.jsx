import React, { useState, useEffect } from "react";
import { Dropdown } from "react-bootstrap";
import ThemeToggle from "./ThemeToggle";
import { toggleTheme, useTheme } from "../../context/ThemeProvider";
import RegisterModal from "../modals/RegisterModal";
import UserSettingsModal from "../modals/UserSettingsModal";
import UserAPI from "../../api/userApi";
import { useNotification } from "../NotificationProvider";
import { useAuth } from "../../context/AuthProvider";

function UserMenuLoggedOut() {
  const { toggleTheme } = useTheme();
  const {
    setUser,
    login,
    setShowLoginModal,
    setShowMFAModal,
    pendingEmail,
    setPendingEmail,
    pendingPassword,
    setPendingPassword,
    mfaLoading,
    mfaError,
    verifyMFA,
  } = useAuth();
  const { showSuccess, showError } = useNotification();
  const [showRegister, setShowRegister] = useState(false);
  const [registerError, setRegisterError] = useState("");

  const [showDictionaryModal, setShowDictionaryModal] = useState(false);


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
        setShowLogin(true);
      })
      .catch((error) => {
        console.error("Registration error:", error);
        setRegisterError(error.message || "Registration failed.");
      });
  }

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

  const handleDictionary = () => {
    setShowDictionaryModal(true);
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
      <Dropdown.Divider />
      <Dropdown.Item id="dictionaryBtn" onClick={handleDictionary}>
        <i className="bi bi-book me-2"></i>Dictionary
      </Dropdown.Item>
      <Dropdown.Divider />
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
      defaultActiveKey="dictionary"
      activeTab="dictionary"
      setActiveTab={() => {}} // No-op for guest users
      guestMode={true}
    />
    </>
  );
}

export default UserMenuLoggedOut;
/**
 * Simplified Auth Context and Hook
 * Uses AuthService for all operations and provides React state management
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import AuthService from '@/services/core/AuthService';
import UserAPI from '@/api/userApi';
import LoginModal from '../components/auth/modals/LoginModal.jsx';
import SSORegisterModal from '../components/auth/modals/SSORegisterModal.jsx';
import VerifyMFAModal from '../components/security/modals/VerifyMFAModal.jsx';
import PasswordResetModal from '../components/auth/modals/PasswordResetModal.jsx';
import LogoutProgressModal from '../components/LogoutProgressModal.jsx';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // Auth state from service
  const [authState, setAuthState] = useState(AuthService.getAuthState());
  const [isInitializing, setIsInitializing] = useState(true);

  // Modal states
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showMFAModal, setShowMFAModal] = useState(false);
  const [showPasswordResetModal, setShowPasswordResetModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showSSORegisterModal, setShowSSORegisterModal] = useState(false);
  const [ssoRegisterError, setSSORegisterError] = useState('');

  // SSO linking state
  const [ssoEmail, setSsoEmail] = useState(null);
  const [ssoIssuer, setSsoIssuer] = useState(null);

  // MFA state
  const [pendingEmail, setPendingEmail] = useState("");
  const [pendingPassword, setPendingPassword] = useState("");
  const [mfaLoading, setMFALoading] = useState(false);
  const [mfaError, setMFAError] = useState("");

  // Other UI state
  const [loginEmail, setLoginEmail] = useState("");
  const [devMode, setDevMode] = useState(false);
  const [logoutConfig, setLogoutConfig] = useState(null);

  // Settings state
  const [autosaveEnabled, setAutosaveEnabledState] = useState(() => {
    const saved = localStorage.getItem("autosaveEnabled");
    return saved === null ? true : saved === "true";
  });
  const [syncPreviewScrollEnabled, setSyncPreviewScrollEnabledState] = useState(() => {
    const saved = localStorage.getItem("syncPreviewScrollEnabled");
    return saved === null ? true : saved === "true";
  });
  const [autoCommitEnabled, setAutoCommitEnabledState] = useState(() => {
    const saved = localStorage.getItem("autoCommitEnabled");
    return saved === null ? true : saved === "true";
  });
  const [tabPosition, setTabPositionState] = useState(() => {
    return localStorage.getItem("tabPosition") || "above";
  });
  const [tabSortOrder, setTabSortOrderState] = useState(() => {
    return localStorage.getItem("tabSortOrder") || "name";
  });
  const [recentsTabLimit, setRecentsTabLimitState] = useState(() => {
    const saved = localStorage.getItem("recentsTabLimit");
    return saved ? parseInt(saved, 10) : 10;
  });

  // Update auth state when service state changes
  const updateAuthState = useCallback(() => {
    setAuthState(AuthService.getAuthState());
  }, []);

  // Initialize and set up auth state synchronization
  useEffect(() => {
    const initializeAuth = async () => {
      console.log('AuthContext: Waiting for AuthService initialization');
      await AuthService.waitForInitialization();
      console.log('AuthContext: AuthService initialization complete');
      updateAuthState();
      setIsInitializing(false);

      // Check if SSO detected an unlinked account
      const state = AuthService.getAuthState();
      if (state.ssoEmail) {
        setSsoEmail(state.ssoEmail);
        setSsoIssuer(state.ssoIssuer || '');
        setShowSSORegisterModal(true);
      }
    };

    initializeAuth();

    // Listen for forced logout from API layer (e.g. token refresh failure)
    const logoutHandler = () => {
      AuthService.performLogout();
      updateAuthState();
    };
    window.addEventListener('logout', logoutHandler);

    // Listen for legacy password reset events if needed
    const handler = (_e) => {
      // Handle password reset token from legacy JS if applicable
      setShowPasswordResetModal(true);
    };
    window.addEventListener("passwordResetTokenFound", handler);
    return () => {
      window.removeEventListener('logout', logoutHandler);
      window.removeEventListener("passwordResetTokenFound", handler);
    };
  }, [updateAuthState]);

  // Auth actions
  const login = useCallback(async (email, password) => {
    try {
      const result = await AuthService.login(email, password);

      if (result.mfaRequired) {
        setShowLoginModal(false);
        setPendingEmail(email);
        setPendingPassword(password);
        setShowMFAModal(true);
        return result;
      }

      if (result.success) {
        setShowLoginModal(false);
        setLoginEmail("");
        updateAuthState();
      }

      return result;
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: error.message };
    }
  }, [updateAuthState]);

  const handleSSORegister = useCallback(async (formData) => {
    try {
      setSSORegisterError('');
      await UserAPI.register(formData);
      setShowSSORegisterModal(false);
      setSsoEmail(null);
      setSsoIssuer(null);
      AuthService.clearSsoState();
      // After registration, show login modal so user can sign in
      setLoginEmail(formData.email || '');
      setShowLoginModal(true);
    } catch (error) {
      console.error('SSO registration error:', error);
      setSSORegisterError(error.message || 'Registration failed.');
    }
  }, []);

  const handleDismissSSORegister = useCallback(() => {
    setShowSSORegisterModal(false);
    setSsoEmail(null);
    setSsoIssuer(null);
    AuthService.clearSsoState();
  }, []);

  const verifyMFA = useCallback(async (code) => {
    setMFALoading(true);
    setMFAError("");

    try {
      const result = await AuthService.verifyMFA(pendingEmail, pendingPassword, code);

      if (result.success) {
        setShowMFAModal(false);
        setPendingEmail("");
        setPendingPassword("");
        updateAuthState();
      } else {
        setMFAError(result.message || "Verification failed.");
      }

      return result;
    } catch (error) {
      const errorMsg = error.message || "Verification failed.";
      setMFAError(errorMsg);
      return { success: false, message: errorMsg };
    } finally {
      setMFALoading(false);
    }
  }, [pendingEmail, pendingPassword, updateAuthState]);

  const logout = useCallback(async () => {
    const result = await AuthService.logout();

    if (result.delayed) {
      setLogoutConfig(result);
      setShowLogoutModal(true);
      return;
    }

    if (result.success) {
      updateAuthState();
    }
  }, [updateAuthState]);

  const forceLogout = useCallback(async () => {
    AuthService.performLogout();
    setShowLogoutModal(false);
    updateAuthState();
  }, [updateAuthState]);

  const cancelLogout = useCallback(() => {
    setShowLogoutModal(false);
    setLogoutConfig(null);
  }, []);

  const updateProfile = useCallback(async (profileData) => {
    const result = await AuthService.updateProfile(profileData);
    updateAuthState();
    return result;
  }, [updateAuthState]);

  const updatePassword = useCallback(async (currentPassword, newPassword) => {
    return await AuthService.updatePassword(currentPassword, newPassword);
  }, []);

  const deleteAccount = useCallback(async () => {
    const result = await AuthService.deleteAccount();
    updateAuthState();
    return result;
  }, [updateAuthState]);

  const enableMFA = useCallback(async (password, code) => {
    const result = await AuthService.enableMFA(password, code);
    updateAuthState();
    return result;
  }, [updateAuthState]);

  const disableMFA = useCallback(async (password, code) => {
    const result = await AuthService.disableMFA(password, code);
    updateAuthState();
    return result;
  }, [updateAuthState]);

  const requestPasswordReset = useCallback(async (email) => {
    const result = await AuthService.requestPasswordReset(email);
    if (result.debug_token) setDevMode(true);
    return result;
  }, []);

  const confirmPasswordReset = useCallback(async (token, newPassword) => {
    return await AuthService.confirmPasswordReset(token, newPassword);
  }, []);

  const forceRefreshToken = useCallback(async () => {
    const result = await AuthService.forceRefresh();
    if (result.success) {
      updateAuthState();
    }
    return result;
  }, [updateAuthState]);

  // Settings handlers
  const setAutosaveEnabled = useCallback(async (value) => {
    setAutosaveEnabledState(value);
    await AuthService.updateSetting('autosaveEnabled', value);
  }, []);

  const setSyncPreviewScrollEnabled = useCallback(async (value) => {
    setSyncPreviewScrollEnabledState(value);
    await AuthService.updateSetting('syncPreviewScrollEnabled', value);
  }, []);

  const setAutoCommitEnabled = useCallback(async (value) => {
    setAutoCommitEnabledState(value);
    await AuthService.updateSetting('autoCommitEnabled', value);
    // Also update the git settings via the API
    try {
      const documentsApi = (await import('../api/documentsApi')).default;
      await documentsApi.updateGitSettings({
        auto_commit_on_save: value
      });
    } catch (error) {
      console.error('Failed to update git auto-commit setting:', error);
    }
  }, []);

  const setTabPosition = useCallback(async (value) => {
    setTabPositionState(value);
    await AuthService.updateSetting('tabPosition', value);
  }, []);

  const setTabSortOrder = useCallback(async (value) => {
    setTabSortOrderState(value);
    await AuthService.updateSetting('tabSortOrder', value);
  }, []);

  const setRecentsTabLimit = useCallback(async (value) => {
    const clamped = Math.max(1, Math.min(25, parseInt(value, 10) || 10));
    setRecentsTabLimitState(clamped);
    await AuthService.updateSetting('recentsTabLimit', clamped);
  }, []);

  // Password reset API for modal
  const passwordResetApi = {
    request: requestPasswordReset,
    verify: async () => ({ success: true }), // UI step only
    setPassword: async ({ code, newPassword }) => {
      const res = await confirmPasswordReset(code, newPassword);
      return res && (res.message || res.success)
        ? { success: true }
        : { success: false, message: res?.message || "Failed to reset password." };
    },
  };

  const contextValue = {
    // Auth state
    user: authState.user,
    token: authState.token,
    isAuthenticated: authState.isAuthenticated,
    isInitializing,

    // Auth actions
    login,
    logout,
    updateProfile,
    updatePassword,
    deleteAccount,
    enableMFA,
    disableMFA,
    requestPasswordReset,
    confirmPasswordReset,
    forceRefreshToken,

    // Settings
    autosaveEnabled,
    setAutosaveEnabled,
    syncPreviewScrollEnabled,
    setSyncPreviewScrollEnabled,
    autoCommitEnabled,
    setAutoCommitEnabled,
    tabPosition,
    setTabPosition,
    tabSortOrder,
    setTabSortOrder,
    recentsTabLimit,
    setRecentsTabLimit,

    // Modal controls
    showLoginModal,
    setShowLoginModal,
    showMFAModal,
    setShowMFAModal,
    loginEmail,
    setLoginEmail,
    pendingEmail,
    setPendingEmail,
    pendingPassword,
    setPendingPassword,
    mfaLoading,
    mfaError,
    verifyMFA,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}

      {/* Auth Modals */}
      <LoginModal
        show={showLoginModal}
        onHide={() => setShowLoginModal(false)}
        onForgotPassword={() => {
          setShowLoginModal(false);
          setShowPasswordResetModal(true);
        }}
        onLogin={login}
        email={loginEmail}
      />

      <VerifyMFAModal
        show={showMFAModal}
        onHide={() => setShowMFAModal(false)}
        onVerify={verifyMFA}
        loading={mfaLoading}
        error={mfaError}
        onBack={() => {
          setShowMFAModal(false);
          setShowLoginModal(true);
        }}
      />

      <PasswordResetModal
        show={showPasswordResetModal}
        onHide={() => {
          setShowPasswordResetModal(false);
          setShowLoginModal(true);
        }}
        onReset={passwordResetApi}
        devMode={devMode}
      />

      <LogoutProgressModal
        show={showLogoutModal}
        onForceLogout={forceLogout}
        onCanceled={cancelLogout}
        config={logoutConfig}
      />

      <SSORegisterModal
        show={showSSORegisterModal}
        onHide={handleDismissSSORegister}
        onRegister={handleSSORegister}
        email={ssoEmail || ''}
        issuer={ssoIssuer || ''}
        error={ssoRegisterError}
      />
    </AuthContext.Provider>
  );
}

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export { AuthService };

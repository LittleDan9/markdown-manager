import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from "react";
import DocumentManager from "../storage/DocumentManager";
import StorageMigration from "../storage/StorageMigration";
import UserAPI from "../api/userApi.js";
import CustomDictionarySyncService from "../services/CustomDictionarySyncService";
import LogoutProgressModal from "../components/LogoutProgressModal";
import PropTypes from "prop-types";
import config from "../config.js";
import LoginModal from "../components/modals/LoginModal";
import VerifyMFAModal from "../components/modals/VerifyMFAModal";
import PasswordResetModal from "../components/modals/PasswordResetModal";

const defaultUser = {
  bio: "",
  created_at: "",
  display_name: "Guest",
  email: "",
  first_name: "",
  full_name: "",
  id: -1,
  is_active: false,
  is_verified: false,
  last_name: "",
  mfa_enabled: false,
  updated_at: "",
};

const AuthContext = createContext({
  user: defaultUser,
  token: null,
  isAuthenticated: false,
  setUser: () => {},
  setToken: () => {},
  login: async () => {},
  logout: async () => {},
  register: async () => {},
  updateProfile: async () => {},
  updatePassword: async () => {},
  deleteAccount: async () => {},
  requestPasswordReset: async () => {},
  confirmPasswordReset: async () => {},
});


export function AuthProvider({ children }) {
  // Track if we just logged in or registered to avoid duplicate fetchCurrentUser
  const justLoggedInRef = useRef(false);
  const [logoutModalConfig, setLogoutModalConfig] = useState(null);
  // Auth modals state
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showMFAModal, setShowMFAModal] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [pendingPassword, setPendingPassword] = useState("");
  const [mfaLoading, setMFALoading] = useState(false);
  const [mfaError, setMFAError] = useState("");
  const [showPasswordResetModal, setShowPasswordResetModal] = useState(false);
  const [devMode, setDevMode] = useState(false);

  // Listen for passwordResetTokenFound event from legacy JS
  useEffect(() => {
    const handler = (e) => {
      setPasswordResetToken(e.detail.resetToken);
      setShowPasswordResetVerify(true);
    };
    window.addEventListener("passwordResetTokenFound", handler);
    return () => window.removeEventListener("passwordResetTokenFound", handler);
  }, []);
  // Profile settings state
  // Set user getter for DocumentSyncService (for context-driven sync)
  useEffect(() => {
    if (!justLoggedInRef.current) {
      const detail = {user, token, isAuthenticated};
      window.dispatchEvent(new CustomEvent('auth:changed', { detail }));
    }
  }, [user, isAuthenticated, token]);


  const [autosaveEnabled, setAutosaveEnabledState] = useState(() => {
    const saved = localStorage.getItem("autosaveEnabled");
    return saved === null ? true : saved === "true";
  });
  const [syncPreviewScrollEnabled, setSyncPreviewScrollEnabledState] = useState(() => {
    const saved = localStorage.getItem("syncPreviewScrollEnabled");
    return saved === null ? true : saved === "true";
  });
  // Ensure DocumentManager sync service is authenticated after reload if token and user are valid (not defaultUser)
  useEffect(() => {
    if (
      token &&
      typeof user === 'object' &&
      user !== null &&
      typeof user.id !== 'undefined' &&
      user.id !== -1 &&
      user.display_name !== 'Guest'
    ) {
      DocumentManager.handleLogin(token);
    }
  }, [token, user]);
  const [user, setUserState] = useState(defaultUser);
  const [token, setTokenState] = useState(localStorage.getItem("authToken"));
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Initialize DocumentManager on first load
  useEffect(() => {
    const initializeStorage = async () => {
      // Check if migration is needed
      if (!StorageMigration.isMigrationComplete()) {
        try {
          const migrationResult = await StorageMigration.migrateFromOldSystem();
          if (!migrationResult.success) {
            console.error('Storage migration failed:', migrationResult.message);
          } else {
            console.log('Storage migration completed successfully');
          }
        } catch (error) {
          console.error('Storage migration error:', error);
        }
      }

      // Initialize the document manager
      await DocumentManager.initialize();
      DocumentManager.handleLogin(token);
    };

    initializeStorage();
  }, []);

  // Listen for logout pending events from DocumentManager
  useEffect(() => {
    const handleLogoutPending = (event) => {
      console.log('Logout pending event received:', event.detail);
      setShowLogoutModal(true);
    };

    window.addEventListener('markdown-manager:logout-pending', handleLogoutPending);

    return () => {
      window.removeEventListener('markdown-manager:logout-pending', handleLogoutPending);
    };
  }, []);

  // Helper to update token in state and localStorage
  const setToken = useCallback((newToken) => {
    const oldToken = token;
    setTokenState(newToken);
    if (newToken) {
      localStorage.setItem("authToken", newToken);
      // If token changed and we have a user, notify DocumentManager
      if (oldToken !== newToken && user && user.id !== -1) {
        DocumentManager.handleTokenRefresh(newToken);
      }
    } else {
      localStorage.removeItem("authToken");
    }
  }, [token, user]);

  // Helper to update user state
  const setUser = useCallback((value) => {
    console.log('[AuthProvider] setUser called', value);
    if (value == null) {
      setUserState(defaultUser);
    } else {
      const displayName = value.display_name?.trim();
      if (!displayName) {
        value.display_name = `${value.first_name || ""} ${value.last_name || ""}`.trim();
      }
      setUserState(value);
    }
  }, []);


  // Auth actions
  const login = useCallback(async (email, password) => {
    const loginResponse = await UserAPI.login(email, password);
    if (loginResponse.mfa_required) {
      setShowLoginModal(false);
      setPendingEmail(email);
      setPendingPassword(password);
      setShowMFAModal(true);
      return loginResponse;
    }
    justLoggedInRef.current = true;
    setToken(loginResponse.access_token);
    setUser(loginResponse.user || defaultUser);
    await fetchCurrentUser(loginResponse.access_token);
    window.dispatchEvent(new CustomEvent('auth:login', {
      detail: {
        user: loginResponse.user,
        token: loginResponse.access_token
      }
    }));
    try {
      await CustomDictionarySyncService.syncAfterLogin();
    } catch (error) {
      console.error('Dictionary sync failed after login:', error);
    }
    setShowLoginModal(false);
    setLoginEmail("");
    justLoggedInRef.current = false;
    return loginResponse;
  }, [setToken, fetchCurrentUser]);
  // MFA verification handler
  const verifyMFA = useCallback(async (code) => {
    setMFALoading(true);
    setMFAError("");
    try {
      const response = await UserAPI.loginMFA(pendingEmail, pendingPassword, code);
      if (response) {
        setShowMFAModal(false);
        setPendingEmail("");
        setPendingPassword("");
        setToken(response.token);
        justLoggedInRef.current = true;
        await fetchCurrentUser(response.token);
        window.dispatchEvent(new CustomEvent('auth:login', { detail: { user, token } }));
        try {
          await CustomDictionarySyncService.syncAfterLogin();
        } catch (error) {
          console.error('Dictionary sync failed after MFA login:', error);
        }
      } else {
        setMFAError(response.message || "Verification failed.");
      }
    } catch (error) {
      setMFAError(error.message || "Verification failed.");
    } finally {
      setMFALoading(false);
    }
  }, [pendingEmail, pendingPassword, setToken, fetchCurrentUser]);

  const loginMFA = useCallback(async (email, password, code) => {
    const data = await UserAPI.loginMFA(email, password, code);
    setToken(data.token);
    justLoggedInRef.current = true;
    await fetchCurrentUser(data.token);

    // Initialize DocumentManager with authentication
    await DocumentManager.handleLogin(data.token);

    // Sync custom dictionary after successful MFA login
    try {
      await CustomDictionarySyncService.syncAfterLogin();
    } catch (error) {
      console.error('Dictionary sync failed after MFA login:', error);
      // Don't fail the login process if dictionary sync fails
    }

    return data;
  }, [setToken, fetchCurrentUser]);

  const register = useCallback(async (formData) => {
    const data = await UserAPI.register(formData);
    setToken(data.token);
    justLoggedInRef.current = true;
    await fetchCurrentUser(data.token);

    // Initialize DocumentManager with authentication
    await DocumentManager.handleLogin(data.token);

    // Sync custom dictionary after successful registration
    try {
      await CustomDictionarySyncService.syncAfterLogin();
    } catch (error) {
      console.error('Dictionary sync failed after registration:', error);
      // Don't fail the registration process if dictionary sync fails
    }

    return data;
  }, [setToken, fetchCurrentUser]);

  const logout = useCallback(async () => {
    // Try normal logout first (will show modal if sync pending)
    let delayLogoutReceived = false;
    let modalConfig = null;

    const handleDelayLogout = (event) => {
      delayLogoutReceived = true;
      modalConfig = event.detail;
      setLogoutModalConfig(modalConfig);
      setShowLogoutModal(true);
      window.removeEventListener('auth:delayLogout', handleDelayLogout);
    };

    window.addEventListener('auth:delayLogout', handleDelayLogout);
    window.dispatchEvent(new CustomEvent('auth:logout'));

    setTimeout(() => {
      window.removeEventListener('auth:delayLogout', handleDelayLogout);
      if (!delayLogoutReceived) {
        setToken(null);
        setUser(defaultUser);
        // CustomDictionarySyncService.clearLocal(); Should listen for the logout-comp event instead
      }
    }, 500);
    // If logout was deferred due to pending sync, the modal will handle it
  }, []);

  const performLogout = useCallback(() => {
    setToken(null);
    setUser(defaultUser);
    window.dispatchEvent(new CustomEvent('auth:logout-complete'));
  }, [setToken, setUser]);

  // Handle force logout from the modal
  const handleForceLogout = useCallback(async () => {
    setShowLogoutModal(false);

    // Clear auth state immediately
    setToken(null);
    setUser(null);

    // DocumentManager.forceLogout() will be called by the modal's force-logout event
  }, [setToken, setUser]);

  // Handle logout cancellation
  const handleLogoutCanceled = useCallback(() => {
    setShowLogoutModal(false);
  }, []);

  const fetchCurrentUser = useCallback(async (overrideToken = null) => {
    console.log('[AuthProvider] fetchCurrentUser called with token:', overrideToken || token);
    const userData = await UserAPI.getCurrentUser(overrideToken || token);
    if (!userData || !userData.id) {
      setUser(null);
      return null;
    }
    // Only update if user data actually changed
    if (JSON.stringify(userData) !== JSON.stringify(user)) {
      setUser(userData);
    }
    return userData;
  }, [token, setUser, user]);

  const updateProfile = useCallback(async (profileData) => {
    const data = await UserAPI.updateProfileInfo(profileData);
    setUser(data);
    return data;
  }, [setUser]);

  const updatePassword = useCallback(async (current_password, new_password) => {
    return await UserAPI.updatePassword(current_password, new_password);
  }, []);

  const deleteAccount = useCallback(async () => {
    const data = await UserAPI.deleteAccount();
    await logout();
    return data;
  }, [logout]);

  const requestPasswordReset = useCallback(async (email) => {
    return await UserAPI.resetPassword(email);
  }, []);

  const confirmPasswordReset = useCallback(async (token, new_password) => {
    return await UserAPI.resetPasswordVerify(token, new_password);
  }, []);

  // On mount, fetch user if token exists and load profile settings
  useEffect(() => {
    if (token) {
      if (justLoggedInRef.current) {
        justLoggedInRef.current = false;
        // Skip fetchCurrentUser here, just did it after login/register
        return;
      }
      fetchCurrentUser(token).then((user) => {
        // Only call logout if token exists and is invalid
        if (!user) {
          logout();
        } else {
          // Load profile settings from user profile if available
          if (user.sync_preview_scroll_enabled !== undefined) {
            setSyncPreviewScrollEnabledState(Boolean(user.sync_preview_scroll_enabled));
          }
          if (user.autosave_enabled !== undefined) {
            setAutosaveEnabledState(Boolean(user.autosave_enabled));
          }
        }
      });
    } else {
      // No token: do not call logout, just set user to null
      setUser(null);
    }
  }, [token, fetchCurrentUser, setUser, logout]);


  // Sync profile settings to localStorage and backend
  useEffect(() => {
    localStorage.setItem("autosaveEnabled", autosaveEnabled);
    if (isAuthenticated) {
      UserAPI.updateProfileInfo({ autosave_enabled: autosaveEnabled });
    }
  }, [autosaveEnabled, isAuthenticated]);

  useEffect(() => {
    localStorage.setItem("syncPreviewScrollEnabled", syncPreviewScrollEnabled);
    if (isAuthenticated) {
      UserAPI.updateProfileInfo({ sync_preview_scroll_enabled: syncPreviewScrollEnabled });
    }
  }, [syncPreviewScrollEnabled, isAuthenticated]);

  const isAuthenticated = !!token && user && user.id !== -1;

  const contextValue = useMemo(() => ({
    user,
    token,
    isAuthenticated,
    setUser,
    setToken,
    login,
    loginMFA,
    register,
    logout,
    updateProfile,
    updatePassword,
    deleteAccount,
    requestPasswordReset,
    confirmPasswordReset,
    autosaveEnabled,
    setAutosaveEnabled: setAutosaveEnabledState,
    syncPreviewScrollEnabled,
    setSyncPreviewScrollEnabled: setSyncPreviewScrollEnabledState,
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
  }), [user, token, isAuthenticated, setUser, setToken, login, loginMFA, register, logout, updateProfile, updatePassword, deleteAccount, requestPasswordReset, confirmPasswordReset, autosaveEnabled, syncPreviewScrollEnabled, showLoginModal, showMFAModal, loginEmail, pendingEmail, pendingPassword, mfaLoading, mfaError, verifyMFA]);
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
    <AuthContext.Provider value={contextValue}>
      {children}
      <LogoutProgressModal
        show={showLogoutModal}
        onForceLogout={handleForceLogout}
        onCanceled={handleLogoutCanceled}
      />
      {/* Auth modals */}
      <PasswordResetModal
        show={showPasswordResetModal}
        onHide={() => {
          setShowPasswordResetModal(false);
          setShowLoginModal(true);
        }}
        onReset={passwordResetApi}
        devMode={devMode}
      />
      <LoginModal
        show={showLoginModal}
        onHide={() => setShowLoginModal(false)}
        onForgotPassword={() => setShowPasswordResetModal(true)}
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

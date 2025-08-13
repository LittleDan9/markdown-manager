import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from "react";
import DocumentService from "../services/DocumentService";
import UserAPI from "../api/userApi.js";
import DictionaryService from "@/services/DictionaryService";
import LogoutProgressModal from "../components/LogoutProgressModal";
import PropTypes from "prop-types";
import config from "../config.js";
import LoginModal from "../components/modals/LoginModal";
import VerifyMFAModal from "../components/modals/VerifyMFAModal";
import PasswordResetModal from "../components/modals/PasswordResetModal";
import { notification } from "@/services/EventDispatchService.js";
import DocumentStorageService from "@/services/DocumentStorageService.js";

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

// Recovery utility functions
const checkForRecoveryDocuments = async (userId, token) => {
  try {
    const RecoveryApi = (await import("../api/recoveryApi.js")).default;
    const recoveredDocs = await RecoveryApi.fetchRecoveredDocs(userId, token);
    if (recoveredDocs && recoveredDocs.length > 0) {
      window.dispatchEvent(new CustomEvent('showRecoveryModal', { detail: recoveredDocs }));
    }
  } catch (error) {
    console.error('Failed to check for recovery documents:', error);
  }
};

const checkForOrphanedDocuments = async () => {
  try {
    const localDocs = JSON.parse(localStorage.getItem('markdown_manager_documents') || '[]');
    const lastKnownAuth = localStorage.getItem('lastKnownAuthState');

    // If we have local documents but no auth token, they might be orphaned
    if (localDocs.length > 0 && !localStorage.getItem('authToken') && lastKnownAuth === 'authenticated') {
      const orphanedDocs = localDocs
        .filter(doc => doc.content && doc.content.trim() !== '' && doc.name !== 'Untitled Document')
        .map(doc => ({
          id: `orphaned_${doc.id}_${Date.now()}`,
          document_id: doc.id,
          name: doc.name,
          category: doc.category,
          content: doc.content,
          collision: false,
          recoveredAt: new Date().toISOString(),
          conflictType: 'orphaned'
        }));

      if (orphanedDocs.length > 0) {
        // Delay to ensure UI is ready
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('showRecoveryModal', { detail: orphanedDocs }));
        }, 2000);
      }
    }

    // Update last known auth state
    localStorage.setItem('lastKnownAuthState', 'unauthenticated');
  } catch (error) {
    console.error('Failed to check for orphaned documents:', error);
  }
};

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

  useEffect(() => {
    let refreshInterval = null;
    async function doRefresh() {
      // Only attempt refresh if we have a valid token
      if (!token || token.trim() === '') {
        return;
      }

      try {
        const res = await UserAPI.refreshToken();
        if (res && res.access_token) {
          setToken(res.access_token);
        }
      } catch (err) {
        // If refresh fails, log out
        setToken(null);
        setUser(null);
      }
    }
    if (isAuthenticated) {
      // Start timer
      refreshInterval = setInterval(doRefresh, 60 * 60 * 1000); // 1 hour
      // Immediate refresh on auth
      doRefresh();
    }
    return () => {
      if (refreshInterval) clearInterval(refreshInterval);
    };
  }, [isAuthenticated, token]); // Add token dependency

  const [autosaveEnabled, setAutosaveEnabledState] = useState(() => {
    const saved = localStorage.getItem("autosaveEnabled");
    return saved === null ? true : saved === "true";
  });
  const [syncPreviewScrollEnabled, setSyncPreviewScrollEnabledState] = useState(() => {
    const saved = localStorage.getItem("syncPreviewScrollEnabled");
    return saved === null ? true : saved === "true";
  });
    // DocumentService automatically handles auth state via events
  const [user, setUserState] = useState(defaultUser);
  const [token, setTokenState] = useState(localStorage.getItem("authToken"));
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Initialize DocumentService on first load and check for recovery
  useEffect(() => {
    const initializeStorage = async () => {
      // DocumentService automatically initializes, no manual setup needed

      // Check for orphaned local documents on app startup
      checkForOrphanedDocuments();
    };

    initializeStorage();
  }, []);

  // Network reconnection recovery trigger
  useEffect(() => {
    const handleOnline = () => {
      if (isAuthenticated && user && user.id !== -1) {
        console.log('Network reconnected, checking for recovery documents...');
        setTimeout(() => {
          checkForRecoveryDocuments(user.id, token);
        }, 1000);
      }
    };

    const handleVisibilityChange = () => {
      if (!document.hidden && isAuthenticated && user && user.id !== -1) {
        console.log('App regained focus, checking for recovery documents...');
        setTimeout(() => {
          checkForRecoveryDocuments(user.id, token);
        }, 500);
      }
    };

    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isAuthenticated, user, token]);

  // Track authentication state changes for recovery
  useEffect(() => {
    if (isAuthenticated && user && user.id !== -1) {
      localStorage.setItem('lastKnownAuthState', 'authenticated');
    }
  }, [isAuthenticated, user]);

  // Note: DocumentService handles logout events automatically

  // Helper to update token in state and localStorage
  const setToken = useCallback((newToken) => {
    const oldToken = token;
    setTokenState(newToken);
    if (newToken) {
      localStorage.setItem("authToken", newToken);
      // DocumentService listens for auth events automatically
    } else {
      localStorage.removeItem("authToken");
    }
  }, [token, user]);

  // Helper to update user state
  const setUser = useCallback((value) => {
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
    window.dispatchEvent(new CustomEvent('auth:login', {
      detail: {
        user: loginResponse.user,
        token: loginResponse.access_token
      }
    }));
    try {
      await DictionaryService.syncAfterLogin();
    } catch (error) {
      console.error('Dictionary sync failed after login:', error);
    }

    // Trigger recovery check after successful login
    setTimeout(() => {
      checkForRecoveryDocuments(loginResponse.user.id, loginResponse.access_token);
    }, 1000);

    setShowLoginModal(false);
    setLoginEmail("");
    justLoggedInRef.current = false;
    return loginResponse;
  }, [setToken]);
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
        setToken(response.access_token);
        setUser(response.user || defaultUser);
        justLoggedInRef.current = true;
        window.dispatchEvent(new CustomEvent('auth:login', { detail: { user: response.user, token: response.access_token } }));
        try {
          await DictionaryService.syncAfterLogin();
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
  }, [pendingEmail, pendingPassword, setToken, setUser]);


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

    setTimeout(async () => {
      window.removeEventListener('auth:delayLogout', handleDelayLogout);
      if (!delayLogoutReceived) {
        // Call backend to clear refresh token cookie
        await UserAPI.logout();
        performLogout();
      }
    }, 500);
    // If logout was deferred due to pending sync, the modal will handle it
  }, [performLogout]);

  const performLogout = useCallback(() => {
    window.dispatchEvent(new CustomEvent('auth:logout-complete'));
    DocumentStorageService.clearAllData();
    setToken(null);
    setUser(defaultUser);
    // Mark auth state as unauthenticated for recovery tracking
    localStorage.setItem('lastKnownAuthState', 'unauthenticated');
  }, [setToken, setUser]);

  // Handle force logout from the modal
  const handleForceLogout = useCallback(async () => {
    setShowLogoutModal(false);

    // Clear auth state immediately
    performLogout();

    // DocumentService handles logout automatically
  }, [performLogout]);

  // Handle logout cancellation
  const handleLogoutCanceled = useCallback(() => {
    setShowLogoutModal(false);
  }, []);

  const fetchCurrentUser = useCallback(async (overrideToken = null) => {
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

  const disableMFA = useCallback(async (password, code) => {
    try {
      await UserAPI.disableMFA(password, code);
      setUser((prevUser) => ({ ...prevUser, mfa_enabled: false }));
      notification.success("Two-factor authentication disabled successfully.");
      return true;
    } catch (error) {
      window.dispatchEvent(new CustomEvent('notification:error'));
      notification.error(error.message || "Failed to disable MFA.");
      return false;
    }
  }, [setUser]);

  const enableMFA = useCallback(async (password, code) => {
    try {
      const response = await UserAPI.enableMFA(password, code);
      if (response.success) {
        setUser((user) => ({ ...user, mfa_enabled: true }));
        notification.success("Two-factor authentication enabled successfully.");
        const codes = await UserAPI.getBackupCodes();
        return {success: true, backup_codes: codes.backup_codes};
      }
      // If we reach here, MFA enable failed
      notification.error("Failed to enable MFA.");
      return {success: false};
    } catch (err) {
      notification.error(err.message || "Failed to enable MFA.");
      return {success: false};
    }
  }, [setUser, user]);

  const requestPasswordReset = useCallback(async (email) => {
    return await UserAPI.resetPassword(email);
  }, []);

  const confirmPasswordReset = useCallback(async (token, new_password) => {
    return await UserAPI.resetPasswordVerify(token, new_password);
  }, []);

  // On mount, if no valid access token, try to refresh using refresh token cookie
  useEffect(() => {
    const tryInitialAuth = async () => {
      if (token && token.trim() !== '') {
        if (justLoggedInRef.current) {
          justLoggedInRef.current = false;
          // Skip fetchCurrentUser here, just did it after login/register
          return;
        }
        const user = await fetchCurrentUser(token);
        if (!user) {
          // Token invalid, try refresh only if we had a token
          try {
            const res = await UserAPI.refreshToken();
            if (res && res.access_token) {
              setToken(res.access_token);
              await fetchCurrentUser(res.access_token);
              return;
            }
          } catch (err) {
            // Refresh failed, log out
            logout();
            return;
          }
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
      } else {
        // No token: only try refresh if we might have a refresh cookie
        // Check if we previously had authentication
        const hadPreviousAuth = localStorage.getItem('lastKnownAuthState') === 'authenticated';

        if (hadPreviousAuth) {
          try {
            const res = await UserAPI.refreshToken();
            if (res && res.access_token) {
              setToken(res.access_token);
              await fetchCurrentUser(res.access_token);
              return;
            }
          } catch (err) {
            // Refresh failed, ensure we're in guest state
            setUser(defaultUser);
            return;
          }
        }

        // No token and no previous auth - start as guest
        setUser(defaultUser);
      }
    };
    tryInitialAuth();
  }, []); // Remove dependencies to run only on mount


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
    login,
    logout,
    enableMFA,
    disableMFA,
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
  }), [user, token, isAuthenticated, login, logout, enableMFA, disableMFA, updateProfile, updatePassword, deleteAccount, requestPasswordReset, confirmPasswordReset, autosaveEnabled, syncPreviewScrollEnabled, showLoginModal, showMFAModal, loginEmail, pendingEmail, pendingPassword, mfaLoading, mfaError, verifyMFA]);
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

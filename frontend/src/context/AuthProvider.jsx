import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from "react";
import DocumentManager from "../storage/DocumentManager";
import DocumentSyncService from "../storage/DocumentSyncService";
import StorageMigration from "../storage/StorageMigration";
import UserAPI from "../js/api/userApi.js";
import CustomDictionarySyncService from "../js/services/CustomDictionarySyncService";
import LogoutProgressModal from "../components/LogoutProgressModal";
import PropTypes from "prop-types";
import config from "../js/config.js";

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

import { useRef } from "react";

export function AuthProvider({ children }) {
  // Track if we just logged in or registered to avoid duplicate fetchCurrentUser
  const justLoggedInRef = useRef(false);
  // Profile settings state
  // Set user getter for DocumentSyncService (for context-driven sync)
  useEffect(() => {
    DocumentSyncService.setUserGetter(() => user);
    DocumentSyncService.setTokenGetter(() => token);
    DocumentSyncService.setIsAuthenticatedGetter(() => isAuthenticated);
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
    const data = await UserAPI.login(email, password);
    setToken(data.token);
    justLoggedInRef.current = true;
    await fetchCurrentUser(data.token);

    // Initialize DocumentManager with authentication
    await DocumentManager.handleLogin(data.token);

    // Sync custom dictionary after successful login
    try {
      await CustomDictionarySyncService.syncAfterLogin();
    } catch (error) {
      console.error('Dictionary sync failed after login:', error);
      // Don't fail the login process if dictionary sync fails
    }

    return data;
  }, [setToken, fetchCurrentUser]);

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
    const logoutCompleted = await DocumentManager.handleLogout();

    if (logoutCompleted) {
      // Normal logout completed
      setToken(null);
      setUser(null);

      // Clear custom dictionary when logging out
      // Keep local words for anonymous usage
      // CustomDictionarySyncService.clearLocal(); // Uncomment if you want to clear local dictionary on logout
    }
    // If logout was deferred due to pending sync, the modal will handle it
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
  }), [user, token, isAuthenticated, setUser, setToken, login, loginMFA, register, logout, updateProfile, updatePassword, deleteAccount, requestPasswordReset, confirmPasswordReset, autosaveEnabled, syncPreviewScrollEnabled]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
      <LogoutProgressModal
        show={showLogoutModal}
        onForceLogout={handleForceLogout}
        onCanceled={handleLogoutCanceled}
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

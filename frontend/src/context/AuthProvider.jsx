import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from "react";
import DocumentStorage from "../storage/DocumentStorage";
import UserAPI from "../js/api/userApi.js";
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

export function AuthProvider({ children }) {
  const [user, setUserState] = useState(defaultUser);
  const [token, setTokenState] = useState(localStorage.getItem("authToken"));

  // Helper to update token in state and localStorage
  const setToken = useCallback((newToken) => {
    setTokenState(newToken);
    if (newToken) {
      localStorage.setItem("authToken", newToken);
    } else {
      localStorage.removeItem("authToken");
    }
  }, []);

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
    const data = await UserAPI.login(email, password);
    setToken(data.token);
    await fetchCurrentUser(data.token);
    return data;
  }, [setToken, fetchCurrentUser]);

  const loginMFA = useCallback(async (email, password, code) => {
    const data = await UserAPI.loginMFA(email, password, code);
    setToken(data.token);
    await fetchCurrentUser(data.token);
    return data;
  }, [setToken, fetchCurrentUser]);

  const register = useCallback(async (formData) => {
    const data = await UserAPI.register(formData);
    setToken(data.token);
    await fetchCurrentUser(data.token);
    return data;
  }, [setToken, fetchCurrentUser]);

  const logout = useCallback(async () => {
    setToken(null);
    setUser(null);
  }, [setToken, setUser]);
    // Flush all document-related localStorage keys
    localStorage.removeItem("savedDocuments");
    localStorage.removeItem("currentDocument");
    localStorage.removeItem("documentCategories");
    localStorage.removeItem("lastDocumentId");
    DocumentStorage.setCurrentDocument(null);

  const fetchCurrentUser = useCallback(async (overrideToken = null) => {
    const userData = await UserAPI.getCurrentUser(overrideToken || token);
    if (!userData || !userData.id) {
      setUser(null);
      return null;
    }
    setUser(userData);
    return userData;
  }, [token, setUser]);

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

  // On mount, fetch user if token exists
  useEffect(() => {
    if (token) {
      fetchCurrentUser(token).then((user) => {
        if (!user) {
          logout();
        }
      });

    } else {
      setUser(null);
    }
  }, [token, fetchCurrentUser, setUser]);

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
  }), [user, token, isAuthenticated, setUser, setToken, login, loginMFA, register, logout, updateProfile, updatePassword, deleteAccount, requestPasswordReset, confirmPasswordReset]);

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
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

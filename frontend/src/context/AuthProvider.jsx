import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from "react";
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

  // API call helper
  const apiCall = useCallback(async (endpoint, method = "GET", body = null) => {
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const config = { method, headers };
    if (body) config.body = JSON.stringify(body);
    return fetch(`${config.apiBaseUrl}${endpoint}`, config);
  }, [token]);

  // Auth actions
  const login = useCallback(async (email, password) => {
    const res = await apiCall("/auth/login", "POST", { email, password });
    if (!res.ok) throw new Error("Login failed");
    const data = await res.json();
    setToken(data.token);
    await fetchCurrentUser(data.token);
    return data;
  }, [apiCall, setToken]);

  const loginMFA = useCallback(async (email, password, code) => {
    const res = await apiCall("/auth/login-mfa", "POST", { email, password, code });
    if (!res.ok) throw new Error("MFA login failed");
    const data = await res.json();
    setToken(data.token);
    await fetchCurrentUser(data.token);
    return data;
  }, [apiCall, setToken]);

  const register = useCallback(async (formData) => {
    const res = await apiCall("/auth/register", "POST", formData);
    if (!res.ok) throw new Error("Registration failed");
    const data = await res.json();
    setToken(data.token);
    await fetchCurrentUser(data.token);
    return data;
  }, [apiCall, setToken]);

  const logout = useCallback(async () => {
    setToken(null);
    setUser(null);
  }, [setToken, setUser]);

  const fetchCurrentUser = useCallback(async (overrideToken = null) => {
    const res = await fetch(`${config.apiBaseUrl}/auth/me`, {
      headers: {
        "Content-Type": "application/json",
        ...(overrideToken ? { Authorization: `Bearer ${overrideToken}` } : token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) {
      setUser(null);
      return null;
    }
    const userData = await res.json();
    setUser(userData);
    return userData;
  }, [token, setUser]);

  const updateProfile = useCallback(async (profileData) => {
    const res = await apiCall("/users/profile", "PUT", profileData);
    if (!res.ok) throw new Error("Profile update failed");
    const data = await res.json();
    setUser(data);
    return data;
  }, [apiCall, setUser]);

  const updatePassword = useCallback(async (current_password, new_password) => {
    const res = await apiCall("/users/password", "PUT", { current_password, new_password });
    if (!res.ok) throw new Error("Password update failed");
    return await res.json();
  }, [apiCall]);

  const deleteAccount = useCallback(async () => {
    const res = await apiCall("/users/account", "DELETE");
    if (!res.ok) throw new Error("Account deletion failed");
    await logout();
    return await res.json();
  }, [apiCall, logout]);

  const requestPasswordReset = useCallback(async (email) => {
    const res = await apiCall("/auth/password-reset-request", "POST", { email });
    if (!res.ok) throw new Error("Password reset request failed");
    return await res.json();
  }, [apiCall]);

  const confirmPasswordReset = useCallback(async (token, new_password) => {
    const res = await apiCall("/auth/password-reset-confirm", "POST", { token, new_password });
    if (!res.ok) throw new Error("Password reset confirm failed");
    return await res.json();
  }, [apiCall]);

  // On mount, fetch user if token exists
  useEffect(() => {
    if (token) {
      fetchCurrentUser(token);
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

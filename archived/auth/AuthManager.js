// AuthManager.js
// Handles API calls, token management, and user state for authentication flows

import config from "../config.js";

class AuthManager {
  constructor() {
    this.apiBase = config.apiBaseUrl;
    this.token = localStorage.getItem("authToken");
    this.currentUser = null;
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem("authToken", token);
    } else {
      localStorage.removeItem("authToken");
    }
  }

  getToken() {
    return this.token;
  }

  setCurrentUser(user) {
    this.currentUser = user;
    AuthUI.updateUI();
  }

  getCurrentUser() {
    return this.currentUser;
  }

  async apiCall(endpoint, method = "GET", body = null) {
    const headers = { "Content-Type": "application/json" };
    if (this.token) headers["Authorization"] = `Bearer ${this.token}`;
    const config = { method, headers };
    if (body) config.body = JSON.stringify(body);
    return fetch(`${this.apiBase}${endpoint}`, config);
  }

  async login(email, password) {
    return this.apiCall("/auth/login", "POST", { email, password });
  }

  async loginMFA(email, password, code) {
    return this.apiCall("/auth/login-mfa", "POST", { email, password, code });
  }

  async register(formData) {
    return this.apiCall("/auth/register", "POST", formData);
  }

  async logout() {
    this.setToken(null);
    this.setCurrentUser(null);
  }

  async getProfile() {
    return this.apiCall("/auth/me", "GET");
  }

  async updateProfile(profileData) {
    return this.apiCall("/users/profile", "PUT", profileData);
  }

  async updatePassword(current_password, new_password) {
    return this.apiCall("/users/password", "PUT", {
      current_password,
      new_password,
    });
  }

  async deleteAccount() {
    return this.apiCall("/users/account", "DELETE");
  }

  async requestPasswordReset(email) {
    return this.apiCall("/auth/password-reset-request", "POST", { email });
  }

  async confirmPasswordReset(token, new_password) {
    return this.apiCall("/auth/password-reset-confirm", "POST", {
      token,
      new_password,
    });
  }

  isAuthenticated() {
    return !!this.token;
  }
}

export default new AuthManager();

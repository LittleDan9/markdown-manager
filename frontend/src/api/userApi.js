import { Api } from "./api";

class UserAPI extends Api {
  // Request a new access token using the refresh token cookie
  async refreshToken() {
    try {
      // The refresh token should be sent as a cookie
      const res = await this.apiCall("/auth/refresh", "POST", null, {}, { withCredentials: true });
      return res.data;
    } catch (error) {
      // If refresh fails due to no auth (401/403), don't log error for guests
      if (error?.response?.status === 401 || error?.response?.status === 403) {
        return null;
      }
      // Log other errors (500, network issues, etc.)
      console.error("Token refresh failed:", error);
      throw error;
    }
  }
  // Verify password reset code (for step 2 in password reset flow)
  async verifyResetCode(email, code) {
    const res = await this.apiCall("/auth/password-reset-verify", "POST", { email, code });
    return res.data;
  }
  // Validate token and fetch current user
  async getCurrentUser(token = null) {
    const headers = { "Content-Type": "application/json" };
    if (token || this.getToken()) {
      headers["Authorization"] = `Bearer ${token || this.getToken()}`;
    } else {
      // No token available, return null for guest user
      return null;
    }

    try {
      const res = await this.apiCall("/auth/me", "GET", null, headers);
      return res.data;
    } catch (e) {
      if (e?.response?.status === 401) {
        // Not authenticated, return null
        return null;
      }
      if (e?.response?.status === 403) {
        // Forbidden: trigger force logout for full cleanup
        window.dispatchEvent(new CustomEvent('auth:force-logout'));
        return null;
      }
      // Log other errors
      console.error("Error in getCurrentUser:", e);
      throw e;
    }
  }
  constructor() {
    super();
    this.user = null;
  }

  async fetchUser() {
    const token = this.getToken();
    if (!token) return null;
    const res = await this.apiCall("/auth/user");
    this.user = res.data;
    return this.user;
  }

  getUser() {
    return this.user;
  }


  async login(email, password) {
    // Use withCredentials to receive refresh token cookie
    const res = await this.apiCall("/auth/login", "POST", { email, password }, {}, { withCredentials: true });
    return res.data;
  }

  async currentUser() {
    const res = await this.apiCall("/auth/me");
    return res.data;
  }

  async loginMFA(email, password, code) {
    // Use withCredentials to receive refresh token cookie
    const res = await this.apiCall("/auth/login-mfa", "POST", { email, password, code }, {}, { withCredentials: true });
    return res.data;
  }
  // Call backend logout endpoint to clear refresh token cookie
  async logout() {
    await this.apiCall("/auth/logout", "POST", null, {}, { withCredentials: true });
  }

  async resetPassword(email) {
    const res = await this.apiCall("/auth/password-reset-request", "POST", { email });
    return res.data;
  }

  async resetPasswordVerify(token, newPassword) {
    const res = await this.apiCall("/auth/password-reset-confirm", "POST", { token, new_password: newPassword });
    return res.data;
  }

  async register(userData) {
    const res = await this.apiCall("/auth/register", "POST", userData);
    return res.data;
  }

  async updateProfileInfo(profile) {
    const res = await this.apiCall(`/users/profile`, "PUT", profile);
    return res.data;
  }

  async updatePassword(currentPassword, newPassword) {
    const res = await this.apiCall(`/users/password`, "PUT", {
      current_password: currentPassword,
      new_password: newPassword
    });
    return res.data;
  }

  async setupMFA() {
    const res = await this.apiCall(`/mfa/setup`, "POST");
    return res.data;
  }

  // async confirmEnableMFA() {
  //   const res = await this.apiCall(`/mfa/enable`, "POST");
  //   return res.data;
  // }

  // Verify TOTP code during setup
  async verifyMFASetup(code) {
    const res = await this.apiCall(`/mfa/verify`, "POST", { totp_code: code });
    return res.data;
  }

  // Confirm password to enable MFA
  async enableMFA(password, code) {
    const res = await this.apiCall(`/mfa/enable`, "POST", {
      totp_code: code,
      current_password: password
    });
    return res.data;
  }

  async disableMFA(password, code) {
    const res = await this.apiCall(`/mfa/disable`, "POST", {
      current_password: password,
      totp_code: code
    });
    return res.data;
  }

  async getBackupCodes() {
    const res = await this.apiCall(`/mfa/backup-codes`, "GET");
    return res.data;
  }

  async regenerateBackupCodes(code) {
    const res = await this.apiCall(`/mfa/regenerate-backup-codes`, "POST", { code });
    return res.data;
  }

  async deleteAccount() {
    const res = await this.apiCall(`/users/delete`, "DELETE");
    return res.data;
  }

}

export default new UserAPI();
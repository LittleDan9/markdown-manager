import { Api } from "./api";

class UserAPI extends Api {
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
    }
    const res = await this.apiCall("/auth/me", "GET", null, headers);
    return res.data;
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


  async login(email, password){
    const res = await this.apiCall("/auth/login", "POST", { email, password });
    return res.data;
  }

  async currentUser() {
    const res = await this.apiCall("/auth/me");
    return res.data;
  }

  async loginMFA(email, password, code) {
    const res = await this.apiCall("/auth/login-mfa", "POST", { email, password, code });
    return res.data;
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

  async enableMFA() {
    const res = await this.apiCall(`/mfa/enable`, "POST");
    return res.data;
  }

  // Verify TOTP code during setup
  async verifyMFASetup(code) {
    const res = await this.apiCall(`/mfa/verify`, "POST", { totp_code: code });
    return res.data;
  }

  // Confirm password to enable MFA
  async confirmEnableMFA(password, code) {
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
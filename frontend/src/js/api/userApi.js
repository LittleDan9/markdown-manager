import config from "../config";

class UserAPI {
  constructor() {
    this.apiBase = config.apiBaseUrl;
    this.token = localStorage.getItem("authToken");
    this.user = null;
  }

  async fetchUser() {
    if (!this.token) return null;

    const response = await this.#apiCall("/auth/user");
    if (!response.ok) {
      throw new Error("Failed to fetch user data");
    }
    this.user = await response.json();
    return this.user;
  }

  getUser() {
    return this.user;
  }

  async #apiCall(endpoint, method = "GET", body = null) {
    const headers = {
      "Content-Type": "application/json",
    };

    if (this.token) {
      headers["Authorization"] = `Bearer ${localStorage.getItem("authToken")}`;
    }

    const config = {
      method,
      headers,
    };

    if (body) {
      config.body = JSON.stringify(body);
    }

    return fetch(`${this.apiBase}${endpoint}`, config);
  }

  async login(email, password){
    const response = await this.#apiCall("/auth/login", "POST", { email, password });
    if (!response.ok) {
      throw new Error("Login failed");
    }
    return await response.json();
  }

  async currentUser() {
    const response = await this.#apiCall("/auth/me");
    if (!response.ok) {
      return {};
    }
    const payload = await response.json();
    return payload
  }

  async loginMFA(email, password, code) {
    const response = await this.#apiCall("/auth/login-mfa", "POST", { email, password, code });
    if (!response.ok) {
      throw new Error("MFA verification failed");
    }
    return await response.json();
  }

  async resetPassword(email) {
    const response = await this.#apiCall("auth/password-reset-request", "POST", { email });
    if (!response.ok) {
      throw new Error("Password reset failed");
    }
    return await response.json();
  }

  async register(userData) {
    const response = await this.#apiCall("/auth/register", "POST", userData);
    if (!response.ok) {
      throw new Error("Registration failed");
    }
    return await response.json();
  }

  async updateProfileInfo(profile) {
    const res = await this.#apiCall(`/users/profile`, "PUT", profile);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async updatePassword(currentPassword, newPassword) {
    const res = await this.#apiCall(`/users/password`, "PUT", {
      current_password: currentPassword,
      new_password: newPassword
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async setupMFA() {
    const res = await this.#apiCall(`/mfa/setup`, "POST");
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async enableMFA() {
    const res = await this.#apiCall(`/mfa/enable`, "POST");
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  // Verify TOTP code during setup
  async verifyMFASetup(code) {
    const res = await this.#apiCall(`/mfa/verify`, "POST", { totp_code: code });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  // Confirm password to enable MFA
  async confirmEnableMFA(password, code) {
    const res = await this.#apiCall(`/mfa/enable`, "POST", {
      totp_code: code,
      current_password: password
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async disableMFA(password, code) {
    const res = await this.#apiCall(`/mfa/disable`, "POST", {
      current_password: password,
      totp_code: code
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async getBackupCodes() {
    const res = await this.#apiCall(`/mfa/backup-codes`, "GET");
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async regenerateBackupCodes(code) {
    const res = await this.#apiCall(`/mfa/regenerate-backup-codes`, "POST", { code });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async deleteAccount() {
    const res = await this.#apiCall(`/users/delete`, "DELETE");
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

}

export default new UserAPI();
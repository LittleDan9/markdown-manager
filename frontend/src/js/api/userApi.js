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

  async loginMFA(email, password, code) {
    const response = await this.#apiCall("/auth/login-mfa", "POST", { email, password, code });
    if (!response.ok) {
      throw new Error("MFA verification failed");
    }
    return await response.json();
  }

}

export default new UserAPI();
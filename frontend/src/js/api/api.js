// api.js - Common API base class for DRY HTTP requests
import config from "../config";

export class Api {
  constructor() {
    this.apiBase = config.apiBaseUrl;
  }

  getToken() {
    return localStorage.getItem("authToken");
  }

  async apiCall(endpoint, method = "GET", body = null, extraHeaders = {}) {
    const headers = {
      "Content-Type": "application/json",
      ...extraHeaders,
    };
    const token = this.getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
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
}

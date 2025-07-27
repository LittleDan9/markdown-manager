// api.js - Common API base class for DRY HTTP requests
import config from "../config";
import axios from "axios";

export class Api {
  constructor() {
    this.apiBase = config.apiBaseUrl;
  }

  getToken() {
    return localStorage.getItem("authToken");
  }

  async apiCall(endpoint, method = "GET", body = null, extraHeaders = {}, options = {}) {
    const url = `${this.apiBase}${endpoint}`;
    const headers = {
      "Content-Type": "application/json",
      ...extraHeaders
    };
    const token = this.getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    const config = {
      method,
      url,
      headers,
      data: body,
      ...options
    };
    // Remove data for GET requests
    if (method === "GET") delete config.data;
    return axios(config);
  }
}

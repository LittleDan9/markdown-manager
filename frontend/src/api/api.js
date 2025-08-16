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
    
    // Add authorization header unless noAuth is specified
    if (!options.noAuth) {
      const token = this.getToken();
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    }
    
    const config = {
      method,
      url,
      headers,
      data: body,
      ...options
    };
    
    // Remove data for GET requests and remove noAuth from axios config
    if (method === "GET") delete config.data;
    delete config.noAuth;
    
    return axios(config);
  }
}

// API helper for document recovery endpoints
import { Api } from "./api";

class RecoveryApi extends Api {
  constructor() {
    super();
    this.baseUrl = this.apiBase + "/recovery";
  }

  async fetchRecoveredDocs(userId, token) {
    const headers = { Authorization: `Bearer ${token}` };
    const res = await this.axiosCall(`/list/${userId}`, "GET", null, headers);
    return res.data;
  }

  async saveRecoveryDoc(doc, token) {
    const headers = { Authorization: `Bearer ${token}` };
    const res = await this.axiosCall(`/save`, "POST", doc, headers);
    return res.data;
  }

  async resolveRecoveryDoc(docId, token) {
    const headers = { Authorization: `Bearer ${token}` };
    const res = await this.axiosCall(`/resolve/${docId}`, "POST", {}, headers);
    return res.data;
  }

  // Axios-based call for recovery endpoints
  async axiosCall(endpoint, method = "GET", data = null, extraHeaders = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      "Content-Type": "application/json",
      ...extraHeaders,
    };
    const config = {
      method,
      url,
      headers,
      data,
    };
    // Remove data for GET requests
    if (method === "GET") delete config.data;
    // Use axios from node_modules
    const axios = require("axios");
    return axios(config);
  }
}

export default new RecoveryApi();

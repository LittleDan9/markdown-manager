// api.js - Common API base class for DRY HTTP requests
import config from "../config";
import axios from "axios";

export class Api {
  constructor() {
    this.apiBase = config.apiBaseUrl;
    this.lastNotificationTime = 0;
    this.notificationCooldown = 30000; // 30 seconds between similar notifications
  }

  getToken() {
    return localStorage.getItem("authToken");
  }

  async apiCall(endpoint, method = "GET", body = null, extraHeaders = {}, options = {}) {
    const url = `${this.apiBase}${endpoint}`;
    // console.log('API Call:', { method, url, body }); // Commented out to reduce noise

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
      timeout: 40000, // 40 second timeout
      ...options
    };

    // Remove data for GET requests and remove noAuth from axios config
    if (method === "GET") delete config.data;
    delete config.noAuth;

    try {
      const response = await axios(config);
      // console.log('API Response:', response.status, response.data); // Commented out to reduce noise
      return response;
    } catch (error) {
      console.error('API Error:', error);

      // Dispatch global notification for network errors
      this.handleApiError(error, endpoint);

      throw error;
    }
  }

  /**
   * Handle API errors and dispatch appropriate notifications
   */
  handleApiError(error, endpoint) {
    let notificationMessage = null;
    let notificationType = 'warning';

    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      notificationMessage = 'Backend service is taking too long to respond. Some features may be unavailable.';
    } else if (error.code === 'ERR_NETWORK' || !error.response) {
      notificationMessage = 'Cannot connect to backend service. Some features may be unavailable.';
      notificationType = 'danger';
    } else if (error.response?.status >= 500) {
      notificationMessage = 'Backend service is experiencing issues. Some features may be degraded.';
      notificationType = 'danger';
    }

    if (notificationMessage) {
      // Throttle notifications to prevent spam
      const now = Date.now();
      if (now - this.lastNotificationTime > this.notificationCooldown) {
        this.lastNotificationTime = now;

        // Dispatch custom notification event
        window.dispatchEvent(new CustomEvent('notification', {
          detail: {
            message: notificationMessage,
            type: notificationType,
            duration: 15000 // Show for 15 seconds for backend issues
          }
        }));
      }
    }
  }
}

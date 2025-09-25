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
      ...extraHeaders
    };

    // Don't set Content-Type for FormData - let browser set it with boundary
    if (!options.isFormData) {
      headers["Content-Type"] = "application/json";
    }

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
      timeout: options.timeout || 40000, // Use custom timeout or default 40 seconds
      // Spread other options (like responseType, withCredentials, etc.)
      ...Object.fromEntries(Object.entries(options).filter(([key]) =>
        !['timeout', 'noAuth', 'isFormData'].includes(key)
      ))
    };

    // For GET requests, convert extraHeaders to query params if they contain non-header data
    if (method === "GET") {
      delete config.data;
      // If extraHeaders contains query parameters (non-header keys), use them as params
      const queryParams = {};
      const actualHeaders = {};

      for (const [key, value] of Object.entries(extraHeaders)) {
        // Headers typically have specific formats (Authorization, Content-Type, etc.)
        // Query params are typically lowercase or simple names like 'limit', 'page', etc.
        if (key.toLowerCase() === key && !key.includes('-') && typeof value !== 'undefined') {
          queryParams[key] = value;
        } else {
          actualHeaders[key] = value;
        }
      }

      if (Object.keys(queryParams).length > 0) {
        config.params = queryParams;
      }

      // Update headers to only include actual headers
      config.headers = { ...config.headers, ...actualHeaders };
    }

    try {
      const response = await axios(config);
      // console.log('API Response:', response.status, response.data); // Commented out to reduce noise
      return response;
    } catch (error) {
      // Log error details without circular references
      console.error('API Error:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        endpoint: endpoint
      });

      // Extract detailed error message from backend response
      let detailedErrorMessage = error.message;
      if (error.response?.data?.detail) {
        // Handle case where detail might be an array or object
        detailedErrorMessage = typeof error.response.data.detail === 'string'
          ? error.response.data.detail
          : JSON.stringify(error.response.data.detail);
      } else if (error.response?.data?.message) {
        detailedErrorMessage = error.response.data.message;
      } else if (error.response?.data?.error) {
        detailedErrorMessage = error.response.data.error;
      }

      // Create a new error with the detailed message but preserve other properties
      const enhancedError = new Error(detailedErrorMessage);
      enhancedError.response = error.response;
      enhancedError.request = error.request;
      enhancedError.config = error.config;
      enhancedError.code = error.code;
      enhancedError.status = error.response?.status;

      // Dispatch global notification for network errors
      this.handleApiError(error, endpoint);

      throw enhancedError;
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

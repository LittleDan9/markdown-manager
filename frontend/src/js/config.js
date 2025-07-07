/**
 * Environment Configuration
 * Determines API base URL based on environment
 */

/**
 * Detect if we're in development mode
 * @returns {boolean} True if in development
 */
function isDevelopment() {
  // Check if we're running on localhost or with webpack dev server
  return (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.port === "3000" ||
    process.env.NODE_ENV === "development"
  );
}

/**
 * Get the appropriate API base URL for the current environment
 * @returns {string} API base URL
 */
function getApiBaseUrl() {
  if (isDevelopment()) {
    // Development: call backend directly on port 8001
    return "http://localhost:8001/api/v1";
  } else {
    // Production: use relative path, nginx will proxy to backend
    return "/api/v1";
  }
}

/**
 * Configuration object
 */
const config = {
  apiBaseUrl: getApiBaseUrl(),
  isDevelopment: isDevelopment(),
};

export default config;

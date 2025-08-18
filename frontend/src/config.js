/**
 * Environment Configuration
 * Clean Architecture: No forced contracts, simple subdomain separation
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
    window.location.hostname === "api.localhost" ||
    window.location.port === "3000" ||
    process.env.NODE_ENV === "development"
  );
}

/**
 * Get the appropriate API base URL for the current environment
 * Clean architecture: No path injection, simple domain-based routing
 * @returns {string} API base URL (without /api/v1 - backend serves directly)
 */
function getApiBaseUrl() {
  if (isDevelopment()) {
    // Development: call backend directly on port 8000
    // No /api/v1 path needed - backend serves endpoints directly
    return "http://localhost:8000";
  } else {
    // Production: use api subdomain
    // Clean separation: api.littledan.com serves API directly
    return "https://api.littledan.com";
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

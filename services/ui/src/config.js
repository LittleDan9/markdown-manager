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
    window.location.port === "3000"
    // Removed process.env.NODE_ENV check as it's unreliable in static builds
  );
}

/**
 * Get the appropriate API base URL for the current environment
 * Same-domain architecture: API served from /api path on same origin
 * @returns {string} API base URL (with /api prefix)
 */
function getApiBaseUrl() {
  // Always use a relative path so requests go to the same host:port
  // the page was loaded from (works for both dev and production).
  return "/api";
}

/**
 * Configuration object
 */
const config = {
  apiBaseUrl: getApiBaseUrl(),
  isDevelopment: isDevelopment(),

  // Feature Flags
  features: {
    // Enable unified architecture (document ID-centric file browser/opening)
    // Set to true to enable new unified components during migration
    unifiedArchitecture: true, // Enable during development/testing
  }
};

export default config;

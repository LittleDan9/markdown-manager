/**
 * Admin API Module - Barrel Export
 * Provides clean access to all admin API clients
 */

// Import admin API clients
import adminIconsApi from './iconsApi.js';
import adminUsersApi from './usersApi.js';
import adminGitHubApi from './githubApi.js';
import adminSystemApi from './systemApi.js';

// Export API clients as named exports for granular imports
export { default as adminIconsApi } from './iconsApi.js';
export { default as adminUsersApi } from './usersApi.js';
export { default as adminGitHubApi } from './githubApi.js';
export { default as adminSystemApi } from './systemApi.js';

// Export API classes for type checking/instanceof
export { AdminIconsApi } from './iconsApi.js';
export { AdminUsersApi } from './usersApi.js';
export { AdminGitHubApi } from './githubApi.js';
export { AdminSystemApi } from './systemApi.js';

// Export combined admin API object for convenience
export const adminApi = {
  icons: adminIconsApi,
  users: adminUsersApi,
  github: adminGitHubApi,
  system: adminSystemApi,
};

// Default export for convenience imports
export default adminApi;
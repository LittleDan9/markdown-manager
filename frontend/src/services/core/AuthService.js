/**
 * Authentication Service
 * Centralized auth logic with direct method calls instead of events
 */

import UserAPI from '@/api/userApi.js';
import {
  getLocalStorageData,
  setLocalStorageData,
  clearLocalStorageData
} from '@/utils/authHelpers';
import DocumentStorageService from './DocumentStorageService';
import NotificationService from '../utilities/notifications.js';
import { DictionaryService } from '../utilities';

const defaultUser = {
  bio: "",
  created_at: "",
  display_name: "Guest",
  email: "",
  first_name: "",
  full_name: "",
  id: -1,
  is_active: false,
  is_verified: false,
  last_name: "",
  mfa_enabled: false,
  updated_at: "",
};

class AuthService {
  constructor() {
    this.user = defaultUser;
    this.token = localStorage.getItem("authToken");
    this.isAuthenticated = false;
    this.refreshInterval = null;
    this.justLoggedIn = false;
    this.initializationPromise = null;
    this.isInitialized = false;

    // Initialize auth state
    this.initializationPromise = this.initializeAuth();
  }

  /**
   * Initialize authentication state on service creation
   * Always tries refresh token first, regardless of stored access token state
   */
  async initializeAuth() {
    console.log('AuthService: Starting initialization');

    try {
      // Always try refresh token first - this ensures we get the latest auth state
      console.log('AuthService: Attempting refresh token');
      const refreshResult = await UserAPI.refreshToken();

      if (refreshResult && refreshResult.access_token) {
        console.log('AuthService: Refresh successful, validating user');
        this.setToken(refreshResult.access_token);
        const user = await this.fetchCurrentUser(refreshResult.access_token);

        if (user) {
          console.log('AuthService: User validation successful', user.email);
          this.setUser(user);
          this.isAuthenticated = true;
          this.startTokenRefresh();
          localStorage.setItem('lastKnownAuthState', 'authenticated');

          // Load profile settings
          if (user.sync_preview_scroll_enabled !== undefined) {
            localStorage.setItem("syncPreviewScrollEnabled", Boolean(user.sync_preview_scroll_enabled));
          }
          if (user.autosave_enabled !== undefined) {
            localStorage.setItem("autosaveEnabled", Boolean(user.autosave_enabled));
          }
        } else {
          console.log('AuthService: User validation failed after refresh');
          this.performLogout();
        }
      } else {
        console.log('AuthService: Refresh failed, checking stored token');

        // Fallback: try stored token if refresh failed
        if (this.token && this.token.trim() !== '') {
          console.log('AuthService: Validating stored token');
          const user = await this.fetchCurrentUser(this.token);

          if (user) {
            console.log('AuthService: Stored token is valid', user.email);
            this.setUser(user);
            this.isAuthenticated = true;
            this.startTokenRefresh();
            localStorage.setItem('lastKnownAuthState', 'authenticated');

            // Load profile settings
            if (user.sync_preview_scroll_enabled !== undefined) {
              localStorage.setItem("syncPreviewScrollEnabled", Boolean(user.sync_preview_scroll_enabled));
            }
            if (user.autosave_enabled !== undefined) {
              localStorage.setItem("autosaveEnabled", Boolean(user.autosave_enabled));
            }
          } else {
            console.log('AuthService: Stored token is invalid');
            this.performLogout();
          }
        } else {
          console.log('AuthService: No stored token, setting guest state');
          this.setUser(defaultUser);
          this.isAuthenticated = false;
          localStorage.setItem('lastKnownAuthState', 'unauthenticated');
        }
      }
    } catch (err) {
      console.error('AuthService: Initialization failed:', err);
      // Complete failure - ensure we're in a clean guest state
      this.performLogout();
    } finally {
      this.isInitialized = true;
      console.log('AuthService: Initialization complete', {
        isAuthenticated: this.isAuthenticated,
        userId: this.user?.id,
        hasToken: !!this.token
      });
    }
  }

  /**
   * Wait for initialization to complete
   */
  async waitForInitialization() {
    if (this.initializationPromise) {
      await this.initializationPromise;
    }
    return this.isInitialized;
  }

  /**
   * Get current auth state
   */
  getAuthState() {
    return {
      user: this.user,
      token: this.token,
      isAuthenticated: this.isAuthenticated
    };
  }

  /**
   * Set token and update localStorage
   */
  setToken(newToken) {
    this.token = newToken;
    if (newToken) {
      localStorage.setItem("authToken", newToken);
    } else {
      localStorage.removeItem("authToken");
    }
  }

  /**
   * Set user state
   */
  setUser(value) {
    if (value == null) {
      this.user = defaultUser;
    } else {
      const displayName = value.display_name?.trim();
      if (!displayName) {
        value.display_name = `${value.first_name || ""} ${value.last_name || ""}`.trim();
      }
      this.user = value;
    }
  }

  /**
   * Start token refresh interval
   * Refreshes tokens every hour, with 14-day refresh token lifespan
   */
  startTokenRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }

    this.refreshInterval = setInterval(async () => {
      if (!this.token || this.token.trim() === '') {
        return;
      }

      try {
        console.log('AuthService: Attempting scheduled token refresh');
        const res = await UserAPI.refreshToken();
        if (res && res.access_token) {
          console.log('AuthService: Scheduled refresh successful');
          this.setToken(res.access_token);
        } else {
          console.log('AuthService: Scheduled refresh failed - no token returned');
          this.performLogout();
        }
      } catch (err) {
        console.error('AuthService: Scheduled refresh failed:', err);
        // If refresh fails, log out to ensure security
        this.performLogout();
      }
    }, 60 * 60 * 1000); // 1 hour - matches backend refresh strategy
  }

  /**
   * Stop token refresh
   */
  stopTokenRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  /**
   * Fetch current user from API
   */
  async fetchCurrentUser(overrideToken = null) {
    try {
      const userData = await UserAPI.getCurrentUser(overrideToken || this.token);
      if (!userData || !userData.id) {
        this.setUser(null);
        return null;
      }

      // Only update if user data actually changed
      if (JSON.stringify(userData) !== JSON.stringify(this.user)) {
        this.setUser(userData);
      }
      return userData;
    } catch (error) {
      console.error('Failed to fetch current user:', error);
      return null;
    }
  }

  /**
   * Login user
   */
  async login(email, password) {
    const loginResponse = await UserAPI.login(email, password);

    if (loginResponse.mfa_required) {
      return { mfaRequired: true, email, password };
    }

    this.justLoggedIn = true;
    this.setToken(loginResponse.access_token);
    this.setUser(loginResponse.user || defaultUser);
    this.isAuthenticated = true;

    try {
      await DictionaryService.syncAfterLogin();
    } catch (error) {
      console.error('Dictionary sync failed after login:', error);
    }

    this.startTokenRefresh();
    localStorage.setItem('lastKnownAuthState', 'authenticated');

    this.justLoggedIn = false;
    return { success: true, user: loginResponse.user };
  }

  /**
   * Verify MFA and complete login
   */
  async verifyMFA(email, password, code) {
    try {
      const response = await UserAPI.loginMFA(email, password, code);
      if (response) {
        this.setToken(response.access_token);
        this.setUser(response.user || defaultUser);
        this.isAuthenticated = true;
        this.justLoggedIn = true;

        try {
          await DictionaryService.syncAfterLogin();
        } catch (error) {
          console.error('Dictionary sync failed after MFA login:', error);
        }

        this.startTokenRefresh();
        localStorage.setItem('lastKnownAuthState', 'authenticated');

        return { success: true, user: response.user };
      } else {
        return { success: false, message: response.message || "Verification failed." };
      }
    } catch (error) {
      return { success: false, message: error.message || "Verification failed." };
    }
  }

  /**
   * Logout user
   */
  async logout() {
    // Check if there are pending sync operations that should delay logout
    const pendingOperations = this.checkPendingOperations();

    if (pendingOperations.length > 0) {
      return {
        delayed: true,
        pendingOperations,
        forceLogout: () => this.performLogout()
      };
    }

    try {
      await UserAPI.logout();
    } catch (error) {
      console.error('Logout API call failed:', error);
    }

    this.performLogout();
    return { success: true };
  }

  /**
   * Force logout without checking pending operations
   */
  performLogout() {
    this.stopTokenRefresh();
    DocumentStorageService.clearAllData();
    this.setToken(null);
    this.setUser(defaultUser);
    this.isAuthenticated = false;
    localStorage.setItem('lastKnownAuthState', 'unauthenticated');
    DictionaryService.clearLocal();
  }

  /**
   * Check for pending sync operations (placeholder - implement based on your sync logic)
   */
  checkPendingOperations() {
    // This would integrate with your document sync logic
    // Return array of pending operations that should delay logout
    return [];
  }

  /**
   * Update user profile
   */
  async updateProfile(profileData) {
    const data = await UserAPI.updateProfileInfo(profileData);
    this.setUser(data);
    return data;
  }

  /**
   * Update password
   */
  async updatePassword(currentPassword, newPassword) {
    return await UserAPI.updatePassword(currentPassword, newPassword);
  }

  /**
   * Delete account
   */
  async deleteAccount() {
    const data = await UserAPI.deleteAccount();
    await this.logout();
    return data;
  }

  /**
   * Enable MFA
   */
  async enableMFA(password, code) {
    try {
      const response = await UserAPI.enableMFA(password, code);
      if (response.success) {
        this.setUser({ ...this.user, mfa_enabled: true });
        NotificationService.success("Two-factor authentication enabled successfully.");
        const codes = await UserAPI.getBackupCodes();
        return { success: true, backup_codes: codes.backup_codes };
      }
      NotificationService.error("Failed to enable MFA.");
      return { success: false };
    } catch (err) {
      NotificationService.error(err.message || "Failed to enable MFA.");
      return { success: false };
    }
  }

  /**
   * Disable MFA
   */
  async disableMFA(password, code) {
    try {
      await UserAPI.disableMFA(password, code);
      this.setUser({ ...this.user, mfa_enabled: false });
      NotificationService.success("Two-factor authentication disabled successfully.");
      return { success: true };
    } catch (error) {
      NotificationService.error(error.message || "Failed to disable MFA.");
      return { success: false };
    }
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email) {
    return await UserAPI.resetPassword(email);
  }

  /**
   * Confirm password reset
   */
  async confirmPasswordReset(token, newPassword) {
    return await UserAPI.resetPasswordVerify(token, newPassword);
  }

  /**
   * Update profile settings and sync to backend if authenticated
   */
  async updateSetting(key, value) {
    localStorage.setItem(key, value);
    if (this.isAuthenticated) {
      const settingMap = {
        autosaveEnabled: 'autosave_enabled',
        syncPreviewScrollEnabled: 'sync_preview_scroll_enabled'
      };

      const backendKey = settingMap[key];
      if (backendKey) {
        try {
          await UserAPI.updateProfileInfo({ [backendKey]: value });
        } catch (error) {
          console.error(`Failed to sync ${key} to backend:`, error);
        }
      }
    }
  }

  /**
  /**
   * Check for orphaned documents (documents with local IDs that need migration)
   */
  /**
   * Check for orphaned documents (documents with local IDs that need migration)
   */
  checkForOrphanedDocuments() {
    try {
      const localDocs = JSON.parse(localStorage.getItem('markdown_manager_documents') || '[]');

      // Check for documents with local IDs regardless of auth state
      const orphanedDocs = localDocs
        .filter(doc =>
          doc.id && String(doc.id).startsWith('doc_') &&
          doc.content && doc.content.trim() !== '' &&
          doc.name !== 'Untitled Document'
        )
        .map(doc => ({
          id: `orphaned_${doc.id}_${Date.now()}`,
          document_id: doc.id,
          name: doc.name,
          category: doc.category,
          content: doc.content,
          collision: false,
          recoveredAt: new Date().toISOString(),
          conflictType: 'orphaned'
        }));

      return orphanedDocs;
    } catch (error) {
      console.error('Failed to check for orphaned documents:', error);
      return [];
    }
  }
}

// Export singleton instance
export default new AuthService();

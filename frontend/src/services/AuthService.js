/**
 * Authentication Service
 * Centralized auth logic with direct method calls instead of events
 */

import UserAPI from '../api/userApi.js';
import DocumentStorageService from './DocumentStorageService.js';
import { notification } from './EventDispatchService.js';
import DictionaryService from './DictionaryService.js';

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
    this.recoveryCallback = null;

    // Initialize auth state
    this.initializeAuth();
  }

  /**
   * Set recovery callback to handle recovery documents
   */
  setRecoveryCallback(callback) {
    this.recoveryCallback = callback;
  }

  /**
   * Initialize authentication state on service creation
   */
  async initializeAuth() {
    if (this.token && this.token.trim() !== '') {
      const user = await this.fetchCurrentUser(this.token);
      if (!user) {
        // Token invalid, try refresh
        try {
          const res = await UserAPI.refreshToken();
          if (res && res.access_token) {
            this.setToken(res.access_token);
            const refreshedUser = await this.fetchCurrentUser(res.access_token);
            if (refreshedUser) {
              this.setUser(refreshedUser);
              this.isAuthenticated = true;
              this.startTokenRefresh();
              localStorage.setItem('lastKnownAuthState', 'authenticated');

              // Load profile settings
              if (refreshedUser.sync_preview_scroll_enabled !== undefined) {
                localStorage.setItem("syncPreviewScrollEnabled", Boolean(refreshedUser.sync_preview_scroll_enabled));
              }
              if (refreshedUser.autosave_enabled !== undefined) {
                localStorage.setItem("autosaveEnabled", Boolean(refreshedUser.autosave_enabled));
              }
            } else {
              this.performLogout();
            }
          } else {
            this.performLogout();
          }
        } catch (err) {
          console.error('Token refresh failed during initialization:', err);
          this.performLogout();
        }
      } else {
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
      }
    } else {
      // Check if we previously had authentication and try refresh
      const hadPreviousAuth = localStorage.getItem('lastKnownAuthState') === 'authenticated';
      if (hadPreviousAuth) {
        try {
          const res = await UserAPI.refreshToken();
          if (res && res.access_token) {
            this.setToken(res.access_token);
            const user = await this.fetchCurrentUser(res.access_token);
            if (user) {
              this.setUser(user);
              this.isAuthenticated = true;
              this.startTokenRefresh();
              localStorage.setItem('lastKnownAuthState', 'authenticated');
            } else {
              this.performLogout();
            }
          } else {
            this.performLogout();
          }
        } catch (err) {
          console.error('Refresh attempt failed during initialization:', err);
          // Refresh failed, set as guest and mark as unauthenticated
          this.setUser(defaultUser);
          this.isAuthenticated = false;
          localStorage.setItem('lastKnownAuthState', 'unauthenticated');
        }
      } else {
        this.setUser(defaultUser);
        this.isAuthenticated = false;
        // Don't set lastKnownAuthState here as this might be first visit
      }
    }
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
        const res = await UserAPI.refreshToken();
        if (res && res.access_token) {
          this.setToken(res.access_token);
        }
      } catch (err) {
        // If refresh fails, log out
        this.performLogout();
      }
    }, 60 * 60 * 1000); // 1 hour
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

    // Trigger recovery check after successful login
    setTimeout(async () => {
      const recoveredDocs = await this.checkForRecoveryDocuments(loginResponse.user.id, loginResponse.access_token);
      if (recoveredDocs.length > 0 && this.recoveryCallback) {
        this.recoveryCallback(recoveredDocs);
      }
    }, 1000);

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
        notification.success("Two-factor authentication enabled successfully.");
        const codes = await UserAPI.getBackupCodes();
        return { success: true, backup_codes: codes.backup_codes };
      }
      notification.error("Failed to enable MFA.");
      return { success: false };
    } catch (err) {
      notification.error(err.message || "Failed to enable MFA.");
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
      notification.success("Two-factor authentication disabled successfully.");
      return { success: true };
    } catch (error) {
      notification.error(error.message || "Failed to disable MFA.");
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
   * Check for recovery documents (placeholder)
   */
  async checkForRecoveryDocuments(userId, token) {
    try {
      const RecoveryApi = (await import("../api/recoveryApi.js")).default;
      const recoveredDocs = await RecoveryApi.fetchRecoveredDocs(userId, token);
      if (recoveredDocs && recoveredDocs.length > 0) {
        // Return recovery docs instead of dispatching event
        return recoveredDocs;
      }
    } catch (error) {
      console.error('Failed to check for recovery documents:', error);
    }
    return [];
  }

  /**
   * Check for orphaned documents
   */
  checkForOrphanedDocuments() {
    try {
      const localDocs = JSON.parse(localStorage.getItem('markdown_manager_documents') || '[]');
      const lastKnownAuth = localStorage.getItem('lastKnownAuthState');

      // If we have local documents but no auth token, they might be orphaned
      if (localDocs.length > 0 && !localStorage.getItem('authToken') && lastKnownAuth === 'authenticated') {
        const orphanedDocs = localDocs
          .filter(doc => doc.content && doc.content.trim() !== '' && doc.name !== 'Untitled Document')
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
      }

      // Update last known auth state
      localStorage.setItem('lastKnownAuthState', 'unauthenticated');
    } catch (error) {
      console.error('Failed to check for orphaned documents:', error);
    }
    return [];
  }
}

// Export singleton instance
export default new AuthService();

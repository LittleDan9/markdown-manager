/**
 * User Authentication Module
 * Handles user login, registration, profile management, and session persistence
 */

import NotificationManager from "./notifications.js";
import { documentManager } from "./documentManager";
import config from "./config.js";
import MFAManager from "./mfa.js";
import SpinnerManager from "./spinnerManager.js";

class AuthManager {
  constructor() {
    this.apiBase = config.apiBaseUrl;
    this.currentUser = null;
    this.token = localStorage.getItem("authToken");

    // Modal instances cache to prevent multiple instances
    this.modalInstances = new Map();

    // Initialize MFA manager
    this.mfaManager = new MFAManager();
    this.mfaManager.setAuthManager(this);

    this.init();
  }

  init() {
    try {
      this.setupEventListeners();
      this.checkAuthStatus();
      this.setupGlobalModalErrorHandling();
      this.checkForPasswordResetToken();
    } catch (error) {
      console.error("AuthManager initialization error:", error);
    }
  }

  /**
   * Check URL for password reset token and show confirm modal if present
   */
  checkForPasswordResetToken() {
    const urlParams = new URLSearchParams(window.location.search);
    const resetToken = urlParams.get("reset_token");

    if (resetToken) {
      // Remove token from URL for security
      const newUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);

      // Show password reset confirm modal
      setTimeout(() => {
        this.showPasswordResetConfirmModal(resetToken);
      }, 500);
    }
  }

  setupEventListeners() {
    // Check if elements exist
    const loginBtn = document.getElementById("loginBtn");
    const registerBtn = document.getElementById("registerBtn");
    const userMenuDropdown = document.getElementById("userMenuDropdown");

    console.log("AuthManager: Setting up event listeners");
    console.log("LoginBtn found:", !!loginBtn);
    console.log("RegisterBtn found:", !!registerBtn);
    console.log("UserMenuDropdown found:", !!userMenuDropdown);
    console.log("Bootstrap available:", typeof bootstrap !== "undefined");

    // Log dropdown structure
    if (userMenuDropdown) {
      console.log("Dropdown element:", userMenuDropdown);
      console.log(
        "Next sibling (should be menu):",
        userMenuDropdown.nextElementSibling,
      );
      console.log("Parent element:", userMenuDropdown.parentElement);
    }

    if (!loginBtn || !registerBtn) {
      console.error("Required DOM elements not found");
      return;
    }

    // Initialize Bootstrap dropdown if not already initialized
    if (userMenuDropdown) {
      this.initializeDropdown(userMenuDropdown);
    }

    // Modal triggers
    loginBtn.addEventListener("click", (e) => {
      e.preventDefault();
      this.showLoginModal();
    });

    registerBtn.addEventListener("click", (e) => {
      e.preventDefault();
      this.showRegisterModal();
    });

    // Use event delegation for profile and logout buttons since they might be hidden initially
    document.addEventListener("click", async (e) => {
      if (e.target.id === "profileBtn" || e.target.closest("#profileBtn")) {
        e.preventDefault();
        this.showProfileModal();
      }

      if (e.target.id === "settingsBtn" || e.target.closest("#settingsBtn")) {
        e.preventDefault();
        this.showProfileModal("security-settings");
      }

      if (e.target.id === "logoutBtn" || e.target.closest("#logoutBtn")) {
        e.preventDefault();
        await this.logout();
      }
    });

    // Form submissions
    document.getElementById("loginForm").addEventListener("submit", (e) => {
      e.preventDefault();
      this.handleLogin();
    });

    document.getElementById("registerForm").addEventListener("submit", (e) => {
      e.preventDefault();
      this.handleRegister();
    });

    document.getElementById("profileForm").addEventListener("submit", (e) => {
      e.preventDefault();
      this.handleProfileUpdate();
    });

    document.getElementById("passwordForm").addEventListener("submit", (e) => {
      e.preventDefault();
      this.handlePasswordUpdate();
    });

    // Delete account button
    document
      .getElementById("deleteAccountBtn")
      .addEventListener("click", () => {
        this.handleAccountDeletion();
      });

    // Password reset functionality
    const forgotPasswordLink = document.getElementById("forgotPasswordLink");
    if (forgotPasswordLink) {
      forgotPasswordLink.addEventListener("click", (e) => {
        e.preventDefault();
        console.log("Forgot password link clicked");
        this.closeModal("loginModal");
        this.showPasswordResetModal();
      });
    } else {
      console.warn("forgotPasswordLink element not found");
    }

    const passwordResetForm = document.getElementById("passwordResetForm");
    if (passwordResetForm) {
      passwordResetForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handlePasswordResetRequest();
      });
    }

    const passwordResetConfirmForm = document.getElementById(
      "passwordResetConfirmForm",
    );
    if (passwordResetConfirmForm) {
      passwordResetConfirmForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handlePasswordResetConfirm();
      });
    }

    // Password confirmation validation for profile form
    const profileConfirmPassword = document.getElementById(
      "profileConfirmPassword",
    );
    if (profileConfirmPassword) {
      profileConfirmPassword.addEventListener("input", () => {
        this.validateProfilePasswordConfirmation();
      });
    }

    // Password confirmation validation for reset form
    const confirmNewPassword = document.getElementById("confirmPasswordReset");
    if (confirmNewPassword) {
      confirmNewPassword.addEventListener("input", () => {
        this.validatePasswordResetConfirmation();
      });
    }
  }

  async checkAuthStatus() {
    if (this.token) {
      try {
        const response = await this.apiCall("/auth/me", "GET");
        if (response.ok) {
          const user = await response.json();
          this.setCurrentUser(user);
        } else {
          // Token is invalid
          this.clearAuth();
        }
      } catch (error) {
        console.error("Auth check failed:", error);
        this.clearAuth();
      }
    }
  }

  async apiCall(endpoint, method = "GET", body = null) {
    const headers = {
      "Content-Type": "application/json",
    };

    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    const config = {
      method,
      headers,
    };

    if (body) {
      config.body = JSON.stringify(body);
    }

    return fetch(`${this.apiBase}${endpoint}`, config);
  }

  /**
   * Get or create a Bootstrap modal instance safely
   * @param {string} modalId - The modal element ID
   * @returns {bootstrap.Modal} Modal instance
   */
  getModalInstance(modalId) {
    try {
      // Validate modal element first
      if (!this.validateModalElement(modalId)) {
        return null;
      }

      const modalElement = document.getElementById(modalId);

      if (
        typeof bootstrap === "undefined" ||
        typeof bootstrap.Modal === "undefined"
      ) {
        console.error("Bootstrap Modal not available!");
        return null;
      }

      // Clean up any orphaned backdrops before creating new instance
      this.cleanupOrphanedBackdrops();

      // Check if we already have an instance for this modal
      let modalInstance = this.modalInstances.get(modalId);

      if (!modalInstance) {
        try {
          // Ensure modal element is properly reset before creating instance
          modalElement.classList.remove("show");
          modalElement.style.display = "none";
          modalElement.setAttribute("aria-hidden", "true");
          modalElement.removeAttribute("aria-modal");
          modalElement.removeAttribute("role");

          // Create new instance with enhanced error handling
          modalInstance = new bootstrap.Modal(modalElement, {
            backdrop: true,
            keyboard: true,
            focus: true,
          });

          // Store the instance
          this.modalInstances.set(modalId, modalInstance);

          // Add comprehensive cleanup listeners
          modalElement.addEventListener("hidden.bs.modal", () => {
            this.cleanupModalState(modalId);
          });

          // Add error handling for show/hide events
          modalElement.addEventListener("show.bs.modal", (event) => {
            // Ensure clean state before showing
            this.cleanupOrphanedBackdrops();
          });
        } catch (instanceError) {
          console.error(
            `Error creating modal instance for ${modalId}:`,
            instanceError,
          );
          return null;
        }
      }

      return modalInstance;
    } catch (error) {
      console.error(`Error in getModalInstance for ${modalId}:`, error);
      return null;
    }
  }

  /**
   * Close a modal safely
   * @param {string} modalId - The modal element ID
   */
  closeModal(modalId) {
    try {
      const modal = this.modalInstances.get(modalId);
      if (modal) {
        try {
          modal.hide();
        } catch (hideError) {
          console.warn(`Error hiding modal ${modalId}:`, hideError);
          // Try alternative cleanup
          this.forceCloseModal(modalId);
        }
      } else {
        // Fallback - try to get existing instance
        const modalElement = document.getElementById(modalId);
        if (modalElement) {
          try {
            const existingModal = bootstrap.Modal.getInstance(modalElement);
            if (existingModal) {
              existingModal.hide();
            } else {
              // Force close if no instance found
              this.forceCloseModal(modalId);
            }
          } catch (fallbackError) {
            console.warn(
              `Fallback modal close failed for ${modalId}:`,
              fallbackError,
            );
            this.forceCloseModal(modalId);
          }
        }
      }
    } catch (error) {
      console.error(`Error closing modal ${modalId}:`, error);
      this.forceCloseModal(modalId);
    }
  }

  /**
   * Force close a modal by directly manipulating the DOM
   * @param {string} modalId - The modal element ID
   */
  forceCloseModal(modalId) {
    try {
      const modalElement = document.getElementById(modalId);
      if (modalElement) {
        // First try to dispose of existing Bootstrap instance properly
        const existingInstance = bootstrap.Modal.getInstance(modalElement);
        if (existingInstance) {
          try {
            existingInstance.dispose();
          } catch (disposeError) {
            console.warn("Error disposing modal instance:", disposeError);
          }
        }

        // Reset modal element state completely
        modalElement.classList.remove("show", "fade");
        modalElement.style.display = "none";
        modalElement.style.paddingRight = "";
        modalElement.setAttribute("aria-hidden", "true");
        modalElement.removeAttribute("aria-modal");
        modalElement.removeAttribute("role");
        modalElement.removeAttribute("tabindex");

        // Force a reflow to ensure styles are applied
        modalElement.offsetHeight;

        // Re-add fade class for future animations
        modalElement.classList.add("fade");
      }

      // Clean up all modal-related DOM state
      this.cleanupOrphanedBackdrops();

      // Reset body state
      document.body.classList.remove("modal-open");
      document.body.style.paddingRight = "";
      document.body.style.overflow = "";

      // Clear cached instance
      this.modalInstances.delete(modalId);
    } catch (error) {
      console.error(`Error in force close modal ${modalId}:`, error);
    }
  }

  showLoginModal() {
    try {
      const modal = this.getModalInstance("loginModal");
      if (!modal) return;

      modal.show();

      document.getElementById("loginForm").reset();
      this.hideError("loginError");
    } catch (error) {
      console.error("Error in showLoginModal:", error);
    }
  }

  showRegisterModal() {
    try {
      const modal = this.getModalInstance("registerModal");
      if (!modal) return;

      modal.show();
      document.getElementById("registerForm").reset();
      this.hideError("registerError");
    } catch (error) {
      console.error("Error in showRegisterModal:", error);
    }
  }

  showProfileModal(activeTab = null) {
    try {
      const modal = this.getModalInstance("profileModal");
      if (!modal) return;

      modal.show();
      this.populateProfileForm();
      this.hideError("profileError");
      this.hideError("passwordError");
      this.hideSuccess("profileSuccess");
      this.hideSuccess("passwordSuccess");

      // Switch to specific tab if provided
      if (activeTab) {
        setTimeout(() => {
          const targetTab = document.getElementById(
            `${activeTab.replace("-settings", "")}-tab`,
          );
          if (targetTab) {
            const tab = new bootstrap.Tab(targetTab);
            tab.show();
          }
        }, 100);
      }
    } catch (error) {
      console.error("Error in showProfileModal:", error);
    }
  }

  showPasswordResetModal() {
    try {
      console.log("showPasswordResetModal called");
      const modal = this.getModalInstance("passwordResetModal");
      if (!modal) {
        console.error("Could not get passwordResetModal instance");
        return;
      }

      modal.show();
      const resetForm = document.getElementById("passwordResetForm");
      if (resetForm) {
        resetForm.reset();
      }
      this.hideError("passwordResetError");
      this.hideSuccess("passwordResetSuccess");
      console.log("Password reset modal should now be visible");
    } catch (error) {
      console.error("Error in showPasswordResetModal:", error);
    }
  }

  showPasswordResetConfirmModal(token) {
    try {
      // Clear any previous modal state first and wait a bit for cleanup
      this.forceCloseModal("passwordResetConfirmModal");

      // Use setTimeout to ensure DOM cleanup is complete before showing new modal
      setTimeout(() => {
        try {
          const modal = this.getModalInstance("passwordResetConfirmModal");
          if (!modal) return;

          // Store token for later use
          this.resetToken = token;

          // Clear the form and any errors
          document.getElementById("passwordResetConfirmForm").reset();
          this.hideError("passwordResetConfirmError");

          // Reset submission state
          this.isSubmittingPasswordReset = false;
          const submitBtn = document.querySelector(
            '#passwordResetConfirmForm button[type="submit"]',
          );
          if (submitBtn) {
            submitBtn.disabled = false;
          }

          modal.show();
        } catch (delayedError) {
          console.error("Error in delayed modal show:", delayedError);
        }
      }, 100);
    } catch (error) {
      console.error("Error in showPasswordResetConfirmModal:", error);
    }
  }

  /**
   * Show MFA verification modal during login
   */
  showMFAVerificationModal() {
    try {
      const modalHtml = `
                <div class="modal fade" id="mfaVerificationModal" tabindex="-1" aria-labelledby="mfaVerificationModalLabel" aria-hidden="true">
                    <div class="modal-dialog">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title" id="mfaVerificationModalLabel">
                                    <i class="bi bi-shield-check me-2"></i>Two-Factor Authentication
                                </h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                            </div>
                            <div class="modal-body">
                                <div class="text-center mb-4">
                                    <i class="bi bi-smartphone" style="font-size: 2rem; color: #0d6efd;"></i>
                                    <h6 class="mt-3">Enter Authentication Code</h6>
                                    <p class="text-muted">Enter the 6-digit code from your authenticator app or use a backup code.</p>
                                </div>

                                <form id="mfaVerificationForm">
                                    <div class="mb-3">
                                        <input type="text" class="form-control form-control-lg text-center"
                                               id="mfaLoginCode" placeholder="000000" maxlength="8"
                                               pattern="[0-9]{6,8}" required>
                                        <div class="form-text">Enter a 6-digit code from your authenticator app or an 8-digit backup code.</div>
                                    </div>
                                    <div class="alert alert-danger" id="mfaLoginError" style="display: none;"></div>
                                    <button type="submit" class="btn btn-primary w-100" id="mfaVerifyLoginBtn">
                                        <span class="spinner-border spinner-border-sm me-2" id="mfaLoginSpinner" style="display: none;"></span>
                                        Verify and Sign In
                                    </button>
                                </form>

                                <div class="text-center mt-3">
                                    <button type="button" class="btn btn-link btn-sm" id="mfaBackToLogin">
                                        <i class="bi bi-arrow-left me-1"></i>Back to Login
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;

      // Remove existing modal if any
      const existingModal = document.getElementById("mfaVerificationModal");
      if (existingModal) {
        const existingInstance = bootstrap.Modal.getInstance(existingModal);
        if (existingInstance) {
          existingInstance.dispose();
        }
        existingModal.remove();
      }

      // Add modal to DOM
      document.body.insertAdjacentHTML("beforeend", modalHtml);

      // Set up event listeners
      document
        .getElementById("mfaVerificationForm")
        .addEventListener("submit", (e) => {
          e.preventDefault();
          this.handleMFAVerification();
        });

      document
        .getElementById("mfaBackToLogin")
        .addEventListener("click", () => {
          this.closeModal("mfaVerificationModal");
          this.showLoginModal();
        });

      // Auto-format code input
      const codeInput = document.getElementById("mfaLoginCode");
      codeInput.addEventListener("input", (e) => {
        e.target.value = e.target.value.replace(/\D/g, "");
      });

      // Show modal with error handling
      try {
        const modalElement = document.getElementById("mfaVerificationModal");
        if (!modalElement) {
          throw new Error("MFA verification modal element not found");
        }

        const modal = new bootstrap.Modal(modalElement, {
          backdrop: true,
          keyboard: true,
          focus: true,
        });
        modal.show();

        // Focus on input after modal is fully shown
        modalElement.addEventListener(
          "shown.bs.modal",
          () => {
            const codeInput = document.getElementById("mfaLoginCode");
            if (codeInput) {
              codeInput.focus();
            }
          },
          { once: true },
        );

        // Clean up modal when hidden
        modalElement.addEventListener(
          "hidden.bs.modal",
          () => {
            const currentModal = bootstrap.Modal.getInstance(modalElement);
            if (currentModal) {
              currentModal.dispose();
            }
            if (modalElement && modalElement.parentNode) {
              modalElement.remove();
            }
          },
          { once: true },
        );
      } catch (modalError) {
        console.error("Error showing MFA verification modal:", modalError);
        NotificationManager.showError(
          "Failed to show verification modal. Please refresh and try again.",
        );
      }
    } catch (error) {
      console.error("Error showing MFA verification modal:", error);
      NotificationManager.showError(
        "Failed to show verification modal. Please try again.",
      );
    }
  }

  /**
   * Handle MFA verification during login
   */
  async handleMFAVerification() {
    const code = document.getElementById("mfaLoginCode").value;
    const errorEl = document.getElementById("mfaLoginError");
    const spinner = document.getElementById("mfaLoginSpinner");
    const submitBtn = document.getElementById("mfaVerifyLoginBtn");

    if (!code || (code.length !== 6 && code.length !== 8)) {
      this.showError(
        "mfaLoginError",
        "Please enter a valid 6-digit or 8-digit code",
      );
      return;
    }

    spinner.style.display = "inline-block";
    submitBtn.disabled = true;
    this.hideError("mfaLoginError");

    try {
      const requestBody = {
        email: this.mfaSession.email,
        password: this.mfaSession.password, // We need to store password
        code: code,
      };

      const response = await this.apiCall(
        "/auth/login-mfa",
        "POST",
        requestBody,
      );

      if (response.ok) {
        const data = await response.json();

        // Login successful
        this.token = data.access_token;
        localStorage.setItem("authToken", this.token);
        this.setCurrentUser(data.user);

        // Clear MFA session
        this.mfaSession = null;

        // Close modal
        this.closeModal("mfaVerificationModal");

        // Trigger document migration
        try {
          if (documentManager) {
            await documentManager.onUserLogin();
          }
        } catch (migrationError) {
          console.error("Document migration failed:", migrationError);
        }

        // Show success message
        NotificationManager.showSuccess("Welcome back!");
      } else {
        const error = await response.json();
        this.showError(
          "mfaLoginError",
          error.detail || "Invalid authentication code",
        );
      }
    } catch (error) {
      console.error("MFA verification error:", error);
      this.showError("mfaLoginError", "Network error. Please try again.");
    } finally {
      spinner.style.display = "none";
      submitBtn.disabled = false;
    }
  }

  async handleLogin() {
    const email = document.getElementById("loginEmail").value;
    const password = document.getElementById("loginPassword").value;

    SpinnerManager.show("loginSpinner");
    this.hideError("loginError");

    try {
      const response = await this.apiCall("/auth/login", "POST", {
        email,
        password,
      });

      if (response.ok) {
        const data = await response.json();

        // Check if MFA is required
        if (data.mfa_required) {
          // Store temporary session for MFA verification
          this.mfaSession = {
            email: email,
            password: password, // Store password for MFA verification
            temp_token: data.temp_token || null,
          };

          // Close login modal and wait for it to be fully hidden before showing MFA modal
          this.closeModal("loginModal");

          // Wait for login modal to be fully closed before showing MFA modal
          const loginModalElement = document.getElementById("loginModal");
          if (loginModalElement) {
            loginModalElement.addEventListener(
              "hidden.bs.modal",
              () => {
                // Small delay to ensure DOM is clean
                setTimeout(() => {
                  this.showMFAVerificationModal();
                }, 100);
              },
              { once: true },
            );
          } else {
            // Fallback if modal element not found
            setTimeout(() => {
              this.showMFAVerificationModal();
            }, 300);
          }
          return;
        }

        // Regular login success
        this.token = data.access_token;
        localStorage.setItem("authToken", this.token);
        this.setCurrentUser(data.user);

        // Close modal safely
        this.closeModal("loginModal");

        // Trigger document migration
        try {
          if (documentManager) {
            await documentManager.onUserLogin();
          }
        } catch (migrationError) {
          console.error("Document migration failed:", migrationError);
        }

        // Show success message
        NotificationManager.showSuccess("Welcome back!");
      } else {
        const error = await response.json();
        this.showError("loginError", error.detail || "Login failed");
      }
    } catch (error) {
      console.error("Login error:", error);
      this.showError("loginError", "Network error. Please try again.");
    } finally {
      SpinnerManager.hide("loginSpinner");
    }
  }

  async handleRegister() {
    const formData = {
      email: document.getElementById("registerEmail").value,
      password: document.getElementById("registerPassword").value,
      first_name: document.getElementById("registerFirstName").value || null,
      last_name: document.getElementById("registerLastName").value || null,
      display_name:
        document.getElementById("registerDisplayName").value || null,
      bio: document.getElementById("registerBio").value || null,
    };

    SpinnerManager.show("registerSpinner");
    this.hideError("registerError");

    try {
      const response = await this.apiCall("/auth/register", "POST", formData);

      if (response.ok) {
        const user = await response.json();

        // Close modal
        // Close modal safely
        this.closeModal("registerModal");

        // Show success and auto-login
        NotificationManager.showSuccess(
          "Account created successfully! Please log in.",
        );

        // Auto-fill login form
        setTimeout(() => {
          document.getElementById("loginEmail").value = formData.email;
          this.showLoginModal();
        }, 1000);
      } else {
        const error = await response.json();
        this.showError("registerError", error.detail || "Registration failed");
      }
    } catch (error) {
      console.error("Registration error:", error);
      this.showError("registerError", "Network error. Please try again.");
    } finally {
      SpinnerManager.hide("registerSpinner");
    }
  }

  async handleProfileUpdate() {
    const formData = {
      first_name: document.getElementById("profileFirstName").value || null,
      last_name: document.getElementById("profileLastName").value || null,
      display_name: document.getElementById("profileDisplayName").value || null,
      bio: document.getElementById("profileBio").value || null,
    };

    SpinnerManager.show("profileSpinner");
    this.hideError("profileError");
    this.hideSuccess("profileSuccess");

    try {
      const response = await this.apiCall("/users/profile", "PUT", formData);

      if (response.ok) {
        const updatedUser = await response.json();
        this.setCurrentUser(updatedUser);
        this.showSuccess("profileSuccess", "Profile updated successfully!");
      } else {
        const error = await response.json();
        this.showError("profileError", error.detail || "Profile update failed");
      }
    } catch (error) {
      console.error("Profile update error:", error);
      this.showError("profileError", "Network error. Please try again.");
    } finally {
      SpinnerManager.hide("profileSpinner");
    }
  }

  async handlePasswordUpdate() {
    const currentPassword = document.getElementById("currentPassword").value;
    const newPassword = document.getElementById("profileNewPassword").value;
    const confirmPassword = document.getElementById(
      "profileConfirmPassword",
    ).value;

    if (newPassword !== confirmPassword) {
      this.showError("passwordError", "New passwords do not match");
      return;
    }

    SpinnerManager.show("passwordSpinner");
    this.hideError("passwordError");
    this.hideSuccess("passwordSuccess");

    try {
      const response = await this.apiCall("/users/password", "PUT", {
        current_password: currentPassword,
        new_password: newPassword,
      });

      if (response.ok) {
        this.showSuccess("passwordSuccess", "Password updated successfully!");
        document.getElementById("passwordForm").reset();
      } else {
        const error = await response.json();
        this.showError(
          "passwordError",
          error.detail || "Password update failed",
        );
      }
    } catch (error) {
      console.error("Password update error:", error);
      this.showError("passwordError", "Network error. Please try again.");
    } finally {
      SpinnerManager.hide("passwordSpinner");
    }
  }

  handleAccountDeletion() {
    if (
      confirm(
        "Are you sure you want to delete your account? This action cannot be undone.",
      )
    ) {
      if (
        confirm(
          "This will permanently delete all your data. Are you absolutely sure?",
        )
      ) {
        this.deleteAccount();
      }
    }
  }

  async deleteAccount() {
    try {
      const response = await this.apiCall("/users/account", "DELETE");

      if (response.ok) {
        NotificationManager.showInfo("Account deleted successfully");
        await this.logout();
        // Close modal safely
        this.closeModal("profileModal");
      } else {
        const error = await response.json();
        this.showError(
          "passwordError",
          error.detail || "Account deletion failed",
        );
      }
    } catch (error) {
      console.error("Account deletion error:", error);
      this.showError("passwordError", "Network error. Please try again.");
    }
  }

  async handlePasswordResetRequest() {
    const email = document.getElementById("resetEmail").value;

    SpinnerManager.show("passwordResetSpinner");
    this.hideError("passwordResetError");
    this.hideSuccess("passwordResetSuccess");

    try {
      const response = await this.apiCall(
        "/auth/password-reset-request",
        "POST",
        {
          email,
        },
      );

      if (response.ok) {
        const data = await response.json();

        // For demo purposes, if debug_token is present, show confirm modal
        if (data.debug_token) {
          this.showSuccess(
            "passwordResetSuccess",
            "Development Mode: Password reset form will appear shortly (no email sent)",
          );
          setTimeout(() => {
            this.closeModal("passwordResetModal");
            this.showPasswordResetConfirmModal(data.debug_token);
          }, 2000);
        } else {
          this.showSuccess("passwordResetSuccess", data.message);
        }
      } else {
        const error = await response.json();
        this.showError(
          "passwordResetError",
          error.detail || "Failed to send reset email",
        );
      }
    } catch (error) {
      console.error("Password reset request error:", error);
      this.showError("passwordResetError", "Network error. Please try again.");
    } finally {
      SpinnerManager.hide("passwordResetSpinner");
    }
  }

  async handlePasswordResetConfirm() {
    const newPassword = document.getElementById("newPassword").value.trim();
    const confirmPassword = document
      .getElementById("confirmNewPassword")
      .value.trim();
    const submitBtn = document.querySelector(
      '#passwordResetConfirmForm button[type="submit"]',
    );

    // Prevent double submission
    if (this.isSubmittingPasswordReset || submitBtn.disabled) {
      return;
    }

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      this.showError("passwordResetConfirmError", "Passwords do not match");
      return;
    }

    if (newPassword.length < 6) {
      this.showError(
        "passwordResetConfirmError",
        "Password must be at least 6 characters long",
      );
      return;
    }

    this.isSubmittingPasswordReset = true;
    submitBtn.disabled = true;
    SpinnerManager.show("passwordResetConfirmSpinner");
    this.hideError("passwordResetConfirmError");

    try {
      const response = await this.apiCall(
        "/auth/password-reset-confirm",
        "POST",
        {
          token: this.resetToken,
          new_password: newPassword,
        },
      );

      if (response.ok) {
        this.closeModal("passwordResetConfirmModal");
        NotificationManager.showSuccess(
          "Password has been reset successfully! You can now login with your new password.",
        );

        // Clear stored token
        this.resetToken = null;

        // Show login modal
        setTimeout(() => {
          this.showLoginModal();
        }, 1000);
      } else {
        const error = await response.json();
        this.showError(
          "passwordResetConfirmError",
          error.detail || "Failed to reset password",
        );
      }
    } catch (error) {
      console.error("Password reset confirm error:", error);
      this.showError(
        "passwordResetConfirmError",
        "Network error. Please try again.",
      );
    } finally {
      this.isSubmittingPasswordReset = false;
      submitBtn.disabled = false;
      SpinnerManager.hide("passwordResetConfirmSpinner");
    }
  }

  validateProfilePasswordConfirmation() {
    const newPasswordEl = document.getElementById("profileNewPassword");
    const confirmPasswordEl = document.getElementById("profileConfirmPassword");
    const confirmField = document.getElementById("profileConfirmPassword");

    if (!newPasswordEl || !confirmPasswordEl || !confirmField) {
      console.error("Profile password form elements not found");
      return;
    }

    const newPassword = newPasswordEl.value;
    const confirmPassword = confirmPasswordEl.value;

    if (confirmPassword && newPassword !== confirmPassword) {
      confirmField.setCustomValidity("Passwords do not match");
    } else {
      confirmField.setCustomValidity("");
    }
  }

  validatePasswordResetConfirmation() {
    const newPasswordEl = document.getElementById("newPasswordReset");
    const confirmNewPasswordEl = document.getElementById(
      "confirmPasswordReset",
    );
    const confirmField = document.getElementById("confirmPasswordReset");

    if (!newPasswordEl || !confirmNewPasswordEl || !confirmField) {
      console.error("Password reset form elements not found");
      return;
    }

    const newPassword = newPasswordEl.value.trim();
    const confirmNewPassword = confirmNewPasswordEl.value.trim();

    if (confirmNewPassword && newPassword !== confirmNewPassword) {
      confirmField.setCustomValidity("Passwords do not match");
    } else {
      confirmField.setCustomValidity("");
    }
  }

  setCurrentUser(user) {
    this.currentUser = user;
    this.updateUI();
  }

  updateUI() {
    const userDisplayName = document.getElementById("userDisplayName");
    const guestMenu = document.getElementById("guestMenu");
    const userMenu = document.getElementById("userMenu");

    if (this.currentUser) {
      // User is logged in
      userDisplayName.textContent =
        this.currentUser.full_name || this.currentUser.display_name || "User";
      guestMenu.style.display = "none";
      userMenu.style.display = "block";
    } else {
      // User is not logged in
      userDisplayName.textContent = "Guest";
      guestMenu.style.display = "block";
      userMenu.style.display = "none";
    }
  }

  populateProfileForm() {
    if (this.currentUser) {
      document.getElementById("profileFirstName").value =
        this.currentUser.first_name || "";
      document.getElementById("profileLastName").value =
        this.currentUser.last_name || "";
      document.getElementById("profileDisplayName").value =
        this.currentUser.display_name || "";
      document.getElementById("profileEmail").value =
        this.currentUser.email || "";
      document.getElementById("profileBio").value = this.currentUser.bio || "";

      // Update MFA status
      this.mfaManager.updateMFAStatus();
    }
  }

  async logout() {
    // Show saving notification
    NotificationManager.showInfo("Saving documents before logout...");

    // Trigger document logout hook with forced save
    try {
      if (documentManager) {
        await documentManager.onUserLogout();
      }
    } catch (error) {
      console.error("Document logout handler failed:", error);
      NotificationManager.showWarning("Some documents may not have been saved");
    }

    this.clearAuth();
    NotificationManager.showSuccess("Logged out successfully");
  }

  clearAuth() {
    this.token = null;
    this.currentUser = null;
    localStorage.removeItem("authToken");
    this.updateUI();
  }

  showError(elementId, message) {
    const element = document.getElementById(elementId);
    element.textContent = message;
    element.style.display = "block";
  }

  hideError(elementId) {
    const element = document.getElementById(elementId);
    element.style.display = "none";
  }

  showSuccess(elementId, message) {
    const element = document.getElementById(elementId);
    element.textContent = message;
    element.style.display = "block";
  }

  hideSuccess(elementId) {
    document.getElementById(elementId).style.display = "none";
  }

  initializeDropdown(dropdownElement) {
    console.log("AuthManager: Attempting to initialize dropdown");

    // Wait a moment for Bootstrap to be fully loaded
    setTimeout(() => {
      // Method 1: Try Bootstrap 5 API
      if (typeof bootstrap !== "undefined" && bootstrap.Dropdown) {
        try {
          const existingDropdown =
            bootstrap.Dropdown.getInstance(dropdownElement);
          if (!existingDropdown) {
            new bootstrap.Dropdown(dropdownElement);
            console.log("AuthManager: Bootstrap dropdown initialized via API");
            return;
          } else {
            console.log("AuthManager: Bootstrap dropdown already exists");
            return;
          }
        } catch (error) {
          console.warn("AuthManager: Bootstrap API failed:", error);
        }
      }

      // Method 2: Manual click handler as fallback
      console.log("AuthManager: Using manual dropdown fallback");
      this.setupManualDropdown(dropdownElement);
    }, 100);
  }

  setupManualDropdown(dropdownElement) {
    dropdownElement.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      const dropdownMenu = dropdownElement.nextElementSibling;
      if (dropdownMenu && dropdownMenu.classList.contains("dropdown-menu")) {
        const isShown = dropdownMenu.classList.contains("show");

        // Close all other dropdowns first
        document.querySelectorAll(".dropdown-menu.show").forEach((menu) => {
          if (menu !== dropdownMenu) {
            menu.classList.remove("show");
            const otherToggle = menu.previousElementSibling;
            if (otherToggle) {
              otherToggle.setAttribute("aria-expanded", "false");
            }
          }
        });

        // Toggle this dropdown
        if (!isShown) {
          dropdownMenu.classList.add("show");
          dropdownElement.setAttribute("aria-expanded", "true");
          console.log("AuthManager: Dropdown opened manually");
        } else {
          dropdownMenu.classList.remove("show");
          dropdownElement.setAttribute("aria-expanded", "false");
          console.log("AuthManager: Dropdown closed manually");
        }
      }
    });

    // Close dropdown when clicking outside
    document.addEventListener("click", (e) => {
      if (!dropdownElement.contains(e.target)) {
        const dropdownMenu = dropdownElement.nextElementSibling;
        if (dropdownMenu && dropdownMenu.classList.contains("dropdown-menu")) {
          dropdownMenu.classList.remove("show");
          dropdownElement.setAttribute("aria-expanded", "false");
        }
      }
    });
  }

  /**
   * Set up global error handling for modal-related issues
   */
  setupGlobalModalErrorHandling() {
    // Listen for modal events to ensure proper cleanup
    document.addEventListener("hidden.bs.modal", (event) => {
      // Additional cleanup to ensure no orphaned backdrops
      setTimeout(() => {
        const backdrops = document.querySelectorAll(".modal-backdrop");
        const openModals = document.querySelectorAll(".modal.show");
        if (backdrops.length > 0 && backdrops.length > openModals.length) {
          console.warn(
            "Found orphaned modal backdrops, cleaning up:",
            backdrops.length,
          );
          backdrops.forEach((backdrop) => backdrop.remove());
        }

        // Ensure body classes are correct

        if (openModals.length === 0) {
          document.body.classList.remove("modal-open");
          document.body.style.paddingRight = "";
          document.body.style.overflow = "";
        }
      }, 100);
    });

    // Enhanced error handling for Bootstrap dataset and style errors
    window.addEventListener("error", (event) => {
      if (
        event.message &&
        (event.message.includes("dataset") ||
          event.message.includes("style") ||
          event.message.includes("Cannot read properties of null"))
      ) {
        console.warn(
          "Bootstrap modal error caught and handled:",
          event.message,
        );
        event.preventDefault(); // Prevent the error from propagating

        // Force cleanup of any modal artifacts
        setTimeout(() => {
          const backdrops = document.querySelectorAll(".modal-backdrop");
          backdrops.forEach((backdrop) => {
            try {
              backdrop.remove();
            } catch (e) {
              console.warn("Error removing backdrop:", e);
            }
          });

          // Reset body state
          document.body.classList.remove("modal-open");
          document.body.style.paddingRight = "";
          document.body.style.overflow = "";

          // Clear any modal instances that might be stuck
          this.modalInstances.clear();
        }, 50);

        return false; // Prevent default error handling
      }
    });

    // Also handle unhandled promise rejections that might be modal-related
    window.addEventListener("unhandledrejection", (event) => {
      if (
        event.reason &&
        event.reason.message &&
        event.reason.message.includes("dataset")
      ) {
        console.warn(
          "Modal-related promise rejection caught:",
          event.reason.message,
        );
        event.preventDefault();

        // Same cleanup as above
        setTimeout(() => {
          const backdrops = document.querySelectorAll(".modal-backdrop");
          backdrops.forEach((backdrop) => backdrop.remove());
          document.body.classList.remove("modal-open");
          document.body.style.paddingRight = "";
          document.body.style.overflow = "";
          this.modalInstances.clear();
        }, 50);
      }
    });
  }

  /**
   * Clean up orphaned modal backdrops
   */
  cleanupOrphanedBackdrops() {
    try {
      const backdrops = document.querySelectorAll(".modal-backdrop");
      backdrops.forEach((backdrop) => {
        try {
          backdrop.remove();
        } catch (e) {
          console.warn("Error removing backdrop:", e);
        }
      });
    } catch (error) {
      console.warn("Error in cleanupOrphanedBackdrops:", error);
    }
  }

  /**
   * Clean up modal state after hiding
   * @param {string} modalId - The modal element ID
   */
  cleanupModalState(modalId) {
    try {
      // Ensure backdrop is removed
      this.cleanupOrphanedBackdrops();

      // Remove modal-open class from body if no other modals are open
      const openModals = document.querySelectorAll(".modal.show");
      if (openModals.length === 0) {
        document.body.classList.remove("modal-open");
        document.body.style.paddingRight = "";
        document.body.style.overflow = "";
      }
    } catch (cleanupError) {
      console.warn("Error during modal cleanup:", cleanupError);
    }
  }

  /**
   * Validate that a modal element exists and is properly structured
   * @param {string} modalId - The modal element ID
   * @returns {boolean} True if modal is valid
   */
  validateModalElement(modalId) {
    try {
      const modalElement = document.getElementById(modalId);
      if (!modalElement) {
        console.error(`Modal element ${modalId} not found!`);
        return false;
      }

      // Check if modal has required Bootstrap structure
      if (!modalElement.classList.contains("modal")) {
        console.error(`Element ${modalId} is not a Bootstrap modal!`);
        return false;
      }

      // Ensure modal has proper dialog structure
      const modalDialog = modalElement.querySelector(".modal-dialog");
      if (!modalDialog) {
        console.error(`Modal ${modalId} missing .modal-dialog element!`);
        return false;
      }

      return true;
    } catch (error) {
      console.error(`Error validating modal ${modalId}:`, error);
      return false;
    }
  }

  // Public methods for other modules
  isAuthenticated() {
    return !!this.token && !!this.currentUser;
  }

  getCurrentUser() {
    return this.currentUser;
  }

  getToken() {
    return this.token;
  }

  /**
   * Get a URL parameter by name
   * @param {string} name - The parameter name
   * @returns {string|null} Parameter value or null if not found
   */
  getUrlParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
  }
}
const authManager = new AuthManager();
// Export for use in other modules
export default authManager;

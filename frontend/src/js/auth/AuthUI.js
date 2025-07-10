// AuthUI.js
// Handles DOM updates, event binding, and delegates to AuthManager and ModalManager

import AuthManager from "./AuthManager.js";
import MFAHandler from "./MFAHandler.js";
import ModalManager from "../modalManager.js";
import SpinnerManager from "../SpinnerManager.js";
import NotificationManager from "../notifications.js";
import { DocumentManager } from "../DocumentManager.js";

class AuthUI {
  constructor() {
    this.currentUser = null;
    this.bindEvents();
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

  bindEvents() {
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
      ModalManager.show("loginModal");
    });

    registerBtn.addEventListener("click", (e) => {
      e.preventDefault();
      ModalManager.show("registerModal");
    });

    // Use event delegation for profile and logout buttons since they might be hidden initially
    document.addEventListener("click", async (e) => {
      if (e.target.id === "profileBtn" || e.target.closest("#profileBtn")) {
        e.preventDefault();
        ModalManager.show("profileModal");
        this.populateProfileForm();
        this.hideError("profileError");
        this.hideError("passwordError");
        this.hideSuccess("profileSuccess");
        this.hideSuccess("passwordSuccess");
      }

      if (e.target.id === "settingsBtn" || e.target.closest("#settingsBtn")) {
        e.preventDefault();
        ModalManager.show("profileModal", "security-settings");
        this.populateProfileForm();
        this.hideError("profileError");
        this.hideError("passwordError");
        this.hideSuccess("profileSuccess");
        this.hideSuccess("passwordSuccess");
      }

      if (e.target.id === "logoutBtn" || e.target.closest("#logoutBtn")) {
        e.preventDefault();
        await AuthManager.logout();
      }
    });

    // Form submissions
    document
      .getElementById("loginForm")
      .addEventListener("submit", async (e) => {
        e.preventDefault();
        await this.handleLogin();
      });

    document
      .getElementById("loginModalClose")
      .addEventListener("click", async (e) => {
        e.preventDefault();
        await ModalManager.hide("loginModal");
      });

    document
      .getElementById("registerForm")
      .addEventListener("submit", async (e) => {
        e.preventDefault();
        await this.handleRegister();
      });

    document
      .getElementById("profileForm")
      .addEventListener("submit", async (e) => {
        e.preventDefault();
        await this.handleProfileUpdate();
      });

    document
      .getElementById("passwordForm")
      .addEventListener("submit", async (e) => {
        e.preventDefault();
        await this.handlePasswordUpdate();
      });

    // Password reset functionality
    const forgotPasswordLink = document.getElementById("forgotPasswordLink");
    if (forgotPasswordLink) {
      forgotPasswordLink.addEventListener("click", (e) => {
        e.preventDefault();
        ModalManager.hide("loginModal");
        ModalManager.show("passwordResetModal");
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
  }

  async handleLogin() {
    const email = document.getElementById("loginEmail").value;
    const password = document.getElementById("loginPassword").value;
    SpinnerManager.show("loginSpinner");
    try {
      const response = await AuthManager.login(email, password);
      if (response.ok) {
        ModalManager.hide("loginModal");
        const data = await response.json();
        console.log("Login response data:", data);
        if (data.mfa_required) {
          let session = {
            email: email,
            password: password,
          };
          MFAHandler.showMFAModal(session);
        } else {
          AuthManager.setToken(data.access_token);
          AuthManager.setCurrentUser(data.user);
          try {
            await DocumentManager.onUserLogin();
          } catch (migrationError) {
            NotificationManager.showError(
              "Migration failed: " + migrationError.message,
            );
            console.debug("Migration error:", migrationError);
          }
          NotificationManager.showSuccess("Welcome back!");
        }
      } else {
        const error = await response.json();
        NotificationManager.showError(error.detail || "Login failed");
      }
    } catch (error) {
      NotificationManager.showError("Network error. Please try again.");
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
      const response = await AuthManager.register(formData);

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
      const response = await AuthManager.updateProfile(formData);

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
      const response = await AuthManager.updatePassword({
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
      const response = await AuthManager.deleteAccount();

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
      const response = await AuthManager.requestPasswordReset(email);

      if (response.ok) {
        const data = await response.json();

        // For demo purposes, if debug_token is present, show confirm modal
        if (data.debug_token) {
          this.showSuccess(
            "passwordResetSuccess",
            "Development Mode: Password reset form will appear shortly (no email sent)",
          );
          setTimeout(() => {
            ModalManager.hide("passwordResetModal");
            ModalManager.show("passwordResetConfirmModal");
            ModalManager.setData(
              "passwordResetConfirmModal",
              "token",
              data.debug_token,
            );
            // What to do with data.debug_token
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
    const newPassword = document
      .getElementById("newPasswordReset")
      .value.trim();
    const confirmPassword = document
      .getElementById("confirmPasswordReset")
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
      const response = await AuthManager.confirmPasswordReset(
        ModalManager.getData("passwordResetConfirmModal", "token"),
        newPassword,
      );

      if (response.ok) {
        ModalManager.hide("passwordResetConfirmModal");
        NotificationManager.showSuccess(
          "Password has been reset successfully! You can now login with your new password.",
        );

        // Clear stored token
        ModalManager.setData("passwordResetConfirmModal", "token", null);
        this.resetToken = null;

        // Show login modal
        setTimeout(() => {
          ModalManager.show("loginModal");
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
}

export default new AuthUI();

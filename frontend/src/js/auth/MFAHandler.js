// MFAHandler.js
// Handles all MFA-specific UI and logic (login-time and profile management)

import AuthManager from "./AuthManager.js";
import ModalManager from "../modalManager.js";
import NotificationManager from "../notifications.js";
import config from "../config.js";
import SpinnerManager from "../SpinnerManager.js";

class MFAHandler {
  constructor() {
    this.apiBase = config.apiBaseUrl;
    this.authManager = AuthManager;
    this.setupData = null;
    this.currentBackupCodes = [];
    this.verifiedTotpCode = null;
    this.init();
  }

  // --- Login-time MFA verification ---
  showMFAModal(session) {
    // Render MFA modal (or ensure it's in DOM)
    // Set up event listeners for code input and submit
    // Use ModalManager to show/hide
    // Use session (email, password, temp_token) as needed
    // (Implementation can be filled in as needed)
  }

  async verifyMFA(email, password, code) {
    try {
      const response = await AuthManager.loginMFA(email, password, code);
      if (response.ok) {
        const data = await response.json();
        AuthManager.setToken(data.access_token);
        AuthManager.setCurrentUser(data.user);
        ModalManager.hide("mfaVerificationModal");
        NotificationManager.showSuccess("Welcome back!");
      } else {
        const error = await response.json();
        NotificationManager.showError(
          error.detail || "Invalid authentication code",
        );
      }
    } catch (error) {
      NotificationManager.showError("Network error. Please try again.");
    }
  }

  // --- MFA Profile Management (from legacy mfa.js) ---
  init() {
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Event delegation for MFA buttons (see mfa.js for details)
    document.addEventListener("click", (e) => {
      const target = e.target;
      const buttonTarget = target.closest("button") || target;
      if (
        buttonTarget.id === "mfaEnableBtn" ||
        target.closest("#mfaEnableBtn")
      ) {
        e.preventDefault();
        this.startMFASetup();
      }
      if (
        buttonTarget.id === "mfaDetailsDisableBtn" ||
        target.closest("#mfaDetailsDisableBtn")
      ) {
        e.preventDefault();
        const disableForm = document.getElementById("disableMFAForm");
        if (disableForm && disableForm.classList.contains("show")) {
          this.hideDisableMFAForm();
        } else {
          this.showDisableMFAForm();
        }
      }
      if (
        buttonTarget.id === "cancelDisableMFABtn" ||
        target.closest("#cancelDisableMFABtn")
      ) {
        e.preventDefault();
        this.hideDisableMFAForm();
      }
      if (
        buttonTarget.id === "confirmDisableMFABtn" ||
        target.closest("#confirmDisableMFABtn")
      ) {
        e.preventDefault();
        this.disableMFA();
      }
      if (
        buttonTarget.id === "mfaDetailsBackupCodesBtn" ||
        target.closest("#mfaDetailsBackupCodesBtn")
      ) {
        e.preventDefault();
        this.toggleBackupCodesSection();
      }
      if (
        buttonTarget.id === "mfaDetailsRegenerateCodesBtn" ||
        target.closest("#mfaDetailsRegenerateCodesBtn")
      ) {
        e.preventDefault();
        const regenerateForm = document.getElementById("regenerateCodesForm");
        if (regenerateForm && regenerateForm.classList.contains("show")) {
          this.hideRegenerateForm();
        } else {
          this.showRegenerateForm();
        }
      }
      if (
        buttonTarget.id === "cancelRegenerateBtn" ||
        target.closest("#cancelRegenerateBtn")
      ) {
        e.preventDefault();
        this.hideRegenerateForm();
      }
      if (
        buttonTarget.id === "downloadBackupCodes" ||
        target.closest("#downloadBackupCodes")
      ) {
        e.preventDefault();
        this.downloadBackupCodes();
      }
      if (
        buttonTarget.id === "printBackupCodes" ||
        target.closest("#printBackupCodes")
      ) {
        e.preventDefault();
        this.printBackupCodes();
      }
    });
    document.addEventListener("submit", (e) => {
      if (e.target.id === "regenerateCodesFormSubmit") {
        e.preventDefault();
        this.regenerateBackupCodes();
      }
      if (e.target.id === "disableMFAFormSubmit") {
        e.preventDefault();
        this.disableMFA();
      }
    });
    document.addEventListener("shown.bs.collapse", (e) => {
      if (e.target.id === "backupCodesSection") {
        this.updateBackupCodesButton(true);
      }
    });
    document.addEventListener("hidden.bs.collapse", (e) => {
      if (e.target.id === "backupCodesSection") {
        this.updateBackupCodesButton(false);
      }
    });
  }

  startMFASetup() {
    // Implementation for starting MFA setup
  }

  hideDisableMFAForm() {
    // Implementation for hiding the disable MFA form
  }

  showDisableMFAForm() {
    // Implementation for showing the disable MFA form
  }

  disableMFA() {
    // Implementation for disabling MFA
  }

  toggleBackupCodesSection() {
    // Implementation for toggling the backup codes section
  }

  hideRegenerateForm() {
    // Implementation for hiding the regenerate form
  }

  showRegenerateForm() {
    // Implementation for showing the regenerate form
  }

  downloadBackupCodes() {
    // Implementation for downloading backup codes
  }

  printBackupCodes() {
    // Implementation for printing backup codes
  }

  regenerateBackupCodes() {
    // Implementation for regenerating backup codes
  }

  updateBackupCodesButton(show) {
    // Implementation for updating the backup codes button
  }
}

export default new MFAHandler();

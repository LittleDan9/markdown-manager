// MFAHandler.js
// Handles all MFA-specific UI and logic (login-time and profile management)

import AuthManager from "./AuthManager.js";
import AuthUI from "./AuthUI.js";
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
    console.log(session);
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
        this.verifyMFA(
          session.email,
          session.password,
          e.target.mfaLoginCode.value,
        );
      });

    document.getElementById("mfaBackToLogin").addEventListener("click", () => {
      ModalManager.hide("mfaVerificationModal");
      ModalManager.show("loginModal");
      // Reset login form
      const loginForm = document.getElementById("loginForm");
      if (loginForm) {
        loginForm.reset();
      }
    });

    // Auto-format code input
    const codeInput = document.getElementById("mfaLoginCode");
    codeInput.addEventListener("input", (e) => {
      e.target.value = e.target.value.replace(/\D/g, "");
    });

    ModalManager.show("mfaVerificationModal");

    ModalManager.onShow("mfaVerificationModal", () => {
      // Focus the code input when modal is shown
      const codeInput = document.getElementById("mfaLoginCode");
      if (codeInput) {
        codeInput.focus();
      }
    });

    // Use session (email, password, temp_token) as needed
    // (Implementation can be filled in as needed)
  }

  async verifyMFA(email, password, code) {
    try {
      const response = await AuthManager.loginMFA(email, password, code);
      if (response.ok) {
        const data = await response.json();
        AuthManager.setToken(data.access_token);
        AuthUI.setCurrentUser(data.user);
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

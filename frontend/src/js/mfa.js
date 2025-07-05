/**
 * MFA (Multi-Factor Authentication) Module
 * Handles TOTP setup, verification, and management
 */

import NotificationManager from './notifications.js';
import config from './config.js';

class MFAManager {
    constructor() {
        this.apiBase = config.apiBaseUrl;
        this.authManager = null; // Will be set by AuthManager
        this.setupData = null; // Stores setup response data
        this.init();
    }

    init() {
        this.setupEventListeners();
    }

    /**
     * Set reference to AuthManager for accessing current user and auth methods
     */
    setAuthManager(authManager) {
        this.authManager = authManager;
    }

    setupEventListeners() {
        // Event delegation for MFA buttons
        document.addEventListener('click', (e) => {
            // Use a more robust event delegation pattern that catches clicks on child elements
            const target = e.target;
            const buttonTarget = target.closest('button') || target;

            if (buttonTarget.id === 'mfaEnableBtn' || target.closest('#mfaEnableBtn')) {
                e.preventDefault();
                this.startMFASetup();
            }

            if (buttonTarget.id === 'mfaDetailsDisableBtn' || target.closest('#mfaDetailsDisableBtn')) {
                e.preventDefault();

                // Toggle between show/hide disable form
                const disableForm = document.getElementById('disableMFAForm');
                if (disableForm && disableForm.classList.contains('show')) {
                    this.hideDisableMFAForm();
                } else {
                    this.showDisableMFAForm();
                }
            }

            if (buttonTarget.id === 'cancelDisableMFABtn' || target.closest('#cancelDisableMFABtn')) {
                e.preventDefault();
                this.hideDisableMFAForm();
            }

            if (buttonTarget.id === 'confirmDisableMFABtn' || target.closest('#confirmDisableMFABtn')) {
                e.preventDefault();
                this.disableMFA();
            }

            if (buttonTarget.id === 'mfaDetailsBackupCodesBtn' || target.closest('#mfaDetailsBackupCodesBtn')) {
                e.preventDefault();
                this.toggleBackupCodesSection();
            }

            if (buttonTarget.id === 'mfaDetailsRegenerateCodesBtn' || target.closest('#mfaDetailsRegenerateCodesBtn')) {
                e.preventDefault();

                // Toggle between show/hide regenerate form
                const regenerateForm = document.getElementById('regenerateCodesForm');
                if (regenerateForm && regenerateForm.classList.contains('show')) {
                    this.hideRegenerateForm();
                } else {
                    this.showRegenerateForm();
                }
            }

            if (buttonTarget.id === 'cancelRegenerateBtn' || target.closest('#cancelRegenerateBtn')) {
                e.preventDefault();
                this.hideRegenerateForm();
            }

            if (buttonTarget.id === 'downloadBackupCodes' || target.closest('#downloadBackupCodes')) {
                e.preventDefault();
                this.downloadBackupCodes();
            }

            if (buttonTarget.id === 'printBackupCodes' || target.closest('#printBackupCodes')) {
                e.preventDefault();
                this.printBackupCodes();
            }
        });

        // Handle form submissions
        document.addEventListener('submit', (e) => {
            if (e.target.id === 'regenerateCodesFormSubmit') {
                e.preventDefault();
                this.regenerateBackupCodes();
            }

            if (e.target.id === 'disableMFAFormSubmit') {
                e.preventDefault();
                this.disableMFA();
            }
        });

        // Listen for collapse events to update button text
        document.addEventListener('shown.bs.collapse', (e) => {
            if (e.target.id === 'backupCodesSection') {
                this.updateBackupCodesButton(true);
            }
        });

        document.addEventListener('hidden.bs.collapse', (e) => {
            if (e.target.id === 'backupCodesSection') {
                this.updateBackupCodesButton(false);
            }
        });
    }

    /**
     * Update MFA status in profile modal
     */
    updateMFAStatus() {
        const mfaDisabledCard = document.getElementById('profileMFADisabled');
        const mfaEnabledCard = document.getElementById('profileMFAEnabled');
        const mfaTabContainer = document.getElementById('mfa-tab-container');

        if (this.authManager?.currentUser?.mfa_enabled) {
            // Show enabled state
            if (mfaDisabledCard) mfaDisabledCard.style.display = 'none';
            if (mfaEnabledCard) mfaEnabledCard.style.display = 'block';
            if (mfaTabContainer) mfaTabContainer.style.display = 'block';
        } else {
            // Show disabled state
            if (mfaDisabledCard) mfaDisabledCard.style.display = 'block';
            if (mfaEnabledCard) mfaEnabledCard.style.display = 'none';
            if (mfaTabContainer) mfaTabContainer.style.display = 'none';
        }
    }

    /**
     * Start MFA setup process
     */
    async startMFASetup() {
        const enableBtn = document.getElementById('mfaEnableBtn');

        try {
            const response = await this.apiCall('/mfa/setup', 'POST');

            if (response.ok) {
                this.setupData = await response.json();

                // Hide the profile modal properly before showing MFA setup
                const profileModalElement = document.getElementById('profileModal');
                const profileModal = bootstrap.Modal.getInstance(profileModalElement);

                if (profileModal && profileModalElement) {
                    // Hide profile modal and wait for it to be fully hidden
                    profileModal.hide();

                    // Wait for modal to be completely hidden before showing MFA modal
                    profileModalElement.addEventListener('hidden.bs.modal', () => {
                        // Clean up any remaining modal states
                        const backdrops = document.querySelectorAll('.modal-backdrop');
                        backdrops.forEach(backdrop => backdrop.remove());
                        document.body.classList.remove('modal-open');
                        document.body.style.overflow = '';
                        document.body.style.paddingRight = '';

                        // Show MFA setup modal
                        setTimeout(() => {
                            this.showSetupModal();
                        }, 100);
                    }, { once: true });
                } else {
                    // Profile modal not found or not initialized, show MFA modal directly
                    this.showSetupModal();
                }
            } else {
                const error = await response.json();
                NotificationManager.showError(error.detail || 'Failed to start MFA setup');
            }
        } catch (error) {
            console.error('MFA setup error:', error);
            NotificationManager.showError('Network error. Please try again.');
        }
    }

    /**
     * Show MFA setup modal with collapsible panels
     */
    showSetupModal() {
        console.log('showSetupModal called');

        // Remove any existing MFA modal and its backdrop
        const existingMFAModal = document.getElementById('mfaSetupModal');
        if (existingMFAModal) {
            const existingInstance = bootstrap.Modal.getInstance(existingMFAModal);
            if (existingInstance) {
                existingInstance.hide();
                existingInstance.dispose();
            }
            existingMFAModal.remove();
        }

        // Also clean up any leftover modal backdrops
        const existingBackdrops = document.querySelectorAll('.modal-backdrop');
        existingBackdrops.forEach(backdrop => backdrop.remove());

        // Reset body classes that might be left over
        document.body.classList.remove('modal-open');
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';

        // Create modal HTML with collapsible panels
        const modalHtml = `
            <div class="modal fade" id="mfaSetupModal" tabindex="-1" aria-labelledby="mfaSetupModalLabel" aria-hidden="true">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="mfaSetupModalLabel">
                                <i class="bi bi-shield-plus me-2"></i>Enable Two-Factor Authentication
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <!-- Progress indicator -->
                            <div class="d-flex justify-content-between align-items-center mb-3">
                                <div class="progress flex-grow-1 me-3" style="height: 6px;">
                                    <div class="progress-bar" id="mfaProgress" role="progressbar" style="width: 25%" aria-valuenow="25" aria-valuemin="0" aria-valuemax="100"></div>
                                </div>
                                <small class="text-muted" id="mfaProgressText">Step 1 of 4</small>
                            </div>

                            <!-- Accordion for MFA setup steps -->
                            <div class="accordion" id="mfaSetupAccordion">

                                <!-- Step 1: QR Code -->
                                <div class="accordion-item">
                                    <h2 class="accordion-header" id="qrHeading">
                                        <button class="accordion-button" type="button" data-bs-toggle="collapse" data-bs-target="#qrCollapse" aria-expanded="true" aria-controls="qrCollapse">
                                            <i class="bi bi-qr-code me-2"></i>
                                            <span class="fw-bold">Step 1: Scan QR Code</span>
                                        </button>
                                    </h2>
                                    <div id="qrCollapse" class="accordion-collapse collapse show" aria-labelledby="qrHeading" data-bs-parent="#mfaSetupAccordion">
                                        <div class="accordion-body">
                                            <p class="text-muted mb-4">Use your authenticator app to scan this QR code:</p>

                                            <div class="row">
                                                <div class="col-md-6 text-center">
                                                    <div class="qr-code-container mb-3">
                                                        <img id="mfaQRCode" src="${this.setupData.qr_code_data_url}"
                                                             alt="QR Code" class="img-fluid border rounded" style="max-width: 200px;">
                                                    </div>
                                                </div>
                                                <div class="col-md-6">
                                                    <div class="manual-entry">
                                                        <p class="small text-muted">Can't scan? Enter this code manually:</p>
                                                        <div class="input-group mb-3">
                                                            <input type="text" class="form-control font-monospace"
                                                                   id="mfaSecret" value="${this.setupData.secret}" readonly>
                                                            <button class="btn btn-outline-secondary" type="button" id="copySecretBtn">
                                                                <i class="bi bi-clipboard"></i>
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <div class="alert alert-info">
                                                        <small>
                                                            <i class="bi bi-info-circle me-1"></i>
                                                            Recommended apps: Google Authenticator, Authy, or 1Password
                                                        </small>
                                                    </div>
                                                </div>
                                            </div>

                                            <div class="text-end mt-4">
                                                <button type="button" class="btn btn-primary" id="mfaNextToVerify">
                                                    Next: Verify Setup <i class="bi bi-arrow-right ms-1"></i>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <!-- Step 2: TOTP Verification -->
                                <div class="accordion-item">
                                    <h2 class="accordion-header" id="verifyHeading">
                                        <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#verifyCollapse" aria-expanded="false" aria-controls="verifyCollapse" disabled>
                                            <i class="bi bi-shield-check me-2"></i>
                                            <span class="fw-bold">Step 2: Verify Setup</span>
                                        </button>
                                    </h2>
                                    <div id="verifyCollapse" class="accordion-collapse collapse" aria-labelledby="verifyHeading" data-bs-parent="#mfaSetupAccordion">
                                        <div class="accordion-body">
                                            <p class="text-muted mb-4">Enter the 6-digit code from your authenticator app:</p>

                                            <form id="mfaVerifyForm">
                                                <div class="row justify-content-center">
                                                    <div class="col-md-6">
                                                        <div class="mb-3">
                                                            <input type="text" class="form-control form-control-lg text-center"
                                                                   id="mfaVerifyCode" placeholder="000000" maxlength="6"
                                                                   pattern="[0-9]{6}" required>
                                                        </div>
                                                        <div class="alert alert-danger d-none" id="mfaVerifyError"></div>
                                                    </div>
                                                </div>

                                                <div class="d-flex justify-content-between mt-4">
                                                    <button type="button" class="btn btn-secondary" id="mfaBackToQR">
                                                        <i class="bi bi-arrow-left me-1"></i>Back
                                                    </button>
                                                    <button type="submit" class="btn btn-primary" id="mfaVerifyBtn">
                                                        <span class="spinner-border spinner-border-sm me-2 d-none" id="mfaVerifySpinner"></span>
                                                        Verify Code
                                                    </button>
                                                </div>
                                            </form>
                                        </div>
                                    </div>
                                </div>

                                <!-- Step 3: Password Confirmation -->
                                <div class="accordion-item">
                                    <h2 class="accordion-header" id="passwordHeading">
                                        <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#passwordCollapse" aria-expanded="false" aria-controls="passwordCollapse" disabled>
                                            <i class="bi bi-key me-2"></i>
                                            <span class="fw-bold">Step 3: Confirm Password</span>
                                        </button>
                                    </h2>
                                    <div id="passwordCollapse" class="accordion-collapse collapse" aria-labelledby="passwordHeading" data-bs-parent="#mfaSetupAccordion">
                                        <div class="accordion-body">
                                            <div class="text-center mb-4">
                                                <i class="bi bi-check-circle-fill text-success" style="font-size: 2rem;"></i>
                                                <h6 class="fw-bold mt-3">Verification Successful!</h6>
                                                <p class="text-muted">Your authenticator app is properly configured. Enter your password to enable two-factor authentication.</p>
                                            </div>

                                            <form id="mfaEnableForm">
                                                <div class="row justify-content-center">
                                                    <div class="col-md-6">
                                                        <div class="mb-3">
                                                            <label for="mfaEnablePassword" class="form-label">Current Password</label>
                                                            <input type="password" class="form-control" id="mfaEnablePassword" required>
                                                        </div>
                                                        <div class="alert alert-danger d-none" id="mfaEnableError"></div>
                                                    </div>
                                                </div>

                                                <div class="d-flex justify-content-between mt-4">
                                                    <button type="button" class="btn btn-secondary" id="mfaBackToVerify">
                                                        <i class="bi bi-arrow-left me-1"></i>Back
                                                    </button>
                                                    <button type="submit" class="btn btn-success" id="mfaEnableFinalBtn">
                                                        <span class="spinner-border spinner-border-sm me-2 d-none" id="mfaEnableSpinner"></span>
                                                        <i class="bi bi-shield-plus me-2"></i>Enable Two-Factor Authentication
                                                    </button>
                                                </div>
                                            </form>
                                        </div>
                                    </div>
                                </div>

                                <!-- Step 4: Backup Codes -->
                                <div class="accordion-item">
                                    <h2 class="accordion-header" id="backupHeading">
                                        <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#backupCollapse" aria-expanded="false" aria-controls="backupCollapse" disabled>
                                            <i class="bi bi-shield-check me-2"></i>
                                            <span class="fw-bold">Step 4: Save Backup Codes</span>
                                        </button>
                                    </h2>
                                    <div id="backupCollapse" class="accordion-collapse collapse" aria-labelledby="backupHeading" data-bs-parent="#mfaSetupAccordion">
                                        <div class="accordion-body">
                                            <div class="text-center mb-4">
                                                <i class="bi bi-check-circle-fill text-success" style="font-size: 3rem;"></i>
                                                <h6 class="fw-bold mt-3">Two-Factor Authentication Enabled!</h6>
                                                <p class="text-muted">Your account is now protected with an extra layer of security.</p>
                                            </div>

                                            <div class="alert alert-warning">
                                                <h6 class="alert-heading">
                                                    <i class="bi bi-key me-2"></i>Save Your Backup Codes
                                                </h6>
                                                <p class="mb-3">These one-time backup codes can be used to access your account if you lose your device:</p>
                                                <div class="backup-codes-grid" id="mfaBackupCodes">
                                                    <!-- Backup codes will be populated here after MFA is enabled -->
                                                </div>
                                                <div class="mt-3">
                                                    <button type="button" class="btn btn-outline-primary btn-sm" id="downloadBackupCodes">
                                                        <i class="bi bi-download me-1"></i>Download Codes
                                                    </button>
                                                </div>
                                            </div>

                                            <div class="text-center mt-4">
                                                <button type="button" class="btn btn-success" id="mfaCompleteBtn">
                                                    <i class="bi bi-check-lg me-1"></i>Complete Setup
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add modal to DOM
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Use setTimeout to ensure DOM is fully updated
        setTimeout(() => {
            // Ensure modal element exists before proceeding
            const modalElement = document.getElementById('mfaSetupModal');
            if (!modalElement) {
                console.error('MFA setup modal element not found after insertion');
                NotificationManager.showError('Failed to create MFA setup modal. Please try again.');
                return;
            }

            try {
                // Set up modal event listeners
                this.setupModalEventListeners();

                // Initialize accordion step states
                this.initializeAccordionStates();

                // Create and show modal
                const modal = new bootstrap.Modal(modalElement, {
                    backdrop: true,
                    keyboard: true,
                    focus: true
                });

                modal.show();
            } catch (error) {
                console.error('Error creating MFA modal:', error);
                NotificationManager.showError('Failed to initialize MFA setup modal. Please try again.');
                // Clean up the modal element if it exists
                if (modalElement) {
                    modalElement.remove();
                }
            }
        }, 100);
    }

    /**
     * Initialize accordion step states
     */
    initializeAccordionStates() {
        // Enable only the first step initially
        this.setAccordionStepState(1, true);
        this.setAccordionStepState(2, false);
        this.setAccordionStepState(3, false);
        this.setAccordionStepState(4, false);
    }

    /**
     * Set up event listeners for MFA setup modal
     */
    setupModalEventListeners() {
        // Copy secret button
        document.getElementById('copySecretBtn')?.addEventListener('click', () => {
            const secretField = document.getElementById('mfaSecret');
            navigator.clipboard.writeText(secretField.value);
            const btn = document.getElementById('copySecretBtn');
            const originalIcon = btn.innerHTML;
            btn.innerHTML = '<i class="bi bi-check"></i>';
            setTimeout(() => {
                btn.innerHTML = originalIcon;
            }, 2000);
        });

        // Step 1: Next to verify button
        document.getElementById('mfaNextToVerify')?.addEventListener('click', () => {
            // Mark QR step as complete and enable verify step
            this.markAccordionStepComplete(1);
            this.setAccordionStepState(2, true);
            this.goToAccordionStep(2);
        });

        // Step 2: Verify form
        document.getElementById('mfaVerifyForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.verifySetup();
        });

        // Step 2: Back to QR button
        document.getElementById('mfaBackToQR')?.addEventListener('click', () => {
            this.goToAccordionStep(1);
        });

        // Step 3: Enable MFA form
        document.getElementById('mfaEnableForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.enableMFAWithPassword();
        });

        // Step 3: Back to verify button
        document.getElementById('mfaBackToVerify')?.addEventListener('click', () => {
            this.goToAccordionStep(2);
        });

        // Step 4: Download backup codes
        document.getElementById('downloadBackupCodes')?.addEventListener('click', () => {
            this.downloadBackupCodes();
        });

        // Step 4: Complete setup
        document.getElementById('mfaCompleteBtn')?.addEventListener('click', () => {
            this.completeSetup();
        });

        // Auto-format verification code input
        const verifyInput = document.getElementById('mfaVerifyCode');
        if (verifyInput) {
            verifyInput.addEventListener('input', (e) => {
                e.target.value = e.target.value.replace(/\D/g, '');
            });
        }
    }

    /**
     * Navigate to accordion step with proper Bootstrap collapse handling
     */
    goToAccordionStep(step) {
        console.log('Navigating to accordion step:', step);

        // Step mapping
        const stepMap = {
            1: { id: 'qrCollapse', heading: 'qrHeading', progress: 25 },
            2: { id: 'verifyCollapse', heading: 'verifyHeading', progress: 50 },
            3: { id: 'passwordCollapse', heading: 'passwordHeading', progress: 75 },
            4: { id: 'backupCollapse', heading: 'backupHeading', progress: 100 }
        };

        const currentStep = stepMap[step];
        if (!currentStep) {
            console.error('Invalid step:', step);
            return;
        }

        // Update progress bar
        const progressBar = document.getElementById('mfaProgress');
        if (progressBar) {
            progressBar.style.width = `${currentStep.progress}%`;
            progressBar.setAttribute('aria-valuenow', currentStep.progress);

            // Add progress text
            const progressText = document.getElementById('mfaProgressText');
            if (progressText) {
                progressText.textContent = `Step ${step} of 4`;
            }
        }

        // Enable the target step's accordion button
        const targetButton = document.querySelector(`#${currentStep.heading} button`);
        if (targetButton) {
            targetButton.disabled = false;
        }

        // Collapse all other steps and expand target step
        Object.values(stepMap).forEach(({ id, heading }) => {
            const collapse = document.getElementById(id);
            const button = document.querySelector(`#${heading} button`);

            if (id === currentStep.id) {
                // Expand target step
                if (collapse && !collapse.classList.contains('show')) {
                    new bootstrap.Collapse(collapse, { toggle: true });
                }
            } else {
                // Collapse other steps
                if (collapse && collapse.classList.contains('show')) {
                    new bootstrap.Collapse(collapse, { toggle: false });
                }
            }
        });

        // Focus on relevant input
        setTimeout(() => {
            if (step === 2) {
                const verifyInput = document.getElementById('mfaVerifyCode');
                if (verifyInput) {
                    verifyInput.focus();
                }
            } else if (step === 3) {
                const passwordInput = document.getElementById('mfaEnablePassword');
                if (passwordInput) {
                    passwordInput.focus();
                }
            }
        }, 300); // Wait for accordion animation
    }

    /**
     * Enable/disable accordion steps based on current progress
     */
    setAccordionStepState(step, enabled = true) {
        const stepMap = {
            1: 'qrHeading',
            2: 'verifyHeading',
            3: 'passwordHeading',
            4: 'backupHeading'
        };

        const headingId = stepMap[step];
        if (!headingId) return;

        const button = document.querySelector(`#${headingId} button`);
        if (button) {
            button.disabled = !enabled;

            // Update visual state
            const parent = button.closest('.accordion-item');
            if (parent) {
                if (enabled) {
                    parent.classList.remove('step-disabled');
                } else {
                    parent.classList.add('step-disabled');
                }
            }
        }
    }

    /**
     * Mark accordion step as completed
     */
    markAccordionStepComplete(step) {
        const stepMap = {
            1: 'qrHeading',
            2: 'verifyHeading',
            3: 'passwordHeading',
            4: 'backupHeading'
        };

        const headingId = stepMap[step];
        if (!headingId) return;

        const button = document.querySelector(`#${headingId} button`);
        if (button) {
            const icon = button.querySelector('i');
            if (icon) {
                // Change icon to checkmark
                icon.className = 'bi bi-check-circle-fill text-success me-2';
            }

            // Add completed class
            button.closest('.accordion-item')?.classList.add('step-completed');
        }
    }

    /**
     * Navigate to setup step (legacy method for backward compatibility)
     */
    goToSetupStep(step) {
        console.log('Navigating to step:', step);

        // Use Bootstrap classes instead of style.display
        document.querySelectorAll('.mfa-setup-step').forEach(el => {
            el.classList.add('d-none');
            el.classList.remove('d-block');
        });

        // Show target step using Bootstrap classes
        const stepId = step === 2.5 ? 'mfaSetupStep2_5' : `mfaSetupStep${step}`;
        const targetStep = document.getElementById(stepId);
        if (targetStep) {
            targetStep.classList.remove('d-none');
            targetStep.classList.add('d-block');
            console.log('Showing step:', stepId);

            // Focus on verification input if step 2
            if (step === 2) {
                setTimeout(() => {
                    const verifyInput = document.getElementById('mfaVerifyCode');
                    if (verifyInput) {
                        verifyInput.focus();
                    }
                }, 100);
            }
        } else {
            console.error('Target step not found:', stepId);
        }
    }

    /**
     * Verify TOTP code during setup
     */
    async verifySetup() {
        const code = document.getElementById('mfaVerifyCode').value;
        const errorEl = document.getElementById('mfaVerifyError');
        const spinner = document.getElementById('mfaVerifySpinner');
        const submitBtn = document.getElementById('mfaVerifyBtn');

        if (!code || code.length !== 6) {
            this.showError(errorEl, 'Please enter a 6-digit code');
            return;
        }

        spinner.classList.remove('d-none');
        spinner.classList.add('d-inline-block');
        submitBtn.disabled = true;
        this.hideError(errorEl);

        try {
            console.log('Verifying TOTP code:', code);
            const response = await this.apiCall('/mfa/verify', 'POST', {
                totp_code: code
            });

            console.log('Verify response status:', response.status);

            if (response.ok) {
                // Verification successful, store the code and move to password step
                console.log('TOTP verification successful');
                this.verifiedTotpCode = code; // Store the verified code

                // Mark verify step as complete and enable password step
                this.markAccordionStepComplete(2);
                this.setAccordionStepState(3, true);

                this.goToAccordionStep(3); // Show password confirmation step
            } else {
                const error = await response.json();
                console.error('Verify error response:', error);
                this.showError(errorEl, error.detail || 'Invalid verification code');
            }
        } catch (error) {
            console.error('MFA verify error:', error);
            this.showError(errorEl, 'Network error. Please try again.');
        } finally {
            spinner.classList.add('d-none');
            spinner.classList.remove('d-inline-block');
            submitBtn.disabled = false;
        }
    }

    /**
     * Enable MFA using the verified TOTP code and password from the form
     */
    async enableMFAWithPassword() {
        if (!this.verifiedTotpCode) {
            NotificationManager.showError('No verified TOTP code available. Please start over.');
            return;
        }

        const password = document.getElementById('mfaEnablePassword').value;
        const enableBtn = document.getElementById('mfaEnableFinalBtn');
        const spinner = document.getElementById('mfaEnableSpinner');
        const errorEl = document.getElementById('mfaEnableError');

        if (!password) {
            this.showError(errorEl, 'Password is required');
            return;
        }

        enableBtn.disabled = true;
        spinner.classList.remove('d-none');
        spinner.classList.add('d-inline-block');
        this.hideError(errorEl);

        try {
            console.log('Enabling MFA with verified TOTP code and password...');
            const response = await this.apiCall('/mfa/enable', 'POST', {
                totp_code: this.verifiedTotpCode,
                current_password: password
            });

            console.log('Enable MFA response status:', response.status);

            if (response.ok) {
                console.log('MFA enabled successfully');
                const result = await response.json();

                // Update setup data with backup codes from response
                if (result.backup_codes) {
                    this.setupData.backup_codes = result.backup_codes;

                    // Populate backup codes in the modal
                    const backupCodesContainer = document.getElementById('mfaBackupCodes');
                    if (backupCodesContainer) {
                        backupCodesContainer.innerHTML = result.backup_codes.map(code =>
                            `<span class="badge bg-light text-dark font-monospace" style="cursor: pointer;" onclick="navigator.clipboard.writeText('${code}'); this.style.backgroundColor='#d4edda'; setTimeout(() => this.style.backgroundColor='', 1000);" title="Click to copy">${code}</span>`
                        ).join('');
                    }
                }

                // Mark password step as complete and enable backup codes step
                this.markAccordionStepComplete(3);
                this.setAccordionStepState(4, true);

                // Update user object
                if (this.authManager?.currentUser) {
                    this.authManager.currentUser.mfa_enabled = true;
                }
                this.goToAccordionStep(4); // Show backup codes step
            } else {
                const error = await response.json();
                console.error('Enable MFA error response:', error);
                this.showError(errorEl, error.detail || 'Failed to enable MFA');
            }
        } catch (error) {
            console.error('MFA enable error:', error);
            this.showError(errorEl, error.message || 'Failed to enable MFA');
        } finally {
            enableBtn.disabled = false;
            spinner.classList.add('d-none');
            spinner.classList.remove('d-inline-block');
        }
    }

    /**
     * Download backup codes as text file (from setup modal)
     */
    /**
     * Complete MFA setup and close modal
     */
    completeSetup() {
        const mfaModalElement = document.getElementById('mfaSetupModal');
        const modal = bootstrap.Modal.getInstance(mfaModalElement);

        if (modal && mfaModalElement) {
            modal.hide();

            // Wait for modal to close then show profile modal
            mfaModalElement.addEventListener('hidden.bs.modal', () => {
                // Clean up modal safely
                const currentModal = bootstrap.Modal.getInstance(mfaModalElement);
                if (currentModal) {
                    currentModal.dispose();
                }

                // Remove modal element
                if (mfaModalElement && mfaModalElement.parentNode) {
                    mfaModalElement.remove();
                }

                // Refresh user data from server to get updated MFA status
                if (this.authManager && typeof this.authManager.checkAuthStatus === 'function') {
                    this.authManager.checkAuthStatus().then(() => {
                        // Update profile UI after refreshing user data
                        this.updateMFAStatus();
                    }).catch(() => {
                        // If refresh fails, still update UI with current data
                        this.updateMFAStatus();
                    });
                } else {
                    // Update profile UI directly if no refresh method available
                    this.updateMFAStatus();
                }

                // Reopen profile modal
                const profileModalElement = document.getElementById('profileModal');
                if (profileModalElement) {
                    const profileModal = new bootstrap.Modal(profileModalElement);
                    profileModal.show();

                    // Switch to security tab
                    const securityTab = document.getElementById('security-tab');
                    securityTab?.click();
                }

                NotificationManager.showSuccess('Two-factor authentication has been enabled successfully!');
            }, { once: true });
        } else {
            // Modal not found or instance is null, handle gracefully
            console.warn('MFA modal not found or instance is null');

            // Still try to clean up
            if (mfaModalElement && mfaModalElement.parentNode) {
                mfaModalElement.remove();
            }

            // Update profile UI
            this.updateMFAStatus();

            // Show success message
            NotificationManager.showSuccess('Two-factor authentication has been enabled successfully!');
        }
    }

    /**
     * Cancel MFA setup and restore profile modal
     */
    cancelSetup() {
        const mfaModalElement = document.getElementById('mfaSetupModal');
        const modal = bootstrap.Modal.getInstance(mfaModalElement);

        if (modal && mfaModalElement) {
            modal.hide();

            // Wait for modal to close then show profile modal
            mfaModalElement.addEventListener('hidden.bs.modal', () => {
                // Clean up modal safely
                const currentModal = bootstrap.Modal.getInstance(mfaModalElement);
                if (currentModal) {
                    currentModal.dispose();
                }

                // Remove modal element
                if (mfaModalElement && mfaModalElement.parentNode) {
                    mfaModalElement.remove();
                }

                // Reopen profile modal
                const profileModalElement = document.getElementById('profileModal');
                if (profileModalElement) {
                    const profileModal = new bootstrap.Modal(profileModalElement);
                    profileModal.show();

                    // Switch to security tab
                    const securityTab = document.getElementById('security-tab');
                    securityTab?.click();
                }
            }, { once: true });
        } else {
            // Modal not found or instance is null, handle gracefully
            console.warn('MFA modal not found or instance is null in cancelSetup');

            // Still try to clean up
            if (mfaModalElement && mfaModalElement.parentNode) {
                mfaModalElement.remove();
            }

            // Reopen profile modal
            const profileModalElement = document.getElementById('profileModal');
            if (profileModalElement) {
                const profileModal = new bootstrap.Modal(profileModalElement);
                profileModal.show();

                // Switch to security tab
                const securityTab = document.getElementById('security-tab');
                securityTab?.click();
            }
        }
    }

    /**
     * Show disable MFA confirmation modal
     */
    showDisableMFAForm() {
        const disableForm = document.getElementById('disableMFAForm');
        const disableBtn = document.getElementById('mfaDetailsDisableBtn');

        if (disableForm) {
            const collapse = bootstrap.Collapse.getOrCreateInstance(disableForm);
            collapse.show();

            // Focus on the password input after the collapse animation
            setTimeout(() => {
                const passwordInput = document.getElementById('disableMFAPassword');
                if (passwordInput) {
                    passwordInput.focus();
                }
            }, 300);
        }

        // Update button text to indicate form is open
        if (disableBtn) {
            disableBtn.innerHTML = '<i class="bi bi-x me-2"></i>Cancel';
            disableBtn.classList.remove('btn-outline-danger');
            disableBtn.classList.add('btn-outline-secondary');
        }
    }

    /**
     * Hide the disable MFA form
     */
    hideDisableMFAForm() {
        const disableForm = document.getElementById('disableMFAForm');
        const disableBtn = document.getElementById('mfaDetailsDisableBtn');
        const errorDiv = document.getElementById('disableMFAError');
        const form = document.getElementById('disableMFAFormSubmit');

        if (disableForm) {
            const collapse = bootstrap.Collapse.getOrCreateInstance(disableForm);
            collapse.hide();
        }

        // Reset button text
        if (disableBtn) {
            disableBtn.innerHTML = '<i class="bi bi-shield-x me-2"></i>Disable Two-Factor Authentication';
            disableBtn.classList.remove('btn-outline-secondary');
            disableBtn.classList.add('btn-outline-danger');
        }

        // Ensure submit button is properly reset
        const submitBtn = document.getElementById('confirmDisableMFABtn');
        if (submitBtn) {
            // Manually restore the button to its original state
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2 d-none" id="disableMFASpinner"></span>Disable MFA';
        }

        // Clear form fields manually (don't use form.reset() as it affects button state)
        const passwordInput = document.getElementById('disableMFAPassword');
        const codeInput = document.getElementById('disableMFACode');
        if (passwordInput) passwordInput.value = '';
        if (codeInput) codeInput.value = '';

        if (errorDiv) {
            errorDiv.classList.add('d-none');
            errorDiv.textContent = '';
        }
    }

    /**
     * Disable MFA
     */
    async disableMFA() {
        const password = document.getElementById('disableMFAPassword').value;
        const code = document.getElementById('disableMFACode').value;
        const errorEl = document.getElementById('disableMFAError');
        const spinner = document.getElementById('disableMFASpinner');
        const submitBtn = document.getElementById('confirmDisableMFABtn');

        if (!password || !code) {
            this.showDisableMFAError('Please enter both password and authentication code');
            return;
        }

        this.setButtonLoading(submitBtn, true);
        this.hideDisableMFAError();

        try {
            const response = await this.apiCall('/mfa/disable', 'POST', {
                current_password: password,
                totp_code: code
            });

            if (response.ok) {
                // Update user object
                if (this.authManager?.currentUser) {
                    this.authManager.currentUser.mfa_enabled = false;
                }

                // Hide the disable form
                this.hideDisableMFAForm();

                // Update profile UI
                this.updateMFAStatus();

                // Navigate back to Security tab since MFA Details tab will be hidden
                this.navigateToSecurityTab();

                NotificationManager.showSuccess('Two-factor authentication has been disabled');
            } else {
                const error = await response.json();
                this.showDisableMFAError(error.detail || 'Failed to disable MFA');
            }
        } catch (error) {
            console.error('MFA disable error:', error);
            this.showDisableMFAError('Network error. Please try again.');
        } finally {
            this.setButtonLoading(submitBtn, false);
        }
    }

    /**
     * Show error in disable MFA form
     */
    showDisableMFAError(message) {
        const errorDiv = document.getElementById('disableMFAError');
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.classList.remove('d-none');
        }
    }

    /**
     * Hide error in disable MFA form
     */
    hideDisableMFAError() {
        const errorDiv = document.getElementById('disableMFAError');
        if (errorDiv) {
            errorDiv.classList.add('d-none');
            errorDiv.textContent = '';
        }
    }

    /**
     * Navigate to Security tab after disabling MFA
     */
    navigateToSecurityTab() {
        // Find and activate the Security tab
        const securityTabButton = document.getElementById('security-tab');
        const securityTabPane = document.getElementById('security-settings');
        const mfaTabButton = document.getElementById('mfa-tab');
        const mfaTabPane = document.getElementById('mfa-details');

        if (securityTabButton && securityTabPane) {
            // Remove active class from current tab (MFA Details)
            if (mfaTabButton && mfaTabPane) {
                mfaTabButton.classList.remove('active');
                mfaTabPane.classList.remove('show', 'active');
            }

            // Activate Security tab
            securityTabButton.classList.add('active');
            securityTabPane.classList.add('show', 'active');
        }
    }

    /**
     * Toggle backup codes section (collapse/expand)
     */
    async toggleBackupCodesSection() {
        const backupCodesSection = document.getElementById('backupCodesSection');
        const toggleBtn = document.getElementById('mfaDetailsBackupCodesBtn');

        if (!backupCodesSection || !toggleBtn) return;

        // Check if section is currently shown
        const isShown = backupCodesSection.classList.contains('show');

        if (isShown) {
            // If shown, just collapse it
            const collapse = bootstrap.Collapse.getOrCreateInstance(backupCodesSection);
            collapse.hide();
        } else {
            // If hidden, load backup codes first, then expand
            this.setButtonLoading(toggleBtn, true);

            try {
                const response = await this.apiCall('/mfa/backup-codes', 'GET');

                if (response.ok) {
                    const data = await response.json();
                    this.populateBackupCodesSection(data.backup_codes);

                    // Show the collapse section
                    const collapse = bootstrap.Collapse.getOrCreateInstance(backupCodesSection);
                    collapse.show();
                } else {
                    const error = await response.json();
                    NotificationManager.showError(error.detail || 'Failed to retrieve backup codes');
                }
            } catch (error) {
                console.error('Backup codes error:', error);
                NotificationManager.showError('Network error. Please try again.');
            } finally {
                this.setButtonLoading(toggleBtn, false);
            }
        }
    }

    /**
     * Update the backup codes button text and icon
     */
    updateBackupCodesButton(isVisible) {
        const toggleBtn = document.getElementById('mfaDetailsBackupCodesBtn');
        if (!toggleBtn) return;

        if (isVisible) {
            toggleBtn.innerHTML = '<i class="bi bi-eye-slash me-2"></i>Hide Backup Codes';
        } else {
            toggleBtn.innerHTML = '<i class="bi bi-eye me-2"></i>View Backup Codes';
        }
    }

    /**
     * Populate the backup codes section with codes
     */
    populateBackupCodesSection(backupCodes) {
        const container = document.getElementById('backupCodesContainer');
        const countElement = document.getElementById('backupCodesCount');

        if (container) {
            container.innerHTML = backupCodes.map(code =>
                `<span class="badge bg-light text-dark font-monospace p-2 m-1">${code}</span>`
            ).join('');
        }

        if (countElement) {
            countElement.textContent = `Each code can only be used once. You have ${backupCodes.length} codes remaining.`;
        }

        // Store codes for download/print functionality
        this.currentBackupCodes = backupCodes;
    }

    /**
     * Download backup codes as a text file
     */
    /**
     * Show the regenerate codes form
     */
    showRegenerateForm() {
        const regenerateForm = document.getElementById('regenerateCodesForm');
        const regenerateBtn = document.getElementById('mfaDetailsRegenerateCodesBtn');

        if (regenerateForm) {
            const collapse = bootstrap.Collapse.getOrCreateInstance(regenerateForm);
            collapse.show();

            // Focus on the TOTP input after the collapse animation
            setTimeout(() => {
                const totpInput = document.getElementById('regenerateTotpCode');
                if (totpInput) {
                    totpInput.focus();
                }
            }, 300);
        }

        // Update button text to indicate form is open
        if (regenerateBtn) {
            regenerateBtn.innerHTML = '<i class="bi bi-x me-2"></i>Cancel Regenerate';
            regenerateBtn.classList.remove('btn-outline-warning');
            regenerateBtn.classList.add('btn-outline-secondary');
        }
    }

    /**
     * Hide the regenerate codes form
     */
    hideRegenerateForm() {
        const regenerateForm = document.getElementById('regenerateCodesForm');
        const regenerateBtn = document.getElementById('mfaDetailsRegenerateCodesBtn');
        const errorDiv = document.getElementById('regenerateError');
        const form = document.getElementById('regenerateCodesFormSubmit');
        const submitBtn = document.getElementById('confirmRegenerateBtn');

        if (regenerateForm) {
            const collapse = bootstrap.Collapse.getOrCreateInstance(regenerateForm);
            collapse.hide();
        }

        // Reset button text
        if (regenerateBtn) {
            regenerateBtn.innerHTML = '<i class="bi bi-arrow-clockwise me-2"></i>Regenerate Codes';
            regenerateBtn.classList.remove('btn-outline-secondary');
            regenerateBtn.classList.add('btn-outline-warning');
        }

        // Ensure submit button is properly reset
        if (submitBtn) {
            // Manually restore the button to its original state
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2 d-none" id="regenerateSpinner"></span><i class="bi bi-arrow-clockwise me-2"></i>Generate New Codes';
        }

        // Clear form fields manually (don't use form.reset() as it affects button state)
        const totpInput = document.getElementById('regenerateTotpCode');
        if (totpInput) {
            totpInput.value = '';
        }

        if (errorDiv) {
            errorDiv.classList.add('d-none');
            errorDiv.textContent = '';
        }
    }

    /**
     * Regenerate backup codes with smooth visual transition
     */
    async regenerateBackupCodes() {
        const totpInput = document.getElementById('regenerateTotpCode');
        const submitBtn = document.getElementById('confirmRegenerateBtn');
        const spinner = document.getElementById('regenerateSpinner');
        const errorDiv = document.getElementById('regenerateError');

        if (!totpInput || !totpInput.value.trim()) {
            this.showRegenerateError('Please enter your TOTP code');
            return;
        }

        // Validate TOTP format
        if (!/^\d{6}$/.test(totpInput.value.trim())) {
            this.showRegenerateError('TOTP code must be 6 digits');
            return;
        }

        // Show loading state
        if (submitBtn) this.setButtonLoading(submitBtn, true, 'Generating...');
        if (errorDiv) errorDiv.classList.add('d-none');

        try {
            const response = await this.apiCall('/mfa/regenerate-backup-codes', 'POST', {
                totp_code: totpInput.value.trim()
            });

            if (response.ok) {
                const data = await response.json();
                NotificationManager.showSuccess('New backup codes generated successfully');

                // Hide the regenerate form (this will also reset the button state)
                this.hideRegenerateForm();

                // Update the backup codes section if it's visible with smooth transition
                const backupCodesSection = document.getElementById('backupCodesSection');
                if (backupCodesSection && backupCodesSection.classList.contains('show')) {
                    this.updateBackupCodesWithTransition(data.backup_codes);
                }
            } else {
                const error = await response.json();
                this.showRegenerateError(error.detail || 'Failed to regenerate backup codes');
            }
        } catch (error) {
            console.error('Regenerate backup codes error:', error);
            this.showRegenerateError('Network error. Please try again.');
        } finally {
            // Ensure button loading state is reset as fallback
            if (submitBtn) {
                submitBtn.disabled = false;
                // Only reset if it still shows the loading state
                if (submitBtn.innerHTML.includes('Generating...')) {
                    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2 d-none" id="regenerateSpinner"></span><i class="bi bi-arrow-clockwise me-2"></i>Generate New Codes';
                }
            }
        }
    }

    /**
     * Show error in regenerate form
     */
    showRegenerateError(message) {
        const errorDiv = document.getElementById('regenerateError');
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.classList.remove('d-none');
        }
    }

    /**
     * Update backup codes with smooth visual transition
     */
    updateBackupCodesWithTransition(newCodes) {
        const container = document.getElementById('backupCodesContainer');
        const countElement = document.getElementById('backupCodesCount');

        if (!container) return;

        // Add blur transition effect
        container.style.transition = 'filter 0.3s ease, opacity 0.3s ease';
        container.style.filter = 'blur(5px)';
        container.style.opacity = '0.5';

        setTimeout(() => {
            // Update the codes
            this.populateBackupCodesSection(newCodes);

            // Remove blur effect
            container.style.filter = 'none';
            container.style.opacity = '1';

            // Add a subtle highlight effect
            container.style.boxShadow = '0 0 20px rgba(25, 135, 84, 0.3)';

            setTimeout(() => {
                container.style.boxShadow = 'none';
                container.style.transition = '';
            }, 1000);
        }, 300);
    }

    /**
     * Update backup codes with a smooth transition effect
     */
    updateBackupCodesWithTransition(newBackupCodes) {
        const container = document.getElementById('backupCodesContainer');
        const countElement = document.getElementById('backupCodesCount');

        if (!container) return;

        // Add blur and fade transition
        container.style.transition = 'all 0.3s ease-in-out';
        container.style.filter = 'blur(3px)';
        container.style.opacity = '0.5';

        setTimeout(() => {
            // Update the content
            this.populateBackupCodesSection(newBackupCodes);

            // Add a subtle highlight to show codes changed
            container.style.backgroundColor = '#d4edda';
            container.style.padding = '10px';
            container.style.borderRadius = '5px';
            container.style.border = '1px solid #c3e6cb';

            // Remove blur and fade back in
            container.style.filter = 'none';
            container.style.opacity = '1';

            // Remove highlight after a moment
            setTimeout(() => {
                container.style.transition = 'background-color 1s ease-out';
                container.style.backgroundColor = 'transparent';
                container.style.border = 'none';
                container.style.padding = '0';
            }, 1000);
        }, 300);
    }

    /**
     * Download backup codes as a text file
     */
    downloadBackupCodes() {
        if (!this.currentBackupCodes || this.currentBackupCodes.length === 0) {
            NotificationManager.showError('No backup codes available to download');
            return;
        }

        const content = `Markdown Manager - Backup Codes

IMPORTANT: These backup codes can be used to access your account if you lose your authenticator device.
Store them securely and do not share them with anyone.
Each code can only be used once.

Generated: ${new Date().toLocaleString()}

Backup Codes:
${this.currentBackupCodes.map((code, index) => `${index + 1}. ${code}`).join('\n')}

Keep these codes in a safe place!`;

        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'markdown-manager-backup-codes.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        NotificationManager.showSuccess('Backup codes downloaded successfully');
    }

    /**
     * Print backup codes
     */
    printBackupCodes() {
        if (!this.currentBackupCodes || this.currentBackupCodes.length === 0) {
            NotificationManager.showError('No backup codes available to print');
            return;
        }

        const printWindow = window.open('', '_blank');
        const printContent = `
            <html>
            <head>
                <title>Markdown Manager - Backup Codes</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    h1 { color: #333; }
                    .warning { background: #fff3cd; padding: 10px; border-left: 4px solid #ffc107; margin: 10px 0; }
                    .code { font-family: monospace; font-size: 14px; padding: 5px; background: #f8f9fa; margin: 5px 0; }
                    .footer { margin-top: 30px; font-size: 12px; color: #666; }
                </style>
            </head>
            <body>
                <h1>Markdown Manager - Backup Codes</h1>
                <div class="warning">
                    <strong>IMPORTANT:</strong> These backup codes can be used to access your account if you lose your authenticator device.
                    Store them securely and do not share them with anyone. Each code can only be used once.
                </div>
                <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
                <h3>Backup Codes:</h3>
                ${this.currentBackupCodes.map((code, index) =>
                    `<div class="code">${index + 1}. ${code}</div>`
                ).join('')}
                <div class="footer">
                    Keep these codes in a safe place!
                </div>
            </body>
            </html>
        `;

        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.print();
    }
    setButtonLoading(button, loading = true, customText = null) {
        if (!button) return;

        if (loading) {
            button.disabled = true;
            button.dataset.originalText = button.innerHTML;
            const loadingText = customText || 'Loading...';
            button.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>${loadingText}`;
        } else {
            button.disabled = false;
            button.innerHTML = button.dataset.originalText || button.innerHTML;
        }
    }

    /**
     * Make API call with authentication
     */
    async apiCall(endpoint, method = 'GET', body = null) {
        const headers = {
            'Content-Type': 'application/json',
        };

        if (this.authManager?.token) {
            headers['Authorization'] = `Bearer ${this.authManager.token}`;
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
     * Show error message
     */
    showError(element, message) {
        if (element) {
            element.textContent = message;
            element.classList.remove('d-none');
            element.classList.add('d-block');
        }
    }

    /**
     * Hide error message
     */
    hideError(element) {
        if (element) {
            element.classList.add('d-none');
            element.classList.remove('d-block');
        }
    }

}

// Export for use in other modules
export default MFAManager;

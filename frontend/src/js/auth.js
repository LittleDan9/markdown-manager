/**
 * User Authentication Module
 * Handles user login, registration, profile management, and session persistence
 */

import NotificationManager from './notifications.js';
import config from './config.js';

class AuthManager {
    constructor() {
        this.apiBase = config.apiBaseUrl;
        this.currentUser = null;
        this.token = localStorage.getItem('authToken');
        
        // Modal instances cache to prevent multiple instances
        this.modalInstances = new Map();
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkAuthStatus();
        this.setupGlobalModalErrorHandling();
    }

    setupEventListeners() {
        // Check if elements exist
        const loginBtn = document.getElementById('loginBtn');
        const registerBtn = document.getElementById('registerBtn');
        const userMenuDropdown = document.getElementById('userMenuDropdown');

        console.log('AuthManager: Setting up event listeners');
        console.log('LoginBtn found:', !!loginBtn);
        console.log('RegisterBtn found:', !!registerBtn);
        console.log('UserMenuDropdown found:', !!userMenuDropdown);
        console.log('Bootstrap available:', typeof bootstrap !== 'undefined');
        
        // Log dropdown structure
        if (userMenuDropdown) {
            console.log('Dropdown element:', userMenuDropdown);
            console.log('Next sibling (should be menu):', userMenuDropdown.nextElementSibling);
            console.log('Parent element:', userMenuDropdown.parentElement);
        }

        if (!loginBtn || !registerBtn) {
            console.error('Required DOM elements not found');
            return;
        }

        // Initialize Bootstrap dropdown if not already initialized
        if (userMenuDropdown) {
            this.initializeDropdown(userMenuDropdown);
        }

        // Modal triggers
        loginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.showLoginModal();
        });

        registerBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.showRegisterModal();
        });

        // Use event delegation for profile and logout buttons since they might be hidden initially
        document.addEventListener('click', async (e) => {
            if (e.target.id === 'profileBtn' || e.target.closest('#profileBtn')) {
                e.preventDefault();
                this.showProfileModal();
            }
            
            if (e.target.id === 'logoutBtn' || e.target.closest('#logoutBtn')) {
                e.preventDefault();
                await this.logout();
            }
        });

        // Form submissions
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        document.getElementById('registerForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleRegister();
        });

        document.getElementById('profileForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleProfileUpdate();
        });

        document.getElementById('passwordForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handlePasswordUpdate();
        });

        // Delete account button
        document.getElementById('deleteAccountBtn').addEventListener('click', () => {
            this.handleAccountDeletion();
        });

        // Password confirmation validation
        document.getElementById('confirmPassword').addEventListener('input', () => {
            this.validatePasswordConfirmation();
        });
    }

    async checkAuthStatus() {
        if (this.token) {
            try {
                const response = await this.apiCall('/auth/me', 'GET');
                if (response.ok) {
                    const user = await response.json();
                    this.setCurrentUser(user);
                } else {
                    // Token is invalid
                    this.clearAuth();
                }
            } catch (error) {
                console.error('Auth check failed:', error);
                this.clearAuth();
            }
        }
    }

    async apiCall(endpoint, method = 'GET', body = null) {
        const headers = {
            'Content-Type': 'application/json',
        };

        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
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
        const modalElement = document.getElementById(modalId);
        
        if (!modalElement) {
            console.error(`Modal element ${modalId} not found!`);
            return null;
        }
        
        if (typeof bootstrap === 'undefined' || typeof bootstrap.Modal === 'undefined') {
            console.error('Bootstrap Modal not available!');
            return null;
        }

        // Check if we already have an instance for this modal
        let modalInstance = this.modalInstances.get(modalId);
        
        if (!modalInstance) {
            // Create new instance
            modalInstance = new bootstrap.Modal(modalElement, {
                backdrop: true,
                keyboard: true,
                focus: true
            });
            
            // Store the instance
            this.modalInstances.set(modalId, modalInstance);
            
            // Add cleanup listener
            modalElement.addEventListener('hidden.bs.modal', () => {
                // Ensure backdrop is removed
                const backdrops = document.querySelectorAll('.modal-backdrop');
                backdrops.forEach(backdrop => backdrop.remove());
                
                // Remove modal-open class from body if no other modals are open
                const openModals = document.querySelectorAll('.modal.show');
                if (openModals.length === 0) {
                    document.body.classList.remove('modal-open');
                    document.body.style.paddingRight = '';
                }
            });
        }
        
        return modalInstance;
    }

    /**
     * Close a modal safely
     * @param {string} modalId - The modal element ID
     */
    closeModal(modalId) {
        try {
            const modal = this.modalInstances.get(modalId);
            if (modal) {
                modal.hide();
            } else {
                // Fallback - try to get existing instance
                const modalElement = document.getElementById(modalId);
                if (modalElement) {
                    const existingModal = bootstrap.Modal.getInstance(modalElement);
                    if (existingModal) {
                        existingModal.hide();
                    }
                }
            }
        } catch (error) {
            console.error(`Error closing modal ${modalId}:`, error);
        }
    }

    showLoginModal() {
        try {
            const modal = this.getModalInstance('loginModal');
            if (!modal) return;
            
            modal.show();
            
            document.getElementById('loginForm').reset();
            this.hideError('loginError');
        } catch (error) {
            console.error('Error in showLoginModal:', error);
        }
    }

    showRegisterModal() {
        try {
            const modal = this.getModalInstance('registerModal');
            if (!modal) return;
            
            modal.show();
            document.getElementById('registerForm').reset();
            this.hideError('registerError');
        } catch (error) {
            console.error('Error in showRegisterModal:', error);
        }
    }

    showProfileModal() {
        try {
            const modal = this.getModalInstance('profileModal');
            if (!modal) return;
            
            modal.show();
            this.populateProfileForm();
            this.hideError('profileError');
            this.hideError('passwordError');
            this.hideSuccess('profileSuccess');
            this.hideSuccess('passwordSuccess');
        } catch (error) {
            console.error('Error in showProfileModal:', error);
        }
    }

    async handleLogin() {
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        this.showSpinner('loginSpinner');
        this.hideError('loginError');

        try {
            const response = await this.apiCall('/auth/login', 'POST', {
                email,
                password
            });

            if (response.ok) {
                const data = await response.json();
                this.token = data.access_token;
                localStorage.setItem('authToken', this.token);
                this.setCurrentUser(data.user);
                
                // Close modal safely
                this.closeModal('loginModal');
                
                // Trigger document migration
                try {
                    if (window.documentManager) {
                        await window.documentManager.onUserLogin();
                    }
                } catch (migrationError) {
                    console.error('Document migration failed:', migrationError);
                }
                
                // Show success message
                NotificationManager.showSuccess('Welcome back!');
            } else {
                const error = await response.json();
                this.showError('loginError', error.detail || 'Login failed');
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showError('loginError', 'Network error. Please try again.');
        } finally {
            this.hideSpinner('loginSpinner');
        }
    }

    async handleRegister() {
        const formData = {
            email: document.getElementById('registerEmail').value,
            password: document.getElementById('registerPassword').value,
            first_name: document.getElementById('registerFirstName').value || null,
            last_name: document.getElementById('registerLastName').value || null,
            display_name: document.getElementById('registerDisplayName').value || null,
            bio: document.getElementById('registerBio').value || null,
        };

        this.showSpinner('registerSpinner');
        this.hideError('registerError');

        try {
            const response = await this.apiCall('/auth/register', 'POST', formData);

            if (response.ok) {
                const user = await response.json();
                
                // Close modal
                // Close modal safely
                this.closeModal('registerModal');
                
                // Show success and auto-login
                NotificationManager.showSuccess('Account created successfully! Please log in.');
                
                // Auto-fill login form
                setTimeout(() => {
                    document.getElementById('loginEmail').value = formData.email;
                    this.showLoginModal();
                }, 1000);
                
            } else {
                const error = await response.json();
                this.showError('registerError', error.detail || 'Registration failed');
            }
        } catch (error) {
            console.error('Registration error:', error);
            this.showError('registerError', 'Network error. Please try again.');
        } finally {
            this.hideSpinner('registerSpinner');
        }
    }

    async handleProfileUpdate() {
        const formData = {
            first_name: document.getElementById('profileFirstName').value || null,
            last_name: document.getElementById('profileLastName').value || null,
            display_name: document.getElementById('profileDisplayName').value || null,
            bio: document.getElementById('profileBio').value || null,
        };

        this.showSpinner('profileSpinner');
        this.hideError('profileError');
        this.hideSuccess('profileSuccess');

        try {
            const response = await this.apiCall('/users/profile', 'PUT', formData);

            if (response.ok) {
                const updatedUser = await response.json();
                this.setCurrentUser(updatedUser);
                this.showSuccess('profileSuccess', 'Profile updated successfully!');
            } else {
                const error = await response.json();
                this.showError('profileError', error.detail || 'Profile update failed');
            }
        } catch (error) {
            console.error('Profile update error:', error);
            this.showError('profileError', 'Network error. Please try again.');
        } finally {
            this.hideSpinner('profileSpinner');
        }
    }

    async handlePasswordUpdate() {
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (newPassword !== confirmPassword) {
            this.showError('passwordError', 'New passwords do not match');
            return;
        }

        this.showSpinner('passwordSpinner');
        this.hideError('passwordError');
        this.hideSuccess('passwordSuccess');

        try {
            const response = await this.apiCall('/users/password', 'PUT', {
                current_password: currentPassword,
                new_password: newPassword
            });

            if (response.ok) {
                this.showSuccess('passwordSuccess', 'Password updated successfully!');
                document.getElementById('passwordForm').reset();
            } else {
                const error = await response.json();
                this.showError('passwordError', error.detail || 'Password update failed');
            }
        } catch (error) {
            console.error('Password update error:', error);
            this.showError('passwordError', 'Network error. Please try again.');
        } finally {
            this.hideSpinner('passwordSpinner');
        }
    }

    handleAccountDeletion() {
        if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
            if (confirm('This will permanently delete all your data. Are you absolutely sure?')) {
                this.deleteAccount();
            }
        }
    }

    async deleteAccount() {
        try {
            const response = await this.apiCall('/users/account', 'DELETE');

            if (response.ok) {
                NotificationManager.showInfo('Account deleted successfully');
                await this.logout();
                // Close modal safely
                this.closeModal('profileModal');
            } else {
                const error = await response.json();
                this.showError('passwordError', error.detail || 'Account deletion failed');
            }
        } catch (error) {
            console.error('Account deletion error:', error);
            this.showError('passwordError', 'Network error. Please try again.');
        }
    }

    validatePasswordConfirmation() {
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const confirmField = document.getElementById('confirmPassword');

        if (confirmPassword && newPassword !== confirmPassword) {
            confirmField.setCustomValidity('Passwords do not match');
        } else {
            confirmField.setCustomValidity('');
        }
    }

    setCurrentUser(user) {
        this.currentUser = user;
        this.updateUI();
    }

    updateUI() {
        const userDisplayName = document.getElementById('userDisplayName');
        const guestMenu = document.getElementById('guestMenu');
        const userMenu = document.getElementById('userMenu');

        if (this.currentUser) {
            // User is logged in
            userDisplayName.textContent = this.currentUser.full_name || this.currentUser.display_name || 'User';
            guestMenu.style.display = 'none';
            userMenu.style.display = 'block';
        } else {
            // User is not logged in
            userDisplayName.textContent = 'Guest';
            guestMenu.style.display = 'block';
            userMenu.style.display = 'none';
        }
    }

    populateProfileForm() {
        if (this.currentUser) {
            document.getElementById('profileFirstName').value = this.currentUser.first_name || '';
            document.getElementById('profileLastName').value = this.currentUser.last_name || '';
            document.getElementById('profileDisplayName').value = this.currentUser.display_name || '';
            document.getElementById('profileEmail').value = this.currentUser.email || '';
            document.getElementById('profileBio').value = this.currentUser.bio || '';
        }
    }

    async logout() {
        // Show saving notification
        NotificationManager.showInfo('Saving documents before logout...');
        
        // Trigger document logout hook with forced save
        try {
            if (window.documentManager) {
                await window.documentManager.onUserLogout();
            }
        } catch (error) {
            console.error('Document logout handler failed:', error);
            NotificationManager.showWarning('Some documents may not have been saved');
        }
        
        this.clearAuth();
        NotificationManager.showSuccess('Logged out successfully');
    }

    clearAuth() {
        this.token = null;
        this.currentUser = null;
        localStorage.removeItem('authToken');
        this.updateUI();
    }

    showError(elementId, message) {
        const element = document.getElementById(elementId);
        element.textContent = message;
        element.style.display = 'block';
    }

    hideError(elementId) {
        const element = document.getElementById(elementId);
        element.style.display = 'none';
    }

    showSuccess(elementId, message) {
        const element = document.getElementById(elementId);
        element.textContent = message;
        element.style.display = 'block';
    }

    hideSuccess(elementId) {
        document.getElementById(elementId).style.display = 'none';
    }

    showSpinner(spinnerId) {
        document.getElementById(spinnerId).style.display = 'inline-block';
    }

    hideSpinner(spinnerId) {
        document.getElementById(spinnerId).style.display = 'none';
    }

    initializeDropdown(dropdownElement) {
        console.log('AuthManager: Attempting to initialize dropdown');
        
        // Wait a moment for Bootstrap to be fully loaded
        setTimeout(() => {
            // Method 1: Try Bootstrap 5 API
            if (typeof bootstrap !== 'undefined' && bootstrap.Dropdown) {
                try {
                    const existingDropdown = bootstrap.Dropdown.getInstance(dropdownElement);
                    if (!existingDropdown) {
                        new bootstrap.Dropdown(dropdownElement);
                        console.log('AuthManager: Bootstrap dropdown initialized via API');
                        return;
                    } else {
                        console.log('AuthManager: Bootstrap dropdown already exists');
                        return;
                    }
                } catch (error) {
                    console.warn('AuthManager: Bootstrap API failed:', error);
                }
            }
            
            // Method 2: Manual click handler as fallback
            console.log('AuthManager: Using manual dropdown fallback');
            this.setupManualDropdown(dropdownElement);
        }, 100);
    }

    setupManualDropdown(dropdownElement) {
        dropdownElement.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const dropdownMenu = dropdownElement.nextElementSibling;
            if (dropdownMenu && dropdownMenu.classList.contains('dropdown-menu')) {
                const isShown = dropdownMenu.classList.contains('show');
                
                // Close all other dropdowns first
                document.querySelectorAll('.dropdown-menu.show').forEach(menu => {
                    if (menu !== dropdownMenu) {
                        menu.classList.remove('show');
                        const otherToggle = menu.previousElementSibling;
                        if (otherToggle) {
                            otherToggle.setAttribute('aria-expanded', 'false');
                        }
                    }
                });
                
                // Toggle this dropdown
                if (!isShown) {
                    dropdownMenu.classList.add('show');
                    dropdownElement.setAttribute('aria-expanded', 'true');
                    console.log('AuthManager: Dropdown opened manually');
                } else {
                    dropdownMenu.classList.remove('show');
                    dropdownElement.setAttribute('aria-expanded', 'false');
                    console.log('AuthManager: Dropdown closed manually');
                }
            }
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!dropdownElement.contains(e.target)) {
                const dropdownMenu = dropdownElement.nextElementSibling;
                if (dropdownMenu && dropdownMenu.classList.contains('dropdown-menu')) {
                    dropdownMenu.classList.remove('show');
                    dropdownElement.setAttribute('aria-expanded', 'false');
                }
            }
        });
    }

    /**
     * Set up global error handling for modal-related issues
     */
    setupGlobalModalErrorHandling() {
        // Listen for modal events to ensure proper cleanup
        document.addEventListener('hidden.bs.modal', (event) => {
            console.log('Modal hidden event:', event.target.id);
            
            // Additional cleanup to ensure no orphaned backdrops
            setTimeout(() => {
                const backdrops = document.querySelectorAll('.modal-backdrop');
                if (backdrops.length > 0) {
                    console.warn('Found orphaned modal backdrops, cleaning up:', backdrops.length);
                    backdrops.forEach(backdrop => backdrop.remove());
                }
                
                // Ensure body classes are correct
                const openModals = document.querySelectorAll('.modal.show');
                if (openModals.length === 0) {
                    document.body.classList.remove('modal-open');
                    document.body.style.paddingRight = '';
                    document.body.style.overflow = '';
                }
            }, 100);
        });

        // Handle potential JavaScript errors from Bootstrap
        window.addEventListener('error', (event) => {
            if (event.message && event.message.includes('dataset')) {
                console.warn('Potential Bootstrap modal dataset error caught:', event.message);
                // Force cleanup
                const backdrops = document.querySelectorAll('.modal-backdrop');
                backdrops.forEach(backdrop => backdrop.remove());
                document.body.classList.remove('modal-open');
                document.body.style.paddingRight = '';
                document.body.style.overflow = '';
            }
        });
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
}

// Export for use in other modules
export default AuthManager;

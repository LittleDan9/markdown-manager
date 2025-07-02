/**
 * User Authentication Module
 * Handles user login, registration, profile management, and session persistence
 */

import NotificationManager from './notifications.js';

class AuthManager {
    constructor() {
        this.apiBase = '/api/v1';
        this.currentUser = null;
        this.token = localStorage.getItem('authToken');
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkAuthStatus();
    }

    setupEventListeners() {
        // Check if elements exist
        const loginBtn = document.getElementById('loginBtn');
        const registerBtn = document.getElementById('registerBtn');
        const userMenuDropdown = document.getElementById('userMenuDropdown');

        if (!loginBtn || !registerBtn) {
            console.error('Required DOM elements not found');
            return;
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
        document.addEventListener('click', (e) => {
            if (e.target.id === 'profileBtn' || e.target.closest('#profileBtn')) {
                e.preventDefault();
                this.showProfileModal();
            }
            
            if (e.target.id === 'logoutBtn' || e.target.closest('#logoutBtn')) {
                e.preventDefault();
                this.logout();
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

    showLoginModal() {
        this.debugLog('showLoginModal called');
        this.debugLog(`Bootstrap available: ${typeof window.bootstrap !== 'undefined'}`);
        this.debugLog(`Bootstrap Modal available: ${typeof window.bootstrap?.Modal !== 'undefined'}`);
        
        try {
            const modalElement = document.getElementById('loginModal');
            this.debugLog(`Modal element found: ${!!modalElement}`);
            
            if (!modalElement) {
                this.debugLog('❌ Modal element not found!');
                return;
            }
            
            if (typeof window.bootstrap?.Modal === 'undefined') {
                this.debugLog('❌ Bootstrap Modal not available!');
                return;
            }
            
            const modal = new bootstrap.Modal(modalElement);
            this.debugLog(`Modal instance created: ${!!modal}`);
            
            modal.show();
            this.debugLog('✅ Modal show() called');
            
            document.getElementById('loginForm').reset();
            this.hideError('loginError');
        } catch (error) {
            this.debugLog(`❌ Error in showLoginModal: ${error.message}`);
            console.error('Error in showLoginModal:', error);
        }
    }

    showRegisterModal() {
        const modal = new bootstrap.Modal(document.getElementById('registerModal'));
        modal.show();
        document.getElementById('registerForm').reset();
        this.hideError('registerError');
    }

    showProfileModal() {
        const modal = new bootstrap.Modal(document.getElementById('profileModal'));
        modal.show();
        this.populateProfileForm();
        this.hideError('profileError');
        this.hideError('passwordError');
        this.hideSuccess('profileSuccess');
        this.hideSuccess('passwordSuccess');
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
                
                // Close modal
                bootstrap.Modal.getInstance(document.getElementById('loginModal')).hide();
                
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
                bootstrap.Modal.getInstance(document.getElementById('registerModal')).hide();
                
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
                this.logout();
                bootstrap.Modal.getInstance(document.getElementById('profileModal')).hide();
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

    logout() {
        this.clearAuth();
        NotificationManager.showInfo('Logged out successfully');
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
        const element = document.getElementById(elementId);
        element.style.display = 'none';
    }

    showSpinner(spinnerId) {
        document.getElementById(spinnerId).style.display = 'inline-block';
    }

    hideSpinner(spinnerId) {
        document.getElementById(spinnerId).style.display = 'none';
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

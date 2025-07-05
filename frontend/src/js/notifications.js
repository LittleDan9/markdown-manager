/**
 * Toast notification utility
 * Provides consistent Bootstrap native toast notifications throughout the application
 */

export class NotificationManager {
    /**
     * Show a toast notification using Bootstrap's native Toast component
     * @param {string} message - The message to display
     * @param {string} type - The type of notification ('success', 'error', 'warning', 'info')
     * @param {number} duration - How long to show the toast in milliseconds (default: 5000)
     */
    static showNotification(message, type = 'info', duration = 5000) {
        // Check if Bootstrap is available
        if (typeof bootstrap === 'undefined') {
            console.error('Bootstrap is not loaded. Cannot show toast notification.');
            // Fallback to simple alert
            alert(message);
            return;
        }

        // Get or create toast container
        let toastContainer = document.getElementById('toastContainer');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toastContainer';
            toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
            toastContainer.style.zIndex = '1060'; // Higher than modal backdrop (1055)
            document.body.appendChild(toastContainer);
        }

        // Map types to Bootstrap toast classes and icons
        const typeConfig = {
            'success': { bgClass: 'bg-success', textClass: 'text-white', icon: 'bi-check-circle-fill' },
            'danger': { bgClass: 'bg-danger', textClass: 'text-white', icon: 'bi-exclamation-triangle-fill' },
            'warning': { bgClass: 'bg-warning', textClass: 'text-dark', icon: 'bi-exclamation-triangle-fill' },
            'info': { bgClass: 'bg-info', textClass: 'text-white', icon: 'bi-info-circle-fill' }
        };

        const config = typeConfig[type] || typeConfig['info'];

        // Create unique ID for this toast
        const toastId = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Create Bootstrap toast element
        const toastElement = document.createElement('div');
        toastElement.className = `toast ${config.bgClass} ${config.textClass}`;
        toastElement.id = toastId;
        toastElement.setAttribute('role', 'alert');
        toastElement.setAttribute('aria-live', 'assertive');
        toastElement.setAttribute('aria-atomic', 'true');
        toastElement.innerHTML = `
            <div class="toast-header ${config.bgClass} ${config.textClass} border-0">
                <i class="bi ${config.icon} me-2"></i>
                <strong class="me-auto">Notification</strong>
                <button type="button" class="btn-close ${config.textClass === 'text-dark' ? '' : 'btn-close-white'}" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
            <div class="toast-body">
                ${message}
            </div>
        `;

        // Add toast to container
        toastContainer.appendChild(toastElement);

        // Initialize Bootstrap Toast
        const toast = new bootstrap.Toast(toastElement, {
            autohide: true,
            delay: duration
        });

        // Show the toast
        toast.show();

        // Clean up after toast is hidden
        toastElement.addEventListener('hidden.bs.toast', () => {
            toastElement.remove();
        });
    }

    /**
     * Show a success notification
     * @param {string} message - The success message
     * @param {number} duration - Duration in milliseconds
     */
    static showSuccess(message, duration = 3000) {
        this.showNotification(message, 'success', duration);
    }

    /**
     * Show an error notification
     * @param {string} message - The error message
     * @param {number} duration - Duration in milliseconds
     */
    static showError(message, duration = 7000) {
        this.showNotification(message, 'danger', duration);
    }

    /**
     * Show a warning notification
     * @param {string} message - The warning message
     * @param {number} duration - Duration in milliseconds
     */
    static showWarning(message, duration = 5000) {
        this.showNotification(message, 'warning', duration);
    }

    /**
     * Show an info notification
     * @param {string} message - The info message
     * @param {number} duration - Duration in milliseconds
     */
    static showInfo(message, duration = 4000) {
        this.showNotification(message, 'info', duration);
    }
}

// Export a default instance for convenience
export default NotificationManager;

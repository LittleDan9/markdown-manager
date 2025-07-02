/**
 * Toast notification utility
 * Provides consistent toast notifications throughout the application
 */

export class NotificationManager {
    /**
     * Show a toast notification
     * @param {string} message - The message to display
     * @param {string} type - The type of notification ('success', 'error', 'warning', 'info')
     * @param {number} duration - How long to show the toast in milliseconds (default: 5000)
     */
    static showNotification(message, type = 'info', duration = 5000) {
        // Create a toast notification
        const toast = document.createElement('div');
        toast.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
        toast.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
        toast.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;

        document.body.appendChild(toast);

        // Auto-remove after specified duration
        setTimeout(() => {
            if (toast.parentNode) {
                toast.remove();
            }
        }, duration);
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

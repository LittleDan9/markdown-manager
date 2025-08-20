/**
 * Notification Service
 * Consolidated notification system that replaces EventDispatchService
 * Provides both direct method calls and event-based notifications
 */

class NotificationService {
  constructor() {
    // Bind methods to ensure 'this' context is preserved
    this.success = this.success.bind(this);
    this.error = this.error.bind(this);
    this.warning = this.warning.bind(this);
    this.info = this.info.bind(this);
  }

  /**
   * Dispatch a notification event
   * @param {string} message - The notification message
   * @param {string} type - Type: 'success', 'error', 'warning', 'info'
   * @param {number} duration - Duration in milliseconds (optional)
   */
  _dispatchNotification(message, type, duration) {
    const detail = { message, type };
    if (duration !== undefined) {
      detail.duration = duration;
    }
    
    window.dispatchEvent(new CustomEvent('notification', { detail }));
  }

  /**
   * Show success notification
   * @param {string} message - Success message
   * @param {number} duration - Duration in milliseconds (optional)
   */
  success(message, duration) {
    this._dispatchNotification(message, 'success', duration);
  }

  /**
   * Show error notification
   * @param {string} message - Error message  
   * @param {number} duration - Duration in milliseconds (optional)
   */
  error(message, duration) {
    this._dispatchNotification(message, 'error', duration);
  }

  /**
   * Show warning notification
   * @param {string} message - Warning message
   * @param {number} duration - Duration in milliseconds (optional)
   */
  warning(message, duration) {
    this._dispatchNotification(message, 'warning', duration);
  }

  /**
   * Show info notification
   * @param {string} message - Info message
   * @param {number} duration - Duration in milliseconds (optional)
   */
  info(message, duration) {
    this._dispatchNotification(message, 'info', duration);
  }

  /**
   * Batch notifications (useful for multiple operations)
   * @param {Array} notifications - Array of {message, type, duration} objects
   */
  batch(notifications) {
    notifications.forEach(({ message, type, duration }) => {
      this._dispatchNotification(message, type, duration);
    });
  }

  /**
   * Clear all notifications (utility method)
   * Dispatches a special event that NotificationProvider can listen for
   */
  clearAll() {
    window.dispatchEvent(new CustomEvent('notification:clear'));
  }
}

// Export singleton instance for consistency with other services
export default new NotificationService();

// Also export the class for testing purposes
export { NotificationService };

// Legacy compatibility - export the old notification object
// This maintains compatibility with existing code during transition
export const notification = {
  success: (message, duration) => new NotificationService().success(message, duration),
  error: (message, duration) => new NotificationService().error(message, duration),
  warning: (message, duration) => new NotificationService().warning(message, duration),
  info: (message, duration) => new NotificationService().info(message, duration),
};

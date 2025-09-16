/**
 * Global GitHub OAuth listener that watches localStorage for OAuth results
 * regardless of which component is currently active.
 */

class GitHubOAuthListener {
  constructor() {
    this.listeners = new Set();
    this.isPolling = false;
    this.pollInterval = null;
  }

  /**
   * Add a listener for OAuth results
   * @param {Function} callback - Function to call when OAuth result is received
   * @returns {Function} - Cleanup function to remove the listener
   */
  addListener(callback) {
    console.log('GitHubOAuthListener: Adding listener');
    this.listeners.add(callback);
    this.startPolling();

    // Return cleanup function
    return () => {
      console.log('GitHubOAuthListener: Removing listener');
      this.listeners.delete(callback);
      if (this.listeners.size === 0) {
        this.stopPolling();
      }
    };
  }

  /**
   * Start polling localStorage for OAuth results
   */
  startPolling() {
    if (this.isPolling) {
      return;
    }

    console.log('GitHubOAuthListener: Starting global localStorage polling');
    this.isPolling = true;

    // Check immediately
    this.checkForOAuthResult();

    // Then poll every 200ms
    this.pollInterval = setInterval(() => {
      this.checkForOAuthResult();
    }, 200);
  }

  /**
   * Stop polling localStorage
   */
  stopPolling() {
    if (!this.isPolling) {
      return;
    }

    console.log('GitHubOAuthListener: Stopping global localStorage polling');
    this.isPolling = false;

    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  /**
   * Check localStorage for OAuth results and notify listeners
   */
  checkForOAuthResult() {
    try {
      const result = localStorage.getItem('github_oauth_result');
      if (result) {
        const data = JSON.parse(result);
        console.log('GitHubOAuthListener: Found OAuth result in localStorage:', data);

        // Clear the result to prevent duplicate handling
        localStorage.removeItem('github_oauth_result');

        // Notify all listeners
        this.listeners.forEach(callback => {
          try {
            callback({
              data: data,
              origin: 'localStorage' // Indicate this came from localStorage
            });
          } catch (error) {
            console.error('GitHubOAuthListener: Error in listener callback:', error);
          }
        });
      }
    } catch (error) {
      console.error('GitHubOAuthListener: Error checking localStorage:', error);
    }
  }

  /**
   * Manually trigger a check (useful for immediate checks)
   */
  checkNow() {
    this.checkForOAuthResult();
  }
}

// Create singleton instance
const githubOAuthListener = new GitHubOAuthListener();

export default githubOAuthListener;
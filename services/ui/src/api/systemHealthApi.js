import { Api } from "./api";

class SystemHealthApi extends Api {
  /**
   * Get system health status
   * @returns {Promise<Object>} Health status data
   */
  async getHealthStatus() {
    const response = await this.apiCall('/health');
    return response.data;
  }

  /**
   * Get detailed health status for a specific service
   * @param {string} serviceName - Name of the service to get detailed info for
   * @returns {Promise<Object>} Detailed health status data
   */
  async getServiceDetailedHealth(serviceName) {
    // Map service names to their detailed endpoints through nginx proxy
    const serviceEndpoints = {
      'event_publisher': '/api/event-publisher/health/detailed',
      'spell_check_service': '/api/spell-check/health/detailed',
      'linting_service': '/api/markdown-lint/health/detailed',
      'export_service': '/api/export/health/detailed'
      // Add other services as they implement detailed endpoints
    };

    const endpoint = serviceEndpoints[serviceName];
    if (!endpoint) {
      throw new Error(`No detailed endpoint available for service: ${serviceName}`);
    }

    try {
      // Use fetch to call through nginx proxy
      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`Failed to fetch detailed health for ${serviceName}:`, error);
      throw error;
    }
  }
}

// Export singleton instance for use in components
export default new SystemHealthApi();
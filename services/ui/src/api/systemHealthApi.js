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
}

// Export singleton instance for use in components
export default new SystemHealthApi();
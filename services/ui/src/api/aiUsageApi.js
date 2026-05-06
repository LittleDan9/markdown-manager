/**
 * AI Usage Stats API Client
 * Aggregated usage queries across local and remote apps.
 */

import { Api } from './api.js';

class AiUsageApi extends Api {
  constructor() {
    super();
  }

  /** Get aggregated usage stats across all apps. */
  async getUsageStats(days = 30) {
    const response = await this.apiCall(`/api/ai-usage/stats?days=${days}`, 'GET');
    return response.data;
  }

  /** Get daily usage breakdown for charts. */
  async getDailyUsage(days = 14) {
    const response = await this.apiCall(`/api/ai-usage/daily?days=${days}`, 'GET');
    return response.data;
  }
}

const aiUsageApi = new AiUsageApi();
export default aiUsageApi;

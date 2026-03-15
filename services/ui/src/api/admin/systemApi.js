/**
 * Admin System API Client
 * Handles LLM configuration, reindexing, and site-wide statistics.
 */

import { Api } from '../api.js';

export class AdminSystemApi extends Api {
  constructor() {
    super();
  }

  // ── Statistics ─────────────────────────────────────────────────────────────

  async getSiteStats() {
    const response = await this.apiCall('/admin/system/stats', 'GET');
    return response.data;
  }

  async getReindexStatus() {
    const response = await this.apiCall('/admin/system/reindex/status', 'GET');
    return response.data;
  }

  // ── LLM configuration ──────────────────────────────────────────────────────

  async getLLMConfig() {
    const response = await this.apiCall('/admin/system/llm', 'GET');
    return response.data;
  }

  async updateLLMConfig({ model, url } = {}) {
    const body = {};
    if (model !== undefined) body.model = model;
    if (url !== undefined) body.url = url;
    const response = await this.apiCall('/admin/system/llm', 'PUT', body);
    return response.data;
  }

  async resetLLMConfig() {
    const response = await this.apiCall('/admin/system/llm', 'DELETE');
    return response.data;
  }

  // ── Reindexing ─────────────────────────────────────────────────────────────

  /**
   * Trigger reindex.
   * @param {number|null} userId - null = all users, number = specific user
   */
  async reindex(userId = null) {
    const body = { user_id: userId ?? null };
    const response = await this.apiCall('/admin/system/reindex', 'POST', body);
    return response.data;
  }
}

const adminSystemApi = new AdminSystemApi();
export default adminSystemApi;

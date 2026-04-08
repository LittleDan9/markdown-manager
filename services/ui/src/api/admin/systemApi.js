/**
 * Admin System API Client
 * Handles LLM configuration, reindexing, and site-wide statistics.
 */

import { Api } from '../api.js';
import config from '../../config';

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

  /**
   * Pull (download) a model from Ollama. Streams progress via NDJSON.
   * @param {string} model - Model tag to pull (e.g. "mistral", "phi3:mini")
   * @param {function} onProgress - Called with each progress object
   * @returns {Promise<void>} Resolves when pull completes
   */
  async pullModel(model, onProgress) {
    const url = `${config.apiBaseUrl}/admin/system/llm/pull`;
    const token = this.getToken();
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ model }),
    });
    if (!response.ok) {
      throw new Error(`Pull request failed: ${response.status}`);
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete line in buffer
      for (const line of lines) {
        if (line.trim()) {
          try {
            const data = JSON.parse(line);
            if (data.status === 'error') {
              throw new Error(data.error || 'Model pull failed');
            }
            onProgress(data);
          } catch (e) {
            if (e.message && !e.message.startsWith('Unexpected')) throw e;
          }
        }
      }
    }
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

  // ── Attachment Quota ────────────────────────────────────────────────────

  async getAttachmentQuota() {
    const response = await this.apiCall('/admin/system/attachment-quota', 'GET');
    return response.data;
  }

  async updateAttachmentQuota(quotaBytes) {
    const response = await this.apiCall('/admin/system/attachment-quota', 'PUT', {
      quota_bytes: quotaBytes,
    });
    return response.data;
  }
}

const adminSystemApi = new AdminSystemApi();
export default adminSystemApi;

/**
 * API Keys API Client
 * Manages per-user API keys for third-party LLM providers (OpenAI, xAI).
 */

import { Api } from './api.js';

class ApiKeysApi extends Api {
  constructor() {
    super();
  }

  /** List all API keys for the current user (raw keys are never returned). */
  async getKeys() {
    const response = await this.apiCall('/api-keys', 'GET');
    return response.data;
  }

  /** Store a new API key. */
  async addKey({ provider, api_key, label, base_url, preferred_model }) {
    const body = { provider, api_key };
    if (label) body.label = label;
    if (base_url) body.base_url = base_url;
    if (preferred_model) body.preferred_model = preferred_model;
    const response = await this.apiCall('/api-keys', 'POST', body);
    return response.data;
  }

  /** Update an existing key's configuration. */
  async updateKey(id, updates) {
    const response = await this.apiCall(`/api-keys/${id}`, 'PUT', updates);
    return response.data;
  }

  /** Delete a key. */
  async deleteKey(id) {
    await this.apiCall(`/api-keys/${id}`, 'DELETE');
  }

  /** Test a key by making a lightweight health-check call to the provider. */
  async testKey(id) {
    const response = await this.apiCall(`/api-keys/${id}/test`, 'POST');
    return response.data;
  }

  /** Fetch available models from the provider using the stored API key. */
  async listModels(id) {
    const response = await this.apiCall(`/api-keys/${id}/models`, 'POST');
    return response.data;
  }
}

const apiKeysApi = new ApiKeysApi();
export default apiKeysApi;

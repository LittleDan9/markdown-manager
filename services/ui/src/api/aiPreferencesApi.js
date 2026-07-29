/**
 * AI Preferences API Client
 * Manages user preferences for AI provider/model selection via Platform AI.
 */

import { Api } from './api.js';

class AiPreferencesApi extends Api {
  constructor() {
    super();
  }

  /** Get AI preferences for the current user (this app). */
  async getPreferences() {
    const response = await this.apiCall('/ai/preferences', 'GET');
    return response.data;
  }

  /** Save AI preferences (provider, model, key selection). */
  async savePreferences({ preferred_provider, preferred_model, preferred_key_id }) {
    const body = {};
    if (preferred_provider !== undefined) body.preferred_provider = preferred_provider;
    if (preferred_model !== undefined) body.preferred_model = preferred_model;
    if (preferred_key_id !== undefined) body.preferred_key_id = preferred_key_id;
    const response = await this.apiCall('/ai/preferences', 'PUT', body);
    return response.data;
  }

  /** Get current quota status (usage, limits, reset time). */
  async getQuota() {
    const response = await this.apiCall('/ai/usage/quota', 'GET');
    return response.data;
  }
}

const aiPreferencesApi = new AiPreferencesApi();
export default aiPreferencesApi;

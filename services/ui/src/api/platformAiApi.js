/**
 * Platform AI API Client — direct access via /ai/ nginx route.
 * Uses native Platform AI schema (no field transformations).
 */
import axios from 'axios';

const AI_BASE = '/ai';

async function aiCall(path, method = 'GET', body = null) {
  const config = {
    method,
    url: `${AI_BASE}${path}`,
    withCredentials: true,
    headers: { 'Content-Type': 'application/json', 'X-App-Id': 'markdown-manager' },
  };
  if (body) config.data = body;
  const response = await axios(config);
  return response.data;
}

const platformAiApi = {
  // Keys
  async getKeys() {
    return aiCall('/keys');
  },
  async createKey(data) {
    return aiCall('/keys', 'POST', data);
  },
  async updateKey(id, data) {
    return aiCall(`/keys/${id}`, 'PUT', data);
  },
  async deleteKey(id) {
    return aiCall(`/keys/${id}`, 'DELETE');
  },
  async testKey(id) {
    return aiCall(`/keys/${id}/test`, 'POST');
  },

  // Ollama
  async getOllamaModels() {
    return aiCall('/keys/ollama/models');
  },
  async getOllamaHealth() {
    return aiCall('/keys/ollama/health');
  },

  // Usage
  async getUsageStats(days = 30) {
    return aiCall(`/usage/stats?days=${days}`);
  },
  async getDailyUsage(days = 14) {
    return aiCall(`/usage/daily?days=${days}`);
  },

  // Preferences
  async getPreferences() {
    return aiCall('/preferences?app_id=markdown-manager');
  },
  async savePreferences(prefs) {
    return aiCall('/preferences', 'PUT', { ...prefs, app_id: 'markdown-manager' });
  },

  // Quota
  async getQuota() {
    return aiCall('/usage/quota');
  },

  // Conversations
  async getConversations(params = {}) {
    const qs = new URLSearchParams({ app_id: 'markdown-manager', ...params }).toString();
    return aiCall(`/conversations?${qs}`);
  },
  async getConversation(id) {
    return aiCall(`/conversations/${id}`);
  },
  async createConversation(data) {
    return aiCall('/conversations', 'POST', { ...data, app_id: 'markdown-manager' });
  },
  async updateConversation(id, data) {
    return aiCall(`/conversations/${id}`, 'PUT', data);
  },
  async deleteConversation(id) {
    return aiCall(`/conversations/${id}`, 'DELETE');
  },
  async generateTitle(id) {
    return aiCall(`/conversations/${id}/generate-title`, 'POST');
  },
};

export default platformAiApi;

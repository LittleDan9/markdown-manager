/**
 * AI Provider Sync API Client
 * Cross-app provider diff and migration (import/export between apps).
 */

import { Api } from './api.js';

class AiProviderSyncApi extends Api {
  constructor() {
    super();
  }

  /** List remote AI providers cached from other apps. */
  async getRemoteProviders() {
    const response = await this.apiCall('/api/ai-provider-sync/remote-providers', 'GET');
    return response.data;
  }

  /** Import a remote provider into Markdown Manager. */
  async importRemoteProvider(remoteId, sourceApp) {
    const response = await this.apiCall('/api/ai-provider-sync/import', 'POST', {
      remote_id: remoteId,
      source_app: sourceApp,
    });
    return response.data;
  }

  /** Export a local provider to a remote app. */
  async exportProvider(keyId) {
    const response = await this.apiCall('/api/ai-provider-sync/export', 'POST', {
      key_id: keyId,
    });
    return response.data;
  }

  /** Trigger a manual publish of provider state. */
  async publishProviderState() {
    const response = await this.apiCall('/api/ai-provider-sync/publish', 'POST');
    return response.data;
  }
}

const aiProviderSyncApi = new AiProviderSyncApi();
export default aiProviderSyncApi;

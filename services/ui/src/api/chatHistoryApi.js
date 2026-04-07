import { Api } from "./api";

class ChatHistoryApi extends Api {
  async createConversation(provider, scope, documentId) {
    const response = await this.apiCall("/chat/conversations/", "POST", {
      provider: provider || null,
      scope: scope || null,
      document_id: documentId || null,
    });
    return response.data;
  }

  async getConversations(limit = 50, offset = 0) {
    const params = new URLSearchParams({ limit, offset });
    const response = await this.apiCall(`/chat/conversations/?${params}`);
    return response.data;
  }

  async getConversation(conversationId) {
    const response = await this.apiCall(`/chat/conversations/${conversationId}`);
    return response.data;
  }

  async updateConversation(conversationId, { title }) {
    const response = await this.apiCall(
      `/chat/conversations/${conversationId}`,
      "PUT",
      { title }
    );
    return response.data;
  }

  async deleteConversation(conversationId) {
    await this.apiCall(`/chat/conversations/${conversationId}`, "DELETE");
  }

  async addMessage(conversationId, role, content, metadataJson = null) {
    const response = await this.apiCall(
      `/chat/conversations/${conversationId}/messages`,
      "POST",
      { role, content, metadata_json: metadataJson }
    );
    return response.data;
  }

  async generateTitle(conversationId, provider = null) {
    const response = await this.apiCall(
      `/chat/conversations/${conversationId}/generate-title`,
      "POST",
      { provider: provider || null }
    );
    return response.data;
  }
}

export const chatHistoryApi = new ChatHistoryApi();

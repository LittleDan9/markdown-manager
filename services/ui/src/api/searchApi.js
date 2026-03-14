import { Api } from "./api";

class SearchApi extends Api {
  /**
   * Semantic document search — finds documents by meaning using vector similarity.
   * @param {string} query - Natural language query
   * @param {number} limit - Max results (default 10)
   * @returns {Promise<Array<{document: object, score: number}>>}
   */
  async semanticSearch(query, limit = 10) {
    const params = new URLSearchParams({ q: query, limit });
    const response = await this.apiCall(`/documents/semantic-search?${params}`);
    return response.data;
  }

  /**
   * Ask a question about documents and get a streaming answer from Ollama.
   * @param {string} question - The question to ask
   * @param {number|null} documentId - Limit to this doc (null = all docs)
   * @param {function} onToken - Called with each streamed token string
   * @param {AbortSignal} signal - Optional abort signal to cancel the stream
   * @returns {Promise<void>}
   */
  async askQuestion(question, documentId, onToken, signal) {
    const response = await fetch("/api/chat/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ question, document_id: documentId ?? null }),
      signal,
    });

    if (!response.ok) {
      throw new Error(`Chat request failed: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      // Parse SSE format: "data: <token>\n\n"
      const lines = chunk.split("\n");
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const token = line.slice(6);
          if (token === "[DONE]") return;
          if (token === "[ERROR]") throw new Error("Streaming error from server");
          if (token) onToken(token);
        }
      }
    }
  }

  /**
   * Check health of embedding service and Ollama.
   * @returns {Promise<{status: string, embedding_service: string, ollama: string}>}
   */
  async getChatHealth() {
    const response = await this.apiCall("/chat/health");
    return response.data;
  }
}

export const searchApi = new SearchApi();

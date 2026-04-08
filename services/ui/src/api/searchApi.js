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
   * Ask a question about documents and get a streaming answer from the configured LLM provider.
   * @param {string} question - The question to ask
   * @param {number|null} documentId - Limit to this doc (null = all docs)
   * @param {function} onToken - Called with each streamed token string, or a metrics object {type:'metrics', data:{...}}
   * @param {AbortSignal} signal - Optional abort signal to cancel the stream
   * @param {boolean} deepThink - Send full document context instead of summary (single-doc only)
   * @param {Array} history - Prior conversation turns
   * @param {number|null} categoryId - Limit to a specific category (all-docs mode only)
   * @param {string|null} provider - LLM provider to use ("ollama", "openai", "xai"; null = default)
   * @param {string|null} selectionContext - Optional editor-selected text to include as context
   * @param {number|null} keyId - Specific API key ID to use (overrides provider lookup)
   * @param {string|null} model - Override model at chat-time (from model picker)
   * @param {boolean} strictContext - Only answer from document content, no general knowledge
   * @returns {Promise<void>}
   */
  async askQuestion(question, documentId, onToken, signal, deepThink = false, history = [], categoryId = null, provider = null, selectionContext = null, keyId = null, model = null, strictContext = false) {
    const token = this.getToken();
    const body = {
      question,
      document_id: documentId ?? null,
      category_id: categoryId ?? null,
      deep_think: deepThink ?? false,
      history: history.map(({ role, content }) => ({ role, content })),
    };
    if (provider) body.provider = provider;
    if (keyId) body.key_id = keyId;
    if (model) body.model = model;
    if (selectionContext) body.selection_context = selectionContext;
    if (strictContext) body.strict_context = true;

    const response = await fetch("/api/chat/ask", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
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
      // Parse SSE format: "data: <json-encoded-token>\n\n"
      // Tokens are JSON-encoded so newlines and special chars survive transport.
      const lines = chunk.split("\n");
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          let parsed;
          try {
            parsed = JSON.parse(line.slice(6));
          } catch {
            continue; // malformed line, skip
          }
          if (parsed === "[DONE]") return;
          if (typeof parsed === "string" && parsed.startsWith("[ERROR]")) throw new Error(parsed.slice(8));
          // Pass metrics objects through as-is for the component to handle
          if (parsed && typeof parsed === "object" && parsed.type === "metrics") {
            onToken(parsed);
          } else if (parsed) {
            onToken(parsed);
          }
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

  /**
   * List locally-available Ollama models (no API key required).
   * @returns {Promise<{models: Array<{id: string, name?: string, parameter_size?: string, size?: string}>, provider: string}>}
   */
  async listOllamaModels() {
    const response = await this.apiCall("/chat/models/ollama");
    return response.data;
  }
}

export const searchApi = new SearchApi();

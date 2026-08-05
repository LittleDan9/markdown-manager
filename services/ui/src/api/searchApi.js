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
   * @param {boolean} helpMode - Answer product questions using built-in help docs
   * @returns {Promise<void>}
   */
  async askQuestion(question, documentId, onToken, signal, deepThink = false, history = [], categoryId = null, provider = null, selectionContext = null, keyId = null, model = null, strictContext = false, helpMode = false) {
    const token = this.getToken();

    // Build platform AI format body
    const messages = [
      ...history.map(({ role, content }) => ({ role, content })),
      { role: "user", content: question },
    ];

    // Determine scope
    let scope = "all";
    if (helpMode) scope = "help";
    else if (documentId) scope = "current";

    const scopeMetadata = { question };
    if (documentId) scopeMetadata.document_id = documentId;
    if (deepThink) scopeMetadata.deep_think = true;
    if (strictContext) scopeMetadata.strict_context = true;
    if (categoryId) scopeMetadata.category_id = categoryId;
    if (selectionContext) scopeMetadata.selection_text = selectionContext;
    if (helpMode) scopeMetadata.client_os = /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent) ? "mac" : "windows";

    const body = {
      messages,
      scope,
      scope_metadata: scopeMetadata,
    };
    if (provider) body.provider = provider;
    if (keyId) body.key_id = String(keyId);
    if (model) body.model = model;
    if (!provider && !keyId) body.provider = "ollama";

    const response = await fetch("/ai/chat/ask", {
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

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const raw = line.slice(6);
          if (raw === "[DONE]") return;
          let parsed;
          try {
            parsed = JSON.parse(raw);
          } catch {
            continue;
          }
          if (typeof parsed === "string") {
            // Platform AI: plain string = token
            if (parsed.startsWith("[ERROR]")) throw new Error(parsed.slice(8));
            onToken(parsed);
          } else if (parsed && typeof parsed === "object") {
            // Structured events: {type, data}
            if (parsed.type === "metrics") {
              onToken({ type: "metrics", data: parsed.data });
            } else if (parsed.type === "error") {
              throw new Error(parsed.data?.message || "AI error");
            }
            // tool_call, tool_result, info — pass through for future UI support
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
    const response = await this.apiCall("/platform-keys/ollama/health");
    return response.data;
  }

  /**
   * List locally-available Ollama models (no API key required).
   * @returns {Promise<{models: Array<{id: string, name?: string, parameter_size?: string, size?: string}>, provider: string}>}
   */
  async listOllamaModels() {
    const response = await this.apiCall("/platform-keys/ollama/models");
    return response.data;
  }
}

export const searchApi = new SearchApi();

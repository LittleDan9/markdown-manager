/**
 * useChatStream — SSE streaming hook for AI chat.
 *
 * Handles connection to the app backend's /api/ai/chat endpoint,
 * parses SSE events, and provides streaming state management.
 */

import { useCallback, useRef, useState } from 'react';
import { parseSSEEvent } from '../utils.js';

/**
 * @typedef {Object} ToolCall
 * @property {string} id
 * @property {string} name
 * @property {Object} arguments
 * @property {'running'|'done'|'error'} status
 * @property {Object|null} result
 */

/**
 * @typedef {Object} ChatStreamOptions
 * @property {string} apiBaseUrl - App backend base URL (e.g. "" for same-origin)
 * @property {string} chatEndpoint - Chat endpoint path (default: "/api/ai/chat")
 * @property {() => string} getAuthToken - Function to get current auth token
 * @property {() => Promise<string>} [refreshToken] - Optional token refresh function
 */

/**
 * Hook for streaming AI chat responses with tool call support.
 *
 * @param {ChatStreamOptions} options
 * @returns {{
 *   sendMessage: (body: Object) => Promise<void>,
 *   isStreaming: boolean,
 *   streamedText: string,
 *   toolCalls: ToolCall[],
 *   metrics: Object|null,
 *   error: string|null,
 *   cancel: () => void,
 * }}
 */
export function useChatStream({ apiBaseUrl = '', chatEndpoint = '/api/ai/chat', getAuthToken, refreshToken }) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamedText, setStreamedText] = useState('');
  const [toolCalls, setToolCalls] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const cancel = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const sendMessage = useCallback(async (body) => {
    // Reset state
    setStreamedText('');
    setToolCalls([]);
    setMetrics(null);
    setError(null);
    setIsStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const token = getAuthToken();
      let response = await fetch(`${apiBaseUrl}${chatEndpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
        credentials: 'include',
      });

      // Handle 401 with token refresh
      if (response.status === 401 && refreshToken) {
        const newToken = await refreshToken();
        if (newToken) {
          response = await fetch(`${apiBaseUrl}${chatEndpoint}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${newToken}`,
            },
            body: JSON.stringify(body),
            signal: controller.signal,
            credentials: 'include',
          });
        }
      }

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || errData.error || `HTTP ${response.status}`);
      }

      // Read SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const dataLine = line.slice(6);

          const event = parseSSEEvent(dataLine);
          if (!event) continue;

          switch (event.type) {
            case 'token':
              setStreamedText((prev) => prev + event.data);
              break;

            case 'tool_call':
              setToolCalls((prev) => [
                ...prev,
                { ...event.data, status: 'running', result: null },
              ]);
              break;

            case 'tool_result':
              setToolCalls((prev) =>
                prev.map((tc) =>
                  tc.id === event.data.id
                    ? { ...tc, status: event.data.result?.error ? 'error' : 'done', result: event.data.result }
                    : tc
                )
              );
              break;

            case 'metrics':
              setMetrics(event.data);
              break;

            case 'info':
              // Info messages can be appended as italic text
              setStreamedText((prev) => prev + `\n\n*${event.data.message}*\n\n`);
              break;

            case 'error':
              setError(event.data.message || 'An error occurred');
              break;

            case 'done':
              break;
          }
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        // User cancelled — not an error
      } else {
        setError(err.message || 'Stream failed');
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [apiBaseUrl, chatEndpoint, getAuthToken, refreshToken]);

  return { sendMessage, isStreaming, streamedText, toolCalls, metrics, error, cancel };
}

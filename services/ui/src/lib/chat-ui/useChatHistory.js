/**
 * useChatHistory — Conversation management hook.
 *
 * Manages conversation CRUD operations via the app backend's proxy endpoints.
 */

import { useCallback, useEffect, useState } from 'react';

/**
 * @typedef {Object} Conversation
 * @property {string} id
 * @property {string} title
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * @typedef {Object} ChatHistoryOptions
 * @property {string} apiBaseUrl - App backend base URL
 * @property {string} appId - App identifier (e.g. "team-manager")
 * @property {() => string} getAuthToken
 * @property {string} [storageKey] - localStorage key for active conversation (default: 'chat_active_conversation')
 */

/**
 * Hook for managing chat conversations.
 *
 * @param {ChatHistoryOptions} options
 */
export function useChatHistory({ apiBaseUrl = '', appId, getAuthToken, storageKey = 'chat_active_conversation' }) {
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(() => {
    try { return localStorage.getItem(storageKey) || null; } catch { return null; }
  });
  const [loading, setLoading] = useState(false);

  // Persist active conversation ID
  useEffect(() => {
    try {
      if (activeConversationId) {
        localStorage.setItem(storageKey, activeConversationId);
      } else {
        localStorage.removeItem(storageKey);
      }
    } catch { /* ignore */ }
  }, [activeConversationId, storageKey]);

  const _fetch = useCallback(async (path, options = {}) => {
    const token = getAuthToken();
    const resp = await fetch(`${apiBaseUrl}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: 'include',
      ...options,
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    if (resp.status === 204) return null;
    return resp.json();
  }, [apiBaseUrl, getAuthToken]);

  const loadConversations = useCallback(async () => {
    setLoading(true);
    try {
      const data = await _fetch(`/ai/conversations?app_id=${appId}`);
      setConversations(data?.conversations || []);
    } catch (err) {
      console.warn('Failed to load conversations:', err);
    } finally {
      setLoading(false);
    }
  }, [_fetch, appId]);

  const createConversation = useCallback(async (title = null) => {
    const data = await _fetch('/ai/conversations', {
      method: 'POST',
      body: JSON.stringify({ app_id: appId, title }),
    });
    if (data) {
      setConversations((prev) => [data, ...prev]);
      setActiveConversationId(data.id);
    }
    return data;
  }, [_fetch, appId]);

  const deleteConversation = useCallback(async (conversationId) => {
    await _fetch(`/ai/conversations/${conversationId}`, { method: 'DELETE' });
    setConversations((prev) => prev.filter((c) => c.id !== conversationId));
    if (activeConversationId === conversationId) {
      setActiveConversationId(null);
    }
  }, [_fetch, activeConversationId]);

  const renameConversation = useCallback(async (conversationId, title) => {
    const data = await _fetch(`/ai/conversations/${conversationId}`, {
      method: 'PUT',
      body: JSON.stringify({ title }),
    });
    setConversations((prev) =>
      prev.map((c) => (c.id === conversationId ? { ...c, title: data?.title || title } : c))
    );
  }, [_fetch]);

  const generateTitle = useCallback(async (conversationId) => {
    try {
      const data = await _fetch(`/ai/conversations/${conversationId}/generate-title`, {
        method: 'POST',
      });
      if (data?.title) {
        setConversations((prev) =>
          prev.map((c) => (c.id === conversationId ? { ...c, title: data.title } : c))
        );
      }
    } catch { /* non-critical */ }
  }, [_fetch]);

  return {
    conversations,
    activeConversationId,
    setActiveConversationId,
    loading,
    loadConversations,
    createConversation,
    deleteConversation,
    renameConversation,
    generateTitle,
  };
}

import { useCallback, useEffect, useRef, useState } from "react";
import { chatHistoryApi } from "@/api/chatHistoryApi";

const STORAGE_KEY = "chat_active_conversation";

/**
 * Hook for managing chat conversation history.
 * Provides CRUD operations and state for conversations and active conversation tracking.
 */
export default function useChatHistory() {
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? Number(saved) || null : null;
    } catch { return null; }
  });
  const [loading, setLoading] = useState(false);
  const titleGenPending = useRef(new Set());

  // Sync activeConversationId to localStorage
  useEffect(() => {
    try {
      if (activeConversationId != null) {
        localStorage.setItem(STORAGE_KEY, String(activeConversationId));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch { /* ignore */ }
  }, [activeConversationId]);

  const loadConversations = useCallback(async () => {
    setLoading(true);
    try {
      const data = await chatHistoryApi.getConversations(50, 0);
      setConversations(data || []);
    } catch (err) {
      console.warn("Failed to load conversations", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const createConversation = useCallback(async (provider, scope, documentId) => {
    try {
      const conv = await chatHistoryApi.createConversation(provider, scope, documentId);
      setActiveConversationId(conv.id);
      setConversations((prev) => [
        {
          ...conv,
          message_count: 0,
          first_message_preview: null,
        },
        ...prev,
      ]);
      return conv;
    } catch (err) {
      console.warn("Failed to create conversation", err);
      return null;
    }
  }, []);

  const loadConversation = useCallback(async (conversationId) => {
    try {
      const detail = await chatHistoryApi.getConversation(conversationId);
      setActiveConversationId(conversationId);
      return detail;
    } catch (err) {
      console.warn("Failed to load conversation", err);
      return null;
    }
  }, []);

  const saveMessage = useCallback(async (conversationId, role, content, metadataJson = null) => {
    if (!conversationId) return null;
    try {
      const msg = await chatHistoryApi.addMessage(conversationId, role, content, metadataJson);
      // Update conversation list preview and count
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId
            ? {
                ...c,
                message_count: (c.message_count || 0) + 1,
                updated_at: new Date().toISOString(),
                first_message_preview:
                  c.first_message_preview || (role === "user" ? content.slice(0, 100) : c.first_message_preview),
              }
            : c
        )
      );
      return msg;
    } catch (err) {
      console.warn("Failed to save message", err);
      return null;
    }
  }, []);

  const deleteConversation = useCallback(async (conversationId) => {
    try {
      await chatHistoryApi.deleteConversation(conversationId);
      setConversations((prev) => prev.filter((c) => c.id !== conversationId));
      if (activeConversationId === conversationId) {
        setActiveConversationId(null);
      }
      return true;
    } catch (err) {
      console.warn("Failed to delete conversation", err);
      return false;
    }
  }, [activeConversationId]);

  const renameConversation = useCallback(async (conversationId, title) => {
    try {
      await chatHistoryApi.updateConversation(conversationId, { title });
      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, title } : c))
      );
      return true;
    } catch (err) {
      console.warn("Failed to rename conversation", err);
      return false;
    }
  }, []);

  const generateTitle = useCallback(async (conversationId, provider) => {
    if (!conversationId || titleGenPending.current.has(conversationId)) return;
    titleGenPending.current.add(conversationId);
    try {
      const result = await chatHistoryApi.generateTitle(conversationId, provider);
      if (result?.title) {
        setConversations((prev) =>
          prev.map((c) => (c.id === conversationId ? { ...c, title: result.title } : c))
        );
        return result.title;
      }
    } catch (err) {
      console.warn("Failed to generate title", err);
    } finally {
      titleGenPending.current.delete(conversationId);
    }
    return null;
  }, []);

  const clearActive = useCallback(() => {
    setActiveConversationId(null);
  }, []);

  return {
    conversations,
    activeConversationId,
    loading,
    loadConversations,
    createConversation,
    loadConversation,
    saveMessage,
    deleteConversation,
    renameConversation,
    generateTitle,
    clearActive,
  };
}

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../providers/AuthProvider';
import commentsApi from '../../api/commentsApi';

/**
 * useComments — Manages comments for a specific document.
 *
 * @param {number|null} documentId
 * @returns {{ comments, total, loading, addComment, updateComment, removeComment, resolveComment, refresh }}
 */
export default function useComments(documentId) {
  const { isAuthenticated } = useAuth();
  const [comments, setComments] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!isAuthenticated || !documentId) {
      setComments([]);
      setTotal(0);
      return;
    }
    try {
      setLoading(true);
      const data = await commentsApi.list(documentId);
      setComments(data.comments || []);
      setTotal(data.total || 0);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, documentId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addComment = useCallback(async ({ content, lineNumber, parentId, anchorText, anchorYpos }) => {
    if (!documentId) return null;
    try {
      const created = await commentsApi.create(documentId, { content, lineNumber, parentId, anchorText, anchorYpos });
      await refresh();
      return created;
    } catch {
      return null;
    }
  }, [documentId, refresh]);

  const updateComment = useCallback(async (commentId, updates) => {
    try {
      const updated = await commentsApi.update(commentId, updates);
      await refresh();
      return updated;
    } catch {
      return null;
    }
  }, [refresh]);

  const removeComment = useCallback(async (commentId) => {
    try {
      await commentsApi.remove(commentId);
      await refresh();
    } catch {
      // silent
    }
  }, [refresh]);

  const resolveComment = useCallback(async (commentId) => {
    return updateComment(commentId, { status: 'resolved' });
  }, [updateComment]);

  return {
    comments,
    total,
    loading,
    addComment,
    updateComment,
    removeComment,
    resolveComment,
    refresh,
  };
}

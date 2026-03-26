import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../providers/AuthProvider';
import notificationsApi from '../../api/notificationsApi';

const POLL_INTERVAL = 60000; // 1 minute

/**
 * useNotifications — Manages notification state with periodic polling.
 */
export default function useNotifications() {
  const { isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const pollRef = useRef(null);

  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      setLoading(true);
      const data = await notificationsApi.list({ limit: 50 });
      setNotifications(data.notifications || []);
      setUnreadCount(data.unread_count || 0);
    } catch {
      // silent — polling failure shouldn't disrupt UX
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const fetchUnreadCount = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const data = await notificationsApi.getUnreadCount();
      setUnreadCount(data.count || 0);
    } catch {
      // silent
    }
  }, [isAuthenticated]);

  const markRead = useCallback(async (id) => {
    try {
      await notificationsApi.markRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {
      // silent
    }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await notificationsApi.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {
      // silent
    }
  }, []);

  const deleteNotification = useCallback(async (id) => {
    try {
      await notificationsApi.deleteNotification(id);
      setNotifications(prev => {
        const removed = prev.find(n => n.id === id);
        const next = prev.filter(n => n.id !== id);
        if (removed && !removed.is_read) {
          setUnreadCount(c => Math.max(0, c - 1));
        }
        return next;
      });
    } catch {
      // silent
    }
  }, []);

  const clearAll = useCallback(async () => {
    try {
      await notificationsApi.clearAll();
      setNotifications([]);
      setUnreadCount(0);
    } catch {
      // silent
    }
  }, []);

  // Initial fetch + polling
  useEffect(() => {
    if (!isAuthenticated) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    fetchNotifications();
    pollRef.current = setInterval(fetchUnreadCount, POLL_INTERVAL);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [isAuthenticated, fetchNotifications, fetchUnreadCount]);

  return {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    markRead,
    markAllRead,
    deleteNotification,
    clearAll,
  };
}

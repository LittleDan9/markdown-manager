import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../providers/AuthProvider';

const WS_RECONNECT_DELAY = 3000;
const HEARTBEAT_INTERVAL = 25000;

/**
 * usePresence — Connects to WebSocket presence endpoint.
 * Tracks which users are active on the current document.
 *
 * @param {number|null} documentId - The document being viewed/edited
 * @returns {{ users: Array<{user_id: number, display_name: string}>, connected: boolean }}
 */
export default function usePresence(documentId) {
  const { isAuthenticated } = useAuth();
  const [users, setUsers] = useState([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);
  const heartbeatRef = useRef(null);
  const reconnectRef = useRef(null);
  const documentIdRef = useRef(documentId);

  // Keep ref up to date
  documentIdRef.current = documentId;

  const cleanup = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
    if (reconnectRef.current) {
      clearTimeout(reconnectRef.current);
      reconnectRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnected(false);
    setUsers([]);
  }, []);

  const connect = useCallback(() => {
    if (!isAuthenticated) return;

    const token = localStorage.getItem('authToken');
    if (!token) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/api/ws/presence?token=${encodeURIComponent(token)}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);

      // Join current document if any
      if (documentIdRef.current) {
        ws.send(JSON.stringify({ type: 'join', document_id: documentIdRef.current }));
      }

      // Start heartbeat
      heartbeatRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'heartbeat' }));
        }
      }, HEARTBEAT_INTERVAL);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'presence') {
          setUsers(data.users || []);
        }
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = (event) => {
      setConnected(false);
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }

      // Reconnect unless intentionally closed
      if (event.code !== 4001 && event.code !== 1000) {
        reconnectRef.current = setTimeout(connect, WS_RECONNECT_DELAY);
      }
    };

    ws.onerror = () => {
      // onclose fires after onerror, reconnect handled there
    };
  }, [isAuthenticated]);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    connect();
    return cleanup;
  }, [connect, cleanup]);

  // When documentId changes, send join/leave
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    if (documentId) {
      ws.send(JSON.stringify({ type: 'join', document_id: documentId }));
    } else {
      ws.send(JSON.stringify({ type: 'leave' }));
    }
  }, [documentId]);

  return { users, connected };
}

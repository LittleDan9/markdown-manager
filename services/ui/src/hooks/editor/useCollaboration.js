import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../providers/AuthProvider';

const WS_RECONNECT_DELAY = 3000;
const MAX_RECONNECT_DELAY = 30000;
const MAX_RETRIES = 10;
const MSG_SYNC = 0;
const MSG_AWARENESS = 1;

/**
 * useCollaboration — Manages the Yjs CRDT document and WebSocket connection
 * for real-time collaborative editing.
 *
 * Only activates when the document has collaborators (hasCollaborators=true).
 * When inactive, returns a no-op state so the editor operates in solo mode.
 *
 * @param {number|null} documentId
 * @param {boolean} hasCollaborators - Whether this document has collaborators
 * @returns {{
 *   collabActive: boolean,
 *   connected: boolean,
 *   ydoc: import('yjs').Doc | null,
 *   ytext: import('yjs').Text | null,
 *   awareness: import('y-protocols/awareness').Awareness | null,
 *   collaborators: Array<{clientId: number, user: object}>,
 *   undoManager: import('yjs').UndoManager | null,
 * }}
 */
export default function useCollaboration(documentId, hasCollaborators = false) {
  const { isAuthenticated } = useAuth();
  const [connected, setConnected] = useState(false);
  const [collabActive, setCollabActive] = useState(false);
  const [collaborators, setCollaborators] = useState([]);
  const ydocRef = useRef(null);
  const ytextRef = useRef(null);
  const awarenessRef = useRef(null);
  const undoManagerRef = useRef(null);
  const wsRef = useRef(null);
  const reconnectRef = useRef(null);
  const retryCountRef = useRef(0);
  const initialSyncDone = useRef(false);
  const onRemoteChangeRef = useRef(null);

  // Expose current collab state via refs for external consumption
  const [ydoc, setYdoc] = useState(null);
  const [ytext, setYtext] = useState(null);
  const [awareness, setAwareness] = useState(null);
  const [undoManager, setUndoManager] = useState(null);

  const cleanup = useCallback(() => {
    if (reconnectRef.current) {
      clearTimeout(reconnectRef.current);
      reconnectRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (undoManagerRef.current) {
      undoManagerRef.current.destroy();
      undoManagerRef.current = null;
    }
    if (awarenessRef.current) {
      awarenessRef.current.destroy();
      awarenessRef.current = null;
    }
    if (ydocRef.current) {
      ydocRef.current.destroy();
      ydocRef.current = null;
    }
    ytextRef.current = null;
    initialSyncDone.current = false;

    setYdoc(null);
    setYtext(null);
    setAwareness(null);
    setUndoManager(null);
    setConnected(false);
    setCollabActive(false);
    setCollaborators([]);
  }, []);

  const connect = useCallback(async () => {
    if (!isAuthenticated || !documentId || !hasCollaborators) return;

    // Dynamically import Yjs (code-split)
    const Y = await import('yjs');
    const { Awareness } = await import('y-protocols/awareness');

    // Create Y.Doc
    const doc = new Y.Doc();
    ydocRef.current = doc;
    const text = doc.getText('content');
    ytextRef.current = text;

    // Awareness for cursor positions
    const aw = new Awareness(doc);
    awarenessRef.current = aw;

    // UndoManager scoped to the text type
    const um = new Y.UndoManager(text);
    undoManagerRef.current = um;

    // Expose to state
    setYdoc(doc);
    setYtext(text);
    setAwareness(aw);
    setUndoManager(um);

    // Listen for awareness changes to update collaborators list
    aw.on('change', () => {
      const states = Array.from(aw.getStates().entries())
        .filter(([clientId]) => clientId !== doc.clientID)
        .map(([clientId, state]) => ({ clientId, user: state.user || {} }));
      setCollaborators(states);
    });

    // Listen for remote document changes — notify the editor
    doc.on('update', (update, origin) => {
      if (origin === 'local') return; // Skip our own changes
      if (onRemoteChangeRef.current) {
        onRemoteChangeRef.current(text.toString());
      }
    });

    // Open WebSocket
    const token = localStorage.getItem('authToken');
    if (!token) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/ws/collab/${documentId}?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(wsUrl);
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setCollabActive(true);
      retryCountRef.current = 0;
    };

    ws.onmessage = (event) => {
      // Handle text-based maintenance messages during shutdown
      if (typeof event.data === 'string') {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'maintenance') {
            window.dispatchEvent(new CustomEvent('notification', {
              detail: { message: msg.message || 'Server updating, reconnecting...', type: 'info', duration: 5000 }
            }));
          }
        } catch { /* ignore */ }
        return;
      }

      const data = new Uint8Array(event.data);
      if (data.length < 2) return;

      const msgType = data[0];
      const payload = data.slice(1);

      if (msgType === MSG_SYNC) {
        // Apply the Yjs update
        try {
          Y.applyUpdate(doc, payload, 'remote');
          if (!initialSyncDone.current) {
            initialSyncDone.current = true;
          }
        } catch (e) {
          console.error('Failed to apply Yjs update:', e);
        }
      } else if (msgType === MSG_AWARENESS) {
        try {
          const { applyAwarenessUpdate } = require('y-protocols/awareness');
          applyAwarenessUpdate(aw, payload, 'remote');
        } catch (e) {
          console.error('Failed to apply awareness update:', e);
        }
      }
    };

    ws.onclose = (event) => {
      setConnected(false);
      // Reconnect with exponential backoff unless intentionally closed
      if (event.code !== 4001 && event.code !== 1000 && event.code !== 4003 && event.code !== 4004) {
        if (retryCountRef.current < MAX_RETRIES) {
          const delay = Math.min(WS_RECONNECT_DELAY * Math.pow(2, retryCountRef.current), MAX_RECONNECT_DELAY);
          retryCountRef.current += 1;
          reconnectRef.current = setTimeout(connect, delay);
        } else {
          console.warn('Collaboration WebSocket: max retries reached, giving up');
        }
      }
    };

    ws.onerror = () => {
      // onclose fires after onerror
    };

    // Set up outgoing sync: when the local doc changes, send updates to server
    doc.on('update', (update, origin) => {
      if (origin === 'remote') return; // Don't echo back remote updates
      if (ws.readyState === WebSocket.OPEN) {
        const msg = new Uint8Array(1 + update.length);
        msg[0] = MSG_SYNC;
        msg.set(update, 1);
        ws.send(msg);
      }
    });

    // Send awareness updates
    aw.on('update', ({ added, updated, removed }) => {
      if (ws.readyState === WebSocket.OPEN) {
        const { encodeAwarenessUpdate } = require('y-protocols/awareness');
        const changedClients = added.concat(updated).concat(removed);
        const encoded = encodeAwarenessUpdate(aw, changedClients);
        const msg = new Uint8Array(1 + encoded.length);
        msg[0] = MSG_AWARENESS;
        msg.set(encoded, 1);
        ws.send(msg);
      }
    });

  }, [isAuthenticated, documentId, hasCollaborators]);

  // Connect/disconnect based on document and collaborator state
  useEffect(() => {
    if (documentId && hasCollaborators && isAuthenticated) {
      connect();
    }
    return cleanup;
  }, [documentId, hasCollaborators, isAuthenticated, connect, cleanup]);

  /**
   * Register a callback for remote content changes.
   * The editor integration uses this to update Monaco without
   * going through triggerContentUpdate (which would cause a loop).
   */
  const onRemoteChange = useCallback((callback) => {
    onRemoteChangeRef.current = callback;
  }, []);

  /**
   * Apply a local text change to the Y.Doc.
   * Called by the editor integration when the user types.
   */
  const applyLocalChange = useCallback((newContent) => {
    const text = ytextRef.current;
    const doc = ydocRef.current;
    if (!text || !doc) return;

    doc.transact(() => {
      const currentContent = text.toString();
      // Simple diff: delete all and insert new
      // In production, a proper diff (e.g., fast-diff) would be more efficient
      if (currentContent !== newContent) {
        text.delete(0, currentContent.length);
        text.insert(0, newContent);
      }
    }, 'local');
  }, []);

  /**
   * Set the local user's cursor/selection in awareness state.
   */
  const setLocalCursor = useCallback((position, selection, userInfo) => {
    const aw = awarenessRef.current;
    if (!aw) return;
    aw.setLocalStateField('user', userInfo);
    aw.setLocalStateField('cursor', { position, selection });
  }, []);

  return {
    collabActive,
    connected,
    ydoc,
    ytext,
    awareness,
    undoManager,
    collaborators,
    onRemoteChange,
    applyLocalChange,
    setLocalCursor,
  };
}

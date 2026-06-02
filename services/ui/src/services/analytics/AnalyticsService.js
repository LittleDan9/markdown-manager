/**
 * Analytics Service
 * Lightweight event tracking for guest and authenticated user activity.
 * Events are batched and flushed periodically or on page unload.
 * Session identification uses sessionStorage (ephemeral, resets on tab close).
 */

const SESSION_ID_KEY = 'analyticsSessionId';
const FLUSH_INTERVAL_MS = 30000; // 30 seconds
const MAX_BATCH_SIZE = 50;
const API_ENDPOINT = '/api/analytics/events';

class AnalyticsService {
  constructor() {
    this._queue = [];
    this._flushTimer = null;
    this._isAuthenticated = false;
    this._userId = null;
    this._initialized = false;
  }

  /**
   * Initialize the service — call once after AuthService is ready.
   */
  init({ isAuthenticated, userId }) {
    if (this._initialized) return;
    this._initialized = true;
    this._isAuthenticated = isAuthenticated;
    this._userId = userId && userId > 0 ? userId : null;

    // Start periodic flush
    this._flushTimer = setInterval(() => this._flush(), FLUSH_INTERVAL_MS);

    // Flush on page unload via sendBeacon
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this._flush(true);
      }
    });
    window.addEventListener('pagehide', () => this._flush(true));

    // Fire session_start
    this.track('session_start');
  }

  /**
   * Update auth state (e.g., after login/logout).
   */
  setAuthState({ isAuthenticated, userId }) {
    this._isAuthenticated = isAuthenticated;
    this._userId = userId && userId > 0 ? userId : null;
  }

  /**
   * Track an analytics event.
   * @param {string} eventType - One of the allowed event types
   * @param {object|null} eventData - Optional metadata
   */
  track(eventType, eventData = null) {
    if (!this._initialized) return;

    this._queue.push({
      event_type: eventType,
      event_data: eventData,
      is_authenticated: this._isAuthenticated,
      user_id: this._userId,
      timestamp: new Date().toISOString(),
    });

    // Auto-flush if batch is full
    if (this._queue.length >= MAX_BATCH_SIZE) {
      this._flush();
    }
  }

  /**
   * Get or create the ephemeral session ID.
   */
  _getSessionId() {
    let id = sessionStorage.getItem(SESSION_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(SESSION_ID_KEY, id);
    }
    return id;
  }

  /**
   * Flush queued events to the backend.
   * @param {boolean} useBeacon - Use navigator.sendBeacon for unload scenarios
   */
  _flush(useBeacon = false) {
    if (this._queue.length === 0) return;

    const events = this._queue.splice(0, MAX_BATCH_SIZE);
    const payload = JSON.stringify({
      session_id: this._getSessionId(),
      events,
    });

    if (useBeacon && navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon(API_ENDPOINT, blob);
    } else {
      fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(() => {
        // Analytics is best-effort — don't disrupt the user
      });
    }
  }

  /**
   * Stop the service (for testing/cleanup).
   */
  destroy() {
    if (this._flushTimer) {
      clearInterval(this._flushTimer);
      this._flushTimer = null;
    }
    this._flush();
    this._initialized = false;
  }
}

export default new AnalyticsService();

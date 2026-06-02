/**
 * AnalyticsService Unit Tests
 */

import AnalyticsService from '@/services/analytics/AnalyticsService';

// Mock fetch and sendBeacon
global.fetch = jest.fn(() => Promise.resolve());
global.navigator.sendBeacon = jest.fn(() => true);

// Mock crypto.randomUUID
Object.defineProperty(global, 'crypto', {
  value: { randomUUID: jest.fn(() => 'test-uuid-1234-5678-abcdef') },
  writable: true,
  configurable: true,
});

// Mock sessionStorage
const sessionStorageMock = (() => {
  let store = {};
  return {
    getItem: jest.fn((key) => store[key] || null),
    setItem: jest.fn((key, value) => { store[key] = value; }),
    removeItem: jest.fn((key) => { delete store[key]; }),
    clear: jest.fn(() => { store = {}; }),
  };
})();
Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock });

describe('AnalyticsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    sessionStorageMock.clear();
    // Reset the service state between tests
    AnalyticsService._initialized = false;
    AnalyticsService._queue = [];
    AnalyticsService._isAuthenticated = false;
    AnalyticsService._userId = null;
    if (AnalyticsService._flushTimer) {
      clearInterval(AnalyticsService._flushTimer);
      AnalyticsService._flushTimer = null;
    }
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('init()', () => {
    it('should initialize and fire session_start', () => {
      AnalyticsService.init({ isAuthenticated: false, userId: -1 });

      expect(AnalyticsService._initialized).toBe(true);
      expect(AnalyticsService._queue).toHaveLength(1);
      expect(AnalyticsService._queue[0].event_type).toBe('session_start');
      expect(AnalyticsService._queue[0].is_authenticated).toBe(false);
      expect(AnalyticsService._queue[0].user_id).toBeNull();
    });

    it('should set authenticated state correctly', () => {
      AnalyticsService.init({ isAuthenticated: true, userId: 42 });

      expect(AnalyticsService._isAuthenticated).toBe(true);
      expect(AnalyticsService._userId).toBe(42);
      expect(AnalyticsService._queue[0].is_authenticated).toBe(true);
      expect(AnalyticsService._queue[0].user_id).toBe(42);
    });

    it('should not re-initialize if already initialized', () => {
      AnalyticsService.init({ isAuthenticated: false, userId: -1 });
      AnalyticsService.init({ isAuthenticated: true, userId: 5 });

      // Only one session_start
      expect(AnalyticsService._queue).toHaveLength(1);
      // State stays as first init
      expect(AnalyticsService._isAuthenticated).toBe(false);
    });

    it('should treat userId <= 0 as null', () => {
      AnalyticsService.init({ isAuthenticated: false, userId: -1 });
      expect(AnalyticsService._userId).toBeNull();

      AnalyticsService._initialized = false;
      AnalyticsService._queue = [];
      AnalyticsService.init({ isAuthenticated: false, userId: 0 });
      expect(AnalyticsService._userId).toBeNull();
    });
  });

  describe('track()', () => {
    it('should add events to the queue', () => {
      AnalyticsService.init({ isAuthenticated: false, userId: -1 });
      AnalyticsService._queue = []; // clear session_start

      AnalyticsService.track('document_create', { category: 'General' });

      expect(AnalyticsService._queue).toHaveLength(1);
      expect(AnalyticsService._queue[0]).toMatchObject({
        event_type: 'document_create',
        event_data: { category: 'General' },
        is_authenticated: false,
        user_id: null,
      });
      expect(AnalyticsService._queue[0].timestamp).toBeDefined();
    });

    it('should not track if not initialized', () => {
      AnalyticsService.track('document_create');
      expect(AnalyticsService._queue).toHaveLength(0);
    });

    it('should auto-flush when batch is full', () => {
      AnalyticsService.init({ isAuthenticated: false, userId: -1 });
      AnalyticsService._queue = [];

      // Fill to max batch size
      for (let i = 0; i < 50; i++) {
        AnalyticsService.track('document_edit');
      }

      // Should have triggered a flush (fetch call)
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe('setAuthState()', () => {
    it('should update auth state', () => {
      AnalyticsService.init({ isAuthenticated: false, userId: -1 });
      AnalyticsService.setAuthState({ isAuthenticated: true, userId: 10 });

      expect(AnalyticsService._isAuthenticated).toBe(true);
      expect(AnalyticsService._userId).toBe(10);
    });
  });

  describe('_getSessionId()', () => {
    it('should generate and store a UUID in sessionStorage', () => {
      const id = AnalyticsService._getSessionId();

      expect(id).toBe('test-uuid-1234-5678-abcdef');
      expect(sessionStorageMock.setItem).toHaveBeenCalledWith(
        'analyticsSessionId',
        'test-uuid-1234-5678-abcdef'
      );
    });

    it('should reuse existing sessionStorage UUID', () => {
      sessionStorageMock.getItem.mockReturnValueOnce('existing-uuid');

      const id = AnalyticsService._getSessionId();
      expect(id).toBe('existing-uuid');
    });
  });

  describe('_flush()', () => {
    it('should not flush if queue is empty', () => {
      AnalyticsService.init({ isAuthenticated: false, userId: -1 });
      AnalyticsService._queue = [];

      AnalyticsService._flush();

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should send events via fetch', () => {
      AnalyticsService.init({ isAuthenticated: false, userId: -1 });

      AnalyticsService._flush();

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/analytics/events',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          keepalive: true,
        })
      );

      const body = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(body.session_id).toBe('test-uuid-1234-5678-abcdef');
      expect(body.events).toHaveLength(1);
      expect(body.events[0].event_type).toBe('session_start');
    });

    it('should use sendBeacon when useBeacon=true', () => {
      AnalyticsService.init({ isAuthenticated: false, userId: -1 });

      AnalyticsService._flush(true);

      expect(global.navigator.sendBeacon).toHaveBeenCalledWith(
        '/api/analytics/events',
        expect.any(Blob)
      );
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should flush periodically (30s)', () => {
      AnalyticsService.init({ isAuthenticated: false, userId: -1 });
      AnalyticsService._queue = []; // clear

      AnalyticsService.track('document_edit');
      expect(global.fetch).not.toHaveBeenCalled();

      jest.advanceTimersByTime(30000);
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe('destroy()', () => {
    it('should flush remaining events and stop timer', () => {
      AnalyticsService.init({ isAuthenticated: false, userId: -1 });
      AnalyticsService.track('document_create');

      AnalyticsService.destroy();

      expect(global.fetch).toHaveBeenCalled();
      expect(AnalyticsService._initialized).toBe(false);
    });
  });
});

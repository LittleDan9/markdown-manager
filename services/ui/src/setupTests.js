import '@testing-library/jest-dom';

// Mock Monaco Editor
global.monaco = {
  KeyCode: {
    Enter: 3,
    KeyB: 5,
    KeyI: 23,
    US_DOT: 84,
    Slash: 85
  },
  KeyMod: {
    CtrlCmd: 2048
  }
};

// Configure React Testing Library to work better with async operations
import { configure } from '@testing-library/react';
configure({ 
  testIdAttribute: 'data-testid',
  asyncUtilTimeout: 2000,
  // Disable act warnings for tests - we handle them manually where needed
  reactStrictMode: false
});

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor(cb) {
    this.cb = cb;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor(cb) {
    this.cb = cb;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock XMLHttpRequest for JSDOM to prevent actual network calls
const mockXHR = {
  open: jest.fn(),
  send: jest.fn(),
  setRequestHeader: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  abort: jest.fn(),
  responseURL: '',
  status: 200,
  statusText: 'OK',
  response: '{}',
  responseText: '{}',
  responseType: '',
  timeout: 0,
  upload: {
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  },
  withCredentials: false,
  readyState: 4,
  UNSENT: 0,
  OPENED: 1, 
  HEADERS_RECEIVED: 2,
  LOADING: 3,
  DONE: 4,
};

global.XMLHttpRequest = jest.fn(() => mockXHR);

// Suppress console errors in test environment
const originalError = console.error;
console.error = (...args) => {
  const message = args[0]?.toString?.() || '';
  if (message.includes('Warning: An update to') && message.includes('was not wrapped in act')) {
    return; // Suppress act warnings
  }
  if (message.includes('The current testing environment is not configured to support act')) {
    return; // Suppress act environment warnings
  }
  originalError(...args);
};
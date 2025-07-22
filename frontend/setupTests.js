// Polyfill fetch for MSW in Jest using whatwg-fetch
require('whatwg-fetch');

// Polyfill TransformStream for MSW in Jest
if (typeof global.TransformStream === 'undefined') {
  global.TransformStream = require('web-streams-polyfill').TransformStream;
}

// Minimal BroadcastChannel stub for MSW in Jest (Node.js)
if (typeof global.BroadcastChannel === 'undefined') {
  global.BroadcastChannel = class {
    constructor() {}
    postMessage() {}
    close() {}
    addEventListener() {}
    removeEventListener() {}
    onmessage = null;
  };
}


// setupTests.js
// Jest setup for React Testing Library and MSW
require('@testing-library/jest-dom');
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
const { server } = require('./src/mocks/server');

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/**
 * Jest test setup file
 */

// Increase timeout for integration tests
jest.setTimeout(30000);

// Global test utilities
global.sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Console formatting for test output
const originalConsoleLog = console.log;
console.log = (...args) => {
  if (process.env.NODE_ENV !== 'test') {
    originalConsoleLog(...args);
  }
};

// Error handling for unhandled promise rejections in tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
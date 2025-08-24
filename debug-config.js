// Debug script to check environment detection in production
console.log('=== ENVIRONMENT DEBUG ===');
console.log('window.location.hostname:', window.location.hostname);
console.log('window.location.port:', window.location.port);
console.log('window.location.protocol:', window.location.protocol);
console.log('window.location.href:', window.location.href);
console.log('process.env.NODE_ENV:', typeof process !== 'undefined' ? process.env?.NODE_ENV : 'undefined');

// Test the exact logic from config.js
const isDev = (
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1" ||
  window.location.hostname === "api.localhost" ||
  window.location.port === "3000" ||
  (typeof process !== 'undefined' && process.env?.NODE_ENV === "development")
);

console.log('isDevelopment result:', isDev);

// Test API URL generation
let baseUrl;
if (isDev) {
  baseUrl = "http://api.localhost";
} else {
  baseUrl = "https://api.littledan.com";
}

console.log('API baseUrl would be:', baseUrl);
console.log('========================');

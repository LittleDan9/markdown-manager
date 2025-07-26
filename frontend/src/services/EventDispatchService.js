export const notification = {
  error: (message) => window.dispatchEvent(new CustomEvent('notification', { detail: { message, type: 'error' } })),
  success: (message) => window.dispatchEvent(new CustomEvent('notification', { detail: { message, type: 'success' } })),
  warning: (message) => window.dispatchEvent(new CustomEvent('notification', { detail: { message, type: 'warning' } })),
  info: (message) => window.dispatchEvent(new CustomEvent('notification', { detail: { message, type: 'info' } })),
};
/**
 * @platform/chat-ui — Shared AI chat hooks and utilities
 *
 * Framework-agnostic React hooks for AI chat integration.
 * Each app provides its own UI components and wires them to these hooks.
 */

export { useChatStream } from './hooks/useChatStream.js';
export { useChatHistory } from './hooks/useChatHistory.js';
export { useProviders } from './hooks/useProviders.js';
export { useQuota } from './hooks/useQuota.js';
export { parseSSEEvent, formatMetrics, formatDuration } from './utils.js';

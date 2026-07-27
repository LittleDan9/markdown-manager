/**
 * SSE event parsing and formatting utilities.
 */

/**
 * Parse a single SSE data line into a structured event.
 *
 * @param {string} dataLine - The content after "data: " in an SSE event
 * @returns {{ type: string, data: any } | { type: 'token', data: string } | null}
 */
export function parseSSEEvent(dataLine) {
  if (!dataLine || dataLine === '[DONE]') {
    return { type: 'done', data: null };
  }

  try {
    const parsed = JSON.parse(dataLine);

    // Structured event: {type: "tool_call"|"tool_result"|"metrics"|"info"|"error", data: {...}}
    if (parsed && typeof parsed === 'object' && parsed.type) {
      return { type: parsed.type, data: parsed.data };
    }

    // Plain string token
    if (typeof parsed === 'string') {
      return { type: 'token', data: parsed };
    }

    // Unknown structure — treat as token
    return { type: 'token', data: String(parsed) };
  } catch {
    // Unparseable — treat as raw text token
    return { type: 'token', data: dataLine };
  }
}

/**
 * Format metrics object into human-readable summary.
 *
 * @param {{ total_ms?: number, output_tokens?: number, provider?: string, model?: string }} metrics
 * @returns {string}
 */
export function formatMetrics(metrics) {
  if (!metrics) return '';
  const parts = [];
  if (metrics.total_ms) parts.push(formatDuration(metrics.total_ms));
  if (metrics.output_tokens) parts.push(`${metrics.output_tokens} tokens`);
  if (metrics.model) parts.push(metrics.model);
  return parts.join(' · ');
}

/**
 * Format milliseconds into human-readable duration.
 *
 * @param {number} ms
 * @returns {string}
 */
export function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

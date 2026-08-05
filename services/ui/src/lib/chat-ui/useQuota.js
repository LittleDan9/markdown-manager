/**
 * useQuota — Token/storage quota status hook.
 *
 * Polls the quota endpoint and provides usage status for UI indicators.
 */

import { useCallback, useEffect, useState } from 'react';

/**
 * @typedef {Object} QuotaStatus
 * @property {boolean} is_exempt - Admin users are exempt from quotas
 * @property {number} daily_limit - Max daily tokens
 * @property {number} daily_used - Tokens used today
 * @property {number} hourly_limit - Max hourly requests
 * @property {number} hourly_used - Requests this hour
 * @property {string} resets_at - ISO timestamp when quota resets
 * @property {number} usage_percent - Percentage of daily limit used (0-100)
 * @property {boolean} is_warning - True if usage > 80%
 * @property {boolean} is_exceeded - True if quota exceeded
 */

/**
 * @typedef {Object} QuotaOptions
 * @property {string} apiBaseUrl
 * @property {() => string} getAuthToken
 * @property {boolean} [enabled] - Whether to poll (default: true)
 * @property {number} [pollInterval] - Poll interval in ms (default: 60000)
 */

/**
 * Hook for monitoring AI usage quota status.
 *
 * @param {QuotaOptions} options
 * @returns {QuotaStatus & { refresh: () => Promise<void> }}
 */
export function useQuota({ apiBaseUrl = '', getAuthToken, enabled = true, pollInterval = 60000 }) {
  const [quota, setQuota] = useState({
    is_exempt: false,
    daily_limit: 0,
    daily_used: 0,
    hourly_limit: 0,
    hourly_used: 0,
    resets_at: '',
    usage_percent: 0,
    is_warning: false,
    is_exceeded: false,
  });

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      const token = getAuthToken();
      const resp = await fetch(`${apiBaseUrl}/ai/usage/quota`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
      });
      if (!resp.ok) return;
      const data = await resp.json();

      const usage_percent = data.daily_limit > 0
        ? Math.round((data.daily_used / data.daily_limit) * 100)
        : 0;

      setQuota({
        ...data,
        usage_percent,
        is_warning: !data.is_exempt && usage_percent >= 80,
        is_exceeded: !data.is_exempt && usage_percent >= 100,
      });
    } catch { /* non-critical */ }
  }, [apiBaseUrl, getAuthToken, enabled]);

  // Initial load + polling
  useEffect(() => {
    if (!enabled) return;
    refresh();
    const interval = setInterval(refresh, pollInterval);
    return () => clearInterval(interval);
  }, [refresh, enabled, pollInterval]);

  return { ...quota, refresh };
}

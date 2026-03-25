import { useEffect, useRef, useCallback } from 'react';
import { useNotification } from '@/components/NotificationProvider';

/* global __BUILD_HASH__ */
const CURRENT_BUILD_HASH = typeof __BUILD_HASH__ !== 'undefined' ? __BUILD_HASH__ : null;
const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

/**
 * Polls /version.json periodically and shows a notification when a newer
 * build is detected, prompting the user to reload.
 *
 * Only active in production (when __BUILD_HASH__ is defined).
 */
export function useVersionCheck() {
  const { showInfo } = useNotification();
  const notifiedRef = useRef(false);

  const checkVersion = useCallback(async () => {
    if (!CURRENT_BUILD_HASH || notifiedRef.current) return;

    try {
      const res = await fetch('/version.json', { cache: 'no-store' });
      if (!res.ok) return;
      const { buildHash } = await res.json();
      if (buildHash && buildHash !== CURRENT_BUILD_HASH && !notifiedRef.current) {
        notifiedRef.current = true;
        showInfo('A new version is available. Please refresh the page to update.', 0);
      }
    } catch {
      // Network error — silently ignore, will retry next interval
    }
  }, [showInfo]);

  useEffect(() => {
    if (!CURRENT_BUILD_HASH) return;

    // Initial check after a short delay (let the app settle)
    const initialTimeout = setTimeout(checkVersion, 30_000);
    const interval = setInterval(checkVersion, CHECK_INTERVAL);

    // Also check when the tab regains focus (user returning to a stale tab)
    const onFocus = () => checkVersion();
    window.addEventListener('focus', onFocus);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [checkVersion]);
}

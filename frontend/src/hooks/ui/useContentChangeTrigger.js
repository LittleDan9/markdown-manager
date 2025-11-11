import { useCallback, useRef } from 'react';

/**
 * Custom hook for managing content change triggers
 * Provides a unified way to emit content change events and reduce useEffect dependencies
 *
 * @param {function} onContentChange - Callback to call when content changes
 * @returns {Object} - { triggerContentChange, lastContentRef }
 */
export default function useContentChangeTrigger(onContentChange) {
  const lastContentRef = useRef('');
  const lastTriggerTimeRef = useRef(0);

  const triggerContentChange = useCallback((newContent, options = {}) => {
    const {
      force = false,
      reason = 'content-change',
      debounceMs = 0
    } = options;

    // Skip if content hasn't changed and not forced
    if (!force && newContent === lastContentRef.current) {
      return;
    }

    // Debounce if specified
    const now = Date.now();
    if (debounceMs > 0 && (now - lastTriggerTimeRef.current) < debounceMs) {
      return;
    }

    lastContentRef.current = newContent;
    lastTriggerTimeRef.current = now;

    console.log(`📝 Content change triggered: ${reason}`, {
      length: newContent.length,
      force,
      debounceMs
    });

    if (onContentChange) {
      onContentChange(newContent, { reason, ...options });
    }
  }, [onContentChange]);

  return {
    triggerContentChange,
    lastContentRef
  };
}
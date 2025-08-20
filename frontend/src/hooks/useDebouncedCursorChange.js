import { useRef } from 'react';
import { useDebouncedCallback } from '@/utils/useDebouncedCallback';

/**
 * Custom hook for handling debounced cursor line changes
 * @param {Function} onCursorLineChange - Callback when cursor line changes
 * @param {number} debounceMs - Debounce delay in milliseconds (default: 300)
 * @returns {Function} - Debounced line change handler
 */
export default function useDebouncedCursorChange(onCursorLineChange, debounceMs = 300) {
  const lastLineNumberRef = useRef(1);

  const debouncedLineChange = useDebouncedCallback((lineNumber) => {
    if (onCursorLineChange && lineNumber !== lastLineNumberRef.current) {
      lastLineNumberRef.current = lineNumber;
      onCursorLineChange(lineNumber);
    }
  }, debounceMs);

  return debouncedLineChange;
}

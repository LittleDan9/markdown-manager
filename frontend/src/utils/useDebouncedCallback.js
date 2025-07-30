// utils/useDebouncedCallback.js
import { useRef, useCallback } from 'react';

export function useDebouncedCallback(callback, delay) {
  const timeoutRef = useRef();

  return useCallback((...args) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      callback(...args);
    }, delay);
  }, [callback, delay]);
}
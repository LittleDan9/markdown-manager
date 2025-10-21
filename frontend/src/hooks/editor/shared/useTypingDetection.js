import { useRef, useCallback } from 'react';

/**
 * Hook for detecting when user is actively typing vs. external value changes
 * Uses refs to avoid re-renders that could interfere with editor focus
 * @returns {Object} { isTyping, setIsTyping, typingTimeoutRef }
 */
export function useTypingDetection() {
  const isTypingRef = useRef(false);
  const typingTimeoutRef = useRef(null);

  const markAsTyping = () => {
    isTypingRef.current = true;
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
    }, 500); // Stop considering as "typing" after 500ms of inactivity
  };

  const getIsTyping = () => {
    return isTypingRef.current;
  };

  const cleanup = () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };

  return {
    isTyping: isTypingRef, // Return ref instead of state
    getIsTyping, // Function to get current typing state
    typingTimeoutRef,
    markAsTyping,
    cleanup
  };
}

/**
 * Generic debounce hook for editor operations
 * @param {Function} callback - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @param {Object} dependencies - Dependencies for cleanup
 * @returns {Object} { debounce, cancel, cleanup }
 */
export function useDebounce() {
  const timeoutRef = useRef(null);

  const debounce = useCallback((callback, delay) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(callback, delay);
  }, []);

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const cleanup = useCallback(() => {
    cancel();
  }, [cancel]);

  return {
    debounce,
    cancel,
    cleanup
  };
}
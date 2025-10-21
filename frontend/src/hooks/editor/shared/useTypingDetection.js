import { useState, useRef } from 'react';

/**
 * Hook for detecting when user is actively typing vs. external value changes
 * Used by spell check and markdown lint to prevent interference during typing
 * @returns {Object} { isTyping, setIsTyping, typingTimeoutRef }
 */
export function useTypingDetection() {
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef(null);

  const markAsTyping = () => {
    setIsTyping(true);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
    }, 500); // Stop considering as "typing" after 500ms of inactivity
  };

  const cleanup = () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };

  return {
    isTyping,
    setIsTyping,
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

  const debounce = (callback, delay) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(callback, delay);
  };

  const cancel = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const cleanup = () => {
    cancel();
  };

  return {
    debounce,
    cancel,
    cleanup
  };
}
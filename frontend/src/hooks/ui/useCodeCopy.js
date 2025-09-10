/**
 * useCodeCopy - Custom hook for handling code block copy functionality
 */

import { useEffect, useRef, useCallback } from 'react';
import { useNotification } from '@/components/NotificationProvider';
import CopyService from '@/services/ui/CopyService';

/**
 * Custom hook to setup copy functionality for code blocks
 * @param {string} content - HTML content that may contain code blocks
 * @param {boolean} enabled - Whether copy functionality should be enabled
 * @returns {Function} - Ref callback to attach to the container element
 */
export function useCodeCopy(content, enabled = true) {
  const containerRef = useRef(null);
  const { showSuccess, showError } = useNotification();

  // Notification callback for copy operations
  const notificationCallback = useCallback((message, type) => {
    if (type === 'success') {
      showSuccess(message);
    } else if (type === 'error') {
      showError(message);
    }
  }, [showSuccess, showError]);

  // Setup copy handlers when content changes
  useEffect(() => {
    if (!enabled || !containerRef.current) return;

    // Small delay to ensure DOM is updated
    const timeoutId = setTimeout(() => {
      if (containerRef.current) {
        CopyService.setupCopyHandlers(containerRef.current, notificationCallback);
      }
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      if (containerRef.current) {
        CopyService.removeCopyHandlers(containerRef.current);
      }
    };
  }, [content, enabled, notificationCallback]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (containerRef.current) {
        CopyService.removeCopyHandlers(containerRef.current);
      }
    };
  }, []);

  // Return ref callback
  const setContainerRef = useCallback((element) => {
    containerRef.current = element;
  }, []);

  return setContainerRef;
}

export default useCodeCopy;

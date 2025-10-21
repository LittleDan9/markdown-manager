import { useRef, useCallback, useState, useEffect } from 'react';

// Singleton state for editor content - shared across all instances
let globalContentRef = { current: '' };
let globalSubscribers = new Set();

/**
 * Hook for accessing editor content WITHOUT causing re-renders
 * This version uses refs to avoid React re-render cycles that steal focus
 */
export default function useEditorContent() {
  const contentRef = useRef(globalContentRef.current);

  // Subscribe to content changes when component mounts, but update ref instead of state
  useEffect(() => {
    const unsubscribe = subscribe((newContent) => {
      contentRef.current = newContent;
      // Don't trigger re-render - this prevents focus loss
    });

    return unsubscribe;
  }, []);

  return {
    // Return ref instead of reactive state to avoid re-renders
    contentRef,
    // For components that need the initial content synchronously
    initialContent: globalContentRef.current
  };
}

// Update content without causing re-renders
export const updateContent = (newContent) => {
  globalContentRef.current = newContent;

  // Notify subscribers immediately but asynchronously to avoid blocking
  globalSubscribers.forEach(callback => {
    try {
      // Use setTimeout with 0 delay to avoid blocking the editor
      setTimeout(() => callback(newContent), 0);
    } catch (error) {
      console.error('Error in editor content subscriber:', error);
    }
  });
};

// Get current content synchronously
export const getCurrentContent = () => {
  return globalContentRef.current;
};

// Subscribe to content changes (for components that need updates)
export const subscribe = (callback) => {
  globalSubscribers.add(callback);

  // Return unsubscribe function
  return () => {
    globalSubscribers.delete(callback);
  };
};
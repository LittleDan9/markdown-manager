import { useState, useRef } from 'react';

/**
 * Custom hook for managing rendering progress in the Renderer component
 * Tracks progress for syntax highlighting, Mermaid rendering, and overall progress
 * @returns {Object} - { progress, setProgress, updateProgress, clearProgress }
 */
export default function useRenderingProgress() {
  const [progress, setProgress] = useState(null);
  const progressRef = useRef(null);

  const updateProgress = (current, total, operation = 'Processing') => {
    const percentComplete = Math.round((current / total) * 100);
    const progressObj = {
      percentComplete,
      current,
      total,
      operation
    };

    progressRef.current = progressObj;
    setProgress(progressObj);
  };

  const clearProgress = () => {
    // Add a small delay before clearing to ensure user sees completion
    setTimeout(() => {
      setProgress(null);
      progressRef.current = null;
    }, 500);
  };

  const setProgressWithOperation = (operation, percentComplete = 0) => {
    const progressObj = {
      percentComplete,
      operation
    };

    progressRef.current = progressObj;
    setProgress(progressObj);
  };

  return {
    progress,
    setProgress: setProgressWithOperation,
    updateProgress,
    clearProgress
  };
}

import { useState, useRef, useEffect } from 'react';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import { MarkdownLintService, MarkdownLintMarkerAdapter } from '@/services/editor';
import { useDebounce } from './shared';

/**
 * Hook for managing markdown linting functionality
 * @param {Object} editor - Monaco editor instance
 * @param {boolean} enabled - Whether markdown lint is enabled
 * @param {string} categoryId - Category ID for context
 * @param {Function} getFolderPath - Function to get folder path
 * @returns {Object} { lintProgress, markersMap, runMarkdownLint, triggerMarkdownLint }
 */
export default function useEditorMarkdownLint(editor, enabled = true, categoryId, getFolderPath) {
  const [lintProgress, setLintProgress] = useState(null);
  const markersMap = useRef(new Map());
  const { debounce: debounceLint, cleanup: cleanupDebounce } = useDebounce();

  // Timing and state refs
  const lastLintTime = useRef(Date.now());
  const lintPreviousValueRef = useRef('');
  const lastLintProgressRef = useRef(null);
  const autoLintTimeout = useRef(null);
  const resizeTimeoutRef = useRef(null);

  // Initialize markdown lint service
  useEffect(() => {
    if (!enabled) return;
    MarkdownLintService.init().catch(console.error);
  }, [enabled]);

  // Main markdown lint function
  const lintDocument = async (textOverride = null, startOffset = 0, forceProgress = false) => {
    if (!enabled || !editor) return;

    const currentText = textOverride ?? editor.getValue();

    if (!currentText || currentText.length === 0) return;

    // Skip linting for very small changes unless forced
    if (!forceProgress && currentText.length < 50) return;

    // Rate limiting: don't lint more than once every 5 seconds
    const timeSinceLastLint = Date.now() - lastLintTime.current;
    if (!forceProgress && timeSinceLastLint < 5000) {
      console.log('[MarkdownLint] Skipping lint - too frequent (rate limited)');
      return;
    }

    const isLarge = currentText.length > 2000;
    const shouldShowProgress = isLarge || forceProgress;
    const progressCb = shouldShowProgress ? (processObj) => {
      lastLintProgressRef.current = processObj;
      setLintProgress(processObj);
    } : () => {};

    try {
      const issues = await MarkdownLintService.scan(
        currentText,
        progressCb,
        categoryId,
        typeof getFolderPath === 'function' ? getFolderPath() : null
      );

      if (editor) {
        markersMap.current = MarkdownLintMarkerAdapter.toMonacoMarkers(
          editor,
          issues,
          startOffset,
          markersMap.current,
          monaco
        );
      }

      if (lastLintProgressRef.current && lastLintProgressRef.current.progress >= 100) {
        setTimeout(() => setLintProgress(null), 500);
      } else {
        setLintProgress(null);
      }
    } catch (error) {
      console.error('MarkdownLint: Failed to lint document:', error);
      setLintProgress(null);
    }
  };

  // Content change detection and very conservative debounced linting
  useEffect(() => {
    if (!enabled || !editor) return;

    const handleContentChange = () => {
      const newValue = editor.getValue();

      if (newValue !== lintPreviousValueRef.current) {
        // Clear existing timeouts
        if (autoLintTimeout.current) clearTimeout(autoLintTimeout.current);

        // Very conservative delays since manual trigger is available
        const docSize = newValue.length;
        const prevSize = lintPreviousValueRef.current?.length || 0;
        const changeSize = Math.abs(docSize - prevSize);

        let delay;
        if (docSize < 2000) {
          delay = changeSize < 100 ? 10000 : 15000;
        } else if (docSize < 10000) {
          delay = changeSize < 200 ? 20000 : 30000;
        } else {
          delay = changeSize < 500 ? 45000 : 60000;
        }

        // Set debounced lint timeout with very conservative delay
        debounceLint(() => {
          lintDocument(newValue, 0);
          lintPreviousValueRef.current = newValue;
          lastLintTime.current = Date.now();
        }, delay);
      }
    };

    const contentDisposable = editor.onDidChangeModelContent(handleContentChange);

    return () => {
      contentDisposable.dispose();
      if (autoLintTimeout.current) clearTimeout(autoLintTimeout.current);
    };
  }, [enabled, editor, debounceLint]);

  // Initial markdown lint when editor is ready - very delayed start
  useEffect(() => {
    if (enabled && editor) {
      setTimeout(() => {
        lintDocument(null, 0);
      }, 5000); // 5 second delay
    }
  }, [enabled, editor]);

  // Periodic markdown lint - very infrequent checks
  useEffect(() => {
    if (!enabled || !editor) return;

    const periodicLintInterval = setInterval(() => {
      const timeSinceLastLint = Date.now() - lastLintTime.current;
      const currentContent = editor?.getValue() || '';

      // Only run if it's been more than 5 minutes since last lint AND content changed
      if (timeSinceLastLint > 300000 && currentContent !== lintPreviousValueRef.current) {
        console.log('[MarkdownLint] Periodic lint check - content changed, running check');
        lintDocument(currentContent, 0);
        lintPreviousValueRef.current = currentContent;
        lastLintTime.current = Date.now();
      }
    }, 120000); // Check every 2 minutes

    return () => {
      clearInterval(periodicLintInterval);
    };
  }, [enabled, editor]);

  // Window resize handling
  useEffect(() => {
    if (!enabled || !editor) return;

    let isResizing = false;
    let resizeStartTimeout = null;

    const handleResize = () => {
      if (!isResizing) {
        isResizing = true;
        MarkdownLintMarkerAdapter.clearMarkers(editor, monaco);
      }
      if (resizeStartTimeout) clearTimeout(resizeStartTimeout);
      resizeStartTimeout = setTimeout(() => {
        isResizing = false;
        if (editor) {
          lintDocument(null, 0);
        }
      }, 1000);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeStartTimeout) clearTimeout(resizeStartTimeout);
    };
  }, [enabled, editor]);

  // Editor layout change handling
  useEffect(() => {
    if (!enabled || !editor) return;

    const layoutDisposable = editor.onDidLayoutChange(() => {
      MarkdownLintMarkerAdapter.clearMarkers(editor, monaco);
      if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current);
      resizeTimeoutRef.current = setTimeout(() => {
        if (editor) {
          lintDocument(null, 0);
        }
      }, 1000);
    });

    return () => {
      layoutDisposable.dispose();
      if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current);
    };
  }, [enabled, editor]);

  // Cleanup
  useEffect(() => {
    return () => {
      cleanupDebounce();
      if (autoLintTimeout.current) clearTimeout(autoLintTimeout.current);
      if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current);
    };
  }, [cleanupDebounce]);

  // Manual markdown lint function
  const runMarkdownLint = () => {
    if (editor) {
      console.log('[MarkdownLint] Manual lint triggered by user');
      setLintProgress({ progress: 0 });
      lintDocument(null, 0, true);
    }
  };

  // Trigger function for external use
  const triggerMarkdownLint = (text = null, offset = 0) => {
    if (editor) {
      lintDocument(text, offset);
    }
  };

  return {
    lintProgress,
    markersMap,
    runMarkdownLint,
    triggerMarkdownLint
  };
}
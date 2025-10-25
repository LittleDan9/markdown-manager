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

      if (lastLintProgressRef.current && lastLintProgressRef.current.percentComplete >= 100) {
        // Ensure 100% is visible before clearing
        setLintProgress({ percentComplete: 100 });
        setTimeout(() => setLintProgress(null), 1500); // Show completion for 1.5 seconds
      } else {
        // Ensure 100% is shown briefly even if we don't have progress tracking
        setLintProgress({ percentComplete: 100 });
        setTimeout(() => setLintProgress(null), 1500);
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

      // Only proceed if content actually changed
      if (newValue === lintPreviousValueRef.current) return;

      // Clear existing timeouts
      if (autoLintTimeout.current) clearTimeout(autoLintTimeout.current);

      // Rate limiting: don't lint more than once every 10 seconds
      const timeSinceLastLint = Date.now() - lastLintTime.current;
      if (timeSinceLastLint < 10000) {
        console.log('[MarkdownLint] Skipping lint - too frequent (rate limited)');
        return;
      }

      // Very conservative delays since manual trigger is available
      const docSize = newValue.length;
      const prevSize = lintPreviousValueRef.current?.length || 0;
      const changeSize = Math.abs(docSize - prevSize);

      let delay;
      if (docSize < 2000) {
        delay = changeSize < 100 ? 15000 : 20000; // Increased from 10-15s
      } else if (docSize < 10000) {
        delay = changeSize < 200 ? 30000 : 45000; // Increased from 20-30s
      } else {
        delay = changeSize < 500 ? 60000 : 90000; // Increased from 45-60s
      }

      // Set debounced lint timeout with very conservative delay
      debounceLint(() => {
        lintDocument(newValue, 0);
        lintPreviousValueRef.current = newValue;
        lastLintTime.current = Date.now();
      }, delay);
    };

    // Use Monaco's content change listener instead of useEffect dependency
    const contentDisposable = editor.onDidChangeModelContent(handleContentChange);

    return () => {
      contentDisposable.dispose();
      if (autoLintTimeout.current) clearTimeout(autoLintTimeout.current);
    };
  }, [enabled, editor]); // Removed debounceLint from dependencies

  // Initial markdown lint when editor is ready - very delayed start
  useEffect(() => {
    if (enabled && editor) {
      setTimeout(() => {
        lintDocument(null, 0);
      }, 5000); // 5 second delay
    }
  }, [enabled, editor]);

  // Periodic markdown lint - DISABLED to prevent excessive checking
  // Content change detection with debouncing is sufficient
  // useEffect(() => {
  //   if (!enabled || !editor) return;
  //   const periodicLintInterval = setInterval(() => {
  //     // ... periodic check logic disabled
  //   }, 300000); // 5 minutes - very infrequent if ever re-enabled
  //   return () => {
  //     clearInterval(periodicLintInterval);
  //   };
  // }, [enabled, editor]);

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

  // Editor layout change handling - authentication-aware throttling
  useEffect(() => {
    if (!enabled || !editor) return;

    let layoutChangeTimeout = null;
    let lastLayoutChangeTime = 0;
    let layoutChangeCount = 0;
    let suppressLayoutChanges = false;

    // Get authentication status
    const isAuthenticated = localStorage.getItem('authToken') !== null;

    // More lenient throttling for authenticated users
    const LAYOUT_THROTTLE_DELAY = isAuthenticated ? 3000 : 10000; // 3s vs 10s
    const MAX_RAPID_CHANGES = isAuthenticated ? 5 : 3; // 5 vs 3 changes
    const SUPPRESSION_DURATION = isAuthenticated ? 15000 : 30000; // 15s vs 30s

    const layoutDisposable = editor.onDidLayoutChange(() => {
      const now = Date.now();

      // Track rapid layout changes
      const timeSinceLastChange = now - lastLayoutChangeTime;
      if (timeSinceLastChange < 2000) { // Changes within 2 seconds
        layoutChangeCount++;
      } else {
        layoutChangeCount = 0; // Reset counter for slower changes
      }

      // If we're getting too many rapid changes, suppress completely for a while
      if (layoutChangeCount > MAX_RAPID_CHANGES) {
        const suppressionText = isAuthenticated ? '15 seconds' : '30 seconds';
        console.log(`[MarkdownLint] Too many rapid layout changes, suppressing for ${suppressionText}`);
        suppressLayoutChanges = true;
        setTimeout(() => {
          suppressLayoutChanges = false;
          layoutChangeCount = 0;
          console.log('[MarkdownLint] Layout change suppression lifted');
        }, SUPPRESSION_DURATION);
        return;
      }

      // If suppressed, ignore all layout changes
      if (suppressLayoutChanges) {
        return;
      }

      // Only clear markers if we're going to process the change
      if (timeSinceLastChange >= LAYOUT_THROTTLE_DELAY) {
        MarkdownLintMarkerAdapter.clearMarkers(editor, monaco);
      }

      // Clear existing timeout
      if (layoutChangeTimeout) {
        clearTimeout(layoutChangeTimeout);
        layoutChangeTimeout = null;
      }

      // Authentication-aware throttling
      if (timeSinceLastChange < LAYOUT_THROTTLE_DELAY) {
        console.log('[MarkdownLint] Layout change throttled, too frequent');
        return;
      }

      layoutChangeTimeout = setTimeout(() => {
        if (editor && !suppressLayoutChanges) {
          lastLayoutChangeTime = Date.now();
          console.log('[MarkdownLint] Running lint after layout change');
          lintDocument(null, 0);
        }
        layoutChangeTimeout = null;
      }, 2000); // 2 second debounce after throttle check
    });

    return () => {
      layoutDisposable.dispose();
      if (layoutChangeTimeout) {
        clearTimeout(layoutChangeTimeout);
      }
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
      setLintProgress({ percentComplete: 0 });
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
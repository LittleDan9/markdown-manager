import { useState, useRef, useEffect, useCallback } from 'react';
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
  const initialLintDoneRef = useRef(false);

  // Initialize markdown lint service
  useEffect(() => {
    if (!enabled) return;
    MarkdownLintService.init().catch(console.error);
  }, [enabled]);

  // Main markdown lint function
  const lintDocument = useCallback(async (textOverride = null, startOffset = 0, forceProgress = false) => {
    if (!enabled || !editor) return;

    const currentText = textOverride ?? editor.getValue();

    if (!currentText || currentText.length === 0) return;

    // Skip linting for very small changes unless forced
    if (!forceProgress && currentText.length < 50) return;

    // Rate limiting: don't lint more than once every 2 seconds
    const timeSinceLastLint = Date.now() - lastLintTime.current;
    if (!forceProgress && timeSinceLastLint < 2000) {
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
  }, [enabled, editor, categoryId, getFolderPath]);

  // Content change detection with reasonable debouncing
  useEffect(() => {
    if (!enabled || !editor) return;

    const handleContentChange = () => {
      const newValue = editor.getValue();

      // Only proceed if content actually changed
      if (newValue === lintPreviousValueRef.current) return;

      // Skip the first content change if initial lint was already done (prevents duplicate on mount)
      if (initialLintDoneRef.current && lintPreviousValueRef.current === '') {
        console.log('[MarkdownLint] Skipping first content change after initial lint');
        lintPreviousValueRef.current = newValue;
        return;
      }

      // Clear existing timeouts
      if (autoLintTimeout.current) clearTimeout(autoLintTimeout.current);

    // Rate limiting: don't lint more than once every 2 seconds, but allow when content is first loaded
    const timeSinceLastLint = Date.now() - lastLintTime.current;
    const isFirstContentLoad = lintPreviousValueRef.current === '';
    if (!isFirstContentLoad && timeSinceLastLint < 2000) {
      console.log('[MarkdownLint] Skipping lint - too frequent (rate limited)');
      return;
    }      // Set debounced lint timeout - 3 seconds of inactivity
      debounceLint(() => {
        lintDocument(newValue, 0);
        lintPreviousValueRef.current = newValue;
        lastLintTime.current = Date.now();
      }, 3000); // 3 seconds after typing stops
    };

    // Use Monaco's content change listener instead of useEffect dependency
    const contentDisposable = editor.onDidChangeModelContent(handleContentChange);

    // Capture timeout ref at effect execution time
    const currentAutoLintTimeout = autoLintTimeout.current;

    return () => {
      contentDisposable.dispose();
      if (currentAutoLintTimeout) clearTimeout(currentAutoLintTimeout);
    };
  }, [enabled, editor, lintDocument, debounceLint]);

  // Initial markdown lint when editor is ready
  useEffect(() => {
    if (enabled && editor && !initialLintDoneRef.current) {
      // Check if content is worth linting - use a lower threshold for initial lint
      const currentText = editor.getValue();
      console.log('[MarkdownLint] Initial lint check - content length:', currentText?.length || 0);

      if (!currentText || currentText.length === 0) {
        console.log('[MarkdownLint] Skipping initial lint - no content');
        return;
      }

      // Mark that initial lint is being done
      initialLintDoneRef.current = true;

      // Run initial lint immediately if there's meaningful content, or after a short delay
      const runInitialLint = () => {
        const textAtTime = editor.getValue();
        console.log('[MarkdownLint] Running initial lint - content length:', textAtTime?.length || 0);
        if (textAtTime && textAtTime.length > 0) {
          lintDocument(null, 0);
          lintPreviousValueRef.current = textAtTime; // Set the ref so content changes know initial lint ran
          lastLintTime.current = Date.now(); // Only set lastLintTime when we actually lint
        }
      };

      // Always use a short delay to ensure content is fully set
      setTimeout(runInitialLint, 100);
    }
  }, [enabled, editor, lintDocument]);
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

    // Don't run resize handler immediately on mount - wait for editor to be stable
    const editorReadyTimeout = setTimeout(() => {
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
        }, 2000); // 2 seconds after resize stops
      };

      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
        const timeoutId = resizeStartTimeout;
        if (timeoutId) clearTimeout(timeoutId);
      };
    }, 3000); // Wait 3 seconds after editor is ready before enabling resize handler

    return () => clearTimeout(editorReadyTimeout);
  }, [enabled, editor, lintDocument]);

  // Editor width change handling - listen to user settings changes
  useEffect(() => {
    if (!enabled || !editor) return;

    // Don't run width change handler immediately on mount - wait for editor to be stable
    const editorReadyTimeout = setTimeout(() => {
      let layoutChangeTimeout = null;
      let lastEditorWidth = null;

      // Get current editor width from user settings
      const getCurrentEditorWidth = () => {
        // Try to get from user settings context if available
        try {
          // We can't directly import useUserSettings here due to hook rules,
          // but we can check if there's a global way to get the current width
          // For now, we'll use a different approach - listen to storage changes
          const stored = localStorage.getItem('editor-width');
          if (stored !== null) {
            return parseFloat(stored);
          }
        } catch (error) {
          console.warn('Failed to get editor width from localStorage:', error);
        }
        return 40; // Default
      };

      // Listen for editor width changes via localStorage events
      const handleEditorWidthChange = () => {
        const currentWidth = getCurrentEditorWidth();

        // Only proceed if width actually changed
        if (currentWidth === lastEditorWidth) return;

        lastEditorWidth = currentWidth;

        // Clear existing timeout
        if (layoutChangeTimeout) {
          clearTimeout(layoutChangeTimeout);
          layoutChangeTimeout = null;
        }

        // Debounce the linting to avoid excessive calls during rapid changes
        layoutChangeTimeout = setTimeout(() => {
          if (editor) {
            lintDocument(null, 0);
          }
          layoutChangeTimeout = null;
        }, 1000); // 1 second debounce
      };
      const handleStorageChange = (e) => {
        if (e.key === 'editor-width') {
          handleEditorWidthChange();
        }
      };

      // Also listen for custom events that might be dispatched when width changes
      const handleWidthChangeEvent = () => {
        handleEditorWidthChange();
      };

      // Set up event listeners
      window.addEventListener('storage', handleStorageChange);
      window.addEventListener('editor-width-changed', handleWidthChangeEvent);

      // Initial width check
      lastEditorWidth = getCurrentEditorWidth();

      return () => {
        window.removeEventListener('storage', handleStorageChange);
        window.removeEventListener('editor-width-changed', handleWidthChangeEvent);
        if (layoutChangeTimeout) {
          clearTimeout(layoutChangeTimeout);
        }
      };
    }, 3000); // Wait 3 seconds after editor is ready before enabling width change handler

    return () => clearTimeout(editorReadyTimeout);
  }, [enabled, editor, lintDocument]);

  // Cleanup
  useEffect(() => {
    const currentAutoLintTimeout = autoLintTimeout.current;
    const currentResizeTimeoutRef = resizeTimeoutRef.current;

    return () => {
      cleanupDebounce();
      if (currentAutoLintTimeout) clearTimeout(currentAutoLintTimeout);
      if (currentResizeTimeoutRef) clearTimeout(currentResizeTimeoutRef);
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
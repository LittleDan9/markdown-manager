import { useState, useRef, useEffect } from 'react';
import { SpellCheckService, SpellCheckMarkers, TextRegionAnalyzer, MonacoMarkerAdapter } from '@/services/editor';
import { useTypingDetection, useDebounce } from './shared';

/**
 * Hook for managing spell check functionality
 * @param {Object} editor - Monaco editor instance
 * @param {boolean} enabled - Whether spell check is enabled
 * @param {string} categoryId - Category ID for context
 * @param {Function} getFolderPath - Function to get folder path
 * @returns {Object} { progress, suggestionsMap, runSpellCheck, triggerSpellCheck }
 */
export default function useEditorSpellCheck(editor, enabled = true, categoryId, getFolderPath) {
  const [progress, setProgress] = useState(null);
  const suggestionsMap = useRef(new Map());
  const { debounce: debounceSpellCheck, cleanup: cleanupDebounce } = useDebounce();
  const { isTyping } = useTypingDetection(); // Get typing state from parent

  // Timing and state refs
  const lastSpellCheckTime = useRef(Date.now());
  const previousValueRef = useRef('');
  const lastProgressRef = useRef(null);
  const autoCheckTimeout = useRef(null);
  const resizeTimeoutRef = useRef(null);

  // Initialize spell check service
  useEffect(() => {
    if (!enabled) return;
    SpellCheckService.init().catch(console.error);
  }, [enabled]);

  // Main spell check function
  const spellCheckDocument = async (textOverride = null, startOffset = 0, forceProgress = false) => {
    if (!enabled || !editor) return;

    // Debug logging to track excessive calls
    console.log('[SpellCheck] spellCheckDocument called:', {
      textLength: (textOverride ?? editor.getValue()).length,
      startOffset,
      forceProgress,
      stackTrace: new Error().stack.split('\n').slice(1, 4).join('\n')
    });

    // Always get fresh content from editor unless explicitly overridden
    const currentText = textOverride ?? editor.getValue();

    if (!currentText || currentText.length === 0) {
      setProgress(null); // Clear progress for empty content
      return;
    }
    if (startOffset > 0 && currentText.length < 10) {
      setProgress(null); // Clear progress for very small content
      return;
    }

    // Only show progress for larger documents or when forced
    const isLarge = currentText.length > 2000; // Increased threshold from 100
    const shouldShowProgress = isLarge || forceProgress;
    const progressCb = shouldShowProgress ? (processObj) => {
      lastProgressRef.current = processObj;
      setProgress(processObj);
    } : (processObj) => {
      // Still track progress internally but don't show UI
      lastProgressRef.current = processObj;
    };

    try {
      const issues = await SpellCheckService.scan(
        currentText,
        progressCb,
        categoryId,
        typeof getFolderPath === 'function' ? getFolderPath() : null
      );

      if (editor) {
        suggestionsMap.current = MonacoMarkerAdapter.toMonacoMarkers(
          editor,
          issues,
          startOffset,
          suggestionsMap.current
        );
      }

      // Clear progress indicator after completion with visual feedback
      if (lastProgressRef.current && lastProgressRef.current.percentComplete >= 100) {
        // Ensure 100% is visible before clearing
        setProgress({ percentComplete: 100 });
        setTimeout(() => setProgress(null), 1500); // Show completion for 1.5 seconds
      } else {
        // Ensure 100% is shown briefly even if we don't have progress tracking
        setProgress({ percentComplete: 100 });
        setTimeout(() => setProgress(null), 1500);
      }
    } catch (error) {
      console.error('SpellCheck error:', error);
      setProgress(null);
    }
  };

  // Content change detection and debounced spell check
  useEffect(() => {
    if (!enabled || !editor) return;

    const handleContentChange = () => {
      const currentValue = editor.getValue();

      console.log('[SpellCheck] Content change detected:', {
        currentLength: currentValue.length,
        previousLength: previousValueRef.current?.length || 0,
        hasChanged: currentValue !== previousValueRef.current
      });

      // Only proceed if content actually changed
      if (currentValue === previousValueRef.current) {
        console.log('[SpellCheck] Content unchanged, skipping');
        return;
      }

      // Clear existing timeouts
      if (autoCheckTimeout.current) clearTimeout(autoCheckTimeout.current);

      const runAndHandleSpellCheck = () => {
        const { regionText, startOffset } = TextRegionAnalyzer.getChangedRegion(
          editor,
          previousValueRef.current,
          editor.getValue()
        );
        previousValueRef.current = editor.getValue();
        lastSpellCheckTime.current = Date.now();
        if (regionText.length > 0) {
          spellCheckDocument(regionText, startOffset);
        }
      };

      // More conservative adaptive delay based on document size and change magnitude
      const docSize = currentValue.length;
      const prevSize = previousValueRef.current?.length || 0;
      const changeSize = Math.abs(docSize - prevSize);

      let delay;
      if (docSize < 500) {
        delay = 3000; // Increased significantly
      } else if (docSize < 2000) {
        delay = changeSize < 20 ? 5000 : 7000;
      } else if (docSize < 10000) {
        delay = changeSize < 50 ? 8000 : 10000;
      } else {
        delay = changeSize < 100 ? 12000 : 15000; // Much more conservative
      }

      debounceSpellCheck(runAndHandleSpellCheck, delay);

      // Set up auto-check after 2 minutes of no changes (increased from 30s)
      autoCheckTimeout.current = setTimeout(() => {
        const timeSinceLastCheck = Date.now() - lastSpellCheckTime.current;
        const currentContent = editor?.getValue() || '';

        if (timeSinceLastCheck > 120000 && currentContent !== previousValueRef.current) {
          console.log('[SpellCheck] Auto-running spell check after 2 minutes of inactivity');
          spellCheckDocument(null, 0);
          previousValueRef.current = currentContent;
          lastSpellCheckTime.current = Date.now();
        }
      }, 120000); // Increased to 2 minutes
    };

    // Use Monaco's content change listener instead of useEffect dependency
    const contentDisposable = editor.onDidChangeModelContent(handleContentChange);

    return () => {
      contentDisposable.dispose();
      if (autoCheckTimeout.current) clearTimeout(autoCheckTimeout.current);
    };
  }, [enabled, editor]); // Removed debounceSpellCheck from dependencies

  // Initial spell check when editor is ready - delayed to prevent immediate execution
  useEffect(() => {
    if (enabled && editor) {
      setTimeout(() => {
        const initialContent = editor.getValue();
        if (initialContent && initialContent.length > 0) {
          spellCheckDocument(null, 0);
          previousValueRef.current = initialContent;
        }
      }, 3000); // Increased from 100ms to 3 seconds
    }
  }, [enabled, editor]);

  // Periodic spell check - DISABLED to prevent excessive checking
  // Content change detection with debouncing is sufficient
  // useEffect(() => {
  //   if (!enabled || !editor) return;
  //   const periodicCheckInterval = setInterval(() => {
  //     // ... periodic check logic disabled
  //   }, 300000); // 5 minutes - very infrequent if ever re-enabled
  //   return () => {
  //     clearInterval(periodicCheckInterval);
  //   };
  // }, [enabled, editor]);

  // Window resize handling - very conservative
  useEffect(() => {
    if (!enabled || !editor) return;

    let isResizing = false;
    let resizeStartTimeout = null;

    const handleResize = () => {
      console.log('[SpellCheck] Window resize detected');
      if (!isResizing) {
        isResizing = true;
        SpellCheckMarkers.clearMarkers(editor, suggestionsMap.current);
      }
      if (resizeStartTimeout) clearTimeout(resizeStartTimeout);
      resizeStartTimeout = setTimeout(() => {
        isResizing = false;
        if (editor) {
          console.log('[SpellCheck] Running spell check after window resize');
          spellCheckDocument(null, 0);
        }
      }, 1000); // Increased from 300ms to 1 second
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
        console.log(`[SpellCheck] Too many rapid layout changes, suppressing for ${suppressionText}`);
        suppressLayoutChanges = true;
        setTimeout(() => {
          suppressLayoutChanges = false;
          layoutChangeCount = 0;
          console.log('[SpellCheck] Layout change suppression lifted');
        }, SUPPRESSION_DURATION);
        return;
      }

      // If suppressed, ignore all layout changes
      if (suppressLayoutChanges) {
        return;
      }

      console.log('[SpellCheck] Editor layout change detected');

      // Only clear markers if we're going to process the change
      if (timeSinceLastChange >= LAYOUT_THROTTLE_DELAY) {
        SpellCheckMarkers.clearMarkers(editor, suggestionsMap.current);
      }

      // Clear existing timeout
      if (layoutChangeTimeout) {
        clearTimeout(layoutChangeTimeout);
        layoutChangeTimeout = null;
      }

      // Authentication-aware throttling
      if (timeSinceLastChange < LAYOUT_THROTTLE_DELAY) {
        console.log('[SpellCheck] Layout change throttled, too frequent');
        return;
      }

      layoutChangeTimeout = setTimeout(() => {
        if (editor && !suppressLayoutChanges) {
          lastLayoutChangeTime = Date.now();
          console.log('[SpellCheck] Running spell check after layout change');
          spellCheckDocument(null, 0);
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
      if (autoCheckTimeout.current) clearTimeout(autoCheckTimeout.current);
      if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current);
    };
  }, [cleanupDebounce]);

  // Manual spell check function
  const runSpellCheck = () => {
    if (editor) {
      setProgress({ percentComplete: 0 });
      spellCheckDocument(null, 0, true);
    }
  };

  // Trigger function for external use
  const triggerSpellCheck = (text = null, offset = 0) => {
    if (editor) {
      spellCheckDocument(text, offset);
    }
  };

  return {
    progress,
    suggestionsMap,
    runSpellCheck,
    triggerSpellCheck
  };
}
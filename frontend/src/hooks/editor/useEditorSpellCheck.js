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

    // Always get fresh content from editor unless explicitly overridden
    const currentText = textOverride ?? editor.getValue();

    if (!currentText || currentText.length === 0) return;
    if (startOffset > 0 && currentText.length < 10) return;

    const isLarge = currentText.length > 100;
    const shouldShowProgress = isLarge || forceProgress;
    const progressCb = shouldShowProgress ? (processObj) => {
      lastProgressRef.current = processObj;
      setProgress(processObj);
    } : () => {};

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

      if (lastProgressRef.current && lastProgressRef.current.percentComplete >= 100) {
        setTimeout(() => setProgress(null), 500);
      } else {
        setProgress(null);
      }
    } catch (error) {
      console.error('SpellCheck error:', error);
      setProgress(null);
    }
  };

  // Content change detection and debounced spell check
  useEffect(() => {
    if (!enabled || !editor) return;

    const currentValue = editor.getValue();

    if (currentValue !== previousValueRef.current) {
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

      // Adaptive delay based on document size and change magnitude
      const docSize = currentValue.length;
      const prevSize = previousValueRef.current?.length || 0;
      const changeSize = Math.abs(docSize - prevSize);

      let delay;
      if (docSize < 500) {
        delay = 200;
      } else if (docSize < 2000) {
        delay = changeSize < 20 ? 300 : 500;
      } else if (docSize < 10000) {
        delay = changeSize < 50 ? 600 : 1000;
      } else {
        delay = changeSize < 100 ? 1200 : 2000;
      }

      debounceSpellCheck(runAndHandleSpellCheck, delay);

      // Set up auto-check after 15 seconds of no changes
      autoCheckTimeout.current = setTimeout(() => {
        const timeSinceLastCheck = Date.now() - lastSpellCheckTime.current;
        const currentContent = editor?.getValue() || '';

        if (timeSinceLastCheck > 15000 && currentContent !== previousValueRef.current) {
          console.log('[SpellCheck] Auto-running spell check after 15 seconds of inactivity');
          spellCheckDocument(null, 0);
          previousValueRef.current = currentContent;
          lastSpellCheckTime.current = Date.now();
        }
      }, 15000);
    }

    return () => {
      if (autoCheckTimeout.current) clearTimeout(autoCheckTimeout.current);
    };
  }, [enabled, editor, debounceSpellCheck]);

  // Initial spell check when editor is ready
  useEffect(() => {
    if (enabled && editor) {
      setTimeout(() => {
        spellCheckDocument(null, 0);
      }, 100);
    }
  }, [enabled, editor]);

  // Periodic spell check
  useEffect(() => {
    if (!enabled || !editor) return;

    const periodicCheckInterval = setInterval(() => {
      const timeSinceLastCheck = Date.now() - lastSpellCheckTime.current;
      const currentContent = editor?.getValue() || '';

      if (timeSinceLastCheck > 15000 && currentContent !== previousValueRef.current) {
        console.log('[SpellCheck] Periodic spell check - content changed, running check');
        spellCheckDocument(null, 0);
        previousValueRef.current = currentContent;
        lastSpellCheckTime.current = Date.now();
      }
    }, 10000);

    return () => {
      clearInterval(periodicCheckInterval);
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
        SpellCheckMarkers.clearMarkers(editor, suggestionsMap.current);
      }
      if (resizeStartTimeout) clearTimeout(resizeStartTimeout);
      resizeStartTimeout = setTimeout(() => {
        isResizing = false;
        if (editor) {
          spellCheckDocument(null, 0);
        }
      }, 300);
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
      SpellCheckMarkers.clearMarkers(editor, suggestionsMap.current);
      if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current);
      resizeTimeoutRef.current = setTimeout(() => {
        if (editor) {
          spellCheckDocument(null, 0);
        }
      }, 300);
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
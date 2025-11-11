import { useState, useRef, useEffect, useCallback } from 'react';
import { SpellCheckService, SpellCheckMarkers, TextRegionAnalyzer, MonacoMarkerAdapter } from '@/services/editor';
import { useTypingDetection, useDebounce } from './shared';
import { useDocumentContext } from '@/providers/DocumentContextProvider';

/**
 * Hook for managing spell check functionality
 * Phase 5: Enhanced with advanced settings support
 * @param {Object} editor - Monaco editor instance
 * @param {boolean} enabled - Whether spell check is enabled
 * @param {string} categoryId - Category ID for context
 * @param {Function} getFolderPath - Function to get folder path
 * @param {Object} settings - Phase 5: Advanced spell check settings
 * @returns {Object} { progress, suggestionsMap, runSpellCheck, triggerSpellCheck, readabilityData, serviceInfo }
 */
export default function useEditorSpellCheck(editor, enabled = true, categoryId, getFolderPath, settings = {}) {
  const [progress, setProgress] = useState(null);
  const [readabilityData, setReadabilityData] = useState(null);
  const [serviceInfo, setServiceInfo] = useState(null);
  const [allIssues, setAllIssues] = useState([]);

  const suggestionsMap = useRef(new Map());
  const { debounce: debounceSpellCheck, cleanup: cleanupDebounce } = useDebounce();
  const { isTyping: _isTyping } = useTypingDetection(); // Get typing state from parent
  const { isRapidTypingActive } = useDocumentContext(); // Get rapid typing state from orchestrator

  // Timing and state refs
  const lastSpellCheckTime = useRef(Date.now());
  const previousValueRef = useRef('');
  const lastProgressRef = useRef(null);
  const autoCheckTimeout = useRef(null);
  const resizeTimeoutRef = useRef(null);
  const initialCheckDoneRef = useRef(false);

  // Initialize spell check service and load service info
  useEffect(() => {
    if (!enabled) return;

    const initializeService = async () => {
      try {
        await SpellCheckService.init();
        const info = await SpellCheckService.getServiceInfo();
        setServiceInfo(info);
      } catch (error) {
        console.error('Failed to initialize spell check service:', error);
      }
    };

    initializeService();
  }, [enabled]);

  // Main spell check function
  const spellCheckDocument = useCallback(async (textOverride = null, startOffset = 0, forceProgress = false, customSettings = null) => {
    if (!enabled || !editor) return;

    // Use custom settings if provided, otherwise use default settings
    const effectiveSettings = customSettings || settings;

    // Debug logging to track excessive calls
    console.log('[SpellCheck] spellCheckDocument called:', {
      textLength: (textOverride ?? editor.getValue()).length,
      startOffset,
      forceProgress,
      customSettings: customSettings ? 'provided' : 'using default',
      codeSpellEnabled: effectiveSettings.enableCodeSpellCheck,
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
    const progressCb = shouldShowProgress ? (percent, issues, metadata) => {
      const processObj = { percentComplete: percent };
      lastProgressRef.current = processObj;
      setProgress(processObj);

      // Phase 5: Update readability data and all issues
      if (metadata?.readability) {
        setReadabilityData(metadata.readability);
      }
      if (issues) {
        setAllIssues(issues); // Use issues directly from backend (already filtered)
      }
    } : (percent, issues, metadata) => {
      // Still track progress internally but don't show UI
      const processObj = { percentComplete: percent };
      lastProgressRef.current = processObj;

      // Phase 5: Update readability data and all issues even when not showing progress
      if (metadata?.readability) {
        setReadabilityData(metadata.readability);
      }
      if (issues) {
        setAllIssues(issues); // Use issues directly from backend (already filtered)
      }
    };

    try {
      const issues = await SpellCheckService.scan(
        currentText,
        progressCb,
        categoryId,
        typeof getFolderPath === 'function' ? getFolderPath() : null,
        effectiveSettings // Phase 6: Use effective settings (custom or default)
      );

      // Backend already filtered issues based on effectiveSettings, so use them directly
      if (editor) {
        console.log('🚀 About to call MonacoMarkerAdapter.toMonacoMarkers:', {
          editorPresent: !!editor,
          issuesCount: issues?.length || 0,
          startOffset,
          issuesWithTypes: issues?.slice(0, 5).map(i => ({ type: i.type, word: i.word, position: i.position })) || [],
          codeSpellIssues: issues?.filter(i => i.type?.includes('code'))?.length || 0
        });

        // Use requestIdleCallback to make marker updates non-blocking
        const updateMarkers = () => {
          suggestionsMap.current = MonacoMarkerAdapter.toMonacoMarkers(
            editor,
            issues, // Use all issues returned by backend (already filtered)
            startOffset,
            suggestionsMap.current
          );

          console.log('✅ MonacoMarkerAdapter.toMonacoMarkers completed, suggestionsMap size:', suggestionsMap.current?.size || 0);
        };

        // Use requestIdleCallback if available, otherwise use setTimeout as fallback
        if (typeof requestIdleCallback !== 'undefined') {
          requestIdleCallback(updateMarkers, { timeout: 100 }); // 100ms timeout to ensure it runs even if idle time is scarce
        } else {
          setTimeout(updateMarkers, 0);
        }
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
  }, [enabled, editor, categoryId, getFolderPath, settings, setProgress, setReadabilityData, setAllIssues]);

  // Content change detection and debounced spell check
  useEffect(() => {
    if (!enabled || !editor) return;

    const handleContentChange = () => {
      const currentValue = editor.getValue();

      console.log('[SpellCheck] Content change detected:', {
        currentLength: currentValue.length,
        previousLength: previousValueRef.current?.length || 0,
        hasChanged: currentValue !== previousValueRef.current,
        isRapidTyping: isRapidTypingActive,
        initialCheckDone: initialCheckDoneRef.current
      });

      // Skip spell checking during rapid typing to prevent blocking the editor
      if (isRapidTypingActive) {
        console.log('[SpellCheck] Skipping during rapid typing mode');
        return;
      }

      // Only proceed if content actually changed
      if (currentValue === previousValueRef.current) {
        console.log('[SpellCheck] Content unchanged, skipping');
        return;
      }

      // Skip the first content change if initial check was already done (prevents duplicate on mount)
      if (initialCheckDoneRef.current && previousValueRef.current === '') {
        console.log('[SpellCheck] Skipping first content change after initial check');
        previousValueRef.current = currentValue;
        return;
      }

      // Clear existing timeouts
      if (autoCheckTimeout.current) clearTimeout(autoCheckTimeout.current);

      const runAndHandleSpellCheck = () => {
        // For code spell checking, always use full document to ensure correct global positions
        if (settings.enableCodeSpellCheck) {
          const fullText = editor.getValue();
          previousValueRef.current = fullText;
          lastSpellCheckTime.current = Date.now();
          spellCheckDocument(fullText, 0); // Always use startOffset 0 for full document
        } else {
          // For regular spell checking, use regional approach for performance
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
  }, [enabled, editor, isRapidTypingActive, debounceSpellCheck, settings.enableCodeSpellCheck, spellCheckDocument]);

  // Initial spell check when editor is ready
  useEffect(() => {
    if (enabled && editor && !initialCheckDoneRef.current) {
      // Check if content is worth spell checking - use a lower threshold for initial check
      const currentText = editor.getValue();
      console.log('[SpellCheck] Initial spell check - content length:', currentText?.length || 0);

      if (!currentText || currentText.length === 0) {
        console.log('[SpellCheck] Skipping initial spell check - no content');
        return;
      }

      // Mark that initial check is being done
      initialCheckDoneRef.current = true;

      // Run initial spell check immediately if there's meaningful content, or after a short delay
      const runInitialSpellCheck = () => {
        const textAtTime = editor.getValue();
        console.log('[SpellCheck] Running initial spell check - content length:', textAtTime?.length || 0);
        if (textAtTime && textAtTime.length > 0) {
          spellCheckDocument(null, 0);
          previousValueRef.current = textAtTime;
        }
      };

      if (currentText.length >= 10) {
        // If there's already meaningful content, spell check immediately
        console.log('[SpellCheck] Content >= 10 chars, spell checking immediately');
        runInitialSpellCheck();
      } else {
        // For very small content, wait a bit to see if more content loads
        console.log('[SpellCheck] Content < 10 chars, waiting 500ms');
        setTimeout(runInitialSpellCheck, 500);
      }
    }
  }, [enabled, editor, spellCheckDocument]);

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
  }, [enabled, editor, spellCheckDocument]);

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

      // More aggressive throttling to reduce interference with scroll-to-line
      console.log('[SpellCheck] Editor layout change detected');

      // Clear existing timeout
      if (layoutChangeTimeout) {
        clearTimeout(layoutChangeTimeout);
        layoutChangeTimeout = null;
      }

      // Increased throttling delay to reduce frequency
      const ENHANCED_THROTTLE_DELAY = LAYOUT_THROTTLE_DELAY * 2; // Double the delay
      if (timeSinceLastChange < ENHANCED_THROTTLE_DELAY) {
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
      }, 3000); // Increased debounce delay from 2s to 3s
    });

    return () => {
      layoutDisposable.dispose();
      if (layoutChangeTimeout) {
        clearTimeout(layoutChangeTimeout);
      }
    };
  }, [enabled, editor, spellCheckDocument]);

  // Cleanup
  useEffect(() => {
    const currentAutoCheckTimeout = autoCheckTimeout.current;
    const currentResizeTimeoutRef = resizeTimeoutRef.current;

    return () => {
      cleanupDebounce();
      if (currentAutoCheckTimeout) clearTimeout(currentAutoCheckTimeout);
      if (currentResizeTimeoutRef) clearTimeout(currentResizeTimeoutRef);
    };
  }, [cleanupDebounce]);

  // Manual spell check function
  const runSpellCheck = (customSettings = null) => {
    if (editor) {
      setProgress({ percentComplete: 0 });
      spellCheckDocument(null, 0, true, customSettings);
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
    triggerSpellCheck,
    readabilityData, // Phase 5: Return readability data
    serviceInfo,     // Phase 5: Return service information
    allIssues        // Phase 5: Return all issues for filtering
  };
}
import { useState, useEffect, useRef, useCallback } from 'react';
import { SpellCheckService } from '@/services/editor';
import { getChangedRegion, toMonacoMarkers, clearSpellCheckMarkers } from '@/utils';

/**
 * Custom hook for handling spell checking in Monaco editor
 * @param {Object} editor - Monaco editor instance
 * @param {string} value - Current editor value
 * @param {number} categoryId - Category ID for spell checking context
 * @returns {Object} - { progress, suggestionsMap }
 */
export default function useSpellCheck(editor, value, categoryId) {
  const [progress, setProgress] = useState(null);
  const suggestionsMap = useRef(new Map());
  const debounceTimeout = useRef(null);
  const lastSpellCheckTime = useRef(Date.now());
  const previousValueRef = useRef(value);
  const lastProgressRef = useRef(null);
  const resizeTimeoutRef = useRef(null);

  // Initialize spell checker once
  useEffect(() => {
    SpellCheckService.init().catch(console.error);
  }, []);

  // Window resize event handling for spell check markers
  useEffect(() => {
    let isResizing = false;
    let resizeStartTimeout = null;

    const handleResize = () => {
      // Clear markers immediately on first resize event (resize start)
      if (!isResizing) {
        isResizing = true;
        console.log('Window resize started - clearing spell check markers');
        clearSpellCheckMarkers(editor, suggestionsMap.current);
      }

      // Clear existing timeout and set new one for resize end detection
      if (resizeStartTimeout) {
        clearTimeout(resizeStartTimeout);
      }

      resizeStartTimeout = setTimeout(() => {
        isResizing = false;
        // Re-run spell check after resize stops
        if (editor && value) {
          console.log('Window resize ended - re-running spell check');
          spellCheckDocument(value, 0);
        }
      }, 500); // 500ms delay to detect resize end
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeStartTimeout) {
        clearTimeout(resizeStartTimeout);
      }
    };
  }, [editor, value]);

  // Monaco editor layout change handling
  useEffect(() => {
    if (!editor) return;

    const layoutDisposable = editor.onDidLayoutChange(() => {
      // Clear markers when editor layout changes (this includes container resizing)
      console.log('Editor layout changed - clearing spell check markers');
      clearSpellCheckMarkers(editor, suggestionsMap.current);

      // Debounce spell check after layout change
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
      resizeTimeoutRef.current = setTimeout(() => {
        if (editor && value) {
          console.log('Editor layout change ended - re-running spell check');
          spellCheckDocument(value, 0);
        }
      }, 500);
    });

    return () => {
      layoutDisposable.dispose();
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, [editor, value]);

  // Main spell check logic
  useEffect(() => {
    if (!editor || !value) return;

    if (value !== previousValueRef.current) {
      if (debounceTimeout.current) clearTimeout(debounceTimeout.current);

      const runAndHandleSpellCheck = () => {
        const { regionText, startOffset } = getChangedRegion(editor, previousValueRef.current, value);
        previousValueRef.current = value;
        lastSpellCheckTime.current = Date.now();

        if (regionText.length > 0) {
          spellCheckDocument(regionText, startOffset);
        }
      };

      // If last spell check was more than 30s ago, run immediately
      const now = Date.now();
      if (now - lastSpellCheckTime.current > 30000) {
        runAndHandleSpellCheck();
      } else {
        // Use longer debounce for more stable spell checking
        debounceTimeout.current = setTimeout(runAndHandleSpellCheck, 5000); // 5s debounce
      }
    }

    // Cleanup on unmount
    return () => {
      if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    };
  }, [editor, value, categoryId]);

  // Initial spell check when editor is ready
  useEffect(() => {
    if (editor && value) {
      spellCheckDocument(value, 0);
    }
  }, [editor]); // Only run when editor becomes available

  const spellCheckDocument = async (text, startOffset) => {
    if (!text || text.length === 0) return;

    // Skip spell checking for very small changes (likely just typing)
    if (startOffset > 0 && text.length < 10) return;

    const isLarge = text.length > 100;
    const progressCb = isLarge ? (processObj) => {
      lastProgressRef.current = processObj;
      setProgress(processObj);
    } : () => {};

    try {
      const issues = await SpellCheckService.scan(text, progressCb, categoryId);

      if (editor) {
        suggestionsMap.current = toMonacoMarkers(
          editor,
          issues,
          startOffset,
          suggestionsMap.current
        );
      }

      if (lastProgressRef.current && lastProgressRef.current.percentComplete >= 100) {
        setTimeout(() => setProgress(null), 500); // Hide after 500ms
      } else {
        setProgress(null);
      }
    } catch (error) {
      console.error('Spell check error:', error);
      setProgress(null);
    }
  };

  return {
    progress,
    suggestionsMap
  };
}

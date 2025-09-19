import { useRef, useEffect, useState, useCallback } from 'react';
import { EditorService, SpellCheckService, CommentService, SpellCheckMarkers, TextRegionAnalyzer, MonacoMarkerAdapter, SpellCheckActions, MarkdownLintService, MarkdownLintMarkers, MarkdownLintMarkerAdapter, MarkdownLintActions } from '@/services/editor';
import { useTheme } from '@/providers/ThemeProvider';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';

/**
 * Consolidated editor hook for Monaco setup, spell check, markdown linting, keyboard shortcuts, and list behavior.
 * @param {Object} options
 *   - containerRef: ref to DOM container
 *   - value: initial editor value
 *   - onChange: callback for content changes
 *   - onCursorLineChange: callback for cursor line changes
 *   - enableSpellCheck: boolean
 *   - enableMarkdownLint: boolean
 *   - enableKeyboardShortcuts: boolean
 *   - enableListBehavior: boolean
 *   - categoryId: for spell check and linting context
 *   - getCategoryId: function for keyboard shortcut context
 *   - getFolderPath: function for folder-based dictionary/rules context
 * @returns {Object} { editor, spellCheck: { progress, suggestionsMap }, markdownLint: { lintProgress, markersMap } }
 */
export default function useEditor({
  containerRef,
  value,
  onChange,
  onCursorLineChange,
  enableSpellCheck = true,
  enableMarkdownLint = true,
  enableKeyboardShortcuts = true,
  enableListBehavior = true,
  categoryId,
  getCategoryId,
  getFolderPath
}) {
  const { theme } = useTheme();
  const editorRef = useRef(null);
  const lastEditorValue = useRef(value);

  // Spell check state
  const [progress, setProgress] = useState(null);
  const suggestionsMap = useRef(new Map());
  const debounceTimeout = useRef(null);
  const lastSpellCheckTime = useRef(Date.now());
  const previousValueRef = useRef(value);
  const lastProgressRef = useRef(null);
  const resizeTimeoutRef = useRef(null);
  const autoCheckTimeout = useRef(null); // For 30-second auto spell check

  // Markdown linting state
  const [lintProgress, setLintProgress] = useState(null);
  const markersMap = useRef(new Map());
  const lintDebounceTimeout = useRef(null);
  const lastLintTime = useRef(Date.now());
  const lintPreviousValueRef = useRef(value);
  const lastLintProgressRef = useRef(null);
  const autoLintTimeout = useRef(null);

  // Monaco editor setup
  useEffect(() => {
    if (!containerRef.current) return;
    EditorService
      .setup(containerRef.current, value, theme)
      .then(editor => {
        editorRef.current = editor;
        editor.setValue(value);
        // Content changes
        editor.onDidChangeModelContent(() => {
          const newValue = editor.getValue();
          lastEditorValue.current = newValue;
          if (onChange) onChange(newValue);

          // Trigger markdown linting on content change
          if (enableMarkdownLint && newValue !== lintPreviousValueRef.current) {
            // Clear existing timeouts
            if (lintDebounceTimeout.current) clearTimeout(lintDebounceTimeout.current);
            if (autoLintTimeout.current) clearTimeout(autoLintTimeout.current);

            // Set debounced lint timeout
            lintDebounceTimeout.current = setTimeout(() => {
              lintDocument(newValue, 0);
              lintPreviousValueRef.current = newValue;
              lastLintTime.current = Date.now();
            }, 1000); // 1 second debounce
          }
        });
        // Cursor position changes
        if (onCursorLineChange) {
          editor.onDidChangeCursorPosition((e) => {
            onCursorLineChange(e.position.lineNumber);
          });
        }
        window.editorInstance = editor;
      })
      .catch(console.error);
    // Cleanup
    return () => {
      if (editorRef.current) {
        editorRef.current.dispose();
        editorRef.current = null;
      }
      // Clean up all timeouts
      if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
      if (autoCheckTimeout.current) clearTimeout(autoCheckTimeout.current);
      if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current);
      if (lintDebounceTimeout.current) clearTimeout(lintDebounceTimeout.current);
      if (autoLintTimeout.current) clearTimeout(autoLintTimeout.current);
    };
  }, [containerRef]);

  // Theme changes
  useEffect(() => {
    if (editorRef.current) {
      // Apply theme using EditorService instead of editor instance directly
      EditorService.applyTheme(theme);
    }
  }, [theme]);

  // External value changes
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || value === lastEditorValue.current) return;

    // Save current cursor position before updating value
    const currentPosition = editor.getPosition();
    const currentScrollTop = editor.getScrollTop();

    editor.setValue(value);
    lastEditorValue.current = value;

    // Restore cursor position and scroll after setValue
    if (currentPosition) {
      const model = editor.getModel();
      const lineCount = model.getLineCount();

      // Ensure position is within bounds
      const safeLineNumber = Math.min(currentPosition.lineNumber, lineCount);
      const lineLength = model.getLineContent(safeLineNumber).length;
      const safeColumn = Math.min(currentPosition.column, lineLength + 1);

      const safePosition = {
        lineNumber: safeLineNumber,
        column: safeColumn
      };

      // Use setTimeout to ensure the position is set after Monaco finishes processing
      setTimeout(() => {
        editor.setPosition(safePosition);
        editor.setScrollTop(currentScrollTop);
      }, 0);
    }
  }, [value]);

  // SPELL CHECK
  useEffect(() => {
    if (!enableSpellCheck) return;
    SpellCheckService.init().catch(console.error);
  }, [enableSpellCheck]);

  // MARKDOWN LINTING
  useEffect(() => {
    if (!enableMarkdownLint) return;
    MarkdownLintService.init().catch(console.error);
  }, [enableMarkdownLint]);

  // Window resize for spell check - reduced delay for better responsiveness
  useEffect(() => {
    if (!enableSpellCheck || !editorRef.current) return;
    let isResizing = false;
    let resizeStartTimeout = null;
    const handleResize = () => {
      if (!isResizing) {
        isResizing = true;
        SpellCheckMarkers.clearMarkers(editorRef.current, suggestionsMap.current);
      }
      if (resizeStartTimeout) clearTimeout(resizeStartTimeout);
      resizeStartTimeout = setTimeout(() => {
        isResizing = false;
        if (editorRef.current) {
          spellCheckDocument(null, 0); // Use fresh content from editor
        }
      }, 300); // Reduced from 500ms to 300ms
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeStartTimeout) clearTimeout(resizeStartTimeout);
    };
  }, [enableSpellCheck]);

  // Editor layout change for spell check - reduced delay for better responsiveness
  useEffect(() => {
    if (!enableSpellCheck || !editorRef.current) return;
    const editor = editorRef.current;
    const layoutDisposable = editor.onDidLayoutChange(() => {
      SpellCheckMarkers.clearMarkers(editor, suggestionsMap.current);
      if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current);
      resizeTimeoutRef.current = setTimeout(() => {
        if (editor) {
          spellCheckDocument(null, 0); // Use fresh content from editor
        }
      }, 300); // Reduced from 500ms to 300ms
    });
    return () => {
      layoutDisposable.dispose();
      if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current);
    };
  }, [enableSpellCheck]);

  // Window resize for markdown linting
  useEffect(() => {
    if (!enableMarkdownLint || !editorRef.current) return;
    let isResizing = false;
    let resizeStartTimeout = null;
    const handleResize = () => {
      if (!isResizing) {
        isResizing = true;
        MarkdownLintMarkerAdapter.clearMarkers(editorRef.current, monaco);
      }
      if (resizeStartTimeout) clearTimeout(resizeStartTimeout);
      resizeStartTimeout = setTimeout(() => {
        isResizing = false;
        if (editorRef.current) {
          lintDocument(null, 0);
        }
      }, 1000); // Slower than spell check since linting is less frequent
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeStartTimeout) clearTimeout(resizeStartTimeout);
    };
  }, [enableMarkdownLint]);

  // Editor layout change for markdown linting
  useEffect(() => {
    if (!enableMarkdownLint || !editorRef.current) return;
    const editor = editorRef.current;
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
  }, [enableMarkdownLint]);

  // Main spell check logic - optimized with adaptive timing based on document size and change type
  useEffect(() => {
    if (!enableSpellCheck || !editorRef.current) return;

    const editor = editorRef.current;
    const currentValue = editor.getValue();

    if (currentValue !== previousValueRef.current) {
      // Clear both timeouts when content changes
      if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
      if (autoCheckTimeout.current) clearTimeout(autoCheckTimeout.current);

      const runAndHandleSpellCheck = () => {
        const { regionText, startOffset } = TextRegionAnalyzer.getChangedRegion(
          editorRef.current,
          previousValueRef.current,
          editorRef.current?.getValue() || '' // Get fresh content
        );
        previousValueRef.current = editorRef.current?.getValue() || '';
        lastSpellCheckTime.current = Date.now();
        if (regionText.length > 0) {
          spellCheckDocument(regionText, startOffset); // Pass fresh content
        }
      };

      // Adaptive delay based on document size and change magnitude
      const docSize = currentValue.length;
      const prevSize = previousValueRef.current?.length || 0;
      const changeSize = Math.abs(docSize - prevSize);

      let delay;
      if (docSize < 500) {
        // Very small documents - almost immediate
        delay = 200;
      } else if (docSize < 2000) {
        // Small documents - quick response
        delay = changeSize < 20 ? 300 : 500;
      } else if (docSize < 10000) {
        // Medium documents - balanced response
        delay = changeSize < 50 ? 600 : 1000;
      } else {
        // Large documents - longer delay to avoid thrashing
        delay = changeSize < 100 ? 1200 : 2000;
      }

      debounceTimeout.current = setTimeout(runAndHandleSpellCheck, delay);

      // Set up auto-check after 15 seconds of no changes
      autoCheckTimeout.current = setTimeout(() => {
        const timeSinceLastCheck = Date.now() - lastSpellCheckTime.current;
        const currentContent = editorRef.current?.getValue() || '';

        // Only run auto-check if:
        // 1. It's been more than 15 seconds since last spell check
        // 2. Content has changed since last check
        if (timeSinceLastCheck > 15000 && currentContent !== previousValueRef.current) {
          console.log('[SpellCheck] Auto-running spell check after 15 seconds of inactivity');
          spellCheckDocument(null, 0); // Check full document with fresh content
          previousValueRef.current = currentContent;
          lastSpellCheckTime.current = Date.now();
        }
      }, 15000); // 15 seconds
    }

    return () => {
      if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
      if (autoCheckTimeout.current) clearTimeout(autoCheckTimeout.current);
    };
  }, [enableSpellCheck, editorRef.current]);

  // Initial spell check when editor is ready - trigger immediately
  useEffect(() => {
    if (enableSpellCheck && editorRef.current) {
      // Don't wait - start spell check immediately when editor loads
      setTimeout(() => {
        spellCheckDocument(null, 0); // Use fresh content from editor
      }, 100); // Small delay to ensure editor is fully initialized
    }
  }, [enableSpellCheck, editorRef.current]);

  // Periodic spell check - ensure it runs even during extended editing sessions
  useEffect(() => {
    if (!enableSpellCheck || !editorRef.current) return;

    const periodicCheckInterval = setInterval(() => {
      const timeSinceLastCheck = Date.now() - lastSpellCheckTime.current;
      const currentContent = editorRef.current?.getValue() || '';

      // Run spell check if:
      // 1. More than 15 seconds since last check AND
      // 2. Content has actually changed since last check
      if (timeSinceLastCheck > 15000 && currentContent !== previousValueRef.current) {
        console.log('[SpellCheck] Periodic spell check - content changed, running check');
        spellCheckDocument(null, 0); // Check full document with fresh content
        previousValueRef.current = currentContent;
        lastSpellCheckTime.current = Date.now();
      }
    }, 10000); // Check every 10 seconds

    return () => {
      clearInterval(periodicCheckInterval);
    };
  }, [enableSpellCheck, editorRef.current]);

  const spellCheckDocument = async (textOverride = null, startOffset, forceProgress = false) => {
    if (!enableSpellCheck) return;

    // ALWAYS get fresh content from editor unless explicitly overridden
    const currentText = textOverride ?? (editorRef.current ? editorRef.current.getValue() : '');

    if (!currentText || currentText.length === 0) return;
    if (startOffset > 0 && currentText.length < 10) return;
    const isLarge = currentText.length > 100;
    const shouldShowProgress = isLarge || forceProgress;
    const progressCb = shouldShowProgress ? (processObj) => {
      lastProgressRef.current = processObj;
      setProgress(processObj);
    } : () => {};
    try {
      const issues = await SpellCheckService.scan(currentText, progressCb, categoryId, typeof getFolderPath === 'function' ? getFolderPath() : null);
      if (editorRef.current) {
        suggestionsMap.current = MonacoMarkerAdapter.toMonacoMarkers(
          editorRef.current,
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
      setProgress(null);
    }
  };

  // MARKDOWN LINTING LOGIC

  // Initial markdown lint when editor is ready
  useEffect(() => {
    if (enableMarkdownLint && editorRef.current) {
      setTimeout(() => {
        lintDocument(null, 0);
      }, 500); // Delay more than spell check to avoid conflict
    }
  }, [enableMarkdownLint, editorRef.current]);

  // Periodic markdown lint
  useEffect(() => {
    if (!enableMarkdownLint || !editorRef.current) return;

    const periodicLintInterval = setInterval(() => {
      const timeSinceLastLint = Date.now() - lastLintTime.current;
      const currentContent = editorRef.current?.getValue() || '';

      if (timeSinceLastLint > 30000 && currentContent !== lintPreviousValueRef.current) {
        console.log('[MarkdownLint] Periodic lint check - content changed, running check');
        lintDocument(currentContent, 0);
        lintPreviousValueRef.current = currentContent;
        lastLintTime.current = Date.now();
      }
    }, 20000); // Check every 20 seconds

    return () => {
      clearInterval(periodicLintInterval);
    };
  }, [enableMarkdownLint, editorRef.current]);

  const lintDocument = async (textOverride = null, startOffset, forceProgress = false) => {
    if (!enableMarkdownLint) return;

    const currentText = textOverride ?? (editorRef.current ? editorRef.current.getValue() : '');

    if (!currentText || currentText.length === 0) return;

    const isLarge = currentText.length > 1000;
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

      if (editorRef.current) {
        markersMap.current = MarkdownLintMarkerAdapter.toMonacoMarkers(
          editorRef.current,
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

  // KEYBOARD SHORTCUTS
  useEffect(() => {
    if (!enableKeyboardShortcuts || !editorRef.current) return;
    const editor = editorRef.current;

    // Store spell check function globally for SpellCheckActions to use
    window.editorSpellCheckTrigger = (text = null, offset = 0) => {
      if (editorRef.current) {
        spellCheckDocument(text, offset);
      }
    };

    // Bold
    const boldCommand = editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyB,
      () => {
        const toolbarButton = document.querySelector('[title="Bold (Ctrl+B)"]');
        if (toolbarButton) toolbarButton.click();
      }
    );
    // Italic
    const italicCommand = editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyI,
      () => {
        const toolbarButton = document.querySelector('[title="Italic (Ctrl+I)"]');
        if (toolbarButton) toolbarButton.click();
      }
    );
    // Quick fix
    const quickFixCommand = editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.US_DOT,
      () => {
        editor.trigger('', 'editor.action.quickFix', {});
      }
    );
    // Comment toggle
    const commentCommand = editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.Slash,
      () => {
        CommentService.handleCommentToggle(editor);
      }
    );
        // Register quick fix actions
  // IMPORTANT: getCategoryId should be memoized in the parent with useCallback to avoid repeated registration
  SpellCheckActions.registerQuickFixActions(editor, suggestionsMap, getCategoryId, getFolderPath);

  // Register markdown linting actions
  MarkdownLintActions.registerQuickFixActions(editor, markersMap, getCategoryId, getFolderPath);

    // Store global functions for external access
    window.editorMarkdownLintTrigger = (text = null, offset = 0) => {
      if (editorRef.current) {
        lintDocument(text, offset);
      }
    };

    window.CommentService = CommentService;
    window.testCommentToggle = () => {
      CommentService.handleCommentToggle(editor);
    };
    // No manual cleanup needed; Monaco disposes commands with editor
  // Only depend on stable references to avoid repeated registration
  // suggestionsMap is a ref (stable), getCategoryId must be memoized in parent
  }, [enableKeyboardShortcuts, editorRef.current]);

  // LIST BEHAVIOR
  useEffect(() => {
    if (!enableListBehavior || !editorRef.current) return;
    const editor = editorRef.current;
    // Helper: isInCodeFence
    const isInCodeFence = (editor, position) => {
      const model = editor.getModel();
      let inCodeFence = false;
      for (let i = 1; i <= position.lineNumber; i++) {
        const lineContent = model.getLineContent(i);
        if (lineContent.trim().startsWith('```')) {
          inCodeFence = !inCodeFence;
        }
      }
      return inCodeFence;
    };
    // Helper: getListPattern
    const getListPattern = (line) => {
      const trimmed = line.trim();
      const unorderedMatch = trimmed.match(/^([-*+])\s+(.*)$/);
      if (unorderedMatch) {
        return {
          type: 'unordered',
          marker: unorderedMatch[1],
          content: unorderedMatch[2],
          indentation: line.match(/^(\s*)/)[1]
        };
      }
      const orderedMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
      if (orderedMatch) {
        return {
          type: 'ordered',
          number: parseInt(orderedMatch[1]),
          content: orderedMatch[2],
          indentation: line.match(/^(\s*)/)[1]
        };
      }
      const orderedMarkerOnly = trimmed.match(/^(\d+)\.\s*$/);
      if (orderedMarkerOnly) {
        return {
          type: 'ordered',
          number: parseInt(orderedMarkerOnly[1]),
          content: '',
          indentation: line.match(/^(\s*)/)[1]
        };
      }
      const unorderedMarkerOnly = trimmed.match(/^([-*+])\s*$/);
      if (unorderedMarkerOnly) {
        return {
          type: 'unordered',
          marker: unorderedMarkerOnly[1],
          content: '',
          indentation: line.match(/^(\s*)/)[1]
        };
      }
      return null;
    };
    // Helper: analyzeOrderedListPattern
    const analyzeOrderedListPattern = (editor, currentLineNumber, indentation) => {
      const model = editor.getModel();
      const listItems = [];
      let startLine = currentLineNumber;
      for (let i = currentLineNumber - 1; i >= 1; i--) {
        const lineContent = model.getLineContent(i);
        const pattern = getListPattern(lineContent);
        if (!pattern || pattern.type !== 'ordered' || pattern.indentation !== indentation) {
          break;
        }
        startLine = i;
        listItems.unshift(pattern.number);
      }
      for (let i = startLine; i <= model.getLineCount(); i++) {
        const lineContent = model.getLineContent(i);
        const pattern = getListPattern(lineContent);
        if (!pattern || pattern.type !== 'ordered' || pattern.indentation !== indentation) {
          break;
        }
        if (i >= startLine) {
          listItems.push(pattern.number);
        }
      }
      const allOnes = listItems.every(num => num === 1);
      return {
        allOnes,
        nextNumber: allOnes ? 1 : Math.max(...listItems) + 1
      };
    };
    // Main: handleEnterKeyInList
    const handleEnterKeyInList = (editor) => {
      const position = editor.getPosition();
      if (isInCodeFence(editor, position)) return false;
      const model = editor.getModel();
      const lineContent = model.getLineContent(position.lineNumber);
      const listPattern = getListPattern(lineContent);
      if (!listPattern) return false;
      if (listPattern.content.trim() === '') {
        editor.executeEdits('list-enter', [
          {
            range: {
              startLineNumber: position.lineNumber,
              startColumn: 1,
              endLineNumber: position.lineNumber,
              endColumn: lineContent.length + 1
            },
            text: '\n'
          }
        ]);
        editor.setPosition({
          lineNumber: position.lineNumber + 1,
          column: 1
        });
        return true;
      }
      let newMarker;
      if (listPattern.type === 'unordered') {
        newMarker = `${listPattern.marker} `;
      } else {
        const analysis = analyzeOrderedListPattern(editor, position.lineNumber, listPattern.indentation);
        newMarker = `${analysis.nextNumber}. `;
      }
      const newLineText = `\n${listPattern.indentation}${newMarker}`;
      editor.executeEdits('list-enter', [
        {
          range: {
            startLineNumber: position.lineNumber,
            startColumn: position.column,
            endLineNumber: position.lineNumber,
            endColumn: position.column
          },
          text: newLineText
        }
      ]);
      editor.setPosition({
        lineNumber: position.lineNumber + 1,
        column: listPattern.indentation.length + newMarker.length + 1
      });
      return true;
    };
    // Add onKeyDown event
    const keyDownDisposable = editor.onKeyDown((e) => {
      if (e.keyCode === monaco.KeyCode.Enter) {
        if (handleEnterKeyInList(editor)) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    });
    return () => {
      keyDownDisposable.dispose();
    };
  }, [enableListBehavior, editorRef.current]);

  return {
    editor: editorRef.current,
    spellCheck: enableSpellCheck ? { progress, suggestionsMap } : undefined,
    markdownLint: enableMarkdownLint ? { lintProgress, markersMap } : undefined,
    runSpellCheck: () => {
      if (editorRef.current) {
        // Show initial progress
        setProgress({ percentComplete: 0 });
        spellCheckDocument(null, 0, true); // Use fresh content from editor, force progress for manual spell check
      }
    },
    runMarkdownLint: () => {
      if (editorRef.current) {
        // Show initial progress
        setLintProgress({ progress: 0 });
        lintDocument(null, 0, true); // Force progress for manual lint check
      }
    },
    // Expose spell check function for use by SpellCheckActions
    triggerSpellCheck: (text = null, offset = 0) => {
      if (editorRef.current) {
        spellCheckDocument(text, offset);
      }
    },
    // Expose markdown lint function for use by MarkdownLintActions
    triggerMarkdownLint: (text = null, offset = 0) => {
      if (editorRef.current) {
        lintDocument(text, offset);
      }
    }
  };
}

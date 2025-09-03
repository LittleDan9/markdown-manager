import { useRef, useEffect, useState, useCallback } from 'react';
import { EditorService, SpellCheckService, CommentService, SpellCheckMarkers, TextRegionAnalyzer, MonacoMarkerAdapter, SpellCheckActions } from '@/services/editor';
import { useTheme } from '@/providers/ThemeProvider';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';

/**
 * Consolidated editor hook for Monaco setup, spell check, keyboard shortcuts, and list behavior.
 * @param {Object} options
 *   - containerRef: ref to DOM container
 *   - value: initial editor value
 *   - onChange: callback for content changes
 *   - onCursorLineChange: callback for cursor line changes
 *   - enableSpellCheck: boolean
 *   - enableKeyboardShortcuts: boolean
 *   - enableListBehavior: boolean
 *   - categoryId: for spell check context
 *   - getCategoryId: function for keyboard shortcut context
 *   - getFolderPath: function for folder-based dictionary context
 * @returns {Object} { editor, spellCheck: { progress, suggestionsMap } }
 */
export default function useEditor({
  containerRef,
  value,
  onChange,
  onCursorLineChange,
  enableSpellCheck = true,
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
    };
  }, [containerRef]);

  // Theme changes
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.applyTheme(theme);
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
        if (editorRef.current && lastEditorValue.current) {
          spellCheckDocument(lastEditorValue.current, 0);
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
        if (editor && lastEditorValue.current) {
          spellCheckDocument(lastEditorValue.current, 0);
        }
      }, 300); // Reduced from 500ms to 300ms
    });
    return () => {
      layoutDisposable.dispose();
      if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current);
    };
  }, [enableSpellCheck]);

  // Main spell check logic - optimized for immediate initial check and faster user response
  useEffect(() => {
    if (!enableSpellCheck || !editorRef.current || !lastEditorValue.current) return;
    if (lastEditorValue.current !== previousValueRef.current) {
      if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
      const runAndHandleSpellCheck = () => {
        const { regionText, startOffset } = TextRegionAnalyzer.getChangedRegion(editorRef.current, previousValueRef.current, lastEditorValue.current);
        previousValueRef.current = lastEditorValue.current;
        lastSpellCheckTime.current = Date.now();
        if (regionText.length > 0) {
          spellCheckDocument(regionText, startOffset);
        }
      };

      // Reduce debounce delay for better responsiveness (was 5000ms, now 2000ms)
      debounceTimeout.current = setTimeout(runAndHandleSpellCheck, 2000);
    }
    return () => {
      if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    };
  }, [enableSpellCheck, lastEditorValue.current, categoryId]);

  // Initial spell check when editor is ready - trigger immediately
  useEffect(() => {
    if (enableSpellCheck && editorRef.current && lastEditorValue.current) {
      // Don't wait - start spell check immediately when editor loads
      setTimeout(() => {
        spellCheckDocument(lastEditorValue.current, 0);
      }, 100); // Small delay to ensure editor is fully initialized
    }
  }, [enableSpellCheck, editorRef.current]);

  const spellCheckDocument = async (text, startOffset) => {
    if (!enableSpellCheck || !text || text.length === 0) return;
    if (startOffset > 0 && text.length < 10) return;
    const isLarge = text.length > 100;
    const progressCb = isLarge ? (processObj) => {
      lastProgressRef.current = processObj;
      setProgress(processObj);
    } : () => {};
    try {
      const issues = await SpellCheckService.scan(text, progressCb, categoryId, typeof getFolderPath === 'function' ? getFolderPath() : null);
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

  // KEYBOARD SHORTCUTS
  useEffect(() => {
    if (!enableKeyboardShortcuts || !editorRef.current) return;
    const editor = editorRef.current;
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
    spellCheck: enableSpellCheck ? { progress, suggestionsMap } : undefined
  };
}

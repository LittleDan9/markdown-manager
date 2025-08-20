
import React, { useEffect, useRef, useState } from 'react';
import EditorSingleton from "../services/EditorService";
import SpellCheckService from '../services/SpellCheckService';
import MarkdownToolbar from './MarkdownToolbar';
import { getChangedRegion, toMonacoMarkers, registerQuickFixActions, clearSpellCheckMarkers } from '@/utils';
import { useTheme } from '@/context/ThemeProvider';
import { useDocument } from '@/context/DocumentProvider';
import { useDebouncedCallback } from '@/utils/useDebouncedCallback';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import { useAuth } from '@/context/AuthContext';

export default function Editor({ value, onChange, onCursorLineChange }) {
  const containerRef = useRef(null); // for the DOM node
  const editorRef = useRef(null);    // for the Monaco editor instance
  const suggestionsMap = useRef(new Map());
  const [progress, setProgress] = useState(null);
  const { theme } = useTheme();
  const { currentDocument } = useDocument();
  const lastEditorValue = useRef(value);
  const previousValueRef = useRef(value);
  const lastProgressRef = useRef(null);

  // Get the category ID from the current document
  const categoryId = currentDocument?.category_id;

  // Create a ref to track current categoryId for dynamic access
  const categoryIdRef = useRef(categoryId);

  // Update the ref whenever categoryId changes
  useEffect(() => {
    categoryIdRef.current = categoryId;
  }, [categoryId]);

  // Debug: Log the document structure to understand what we have
  console.log('Editor - currentDocument:', currentDocument);
  console.log('Editor - categoryId:', categoryId, 'type:', typeof categoryId);

  /* Debounce Refs */
  // Spell Checking
  const debounceTimeout = useRef(null);
  const lastSpellCheckTime = useRef(Date.now());

  // Cursor Line Change
  const lastLineNumberRef = useRef(1);
  const debouncedLineChange = useDebouncedCallback((lineNumber) => {
    if (onCursorLineChange && lineNumber !== lastLineNumberRef.current) {
      lastLineNumberRef.current = lineNumber;
      onCursorLineChange(lineNumber);
    }
  }, 300); // Adjust debounce time as needed

  // Window resize handling for spell check markers
  const resizeTimeoutRef = useRef(null);

  // 1) Initialize spell-checker once
  useEffect(() => {
    SpellCheckService.init().catch(console.error);
  }, []);

  // 2) Window resize event handling for spell check markers
  useEffect(() => {
    let isResizing = false;
    let resizeStartTimeout = null;

    const handleResize = () => {
      // Clear markers immediately on first resize event (resize start)
      if (!isResizing) {
        isResizing = true;
        console.log('Window resize started - clearing spell check markers');
        clearSpellCheckMarkers(editorRef.current, suggestionsMap.current);
      }

      // Clear existing timeout and set new one for resize end detection
      if (resizeStartTimeout) {
        clearTimeout(resizeStartTimeout);
      }

      resizeStartTimeout = setTimeout(() => {
        isResizing = false;
        // Re-run spell check after resize stops
        if (editorRef.current && value) {
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
  }, [value]); // Include value in deps to ensure latest value is used

  // 3) Register Monaco quick-fix actions once
  useEffect(() => {
    if (!containerRef.current) return;

    let editorLayoutCleanup = null;

    EditorSingleton
      .setup(containerRef.current, value, theme)
      .then(editor => {
        editorRef.current = editor;
        editor.setValue(value);
        let lastLineNumber = 1;

        editor.onDidChangeCursorPosition((e) => {
          debouncedLineChange(e.position.lineNumber);
        });

        editor.onDidChangeModelContent(() => {
          const newValue = editor.getValue();
          lastEditorValue.current = newValue;
          onChange(newValue);
        });

        // Add keyboard shortcuts for markdown formatting
        editor.addCommand(
          monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyB,
          () => {
            // Trigger bold formatting
            const toolbarButton = document.querySelector('[title="Bold (Ctrl+B)"]');
            if (toolbarButton) toolbarButton.click();
          }
        );

        editor.addCommand(
          monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyI,
          () => {
            // Trigger italic formatting
            const toolbarButton = document.querySelector('[title="Italic (Ctrl+I)"]');
            if (toolbarButton) toolbarButton.click();
          }
        );

        editor.addCommand(
          monaco.KeyMod.CtrlCmd | monaco.KeyCode.US_DOT, // Ctrl + .
          () => {
            editor.trigger('', 'editor.action.quickFix', {});
          }
        );

        // Add intelligent list behavior using onKeyDown event
        editor.onKeyDown((e) => {
          if (e.keyCode === monaco.KeyCode.Enter) {
            if (handleEnterKeyInList(editor)) {
              e.preventDefault();
              e.stopPropagation();
            }
          }
        });

        registerQuickFixActions(editor, suggestionsMap, () => categoryIdRef.current);

        // Add Monaco editor layout change listener to handle editor-specific resizing
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

        // Store cleanup function for layout listener
        editorLayoutCleanup = () => {
          layoutDisposable.dispose();
          if (resizeTimeoutRef.current) {
            clearTimeout(resizeTimeoutRef.current);
          }
        };

        spellCheckDocument(value, 0);
      })
      .catch(console.error);

    // Cleanup function for the useEffect
    return () => {
      if (editorLayoutCleanup) {
        editorLayoutCleanup();
      }
    };
  }, []);

  // No need to re-register - the quick fix actions will dynamically get the categoryId



  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.applyTheme(theme);
    }
  }, [theme]);

  useEffect(() => {
    if (!editorRef.current) return;
    const editor = editorRef.current;

    if (value !== lastEditorValue.current) {
      // Save current cursor position before updating value
      const currentPosition = editor.getPosition();
      const currentScrollTop = editor.getScrollTop();
      
      editor.setValue(value);
      lastEditorValue.current = value;
      
      // Restore cursor position and scroll after setValue
      // Only restore if the position is valid for the new content
      if (currentPosition) {
        const model = editor.getModel();
        const lineCount = model.getLineCount();
        const lastLineLength = model.getLineContent(lineCount).length;
        
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
    }


    if (value !== previousValueRef.current) {
      if (debounceTimeout.current) clearTimeout(debounceTimeout.current);

      const runAndHandleSpellCheck = () => {
        const { regionText, startOffset } = getChangedRegion(editor, previousValueRef.current, value);
        previousValueRef.current = value;
        lastSpellCheckTime.current = Date.now();

        if (regionText.length > 0) {
          spellCheckDocument(regionText, startOffset);
        }
      }

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
  }, [value, setProgress]);

  // Helper function to check if we're in a code fence
  const isInCodeFence = (editor, position) => {
    const model = editor.getModel();
    const lineCount = model.getLineCount();
    let inCodeFence = false;

    // Check from start of document to current position
    for (let i = 1; i <= position.lineNumber; i++) {
      const lineContent = model.getLineContent(i);
      if (lineContent.trim().startsWith('```')) {
        inCodeFence = !inCodeFence;
      }
    }

    return inCodeFence;
  };

  // Helper function to detect list patterns
  const getListPattern = (line) => {
    const trimmed = line.trim();

    // Unordered list patterns: -, *, +
    const unorderedMatch = trimmed.match(/^([-*+])\s+(.*)$/);
    if (unorderedMatch) {
      return {
        type: 'unordered',
        marker: unorderedMatch[1],
        content: unorderedMatch[2],
        indentation: line.match(/^(\s*)/)[1]
      };
    }

    // Ordered list patterns: 1., 2., etc. - allow empty content after space
    const orderedMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (orderedMatch) {
      return {
        type: 'ordered',
        number: parseInt(orderedMatch[1]),
        content: orderedMatch[2],
        indentation: line.match(/^(\s*)/)[1]
      };
    }

    // Also match just the marker without content (for exit detection)
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

  // Helper function to analyze ordered list numbering pattern
  const analyzeOrderedListPattern = (editor, currentLineNumber, indentation) => {
    const model = editor.getModel();
    const listItems = [];

    // Look backwards to find the start of the list
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

    // Look forwards to include current and subsequent list items
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

    // Determine if all items use "1." or if they increment
    const allOnes = listItems.every(num => num === 1);

    return {
      allOnes,
      nextNumber: allOnes ? 1 : Math.max(...listItems) + 1
    };
  };

  // Main function to handle Enter key in lists
  const handleEnterKeyInList = (editor) => {
    const position = editor.getPosition();

    console.log('handleEnterKeyInList called at position:', position);

    // Don't handle if we're in a code fence
    if (isInCodeFence(editor, position)) {
      console.log('In code fence, returning false');
      // Let Monaco handle the default Enter behavior
      return false; // Allow default behavior
    }

    const model = editor.getModel();
    const lineContent = model.getLineContent(position.lineNumber);
    console.log('Current line content:', JSON.stringify(lineContent));

    const listPattern = getListPattern(lineContent);
    console.log('List pattern detected:', listPattern);

    if (!listPattern) {
      console.log('No list pattern, returning false');
      // Not in a list, use default behavior
      return false; // Allow default behavior
    }

    // Check if the current list item is empty (just the marker)
    if (listPattern.content.trim() === '') {
      console.log('Exit list detected - current line:', lineContent);
      console.log('Position:', position);
      console.log('List pattern:', listPattern);

      // Empty list item - replace with just one newline
      editor.executeEdits('list-enter', [
        {
          range: {
            startLineNumber: position.lineNumber,
            startColumn: 1,
            endLineNumber: position.lineNumber,
            endColumn: lineContent.length + 1
          },
          text: '\n' // Replace the list marker line with just one newline
        }
      ]);

      console.log('After edit - setting position to line:', position.lineNumber + 1);

      // Position cursor at the beginning of the new line
      editor.setPosition({
        lineNumber: position.lineNumber + 1,
        column: 1
      });

      return true; // Command handled
    }

    // We have content in the list item, create a new list item
    let newMarker;

    if (listPattern.type === 'unordered') {
      newMarker = `${listPattern.marker} `;
    } else {
      // Ordered list - analyze the pattern
      const analysis = analyzeOrderedListPattern(editor, position.lineNumber, listPattern.indentation);
      newMarker = `${analysis.nextNumber}. `;
    }

    const newLineText = `\n${listPattern.indentation}${newMarker}`;

    // Insert the new line with the list marker
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

    // Position cursor after the new marker
    editor.setPosition({
      lineNumber: position.lineNumber + 1,
      column: listPattern.indentation.length + newMarker.length + 1
    });

    return true; // Command handled
  };

  const spellCheckDocument = async (text, startOffset) => {
    if (!text || text.length === 0) return;

    // Skip spell checking for very small changes (likely just typing)
    if (startOffset > 0 && text.length < 10) return;

    const isLarge = text.length > 100;
    const progressCb = isLarge ? (processObj) => {
      lastProgressRef.current = processObj;
      setProgress(processObj);
    } : () => { };

    try {
      const issues = await SpellCheckService.scan(text, progressCb, categoryId);

      if (editorRef.current) {
        suggestionsMap.current = toMonacoMarkers(
          editorRef.current,
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
  }

  return (
    <div id="editorContainer" style={{ height: "100%", width: "100%", position: "relative", display: "flex", flexDirection: "column" }}>
      <MarkdownToolbar editorRef={editorRef} />
      <div id="editor" ref={containerRef} className="has-toolbar" style={{ flex: 1, width: "100%" }} />
      {progress && (
        <div
          className="alert alert-info"
          style={{
            position: "absolute",
            bottom: "10px",
            right: "10px",
            zIndex: 1000,
            maxWidth: "250px",
            fontSize: "12px",
            padding: "8px 12px"
          }}
        >
          <div className="d-flex align-items-center">
            <div className="spinner-border spinner-border-sm me-2" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <div>
              <div>Spell Checking Document</div>
              <div className="progress mt-1" style={{ height: "4px" }}>
                <div
                  className="progress-bar"
                  style={{ width: `${progress.percentComplete}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
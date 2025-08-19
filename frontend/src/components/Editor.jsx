
import React, { useEffect, useRef, useState } from 'react';
import EditorSingleton from "../services/EditorService";
import SpellCheckService from '../services/SpellCheckService';
import { getChangedRegion, toMonacoMarkers, registerQuickFixActions } from '@/utils';
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

  // 1) Initialize spell-checker once
  useEffect(() => {
    SpellCheckService.init().catch(console.error);
  }, []);

  // 2) Register Monaco quick-fix actions once
  useEffect(() => {
    if (!containerRef.current) return;
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

        editor.addCommand(
          monaco.KeyMod.CtrlCmd | monaco.KeyCode.US_DOT, // Ctrl + .
          () => {
            editor.trigger('', 'editor.action.quickFix', {});
          }
        );

        registerQuickFixActions(editor, suggestionsMap, () => categoryIdRef.current);
        spellCheckDocument(value, 0);
      })
      .catch(console.error);
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
      editor.setValue(value);
      lastEditorValue.current = value;
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
    <div id="editorContainer" style={{ height: "100%", width: "100%", position: "relative" }}>
      <div id="editor" ref={containerRef} style={{ height: "100%", width: "100%" }} />
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
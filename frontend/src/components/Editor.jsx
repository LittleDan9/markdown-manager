
import React, { useEffect, useRef, useState } from 'react';
import EditorSingleton from "../services/EditorService";
import SpellCheckService from '../services/SpellCheckService';
import { getChangedRegion, toMonacoMarkers, registerQuickFixActions } from '@/utils';
import { useTheme } from '@/context/ThemeProvider';
import { useDebouncedCallback } from '@/utils/useDebouncedCallback';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import { useAuth } from '@/context/AuthProvider';
import { AuthProvider } from '@/context/AuthProvider';

export default function Editor({ value, onChange, onCursorLineChange }) {
  const containerRef = useRef(null); // for the DOM node
  const editorRef = useRef(null);    // for the Monaco editor instance
  const suggestionsMap = useRef(new Map());
  const [progress, setProgress] = useState(null);
  const { theme } = useTheme();
  const lastEditorValue = useRef(value);
  const previousValueRef = useRef(value);
  const lastProgressRef = useRef(null);

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

        registerQuickFixActions(editor, suggestionsMap);
        spellCheckDocument(value, 0);
      })
      .catch(console.error);
  }, []);



  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.applyTheme(theme);
    }
  }, [theme]);

  // Listen for storage:cleared event and clear editor value
  useEffect(() => {
    const handleStorageCleared = (e) => {
      if (e.detail?.type === 'storage:cleared') {
        if (editorRef.current) {
          editorRef.current.setValue("");
        }
        lastEditorValue.current = "";
        previousValueRef.current = "";
        if (onChange) onChange("");
      }
    };
    window.addEventListener('markdown-manager:storage', handleStorageCleared);
    return () => {
      window.removeEventListener('markdown-manager:storage', handleStorageCleared);
    };
  }, []);

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
          spellCheckDocument(regionText, startOffset)
        }
      }
      // If last spell check was more than 30s ago, run immediately
      const now = Date.now();
      if (now - lastSpellCheckTime.current > 30000) {
        runAndHandleSpellCheck();
      } else {
        debounceTimeout.current = setTimeout(runAndHandleSpellCheck, 3000); // 3s debounce
      }
    }
    // Cleanup on unmount
    return () => {
      if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    };
  }, [value, setProgress]);

  const spellCheckDocument = async (text, startOffset) => {
    if (!text || text.length === 0) return;
    const isLarge = text.length > 100;
    const progressCb = isLarge ? (processObj) => {
      lastProgressRef.current = processObj;
      setProgress(processObj);
    } : () => { };
    SpellCheckService
      .scan(text, progressCb)
      .then(issues => {
        suggestionsMap.current = toMonacoMarkers(
          editorRef.current,
          issues,
          startOffset,
          suggestionsMap.current
        );
        if (lastProgressRef.current && lastProgressRef.current.percentComplete >= 100) {
          setTimeout(() => setProgress(null), 500); // Hide after 500ms
        } else {
          setProgress(null);
        }
      })
      .catch(console.error);
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
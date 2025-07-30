
import React, { useEffect, useRef, useState } from 'react';
import EditorSingleton from "../services/EditorService";
import SpellCheckService from '../services/SpellCheckService';
import { getChangedRegion, toMonacoMarkers, registerQuickFixActions } from '@/utils';
import { useTheme } from '@/context/ThemeContext';

export default function Editor({ value, onChange, autoSaveEnabled = true, onCursorLineChange }) {
  const containerRef = useRef(null); // for the DOM node
  const editorRef = useRef(null);    // for the Monaco editor instance
  const suggestionsMap = useRef(new Map());
  const [progress, setProgress] = useState(0);
  const { theme } = useTheme();
  const lastEditorValue = useRef(value);
  const previousValueRef = useRef(value);

  // Debounce Refs
  const debounceTimeout = useRef(null);
  const lastSpellCheckTime = useRef(Date.now());

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
          if (onCursorLineChange && e.position.lineNumber !== lastLineNumber) {
            lastLineNumber = e.position.lineNumber;
            onCursorLineChange(e.position.lineNumber);
          }
        });

        editor.onDidChangeModelContent(() => {
          const newValue = editor.getValue();
          lastEditorValue.current = newValue;
          onChange(editor.getValue());
        });

        registerQuickFixActions(editor, suggestionsMap);
        if (value.length > 0) {
          setProgress(0);
          SpellCheckService.scan(value, setProgress)
            .then(issues => {
              suggestionsMap.current = toMonacoMarkers(
                editor,
                issues,
                0,
                suggestionsMap.current
              );
              setProgress(0);
            })
            .catch(console.error);
        }
      })
      .catch(console.error);
  }, []);

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


      // If auto-save is enabled, trigger a format on save
      // This is a placeholder for any auto-save logic you might want to implement
      // if (autoSaveEnabled) {
      //   editor.trigger('autoSave', 'editor.action.formatDocument');
      // }
    }
    if (value !== previousValueRef.current) {
      if (debounceTimeout.current) clearTimeout(debounceTimeout.current);

      const runSpellCheck = () => {
        const { regionText, startOffset } = getChangedRegion(editor, previousValueRef.current, value);
        previousValueRef.current = value;
        lastSpellCheckTime.current = Date.now();

        if (regionText.length > 0) {
          const isLarge = regionText.length > 100;
          const progressCb = isLarge ? setProgress : () => { };
          setProgress(0);
          SpellCheckService
            .scan(regionText, progressCb)
            .then(issues => {
              console.log(issues)
              suggestionsMap.current = toMonacoMarkers(
                editor,
                issues,
                startOffset,
                suggestionsMap.current
              );
              setProgress(0);
            })
            .catch(console.error);
        }
      }
      // If last spell check was more than 30s ago, run immediately
      const now = Date.now();
      if (now - lastSpellCheckTime.current > 30000) {
        runSpellCheck();
      } else {
        debounceTimeout.current = setTimeout(runSpellCheck, 3000); // 3s debounce
      }
    }
        // Cleanup on unmount
    return () => {
      if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    };
  }, [value, setProgress]);

  return (
    <div id="editorContainer" style={{ height: "100%", width: "100%", position: "relative" }}>
      {progress > 0 && progress < 100 && <ProgressBar percent={progress} />}
      <div id="editor" ref={containerRef} style={{ height: "100%", width: "100%" }} />
    </div>
  );
}
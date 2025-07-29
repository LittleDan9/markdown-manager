
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

  // Track previous value for delta region detection
  const prevValueRef = useRef(value);
  useEffect(() => {
    if (!editorRef.current) return;
    const editor = editorRef.current;
    const prevValue = prevValueRef.current;
    const { regionText, startOffset } = getChangedRegion(editor, prevValue, value);
    prevValueRef.current = value;
    const isLarge = regionText.length > 100;
    const progressCb = isLarge ? setProgress : () => { };
    editor.setValue(value);
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
  }, [value]);

  return (
    <div id="editorContainer" style={{ height: "100%", width: "100%", position: "relative" }}>
      {progress > 0 && progress < 100 && <ProgressBar percent={progress} />}
      <div id="editor" ref={containerRef} style={{ height: "100%", width: "100%" }} />
    </div>
  );
}
import React, { useEffect, useRef, useState } from 'react';
import EditorSingleton from "../services/EditorService";
import SpellCheckService from '../services/SpellCheckService';
import {
  getChangedRegion,
  toMonacoMarkers,
  registerQuickFixActions
} from '@/utils';
import { container } from 'webpack';
import { useTheme } from '@/context/ThemeContext';

export default function Editor({ value, onChange }) {
  const containerRef = useRef(null);
  const editorRef = useRef(null);
  const suggestionsMap = useRef(new Map());
  const [progress, setProgress] = useState(0);
  const { theme } = useTheme();

  // 1) Initialize spell-checker once
  useEffect(() => {
    SpellCheckService.init().catch(console.error);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    EditorSingleton
    .setup(containerRef.current, value, theme)
    .then(editor => {
      editorRef.current = editor;
      registerQuickFixActions(editor, suggestionsMap.current);
    })
    .catch(console.error);
  }, []);

  // 2) Register Monaco quick-fix actions once
  useEffect(() => {
    if (!editorRef.current) return;
    registerQuickFixActions(editorRef.current, suggestionsMap);
  }, []);

  // 3) Re-scan on every change
  useEffect(() => {
    if (!editorRef.current) return;
    const editor = editorRef.current;
    if (!editor) return;

    const { regionText, startOffset } = getChangedRegion(editorRef.current, value);
    const isLarge = regionText.length > 5000;
    const progressCb = isLarge ? setProgress : () => {};

    setProgress(0);
    SpellCheckService
      .scan(regionText, SpellCheckService.getCustomWords(), progressCb)
      .then(issues => {
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
    <div className="editor-container">
      {progress > 0 && progress < 100 && <ProgressBar percent={progress} />}
      <div ref={editorRef} style={{ height: '100%' }} />
    </div>
  );
}
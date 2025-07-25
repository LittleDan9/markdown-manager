import React, { useEffect, useRef } from "react";
import EditorSingleton from "../js/Editor";
import { useTheme } from "../context/ThemeContext";
import { useDocument } from "../context/DocumentProvider";
import HighlightService from "../js/services/HighlightService";
import SpellCheckService from "../js/services/SpellCheckService";
import * as monaco from "monaco-editor/esm/vs/editor/editor.api";
import useAutoSave from "../hooks/useAutoSave";

function Editor({ value, onChange, autosaveEnabled = true, onCursorLineChange }) {
  const editorRef = useRef(null);
  const monacoInstanceRef = useRef(null);
  const spellDebounceRef = useRef(null);
  const suggestionsMapRef = useRef(new Map());
  const { theme } = useTheme();
  const { highlightedBlocks, setHighlightedBlocks } = useDocument();
  const highlightDebounceRef = useRef();
  const resizeObserverRef = useRef(null);
  const layoutDebounceRef = useRef();
  const { currentDocument, saveDocument } = useDocument();

  // Integrate autosave hook: save with latest editor value
  useAutoSave(
    { ...currentDocument, content: value },
    saveDocument,
    autosaveEnabled,
    30000
  );

  // Initialize SpellCheckService once
  useEffect(() => {
    SpellCheckService.init().catch(console.error);
  }, []);

  // Initialize Monaco on mount and observe container resize
  useEffect(() => {
    if (editorRef.current && !monacoInstanceRef.current) {
      EditorSingleton.setup(editorRef.current, value, theme).then((instance) => {
        monacoInstanceRef.current = instance;
        // initial spell-check on load
        (async () => {
          await SpellCheckService.init();
          const text = instance.getValue();
          const issues = SpellCheckService.check(text);
          const model = instance.getModel();
          // populate suggestions map for initial load
          suggestionsMapRef.current.clear();
          const markers = issues.map(({ word, suggestions, lineNumber, column }) => {
            const key = `${lineNumber}:${column}`;
            suggestionsMapRef.current.set(key, suggestions);
            return {
              startLineNumber: lineNumber,
              startColumn: column,
              endLineNumber: lineNumber,
              endColumn: column + word.length,
              message: `Possible typo: "${word}". Suggestions: ${suggestions.join(", ")}`,
              severity: monaco.MarkerSeverity.Warning,
            };
          });
          monaco.editor.setModelMarkers(model, "spell", markers);
        })();
        
        // register quick-fix code actions for spelling suggestions
        monaco.languages.registerCodeActionProvider('markdown', {
          providedCodeActionKinds: ['quickfix'],
          provideCodeActions: (model, range, context) => {
            const actions = [];
            context.markers.forEach(marker => {
              if (marker.owner !== 'spell') return;
              const key = `${marker.startLineNumber}:${marker.startColumn}`;
              const suggestions = suggestionsMapRef.current.get(key) || [];
              suggestions.forEach(suggestion => {
                actions.push({
                  title: suggestion,
                  kind: 'quickfix',
                  edit: {
                    edits: [{
                      resource: model.uri,
                      textEdit: {
                        range: new monaco.Range(
                          marker.startLineNumber,
                          marker.startColumn,
                          marker.endLineNumber,
                          marker.endColumn
                        ),
                        text: suggestion
                      }
                    }]
                  },
                  diagnostics: [marker]
                });
              });
            });
            return { actions, dispose: () => {} };
          }
        });
        setTimeout(() => {
          const textarea = editorRef.current.querySelector('textarea.monaco-mouse-cursor-text');
          if (textarea) {
            textarea.id = 'monaco-editor-textarea';
          }
        }, 0);
        instance.onDidChangeModelContent(() => {
          const newValue = instance.getValue();
          if (newValue !== value) onChange(newValue);

          // Debounced spell-check
          if (spellDebounceRef.current) clearTimeout(spellDebounceRef.current);
          spellDebounceRef.current = setTimeout(() => {
            const text = instance.getValue();
            const issues = SpellCheckService.check(text);
            const model = instance.getModel();
            // populate suggestions map and build markers
            suggestionsMapRef.current.clear();
            const markers = issues.map(({ word, suggestions, lineNumber, column }) => {
              const key = `${lineNumber}:${column}`;
              suggestionsMapRef.current.set(key, suggestions);
              return {
                startLineNumber: lineNumber,
                startColumn: column,
                endLineNumber: lineNumber,
                endColumn: column + word.length,
                message: `Possible typo: "${word}". Suggestions: ${suggestions.join(", ")}`,
                severity: monaco.MarkerSeverity.Warning,
              };
            });
            monaco.editor.setModelMarkers(model, "spell", markers);
          }, 300);

          // Detect fenced code block edits and trigger highlight
          if (highlightDebounceRef.current) clearTimeout(highlightDebounceRef.current);
          highlightDebounceRef.current = setTimeout(() => {
            // Find all fenced code blocks in the markdown
            const fencedRegex = /```(\w+)?\n([\s\S]*?)```/g;
            let match;
            const blocks = [];
            while ((match = fencedRegex.exec(newValue)) !== null) {
              const language = match[1] ? match[1].trim() : "";
              const code = match[2] || "";
              // Generate a stable placeholderId for this block
              const placeholderId = `syntax-highlight-${language}-${code.length}-${code.slice(0,10).replace(/[^a-zA-Z0-9]/g,"")}`;
              blocks.push({ code, language, placeholderId });
            }
            if (blocks.length > 0) {
              HighlightService.highlightBlocks(blocks).then(results => {
                setHighlightedBlocks(prev => ({ ...prev, ...results }));
              });
            }
          }, 150); // Debounce 150ms

        });
        // Listen for cursor position changes and emit line number
        instance.onDidChangeCursorPosition((e) => {
          if (onCursorLineChange) {
            onCursorLineChange(e.position.lineNumber);
          }
        });
      });
    }
    // Setup ResizeObserver to call layout on Monaco when container resizes (debounced)
    if (editorRef.current) {
      resizeObserverRef.current = new window.ResizeObserver(() => {
        if (layoutDebounceRef.current) clearTimeout(layoutDebounceRef.current);
        layoutDebounceRef.current = setTimeout(() => {
          if (monacoInstanceRef.current) {
            monacoInstanceRef.current.layout();
          }
        }, 100); // 100ms debounce
      });
      resizeObserverRef.current.observe(editorRef.current);
    }
    // Cleanup on unmount
    return () => {
      if (monacoInstanceRef.current) {
        monacoInstanceRef.current.dispose();
        monacoInstanceRef.current = null;
      }
      if (highlightDebounceRef.current) clearTimeout(highlightDebounceRef.current);
      if (spellDebounceRef.current) clearTimeout(spellDebounceRef.current);
      if (layoutDebounceRef.current) clearTimeout(layoutDebounceRef.current);
      if (resizeObserverRef.current && editorRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
    };
    // eslint-disable-next-line
  }, []);

  // Update Monaco when theme changes
  useEffect(() => {
    if (monacoInstanceRef.current) {
      EditorSingleton.applyTheme(theme);
    }
  }, [theme]);

  // Update Monaco value if parent value changes (external update)
  useEffect(() => {
    if (
      monacoInstanceRef.current && monacoInstanceRef.current.getValue() !== value
    ) {
      monacoInstanceRef.current.setValue(value);
    }
  }, [value]);

  return (
    <div id="editorContainer" style={{ height: "100%", width: "100%" }}>
      <div
        id="editor"
        ref={editorRef}
        style={{ height: "100%", width: "100%" }}
      />
    </div>
  );
}

export default Editor;

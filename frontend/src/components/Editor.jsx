import React, { useEffect, useRef } from "react";
import EditorSingleton from "../js/Editor";
import { useTheme } from "../context/ThemeContext";
import useAutoSave from "../hooks/useAutoSave";

function Editor({ value, onChange, currentDocument, saveDocument, autosaveEnabled = true }) {
  const editorRef = useRef(null);
  const monacoInstanceRef = useRef(null);
  const { theme } = useTheme();

  // Integrate autosave hook
  useAutoSave(currentDocument, saveDocument, autosaveEnabled);

  // Initialize Monaco on mount
  useEffect(() => {
    if (editorRef.current && !monacoInstanceRef.current) {
        EditorSingleton.setup(editorRef.current, value, theme).then((instance) => {
          monacoInstanceRef.current = instance;
          instance.onDidChangeModelContent(() => {
            const newValue = instance.getValue();
            if (newValue !== value) onChange(newValue);
          });
        });
      }
      // Cleanup on umount
      return () => {
        if (monacoInstanceRef.current) {
          monacoInstanceRef.current.dispose();
          monacoInstanceRef.current = null;
        }
      };
      // eslint-disable-next-line
    }, []);

  // Update Monaco when them changes
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

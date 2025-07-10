import React, { use, useEffect, useRef } from "react";
import editorSingleton from "../js/editor";
import renderer from "../js/renderer";
import { documentManager } from "../js/DocumentManager";
import { useTheme } from "../context/ThemeContext";
import { EDITOR_KEY } from "../js/constants";

function Editor({ value, onChange }) {
  const editorRef = useRef(null);
  const monacoInstanceRef = useRef(null);
  const { theme } = useTheme();

  // Initialize Monaco on mount
  useEffect(() => {
    if (editorRef.current && !monacoInstanceRef.current) {
        editorSingleton.setup(editorRef.current, value, theme).then((instance) => {
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
      editorSingleton.applyTheme(theme);
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

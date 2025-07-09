import React, { useEffect } from "react";
import editor from "../js/editor";
import renderer from "../js/renderer";
import { documentManager } from "../js/DocumentManager";
import { useTheme } from "../context/ThemeContext";

function Editor() {
  const { theme } = useTheme();
  useEffect(() => {
    let editorInstance;
    let debouncedRender;

    async function setupEditor() {
      editorInstance = await editor.setup();
      // Debounced render function to avoid excessive rendering
      debouncedRender = (() => {
        let t;
        return () => {
          clearTimeout(t);
          t = setTimeout(() => renderer.render(editorInstance), 300);
        };
      })();

      // Listen for content changes and trigger debounced render
      editorInstance.onDidChangeModelContent(() => {
        debouncedRender();
        if (documentManager.currentDocument.id) {
          //handle auto save
        } else {
          localStorage.setItem(EDITOR_KEY, editorInstance.getValue());
        }
      });
      renderer.render(editorInstance, { isInitialRender: true });
    }

    setupEditor();
    // eslint-disable-next-line
  }, []);

  // React to theme changes
  useEffect(() => {
    editor.applyTheme(theme);
    // eslint-disable-next-line
  }, [theme]);

  return (
    <div id="editorContainer">
        <div id="editor"></div>
    </div>
  );
}

export default Editor;

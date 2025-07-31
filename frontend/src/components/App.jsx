import React, { useState, useEffect, useRef } from "react";
import Header from "./Header";
import Toolbar from "./toolbar/Toolbar";
import Editor from "./Editor";
import Renderer from "./Renderer";
import { ThemeProvider } from "../context/ThemeProvider";
import { useDocument } from "../context/DocumentProvider";
import { PreviewHTMLProvider } from "../context/PreviewHTMLContext";
import { useNotification } from "../components/NotificationProvider.jsx";

import { useAuth } from "../context/AuthProvider";
import useAutoSave from "@/hooks/useAutoSave";

function App() {
  const { isAuthenticated, autosaveEnabled, setAutosaveEnabled, syncPreviewScrollEnabled, setSyncPreviewScrollEnabled } = useAuth();
  const { currentDocument, saveDocument } = useDocument();
  const [content, setContent] = useState(currentDocument?.content || "");
  const [renderedHTML, setRenderedHTML] = useState("");
  const [cursorLine, setCursorLine] = useState(1);
  const [fullscreenPreview, setFullscreenPreview] = useState(false);
  const { showError } = useNotification();

  useAutoSave(currentDocument, saveDocument, autosaveEnabled);

  useEffect(() => {
    // Sync content with currentDocument after document load/change
    // Only update if document actually changed to prevent render loops
    if (currentDocument && currentDocument.content !== content) {
      setContent(currentDocument.content ?? "");
    }
  }, [currentDocument.id, currentDocument.content]);
  // Capture Ctrl+S to save current content
  useEffect(() => {
    const handleKeyDown = async (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        // Only save if content differs from currentDocument
        if (!currentDocument || content === currentDocument.content) return;
        try {
          const saved = await saveDocument({ ...currentDocument, content }, isAuthenticated);
          if (saved) {
            showSuccess('Document saved successfully.');
          }
        } catch {
          showError('Save failed.');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [content, currentDocument, saveDocument, isAuthenticated]);

  return (
    <ThemeProvider>
      <PreviewHTMLProvider>
        <div id="appRoot" className="app-root">
          <div id="container">
            <Header />
            <Toolbar
              setContent={setContent}
              editorValue={content}
              fullscreenPreview={fullscreenPreview}
              setFullscreenPreview={setFullscreenPreview}
            />
            <div id="main" className={fullscreenPreview ? "preview-full" : "split-view"}>
              {/* editor is always in the DOM, but width: 0 when closed */}
              <div className="editor-wrapper">
                <Editor
                  value={content}
                  onChange={setContent}
                  onCursorLineChange={setCursorLine}
                  fullscreenPreview={fullscreenPreview}
                />
              </div>
              <div className="renderer-wrapper">
                <Renderer
                  content={content}
                  onRenderHTML={html => setRenderedHTML(html)}
                  scrollToLine={syncPreviewScrollEnabled ? cursorLine : null}
                  fullscreenPreview={fullscreenPreview}
                />
              </div>
            </div>
          </div>
        </div>
      </PreviewHTMLProvider>
    </ThemeProvider>
  );
}

export default App;

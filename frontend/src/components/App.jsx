import React, { useState, useEffect, useRef, useCallback } from "react";
import Header from "./Header";
import Toolbar from "./toolbar/Toolbar";
import Editor from "./Editor";
import Renderer from "./Renderer";
import LogLevelController from "./LogLevelController";
import IconBrowser from "./IconBrowser";
import { Modal } from "react-bootstrap";
import { ThemeProvider } from "../context/ThemeProvider";
import { useDocument } from "../context/DocumentProvider";
import { PreviewHTMLProvider } from "../context/PreviewHTMLContext";
import { useNotification } from "../components/NotificationProvider.jsx";

import { useAuth } from "../context/AuthContext";
import useAutoSave from "@/hooks/useAutoSave";

function App() {
  const { isAuthenticated, autosaveEnabled, setAutosaveEnabled, syncPreviewScrollEnabled, setSyncPreviewScrollEnabled } = useAuth();
  const { currentDocument, saveDocument } = useDocument();
  const { content, setContent } = useDocument();
  const [renderedHTML, setRenderedHTML] = useState("");
  const [cursorLine, setCursorLine] = useState(1);
  const [fullscreenPreview, setFullscreenPreview] = useState(false);
  const [showIconBrowser, setShowIconBrowser] = useState(false);
  const { showError, showSuccess } = useNotification();

  const runAutoSave = useCallback(async () => {
    try {
      await saveDocument(currentDocument, false); // Don't show notifications for auto-save
    } catch (error) {
      console.warn("Auto-save failed:", error);
    }
  }, [saveDocument, currentDocument]);

  useAutoSave(currentDocument, runAutoSave, autosaveEnabled);

  useEffect(() => {
    // Sync content with currentDocument after document load/change
    // Only update if document actually changed to prevent render loops
    if (currentDocument && currentDocument.content !== content) {
      setContent(currentDocument.content ?? "");
    }
  }, [currentDocument.id, currentDocument.content]);
  // Capture Ctrl+S to save current content
  // Register Ctrl+S handler only once, always using latest state via refs
  const contentRef = useRef(content);
  const currentDocumentRef = useRef(currentDocument);
  const saveDocumentRef = useRef(saveDocument);
  const isAuthenticatedRef = useRef(isAuthenticated);
  const showSuccessRef = useRef(showSuccess);
  const showErrorRef = useRef(showError);

  useEffect(() => { contentRef.current = content; }, [content]);
  useEffect(() => { currentDocumentRef.current = currentDocument; }, [currentDocument]);
  useEffect(() => { saveDocumentRef.current = saveDocument; }, [saveDocument]);
  useEffect(() => { isAuthenticatedRef.current = isAuthenticated; }, [isAuthenticated]);
  useEffect(() => { showSuccessRef.current = showSuccess; }, [showSuccess]);
  useEffect(() => { showErrorRef.current = showError; }, [showError]);

  useEffect(() => {
    const handleKeyDown = async (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        const content = contentRef.current;
        const currentDocument = currentDocumentRef.current;
        const saveDocument = saveDocumentRef.current;
        const isAuthenticated = isAuthenticatedRef.current;
        const showSuccess = showSuccessRef.current;
        const showError = showErrorRef.current;
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
  }, []);

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
              setShowIconBrowser={setShowIconBrowser}
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

        {/* Icon Browser Modal */}
        <Modal
          show={showIconBrowser}
          onHide={() => setShowIconBrowser(false)}
          size="xl"
          scrollable
          data-bs-theme={document.documentElement.getAttribute('data-bs-theme')}
        >
          <Modal.Header closeButton className="border-bottom">
            <Modal.Title>AWS Icon Browser</Modal.Title>
          </Modal.Header>
          <Modal.Body style={{ minHeight: '70vh' }} className="p-0">
            <IconBrowser />
          </Modal.Body>
        </Modal>
      </PreviewHTMLProvider>
      <LogLevelController />
    </ThemeProvider>
  );
}

export default App;

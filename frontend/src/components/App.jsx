import React, { useState, useEffect } from "react";
import Header from "./Header";
import Toolbar from "./toolbar/Toolbar";
import Editor from "./Editor";
import Renderer from "./Renderer";
import { ThemeProvider } from "../context/ThemeContext";
import ThemeEffects from "./ThemeEffects";
import { AuthProvider } from "../context/AuthProvider";

import { useDocument } from "../context/DocumentProvider";
import { PreviewHTMLProvider } from "../context/PreviewHTMLContext";

import UserAPI from "../js/api/userApi";
import { useAuth } from "../context/AuthProvider";
import { useNotification } from "./NotificationProvider.jsx";

function App() {
  const { isAuthenticated } = useAuth();
  const [autosaveEnabled, setAutosaveEnabled] = useState(() => {
    const saved = localStorage.getItem("autosaveEnabled");
    return saved === null ? true : saved === "true";
  });
  const [syncPreviewScrollEnabled, setSyncPreviewScrollEnabled] = useState(() => {
    const saved = localStorage.getItem("syncPreviewScrollEnabled");
    return saved === null ? true : saved === "true";
  });
  const { currentDocument, saveDocument } = useDocument();
  const [content, setContent] = useState(currentDocument?.content || "");
  const [renderedHTML, setRenderedHTML] = useState("");
  const [cursorLine, setCursorLine] = useState(1);
  const [fullscreenPreview, setFullscreenPreview] = useState(false);
  const notification = useNotification();

  // Load user profile settings on mount
  // Load user profile settings on mount
  useEffect(() => {
    async function fetchProfileSettings() {
      try {
        const user = await UserAPI.getCurrentUser();
        if (user && user.sync_preview_scroll_enabled !== undefined) {
          setSyncPreviewScrollEnabled(Boolean(user.sync_preview_scroll_enabled));
        }
        if (user && user.autosave_enabled !== undefined) {
          setAutosaveEnabled(Boolean(user.autosave_enabled));
        }
      } catch (e) {
        // fallback to localStorage
        console.error("Failed to fetch user profile settings:", e);
        notification?.showError("Failed to fetch user profile settings. Using local defaults.");
      }
    }
    fetchProfileSettings();
  }, []);

  useEffect(() => {
    localStorage.setItem("autosaveEnabled", autosaveEnabled);
    if (isAuthenticated) {
      UserAPI.updateProfileInfo({ autosave_enabled: autosaveEnabled });
    }
  }, [autosaveEnabled, isAuthenticated]);

  useEffect(() => {
    localStorage.setItem("syncPreviewScrollEnabled", syncPreviewScrollEnabled);
    if (isAuthenticated) {
      UserAPI.updateProfileInfo({ sync_preview_scroll_enabled: syncPreviewScrollEnabled });
    }
  }, [syncPreviewScrollEnabled, isAuthenticated]);

  useEffect(() => {
    // Always sync content with currentDocument after document load/change
    if (currentDocument && currentDocument.content !== content) {
      setContent(currentDocument.content ?? "");
    }
  }, [currentDocument]);
  return (
    <ThemeProvider>
      <ThemeEffects />
      <PreviewHTMLProvider>
        <div id="appRoot" className="app-root">
          <div id="container">
            <Header />
            <Toolbar
              autosaveEnabled={autosaveEnabled}
              setAutosaveEnabled={setAutosaveEnabled}
              syncPreviewScrollEnabled={syncPreviewScrollEnabled}
              setSyncPreviewScrollEnabled={setSyncPreviewScrollEnabled}
              setContent={setContent}
              editorValue={content}
              renderedHTML={renderedHTML}
              fullscreenPreview={fullscreenPreview}
              setFullscreenPreview={setFullscreenPreview}
            />
            <div id="main" className={fullscreenPreview ? "preview-full" : "split-view"}>
              {/* editor is always in the DOM, but width: 0 when closed */}
              <div className="editor-wrapper">
                <Editor
                  value={content}
                  onChange={setContent}
                  autosaveEnabled={autosaveEnabled}
                  currentDocument={currentDocument}
                  saveDocument={saveDocument}
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

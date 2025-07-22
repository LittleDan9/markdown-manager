import React, { useState, useEffect } from "react";
import Header from "./Header";
import Toolbar from "./toolbar/Toolbar";
import Editor from "./Editor";
import Renderer from "./Renderer";
import { ThemeProvider } from "../context/ThemeContext";
import ThemeEffects from "./ThemeEffects";
import { NotificationProvider } from "./NotificationProvider";
import { AuthProvider } from "../context/AuthProvider";

import { useDocument } from "../context/DocumentProvider";

import UserAPI from "../js/api/userApi";
import { useAuth } from "../context/AuthProvider";

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
        <NotificationProvider>
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
              />
              <div id="main">
                <Editor
                  value={content}
                  onChange={setContent}
                  autosaveEnabled={autosaveEnabled}
                  currentDocument={currentDocument}
                  saveDocument={saveDocument}
                  onCursorLineChange={setCursorLine}
                />
                <Renderer
                  content={content}
                  onRenderHTML={html => setRenderedHTML(html)}
                  scrollToLine={syncPreviewScrollEnabled ? cursorLine : null}
                />
              </div>
            </div>
          </div>
        </NotificationProvider>
    </ThemeProvider>
  );
}

export default App;

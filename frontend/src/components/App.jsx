import React, { useState, useEffect } from "react";
import Header from "./Header";
import Toolbar from "./toolbar/Toolbar";
import Editor from "./Editor";
import Renderer from "./Renderer";
import { ThemeProvider } from "../context/ThemeContext";
import ThemeEffects from "./ThemeEffects";
import { NotificationProvider } from "./NotificationProvider";
import { AuthProvider } from "../context/AuthProvider.jsx";

import { useDocument } from "../context/DocumentProvider";

function App() {
  const [autosaveEnabled, setAutosaveEnabled] = useState(() => {
    const saved = localStorage.getItem("autosaveEnabled");
    return saved === null ? true : saved === "true";
  });
  const { currentDocument, saveDocument } = useDocument();
  const [content, setContent] = useState(currentDocument?.content || "");
  const [renderedHTML, setRenderedHTML] = useState("");

  useEffect(() => {
    localStorage.setItem("autosaveEnabled", autosaveEnabled);
  }, [autosaveEnabled]);

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
                />
                <Renderer content={content} onRenderHTML={html => {
                  setRenderedHTML(html);
                }} />
              </div>
            </div>
          </div>
        </NotificationProvider>
    </ThemeProvider>
  );
}

export default App;

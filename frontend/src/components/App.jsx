import React, { useState, useEffect } from "react";
import Header from "./Header";
import Toolbar from "./toolbar/Toolbar";
import Editor from "./Editor";
import Renderer from "./Renderer";
import { ThemeProvider } from "../context/ThemeContext";
import ThemeEffects from "./ThemeEffects";
import { NotificationProvider } from "./NotificationProvider";
import { UserProvider } from "../context/UserContext";
import AuthInitializer from "./AuthInitializer";

import { useDocument } from "../context/DocumentProvider";

function App() {
  const [content, setContent] = useState("");
  const [autosaveEnabled, setAutosaveEnabled] = useState(true);
  const { currentDocument, saveDocument } = useDocument();
  useEffect(() => {
    setContent(currentDocument?.content || "");
  }, [currentDocument?.content]);
  return (
    <ThemeProvider>
      <UserProvider>
        <AuthInitializer />
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
              />
              <div id="main">
                <Editor
                  value={content}
                  onChange={setContent}
                  autosaveEnabled={autosaveEnabled}
                  currentDocument={currentDocument}
                  saveDocument={saveDocument}
                />
                <Renderer content={content} />
              </div>
            </div>
          </div>
        </NotificationProvider>
      </UserProvider>
    </ThemeProvider>
  );
}

export default App;

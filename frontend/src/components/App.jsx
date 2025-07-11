import React, { useState } from "react";
import Header from "./Header";
import Toolbar from "./toolbar/Toolbar";
import Editor from "./Editor";
import Renderer from "./Renderer";
import { ThemeProvider } from "../context/ThemeContext";
import ThemeEffects from "./ThemeEffects";
import { NotificationProvider } from "./NotificationProvider";

function App() {
  const [content, setContent] = useState("");
  return (
    <ThemeProvider>
      <ThemeEffects />
      <NotificationProvider>
        <div id="appRoot" className="app-root">
          <div id="container">
            <Header />
            <Toolbar />
            <div id="main">
              <Editor value={content} onChange={setContent} />
              <Renderer content={content} />
            </div>
          </div>
        </div>
      </NotificationProvider>
    </ThemeProvider>
  );
}

export default App;

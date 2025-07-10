import React from "react";
import Header from "./Header";
import Toolbar from "./toolbar/Toolbar";
import Editor from "./Editor";
import Renderer from "./Renderer";
import { ThemeProvider } from "../context/ThemeContext";
import ThemeEffects from "./ThemeEffects";
import { NotificationProvider } from "./NotificationProvider";

function App() {
  return (
    <ThemeProvider>
      <ThemeEffects />
      <NotificationProvider>
      <div>
        <Header />
        <Toolbar />
        <div id="container">
          <div id="main">
            <Editor />
            <Renderer />
          </div>
        </div>
      </div>
      </NotificationProvider>
    </ThemeProvider>
  );
}

export default App;

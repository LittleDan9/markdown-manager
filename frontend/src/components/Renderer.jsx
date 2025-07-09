import React, { useEffect } from "react";
import renderer from "../js/renderer";
import { useTheme } from "../context/ThemeContext";

function Renderer() {
  const { theme } = useTheme();
  useEffect( () => {
    async function themeMermaid() {
      await renderer.initMermaid(theme);
    }
    themeMermaid();
  }, [theme]);
  return (
    <div id="previewContainer">
        <div id="preview">
        <div className="preview-scroll"></div>
        </div>
    </div>
  );
}

export default Renderer;
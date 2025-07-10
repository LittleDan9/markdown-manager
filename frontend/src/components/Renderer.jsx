import React, { useEffect, useState, useRef } from "react";
import { renderMarkdownToHtml } from "../js/renderer";
import { useTheme } from "../context/ThemeContext";
import { setPrismTheme } from "../js/prismTheme";

function Renderer({ content }) {
  const { theme } = useTheme();
  const [html, setHtml] = useState("");
  const prevHtmlRef = useRef("");

  useEffect(() => {
    const updateHtml = async () => {
      const renderedHtml = await renderMarkdownToHtml(prevHtmlRef.current, content, theme);
      setHtml(renderedHtml);
      prevHtmlRef.current = content;
    };
    updateHtml();
  }, [content, theme]);
  return (
    <div id="previewContainer">
      <div id="preview">
        <div className="preview-scroll" dangerouslySetInnerHTML={{ __html: html }}></div>
      </div>
    </div>
  );
}

export default Renderer;

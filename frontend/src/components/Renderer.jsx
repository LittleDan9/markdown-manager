import React, { useEffect, useState, useRef } from "react";
import { render } from "../js/renderer";
import { useTheme } from "../context/ThemeContext";
import MermaidService from "../js/MermaidService";
import HighlightService from "../js/HighlightService";

function Renderer({ content }) {
  const { theme } = useTheme();
  const [html, setHtml] = useState("");
  const prevHtmlRef = useRef("");
  const previewRef = useRef(null);

  // Render Markdown to HTML
  useEffect(() => {
    setHtml(render(content));
    prevHtmlRef.current = content;
  }, [content]);

  // Process any new mermaid diagrams
  useEffect(() => {
    if (previewRef.current && previewRef.current.querySelectorAll("[data-mermaid-source][data-processed='false']").length > 0) {
      MermaidService.render(previewRef.current);
    }
  }, [html]);

  useEffect(() => {
    MermaidService.updateTheme(theme);
    MermaidService.render(previewRef.current);
  }, [theme]);

  useEffect(() => {
    if (previewRef.current && previewRef.current.querySelectorAll("[data-syntax-placeholder][data-processed='false']").length > 0) {
      HighlightService.highlight(previewRef.current);
    }
  }, [html]);
  return (
    <div id="previewContainer">
      <div id="preview" ref={previewRef}>
        <div className="preview-scroll" dangerouslySetInnerHTML={{ __html: html }}></div>
      </div>
    </div>
  );
}

export default Renderer;

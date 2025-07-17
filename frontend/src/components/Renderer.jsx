import React, { useEffect, useState, useRef, useInsertionEffect } from "react";
import { render } from "../js/renderer";
import { useTheme } from "../context/ThemeContext";
import MermaidService from "../js/services/MermaidService";
import HighlightService from "../js/services/HighlightService";

function Renderer({ content }) {
  const { theme } = useTheme();
  const [html, setHtml] = useState("");
  const prevHtmlRef = useRef("");
  const previewRef = useRef(null);
  const [mermaidProcessed, setMermaidProcessed] = useState(false);

  // Render Markdown to HTML
  useEffect(() => {
    setHtml(render(content));
    prevHtmlRef.current = content;
    setMermaidProcessed(false);
  }, [content]);

  // Process any new mermaid diagrams
  useEffect(() => {
    if (previewRef.current && previewRef.current.querySelectorAll("[data-mermaid-source][data-processed='false']").length > 0) {
      MermaidService.render(previewRef.current).then(() => {
        setMermaidProcessed(true);
      });
    }
  }, [html]);

  useEffect(() => {
    if (previewRef.current && mermaidProcessed) {
      setHtml(render(content));
    }
  }, [mermaidProcessed]);

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

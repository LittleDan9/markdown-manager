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
    if (previewRef.current) {
      // Find Existing Mermaid Diagrams in Previous Content
      const existingMermaidDiagrams = new Map();
      const existingMermaidElements = previewRef.current.querySelectorAll(".mermaid[data-mermaid-source]")
      existingMermaidElements.forEach((el) => {
        const source = decodeURIComponent(el.dataset.mermaidSource || "");
        if (source && el.querySelector("svg")) {
          existingMermaidDiagrams.set(source, el.innerHTML);
        }
      });
      const updateMermaids = async () => {
        await MermaidService.renderDiagrams(
          previewRef.current,
          theme,
          existingMermaidDiagrams,
          true, // Initial render
          false, // Don't force render
        );
      };
      updateMermaids();
    }
  }, [html, theme]);

  useEffect(() => {
    if (previewRef.current) {
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

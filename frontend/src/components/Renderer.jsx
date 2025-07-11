import React, { useEffect, useState, useRef } from "react";
import { renderMarkdownToHtml } from "../js/renderer";
import { useTheme } from "../context/ThemeContext";
import { setPrismTheme } from "../js/prismTheme";
import mermaidManager from "../js/MermaidManager";

function Renderer({ content }) {
  const { theme } = useTheme();
  const [html, setHtml] = useState("");
  const prevHtmlRef = useRef("");
  const previewRef = useRef(null);

  useEffect(() => {
    const updateHtml = async () => {
      const renderedHtml = await renderMarkdownToHtml(prevHtmlRef.current, content);
      setHtml(renderedHtml);
      prevHtmlRef.current = content;
    };
    updateHtml();
  }, [content]);

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
        await mermaidManager.updateTheme(theme);
        await mermaidManager.renderDiagrams(
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
  return (
    <div id="previewContainer">
      <div id="preview" ref={previewRef}>
        <div className="preview-scroll" dangerouslySetInnerHTML={{ __html: html }}></div>
      </div>
    </div>
  );
}

export default Renderer;

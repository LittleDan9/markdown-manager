import React, { useEffect, useState, useRef, useInsertionEffect } from "react";
import { render } from "../js/renderer";
import { useTheme } from "../context/ThemeContext";
import MermaidService from "../js/services/MermaidService";
import HighlightService from "../js/services/HighlightService";

function Renderer({ content, onRenderHTML }) {
  const { theme } = useTheme();
  const [html, setHtml] = useState("");
  const prevHtmlRef = useRef("");
  const previewRef = useRef(null);
  const [mermaidProcessed, setMermaidProcessed] = useState(false);

  // Render Markdown to HTML
  useEffect(() => {
    const htmlString = render(content);
    console.log('[Renderer] Generated HTML:', htmlString);
    setHtml(htmlString);
    prevHtmlRef.current = content;
    setMermaidProcessed(false);
    // Do NOT call onRenderHTML here; wait for Mermaid rendering below
  }, [content]);

  // Process any new mermaid diagrams
  useEffect(() => {
    if (previewRef.current && previewRef.current.querySelectorAll("[data-mermaid-source][data-processed='false']").length > 0) {
      MermaidService.render(previewRef.current, theme).then(() => {
        setMermaidProcessed(true);
        if (typeof onRenderHTML === "function") {
          // Get updated HTML from DOM after Mermaid renders
          const updatedHTML = previewRef.current.innerHTML;
          onRenderHTML(updatedHTML);
          console.log('[Renderer] onRenderHTML called after Mermaid with updated HTML:', updatedHTML);
        }
      });
    } else if (typeof onRenderHTML === "function" && previewRef.current) {
      // If no Mermaid diagrams, call onRenderHTML with initial HTML
      onRenderHTML(previewRef.current.innerHTML);
      console.log('[Renderer] onRenderHTML called with initial HTML (no Mermaid):', previewRef.current.innerHTML);
    }
  }, [html, theme]);

  useEffect(() => {
    if (previewRef.current && mermaidProcessed) {
      setHtml(render(content));
    }
  }, [mermaidProcessed]);

  useEffect(() => {
    if (previewRef.current && previewRef.current.querySelectorAll("[data-syntax-placeholder][data-processed='false']").length > 0) {
      HighlightService.highlight(previewRef.current);
      if (typeof onRenderHTML === "function") {
        onRenderHTML(html);
        console.log('[Renderer] onRenderHTML called after Highlight with:', html);
      }
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

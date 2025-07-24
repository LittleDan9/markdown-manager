import React, { useEffect, useState, useRef } from "react";
import { render } from "../js/renderer";
import { useTheme } from "../context/ThemeContext";
import { useDocument } from "../context/DocumentProvider";
import HighlightService from "../js/services/HighlightService";
import MermaidService from "../js/services/MermaidService";
import { usePreviewHTML } from "../context/PreviewHTMLContext";


function Renderer({ content, scrollToLine, fullscreenPreview }) {
  const { theme } = useTheme();
  const { highlightedBlocks, setHighlightedBlocks } = useDocument();
  const [html, setHtml] = useState("");
  const prevHtmlRef = useRef("");
  const previewRef = useRef(null);
  const { setPreviewHTML } = usePreviewHTML();


  // Render Markdown to HTML, replacing code blocks with highlighted HTML from context if available
  // Stable hash function for placeholderId
  function hashCode(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i);
    }
    return hash >>> 0;
  }

  useEffect(() => {
    let htmlString = render(content);
    // Replace code blocks with highlighted HTML if available
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = htmlString;
    const codeBlocks = Array.from(tempDiv.querySelectorAll("[data-syntax-placeholder]"));
    const blocksToHighlight = [];
    codeBlocks.forEach(block => {
      const code = decodeURIComponent(block.dataset.code);
      const language = block.dataset.lang;
      // Generate stable placeholderId
      const placeholderId = `syntax-highlight-${HighlightService.hashCode(language + code)}`;
      block.setAttribute("data-syntax-placeholder", placeholderId);
      if (highlightedBlocks[placeholderId]) {
        const codeEl = block.querySelector("code");
        if (codeEl) {
          codeEl.innerHTML = highlightedBlocks[placeholderId];
          block.setAttribute("data-processed", "true");
        }
      } else {
        block.setAttribute("data-processed", "false");
        blocksToHighlight.push({ code, language, placeholderId });
      }
    });
    htmlString = tempDiv.innerHTML;
    setHtml(htmlString);
    prevHtmlRef.current = content;
    // Trigger highlight for unprocessed blocks
    if (blocksToHighlight.length > 0) {
      HighlightService.highlightBlocks(blocksToHighlight).then(results => {
        // Only update if there are new highlights
        const newHighlights = {};
        Object.entries(results).forEach(([id, html]) => {
          if (!highlightedBlocks[id]) {
            newHighlights[id] = html;
          }
        });
        if (Object.keys(newHighlights).length > 0) {
          setHighlightedBlocks(prev => ({ ...prev, ...newHighlights }));
        }
      });
    }
    // Do NOT call onRenderHTML here; wait for Mermaid rendering below
  }, [content, highlightedBlocks]);

  // Scroll to line if requested without highlight effect
  useEffect(() => {
    if (scrollToLine && previewRef.current) {
      const el = previewRef.current.querySelector(`[data-line='${scrollToLine}']`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [scrollToLine, html]);
  // Process any new mermaid diagrams when html changes
  useEffect(() => {
    if (previewRef.current) {
      const unprocessedBlocks = previewRef.current.querySelectorAll("[data-mermaid-source][data-processed='false']");
      if (unprocessedBlocks.length > 0) {
        MermaidService.render(previewRef.current, theme).then(() => {
            setPreviewHTML(previewRef.current.innerHTML);
        });
      } else {
        setPreviewHTML(previewRef.current.innerHTML);
      }
    }
  }, [html]);

  // On theme change, force all diagrams to be reprocessed and rerendered
  useEffect(() => {
    if (previewRef.current) {
      const allBlocks = previewRef.current.querySelectorAll("[data-mermaid-source]");
      allBlocks.forEach(block => {
        block.setAttribute("data-processed", "false");
      });
      MermaidService.render(previewRef.current, theme).then(() => {
        setPreviewHTML(previewRef.current.innerHTML);
      });

    }
  }, [theme]);

  // ...existing code...
  return (
    <div id="previewContainer" className={fullscreenPreview ? "fullscreen-preview" : ""}>
      <div id="preview" ref={previewRef}>
        <div className="preview-scroll" dangerouslySetInnerHTML={{ __html: html }}></div>
      </div>
    </div>
  );
}

export default Renderer;

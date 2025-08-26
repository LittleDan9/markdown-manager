import React, { useEffect, useState, useRef } from "react";
import { render } from "@/services/rendering";
import { useTheme } from "@/providers/ThemeProvider";
import { useDocumentContext } from "@/providers/DocumentContextProvider.jsx";
import { HighlightService } from "@/services/editor";
import { MermaidService } from "@/services/rendering";
// import { usePreviewHTML } from "@/providers/PreviewHTMLProvider";
import mermaid from "mermaid";


function Renderer({ content, scrollToLine, fullscreenPreview }) {
  const { theme } = useTheme();
  const { highlightedBlocks, setHighlightedBlocks } = useDocumentContext();
  const [html, setHtml] = useState("");
  const previewScrollRef = useRef(null);
  const { previewHTML, setPreviewHTML } = useDocumentContext();
  const mermaidRendering = useRef(false);


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
    // Trigger highlight for unprocessed blocks
    if (blocksToHighlight.length > 0) {
      HighlightService.highlightBlocks(blocksToHighlight).then(results => {
        blocksToHighlight.forEach(({ placeholderId }) => {
          const block = tempDiv.querySelector(`[data-syntax-placeholder="${placeholderId}"]`);
          if (block && results[placeholderId]) {
            block.querySelector("code").innerHTML = results[placeholderId];
            block.setAttribute("data-processed", "true");
          }
        });
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
        htmlString = tempDiv.innerHTML;
        setHtml(htmlString);
      });
    } else {
      htmlString = tempDiv.innerHTML;
      setHtml(htmlString);
    }
    // Do NOT call onRenderHTML here; wait for Mermaid rendering below
  }, [content, highlightedBlocks]);

  // Scroll to line if requested without highlight effect
  useEffect(() => {
    if (scrollToLine && previewScrollRef.current) {
      const el = previewScrollRef.current.querySelector(`[data-line='${scrollToLine}']`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [scrollToLine, html]);
  // Process any new mermaid diagrams when html changes
  useEffect(() => {
    if (mermaidRendering.current) return; // Skip if already rendering

    if (html && html.includes("data-mermaid-source")) {
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = html;
      
      if (theme !== MermaidService.getTheme()) {
        // Process Mermaid diagrams
        const allBlocks = tempDiv.querySelectorAll("[data-mermaid-source]");
        allBlocks.forEach(block => {
          block.setAttribute("data-processed", "false");
        });
      }
      
      const unprocessedBlocks = tempDiv.querySelectorAll("[data-mermaid-source][data-processed='false']");
      if (unprocessedBlocks.length > 0) {
        mermaidRendering.current = true;
        
        MermaidService.render(tempDiv.innerHTML, theme).then((updatedHtml) => {
          mermaidRendering.current = false;
          setPreviewHTML(updatedHtml);
        }).catch((error) => {
          console.error("Mermaid rendering failed:", error);
          mermaidRendering.current = false;
          setPreviewHTML(tempDiv.innerHTML); // Show without mermaid rendering
        });
      } else {
        setPreviewHTML(tempDiv.innerHTML);
      }
    } else {
      setPreviewHTML(html);
    }
  }, [html, theme]);

  return (
    <div id="previewContainer" className={fullscreenPreview ? "fullscreen-preview" : ""}>
      <div id="preview">
        <div className="preview-scroll" ref={previewScrollRef} dangerouslySetInnerHTML={{ __html: previewHTML }}></div>
      </div>
    </div>
  );
}

export default Renderer;

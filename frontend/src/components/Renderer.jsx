import React, { useEffect, useState, useRef } from "react";
import { render } from "@/services/rendering";
import { useTheme } from "@/providers/ThemeProvider";
import { useDocumentContext } from "@/providers/DocumentContextProvider.jsx";
import { HighlightService } from "@/services/editor";
import { MermaidService } from "@/services/rendering";
// import { usePreviewHTML } from "@/providers/PreviewHTMLProvider";
import mermaid from "mermaid";


function Renderer({ content, scrollToLine, fullscreenPreview, onFirstRender }) {
  const { theme } = useTheme();
  const { highlightedBlocks, setHighlightedBlocks } = useDocumentContext();
  const [html, setHtml] = useState("");
  const previewScrollRef = useRef(null);
  const { previewHTML, setPreviewHTML } = useDocumentContext();
  const mermaidRendering = useRef(false);
  const hasCalledFirstRender = useRef(false);
  const [isRendering, setIsRendering] = useState(false);

  // Render Markdown to HTML, replacing code blocks with highlighted HTML from context if available
  function hashCode(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i);
    }
    return hash >>> 0;
  }

  useEffect(() => {
    setIsRendering(true);
    let htmlString = render(content);
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = htmlString;
    const codeBlocks = Array.from(tempDiv.querySelectorAll("[data-syntax-placeholder]"));
    const blocksToHighlight = [];
    codeBlocks.forEach(block => {
      const code = decodeURIComponent(block.dataset.code);
      const language = block.dataset.lang;
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
    if (blocksToHighlight.length > 0) {
      HighlightService.highlightBlocks(blocksToHighlight).then(results => {
        blocksToHighlight.forEach(({ placeholderId }) => {
          const block = tempDiv.querySelector(`[data-syntax-placeholder="${placeholderId}"]`);
          if (block && results[placeholderId]) {
            block.querySelector("code").innerHTML = results[placeholderId];
            block.setAttribute("data-processed", "true");
          }
        });
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
      }).catch(error => {
        console.error("Syntax highlighting failed:", error);
        htmlString = tempDiv.innerHTML;
        setHtml(htmlString);
      });
    } else {
      htmlString = tempDiv.innerHTML;
      setHtml(htmlString);
    }
  }, [content, highlightedBlocks]);

  useEffect(() => {
    if (scrollToLine && previewScrollRef.current) {
      const el = previewScrollRef.current.querySelector(`[data-line='${scrollToLine}']`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [scrollToLine, html]);

  useEffect(() => {
    if (mermaidRendering.current) return;

    if (html && html.includes("data-mermaid-source")) {
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = html;
      if (theme !== MermaidService.getTheme()) {
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
          setIsRendering(false);
        }).catch((error) => {
          console.error("Mermaid rendering failed:", error);
          mermaidRendering.current = false;
          setPreviewHTML(tempDiv.innerHTML);
          setIsRendering(false);
        });
      } else {
        setPreviewHTML(tempDiv.innerHTML);
        setIsRendering(false);
      }
    } else {
      setPreviewHTML(html);
      setIsRendering(false);
    }
  }, [html, theme]);

  // Call onFirstRender when rendering is complete
  useEffect(() => {
    if (onFirstRender && !isRendering && previewHTML && !hasCalledFirstRender.current) {
      hasCalledFirstRender.current = true;
      onFirstRender();
    }
  }, [onFirstRender, isRendering, previewHTML]);

  return (
    <div id="previewContainer" className={fullscreenPreview ? "fullscreen-preview" : ""}>
      <div id="preview">
        <div className="preview-scroll" ref={previewScrollRef} dangerouslySetInnerHTML={{ __html: previewHTML }}></div>
      </div>
    </div>
  );
}

export default Renderer;

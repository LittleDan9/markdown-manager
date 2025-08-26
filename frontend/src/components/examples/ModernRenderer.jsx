import React, { useEffect, useState, useRef } from "react";
import { render } from "@/services/rendering";
import { useTheme } from "@/providers/ThemeProvider";
import { useDocumentContext } from "@/providers/DocumentContextProvider.jsx";
import { HighlightService } from "@/services/editor";
import { useMermaid } from "@/services/rendering";

/**
 * Modern Renderer component using the new useMermaid hook architecture
 *
 * This component renders markdown content with syntax highlighting and Mermaid diagrams
 * using the new modular architecture for better performance and maintainability.
 *
 * Benefits over the legacy approach:
 * - Cleaner state management with React hooks
 * - Automatic loading states and theme management
 * - Better error handling and user feedback
 * - No manual ref management for rendering state
 * - Optimized Mermaid diagram rendering
 */
function Renderer({ content, scrollToLine, fullscreenPreview, onFirstRender }) {
  const { theme } = useTheme();
  const { highlightedBlocks, setHighlightedBlocks, previewHTML, setPreviewHTML } = useDocumentContext();
  const [html, setHtml] = useState("");
  const previewScrollRef = useRef(null);
  const hasCalledFirstRender = useRef(false);

  // Use the new Mermaid hook - much cleaner than manual state management!
  const {
    renderDiagrams,
    updateTheme,
    isLoading: isMermaidLoading,
    currentTheme: mermaidTheme
  } = useMermaid(theme);

  // Automatic theme updates - no manual checking needed
  useEffect(() => {
    if (theme !== mermaidTheme) {
      updateTheme(theme);
    }
  }, [theme, mermaidTheme, updateTheme]);

  // Render Markdown to HTML (same as before)
  useEffect(() => {
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

  // Handle Mermaid rendering - much cleaner with the hook!
  useEffect(() => {
    if (!html) return;

    const processMermaidDiagrams = async () => {
      if (html.includes("data-mermaid-source")) {
        try {
          const updatedHtml = await renderDiagrams(html, theme);
          setPreviewHTML(updatedHtml);
        } catch (error) {
          console.error("Mermaid rendering failed:", error);
          setPreviewHTML(html);
        }
      } else {
        setPreviewHTML(html);
      }
    };

    processMermaidDiagrams();
  }, [html, theme, renderDiagrams]);

  // Scroll to line functionality
  useEffect(() => {
    if (scrollToLine && previewScrollRef.current) {
      const el = previewScrollRef.current.querySelector(`[data-line='${scrollToLine}']`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [scrollToLine, previewHTML]);

  // Call onFirstRender when ready
  useEffect(() => {
    if (onFirstRender && !isMermaidLoading && previewHTML && !hasCalledFirstRender.current) {
      hasCalledFirstRender.current = true;
      onFirstRender();
    }
  }, [onFirstRender, isMermaidLoading, previewHTML]);

  return (
    <div id="previewContainer" className={fullscreenPreview ? "fullscreen-preview" : ""}>
      <div id="preview">
        {/* Optional loading indicator for Mermaid diagrams */}
        {isMermaidLoading && (
          <div className="mermaid-loading-indicator">
            <small className="text-muted">Rendering diagrams...</small>
          </div>
        )}
        <div
          className="preview-scroll"
          ref={previewScrollRef}
          dangerouslySetInnerHTML={{ __html: previewHTML }}
        />
      </div>
    </div>
  );
}

export default Renderer;

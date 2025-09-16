import React, { useEffect, useState, useRef } from "react";
import { render } from "@/services/rendering";
import { useTheme } from "@/providers/ThemeProvider";
import { useDocumentContext } from "@/providers/DocumentContextProvider.jsx";
import { HighlightService } from "@/services/editor";
import { useMermaid } from "@/services/rendering";
import { useCodeCopy } from "@/hooks/ui/useCodeCopy";

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
function Renderer({ content, scrollToLine, fullscreenPreview, onFirstRender, showLoadingOverlay, loadingMessage }) {
  const { theme } = useTheme();
  const { highlightedBlocks, setHighlightedBlocks, previewHTML, setPreviewHTML } = useDocumentContext();
  const [html, setHtml] = useState("");
  const [isRendering, setIsRendering] = useState(false);
  const previewScrollRef = useRef(null);
  const hasCalledFirstRender = useRef(false);

  // Setup copy functionality for code blocks
  const setCodeCopyRef = useCodeCopy(previewHTML, true);

  // Use the new Mermaid hook - much cleaner than manual state management!
  const {
    renderDiagrams,
    updateTheme,
    currentTheme: mermaidTheme
  } = useMermaid(theme);

  // Automatic theme updates - no manual checking needed
  useEffect(() => {
    if (theme !== mermaidTheme) {
      updateTheme(theme);
    }
  }, [theme, mermaidTheme, updateTheme]);

  // Render Markdown to HTML (only when content changes)
  useEffect(() => {
    setIsRendering(true);
    // Reset the first render flag when content changes
    hasCalledFirstRender.current = false;

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

      // Use current highlighted blocks (from closure)
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
        // Re-process the HTML with new highlights
        const updatedTempDiv = document.createElement("div");
        updatedTempDiv.innerHTML = render(content);
        const updatedCodeBlocks = Array.from(updatedTempDiv.querySelectorAll("[data-syntax-placeholder]"));
        
        updatedCodeBlocks.forEach(block => {
          const code = decodeURIComponent(block.dataset.code);
          const language = block.dataset.lang;
          const placeholderId = `syntax-highlight-${HighlightService.hashCode(language + code)}`;
          block.setAttribute("data-syntax-placeholder", placeholderId);
          
          // Apply both existing and new highlights
          const highlightedHtml = results[placeholderId] || highlightedBlocks[placeholderId];
          if (highlightedHtml) {
            const codeEl = block.querySelector("code");
            if (codeEl) {
              codeEl.innerHTML = highlightedHtml;
              block.setAttribute("data-processed", "true");
            }
          }
        });

        // Update highlighted blocks state with new highlights only
        const newHighlights = {};
        Object.entries(results).forEach(([id, html]) => {
          if (!highlightedBlocks[id]) {
            newHighlights[id] = html;
          }
        });

        if (Object.keys(newHighlights).length > 0) {
          setHighlightedBlocks(prev => ({ ...prev, ...newHighlights }));
        }

        htmlString = updatedTempDiv.innerHTML;
        setHtml(htmlString);
        // isRendering will be handled by Mermaid effect
      }).catch(error => {
        console.error("Syntax highlighting failed:", error);
        htmlString = tempDiv.innerHTML;
        setHtml(htmlString);
        // isRendering will be handled by Mermaid effect
      });
    } else {
      htmlString = tempDiv.innerHTML;
      setHtml(htmlString);
      // isRendering will be handled by Mermaid effect
    }
  }, [content]); // Only depend on content, not highlightedBlocks

  // Handle Mermaid rendering - much cleaner with the hook!
  useEffect(() => {
    if (!html) return;

    const processMermaidDiagrams = async () => {
      // Don't set isRendering here as it's already set by the markdown effect
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
      // Always set rendering to false when done (whether Mermaid or not)
      setIsRendering(false);
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
    console.log("onFirstRender check:", {
      hasCallback: !!onFirstRender,
      isRendering,
      hasPreviewHTML: !!previewHTML,
      hasCalledBefore: hasCalledFirstRender.current
    });

    if (onFirstRender && !isRendering && previewHTML && !hasCalledFirstRender.current) {
      console.log("Calling onFirstRender");
      hasCalledFirstRender.current = true;
      onFirstRender();
    }
  }, [onFirstRender, isRendering, previewHTML]);

  return (
    <div id="previewContainer" className={fullscreenPreview ? "fullscreen-preview" : ""}>
      <div id="preview" className="position-relative">
        <div
          className="preview-scroll"
          ref={(element) => {
            previewScrollRef.current = element;
            setCodeCopyRef(element);
          }}
          dangerouslySetInnerHTML={{ __html: previewHTML }}
        />
        {showLoadingOverlay && (
          <div
            className="position-absolute top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center bg-body bg-opacity-90"
            style={{ zIndex: 10, borderRadius: '0.5rem' }}
          >
            <div className="text-center">
              <div className="spinner-border text-primary mb-3" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <div>
                <small className="text-muted">{loadingMessage || "Loading..."}</small>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Renderer;

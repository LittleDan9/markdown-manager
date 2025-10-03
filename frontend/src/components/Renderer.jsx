import React, { useEffect, useState, useRef } from "react";
import ReactDOM from "react-dom/client";
import { render } from "@/services/rendering";
import { useTheme, ThemeProvider } from "@/providers/ThemeProvider";
import { useDocumentContext } from "@/providers/DocumentContextProvider.jsx";
import { HighlightService } from "@/services/editor";
import { useMermaid } from "@/services/rendering";
import { useCodeCopy } from "@/hooks/ui/useCodeCopy";
import { NotificationProvider } from "./NotificationProvider";
import DiagramControls from "./renderer/DiagramControls";

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
  const { highlightedBlocks, setHighlightedBlocks, previewHTML, setPreviewHTML, currentDocument } = useDocumentContext();
  const [html, setHtml] = useState("");
  const [isRendering, setIsRendering] = useState(false);
  const previewScrollRef = useRef(null);
  const hasCalledFirstRender = useRef(false);
  const diagramControlsRefs = useRef(new Map());

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

  // Reset render flag when document changes (even if content is the same)
  useEffect(() => {
    hasCalledFirstRender.current = false;
  }, [currentDocument?.id]);

  /**
   * Add diagram controls to rendered Mermaid diagrams
   * Only adds controls to NEW diagrams that don't already have them
   * @param {HTMLElement} previewElement - The preview container element
   */
  const addDiagramControls = (previewElement) => {
    if (!previewElement) return;

    // Find all processed Mermaid diagrams
    const diagrams = previewElement.querySelectorAll('.mermaid[data-processed="true"]');

    diagrams.forEach((diagram, index) => {
      const diagramId = `diagram-${index}`;

      // Skip if controls already added and still in DOM
      const existingControls = diagram.querySelector('.diagram-controls-container');
      if (existingControls && existingControls.isConnected) return;

      // Get diagram source from data attribute
      const encodedSource = diagram.getAttribute('data-mermaid-source') || '';
      const diagramSource = encodedSource ? decodeURIComponent(encodedSource) : '';

      // Add mermaid-container class if not present
      if (!diagram.classList.contains('mermaid-container')) {
        diagram.classList.add('mermaid-container');
      }

      // Remove any orphaned controls first
      const orphanedControls = diagram.querySelectorAll('.diagram-controls-container');
      orphanedControls.forEach(control => control.remove());

      // Create a container for the controls
      const controlsContainer = document.createElement('div');
      controlsContainer.className = 'diagram-controls-container';
      controlsContainer.style.position = 'absolute';
      controlsContainer.style.top = '0';
      controlsContainer.style.left = '0';
      controlsContainer.style.width = '100%';
      controlsContainer.style.height = '100%';
      controlsContainer.style.pointerEvents = 'none'; // Allow clicks to pass through to diagram
      diagram.appendChild(controlsContainer);

      // Create React root and render controls with providers
      const root = ReactDOM.createRoot(controlsContainer);
      root.render(
        <ThemeProvider>
          <DiagramControls
            diagramElement={diagram}
            diagramId={diagramId}
            diagramSource={diagramSource}
          />
        </ThemeProvider>
      );

      // Store the root for cleanup
      diagramControlsRefs.current.set(diagram, root);
    });
  };

  /**
   * Clean up diagram controls that are no longer in the DOM
   * Uses asynchronous cleanup to avoid React race conditions
   */
  const cleanupStaleControls = () => {
    const validDiagrams = new Set();
    if (previewScrollRef.current) {
      const currentDiagrams = previewScrollRef.current.querySelectorAll('.mermaid[data-processed="true"]');
      currentDiagrams.forEach(diagram => validDiagrams.add(diagram));
    }

    // Async cleanup to avoid race conditions
    setTimeout(() => {
      diagramControlsRefs.current.forEach((root, diagram) => {
        if (!validDiagrams.has(diagram)) {
          try {
            root.unmount();
            diagramControlsRefs.current.delete(diagram);
          } catch (error) {
            console.warn('Error unmounting stale diagram controls:', error);
          }
        }
      });
    }, 0);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Use async cleanup on unmount to avoid race conditions
      setTimeout(() => {
        diagramControlsRefs.current.forEach((root, diagram) => {
          try {
            root.unmount();
          } catch (error) {
            console.warn('Error unmounting diagram controls on cleanup:', error);
          }
        });
        diagramControlsRefs.current.clear();
      }, 0);
    };
  }, []);

  // Render Markdown to HTML (when content changes or component mounts)
  useEffect(() => {
    setIsRendering(true);
    // Reset the first render flag when content changes or document changes
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
  }, [content, currentDocument?.id]); // Depend on content AND document ID to handle document changes

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

  // Add diagram controls after preview HTML is updated
  useEffect(() => {
    if (previewHTML && previewScrollRef.current && !isRendering) {
      // Clean up stale controls (async to avoid race conditions)
      cleanupStaleControls();

      // Add controls to new diagrams (with small delay to ensure DOM is updated)
      setTimeout(() => {
        if (previewScrollRef.current) {
          addDiagramControls(previewScrollRef.current);
        }
      }, 150); // Increased timeout slightly for better stability
    }
  }, [previewHTML, isRendering]);

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

  // Listen for diagram export completion events to ensure controls remain visible
  useEffect(() => {
    const handleExportComplete = (event) => {
      console.log('Diagram export completed:', event.detail);

      // Re-validate diagram controls after export to ensure they remain visible
      if (previewScrollRef.current && !isRendering) {
        setTimeout(() => {
          // Check if controls are still present for all diagrams
          const diagrams = previewScrollRef.current.querySelectorAll('.mermaid[data-processed="true"]');
          let needsRevalidation = false;

          diagrams.forEach((diagram) => {
            const existingControls = diagram.querySelector('.diagram-controls-container');
            if (!existingControls || !existingControls.isConnected) {
              needsRevalidation = true;
            }
          });

          if (needsRevalidation) {
            console.log('Re-adding diagram controls after export');
            addDiagramControls(previewScrollRef.current);
          }
        }, 100); // Small delay to ensure export process is fully complete
      }
    };

    window.addEventListener('diagramExportComplete', handleExportComplete);

    return () => {
      window.removeEventListener('diagramExportComplete', handleExportComplete);
    };
  }, [previewHTML, isRendering]);

  // Defensive mechanism: Periodically check if diagram controls are missing and restore them
  useEffect(() => {
    if (!previewHTML || isRendering) return;

    const checkAndRestoreControls = () => {
      if (!previewScrollRef.current) return;

      const diagrams = previewScrollRef.current.querySelectorAll('.mermaid[data-processed="true"]');
      let missingControls = false;

      diagrams.forEach((diagram) => {
        const existingControls = diagram.querySelector('.diagram-controls-container');
        if (!existingControls || !existingControls.isConnected) {
          missingControls = true;
        }
      });

      if (missingControls && diagrams.length > 0) {
        console.log('Detected missing diagram controls, restoring...');
        addDiagramControls(previewScrollRef.current);
      }
    };

    // Check every 10 seconds for missing controls
    const interval = setInterval(checkAndRestoreControls, 10000);

    return () => {
      clearInterval(interval);
    };
  }, [previewHTML, isRendering]);

  return (
    <div id="previewContainer">
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

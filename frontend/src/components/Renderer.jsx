/**
 * Modern Renderer component - Refactored for maintainability
 *
 * This is the simplified main orchestrator that coordinates the specialized
 * sub-components for a clean, maintainable architecture.
 */
import React, { useEffect, useCallback } from 'react';
import { useTheme } from '../providers/ThemeProvider';
import { useDocumentContext } from '../providers/DocumentContextProvider';
import { useMermaid } from '../services/rendering/mermaid/useMermaid';
import { useCodeCopy } from '../hooks/ui/useCodeCopy';
import RendererProvider, { useRendererContext } from './renderer/RendererContext';
import RenderingOrchestrator from './renderer/RenderingOrchestrator';
import FeatureManager from './renderer/FeatureManager';
import LifecycleManager from './renderer/LifecycleManager';
import PreviewRenderer from './renderer/PreviewRenderer';

const RendererContent = ({
  scrollToLine,
  fullscreenPreview: _fullscreenPreview,
  onFirstRender,
  showLoadingOverlay,
  loadingMessage
}) => {
  const { theme: _theme } = useTheme();
  const { currentDocument, previewHTML, setPreviewHTML, isRendering: _isRendering } = useDocumentContext();
  const {
    html: _html,
    setIsRendering: _setIsRendering,
    previewScrollRef,
    resetFirstRenderFlag,
    isCropModeActive: _isCropModeActive
  } = useRendererContext();  // Setup copy functionality for code blocks
  const setCodeCopyRef = useCodeCopy(previewHTML, true);

  // Use the Mermaid hook for diagram rendering
  const {
    renderDiagrams,
    updateTheme,
    currentTheme: mermaidTheme
  } = useMermaid(_theme);

  // Setup global image modal function (fallback for external images)
  useEffect(() => {
    window.openImageModal = (imageElement) => {
      // This could be handled by ImageManager in the future
      console.log('Global image modal triggered for:', imageElement.src);
    };

    return () => {
      delete window.openImageModal;
    };
  }, []);

  // Automatic theme updates for Mermaid
  useEffect(() => {
    if (_theme !== mermaidTheme) {
      updateTheme(_theme);
    }
  }, [_theme, mermaidTheme, updateTheme]);

  // Reset render flag when document changes
  useEffect(() => {
    resetFirstRenderFlag();
  }, [currentDocument?.id, resetFirstRenderFlag]);

  /**
   * Handle render completion from the orchestrator
   * This is where we process Mermaid diagrams after the initial render
   */
  const handleRenderComplete = useCallback(async (htmlString, { renderId, reason }) => {
    console.log(`🎯 Renderer: Handling render completion for ${renderId} (${reason})`);

    try {
      let finalHtml = htmlString;

      // Check if we need to process Mermaid diagrams
      if (htmlString.includes("data-mermaid-source")) {
        console.log(`🧜‍♀️ Processing Mermaid diagrams for render ${renderId}`);
        finalHtml = await renderDiagrams(htmlString, _theme);
        setPreviewHTML(finalHtml);
      } else {
        console.log(`📄 Setting preview HTML for render ${renderId} (no Mermaid)`);
        setPreviewHTML(finalHtml);
      }

      // Update the App's renderedHTML state for PDF export
      // Note: Rendering is now centralized - previewHTML is updated directly in context
      // if (onRenderHTML) {
      //   onRenderHTML(finalHtml);
      // }

      // The orchestrator will handle setting isRendering to false

    } catch (error) {
      console.error(`❌ Error processing Mermaid for render ${renderId}:`, error);
      // Fall back to original HTML
      setPreviewHTML(htmlString);

      // Still update the App's renderedHTML state even on error
      // Note: Rendering is now centralized - previewHTML is updated directly in context
      // if (onRenderHTML) {
      //   onRenderHTML(htmlString);
      // }
    }
  }, [renderDiagrams, _theme, setPreviewHTML]);

  return (
    <div id="previewContainer">
      {/* Central rendering orchestrator replaces MarkdownProcessor */}
      <RenderingOrchestrator
        theme={_theme}
        onRenderComplete={handleRenderComplete}
      />

      {/* Handle lifecycle and controls */}
      <LifecycleManager onFirstRender={onFirstRender} />

      {/* Handle image functionality */}
      <FeatureManager />

      <div id="preview" className="position-relative">
        <PreviewRenderer
          htmlContent={previewHTML}
          className="preview-scroll"
          scrollToLine={scrollToLine}
          onRef={(element) => {
            previewScrollRef.current = element;
            setCodeCopyRef(element);
          }}
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
};

/**
 * Main Renderer component with context provider
 */
const Renderer = (props) => {
  return (
    <RendererProvider>
      <RendererContent {...props} />
    </RendererProvider>
  );
};

export default Renderer;
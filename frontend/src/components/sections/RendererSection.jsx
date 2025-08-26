import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Container, Alert, Button } from 'react-bootstrap';
import Renderer from '../Renderer';

/**
 * RendererSection - Wrapper component for the renderer area
 * Handles renderer with error states and shared view logic
 */

// ...existing code...
function RendererSection({
  content,
  onRenderHTML,
  isSharedView,
  sharedDocument,
  sharedLoading,
  isInitializing,
  syncPreviewScrollEnabled,
  cursorLine,
  fullscreenPreview
}) {
  const [hasRendered, setHasRendered] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Loading...");
  const [lastContentHash, setLastContentHash] = useState("");

  // Reset hasRendered if loading starts again or content changes significantly
  React.useEffect(() => {
    if (isInitializing || sharedLoading) {
      setHasRendered(false);
      if (isInitializing) {
        setLoadingMessage("Initializing...");
      } else if (sharedLoading) {
        setLoadingMessage("Loading shared document...");
      }
    }
  }, [isInitializing, sharedLoading]);

  // Reset rendering state when content changes
  React.useEffect(() => {
    if (content.trim()) {
      // Create a simple hash of the content to detect real changes
      const contentHash = content.trim().slice(0, 100) + content.length;

      if (contentHash !== lastContentHash) {
        setLastContentHash(contentHash);
        setHasRendered(false);

        const hasMermaidDiagrams = content.includes("```mermaid");
        if (hasMermaidDiagrams) {
          setLoadingMessage("Rendering diagrams...");
        } else {
          setLoadingMessage("Rendering content...");
        }
      }
    } else if (content === "" && lastContentHash !== "") {
      // Content was cleared
      setLastContentHash("");
      setHasRendered(true); // Empty content is "rendered"
    }
  }, [content, lastContentHash]);

  // Update loading message based on content type (only when not rendered yet)
  React.useEffect(() => {
    if (!hasRendered && content.trim()) {
      const hasMermaidDiagrams = content.includes("```mermaid");
      if (hasMermaidDiagrams) {
        setLoadingMessage("Rendering diagrams...");
      } else {
        setLoadingMessage("Rendering content...");
      }
    }
  }, [content, hasRendered]);

  // Handle empty content case - consider it "rendered"
  React.useEffect(() => {
    if (!content.trim() && !isInitializing && !sharedLoading && !hasRendered) {
      setHasRendered(true);
    }
  }, [content, isInitializing, sharedLoading, hasRendered]);

    const handleFirstRender = useCallback(() => {
    console.log("handleFirstRender called - setting hasRendered to true");
    setHasRendered(true);
  }, []);

  const showSpinner = isInitializing || sharedLoading || !hasRendered;

  return (
    <div className="renderer-wrapper position-relative">
      {isSharedView && !sharedDocument && !sharedLoading ? (
        <Container className="py-4">
          <Alert variant="danger">
            <Alert.Heading>Unable to Load Document</Alert.Heading>
            <p>The shared document could not be found or sharing has been disabled.</p>
            <hr />
            <div className="d-flex justify-content-end">
              <Button
                variant="outline-danger"
                onClick={() => window.location.href = '/'}
              >
                Go to Main App
              </Button>
            </div>
          </Alert>
        </Container>
      ) : (
        <Renderer
          content={content}
          onRenderHTML={onRenderHTML}
          scrollToLine={isSharedView ? null : (syncPreviewScrollEnabled ? cursorLine : null)}
          fullscreenPreview={isSharedView ? true : fullscreenPreview}
          onFirstRender={handleFirstRender}
          showLoadingOverlay={showSpinner}
          loadingMessage={loadingMessage}
        />
      )}
    </div>
  );
}
RendererSection.propTypes = {
  content: PropTypes.string.isRequired,
  onRenderHTML: PropTypes.func.isRequired,
  isSharedView: PropTypes.bool.isRequired,
  sharedDocument: PropTypes.object,
  sharedLoading: PropTypes.bool.isRequired,
  isInitializing: PropTypes.bool.isRequired,
  syncPreviewScrollEnabled: PropTypes.bool.isRequired,
  cursorLine: PropTypes.number.isRequired,
  fullscreenPreview: PropTypes.bool.isRequired,
};

export default RendererSection;

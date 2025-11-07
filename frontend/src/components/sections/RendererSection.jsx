import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Container, Alert, Button } from 'react-bootstrap';
import Renderer from '../Renderer';
import { useDocumentContext } from '../../providers/DocumentContextProvider';

/**
 * RendererSection - Wrapper component for the renderer area
 * Handles renderer with error states and shared view logic
 */

// ...existing code...
function RendererSection({
  isSharedView,
  sharedDocument,
  sharedLoading,
  isInitializing,
  documentLoading,
  syncPreviewScrollEnabled,
  cursorLine,
  fullscreenPreview
}) {
  const { content } = useDocumentContext();
  const [hasRendered, setHasRendered] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Loading...");

  // Reset hasRendered only when starting a document operation (not content changes)
  React.useEffect(() => {
    if (isInitializing || sharedLoading || documentLoading) {
      setHasRendered(false);
      if (isInitializing) {
        setLoadingMessage("Initializing...");
      } else if (sharedLoading) {
        setLoadingMessage("Loading shared document...");
      } else if (documentLoading) {
        setLoadingMessage("Loading document...");
      }
    }
  }, [isInitializing, sharedLoading, documentLoading]);

  // Handle empty content case - consider it "rendered" immediately
  React.useEffect(() => {
    console.log("RendererSection: Empty content check", {
      content: content.length,
      contentTrimmed: content.trim().length,
      isInitializing,
      sharedLoading,
      documentLoading,
      hasRendered
    });

    if (!content.trim() && !isInitializing && !sharedLoading && !documentLoading) {
      console.log("RendererSection: Setting hasRendered=true for empty content");
      setHasRendered(true);
    }
  }, [content, isInitializing, sharedLoading, documentLoading]);

    const handleFirstRender = useCallback(() => {
    console.log("handleFirstRender called - setting hasRendered to true");
    setHasRendered(true);
  }, []);

  // Only show spinner for document operations, not content changes
  const showSpinner = (isInitializing || sharedLoading || documentLoading) && !hasRendered;

  const scrollToLineValue = isSharedView ? null : (syncPreviewScrollEnabled ? cursorLine : null);

  return (
    <>
      {isSharedView && !sharedDocument && !sharedLoading ? (
        <div id="previewContainer">
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
        </div>
      ) : (
        <Renderer
          scrollToLine={scrollToLineValue}
          fullscreenPreview={fullscreenPreview}
          onFirstRender={handleFirstRender}
          showLoadingOverlay={showSpinner}
          loadingMessage={loadingMessage}
        />
      )}
    </>
  );
}
RendererSection.propTypes = {
  isSharedView: PropTypes.bool.isRequired,
  sharedDocument: PropTypes.object,
  sharedLoading: PropTypes.bool.isRequired,
  isInitializing: PropTypes.bool.isRequired,
  documentLoading: PropTypes.bool.isRequired,
  syncPreviewScrollEnabled: PropTypes.bool.isRequired,
  cursorLine: PropTypes.number.isRequired,
  fullscreenPreview: PropTypes.bool.isRequired,
};

export default RendererSection;

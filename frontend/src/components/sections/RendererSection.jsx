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

  // Reset hasRendered if loading starts again or content changes significantly
  React.useEffect(() => {
    if (isInitializing || sharedLoading) {
      setHasRendered(false);
    }
  }, [isInitializing, sharedLoading]);

  // Handle empty content case - consider it "rendered"
  React.useEffect(() => {
    if (!content.trim() && !isInitializing && !sharedLoading && !hasRendered) {
      setHasRendered(true);
    }
  }, [content, isInitializing, sharedLoading, hasRendered]);

  const handleFirstRender = useCallback(() => {
    setHasRendered(true);
  }, []);

  const showSpinner = isInitializing || sharedLoading || !hasRendered;

  return (
    <div className="renderer-wrapper">
      {showSpinner ? (
        <div className="d-flex justify-content-center align-items-center h-100">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      ) : isSharedView && !sharedDocument && !sharedLoading ? (
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

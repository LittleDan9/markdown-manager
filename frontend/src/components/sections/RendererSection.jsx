import React from 'react';
import PropTypes from 'prop-types';
import { Container, Alert, Button } from 'react-bootstrap';
import Renderer from '../Renderer';

/**
 * RendererSection - Wrapper component for the renderer area
 * Handles renderer with error states and shared view logic
 */
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
  return (
    <div className="renderer-wrapper">
      {isInitializing ? (
        // Show loading spinner while initializing
        <div className="d-flex justify-content-center align-items-center h-100">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      ) : isSharedView && !sharedDocument && !sharedLoading ? (
        // Show error state for shared documents that failed to load
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
        // Standard renderer for both normal and shared views
        <Renderer
          content={content}
          onRenderHTML={onRenderHTML}
          scrollToLine={isSharedView ? null : (syncPreviewScrollEnabled ? cursorLine : null)}
          fullscreenPreview={isSharedView ? true : fullscreenPreview}
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

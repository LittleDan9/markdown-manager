import React from 'react';
import PropTypes from 'prop-types';
import Editor from '../Editor';

/**
 * EditorSection - Wrapper component for the editor area
 * Handles editor rendering with loading states and conditional visibility
 */
function EditorSection({
  isSharedView,
  isInitializing,
  content,
  onContentChange,
  onCursorLineChange,
  currentDocument,
  fullscreenPreview
}) {
  // Don't render editor in shared view
  if (isSharedView) {
    return null;
  }

  return (
    <div id="editorContainer">
      {!isInitializing ? (
        <Editor
          value={content}
          onChange={onContentChange}
          onCursorLineChange={onCursorLineChange}
          categoryId={currentDocument?.category_id}
          fullscreenPreview={fullscreenPreview}
        />
      ) : (
        <div style={{ height: "100%", width: "100%", position: "relative", display: "flex", flexDirection: "column" }}>
          <div className="editor-loading-container">
            <div className="text-center">
              <div className="spinner-border text-primary mb-3" role="status">
                <span className="visually-hidden">Initializing authentication...</span>
              </div>
              <div>
                <small className="text-muted">Loading editor...</small>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

EditorSection.propTypes = {
  isSharedView: PropTypes.bool.isRequired,
  isInitializing: PropTypes.bool.isRequired,
  content: PropTypes.string.isRequired,
  onContentChange: PropTypes.func.isRequired,
  onCursorLineChange: PropTypes.func.isRequired,
  currentDocument: PropTypes.object,
  fullscreenPreview: PropTypes.bool.isRequired,
};

export default EditorSection;

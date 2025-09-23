import React from 'react';
import PropTypes from 'prop-types';
import InvisibleResizer from './InvisibleResizer';

/**
 * AppLayout - Main layout structure for the application
 * Simple layout structure with invisible resize functionality
 */
function AppLayout({ header, toolbar, editorSection, rendererSection, fullscreenPreview }) {
  return (
    <div id="appRoot" className="app-root">
      <div id="container">
        {header}
        {toolbar}
        <div
          id="main"
          className={fullscreenPreview ? "preview-full" : "split-view"}
        >
          {editorSection}
          {rendererSection}
          <InvisibleResizer fullscreenPreview={fullscreenPreview} />
        </div>
      </div>
    </div>
  );
}

AppLayout.propTypes = {
  header: PropTypes.node.isRequired,
  toolbar: PropTypes.node.isRequired,
  editorSection: PropTypes.node,
  rendererSection: PropTypes.node.isRequired,
  fullscreenPreview: PropTypes.bool.isRequired,
};

export default AppLayout;

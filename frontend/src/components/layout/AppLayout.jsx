import React from 'react';
import PropTypes from 'prop-types';

/**
 * AppLayout - Main layout structure for the application
 * Provides the basic layout structure without business logic
 */
function AppLayout({ header, toolbar, editorSection, rendererSection, fullscreenPreview }) {
  return (
    <div id="appRoot" className="app-root">
      <div id="container">
        {header}
        {toolbar}
        <div id="main" className={fullscreenPreview ? "preview-full" : "split-view"}>
          {editorSection}
          {rendererSection}
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

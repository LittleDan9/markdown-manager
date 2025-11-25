import React from 'react';
import PropTypes from 'prop-types';

/**
 * SharedViewLayout - Dedicated layout for shared document viewing
 * Provides a clean, full-width layout optimized for shared documents
 * without the complexity of editor/preview splitting or fullscreen inheritance
 */
function SharedViewLayout({ header, toolbar, rendererSection }) {
  return (
    <div id="appRoot" className="app-root">
      <div id="container">
        {header}
        {toolbar}
        <div id="main" className="shared-view">
          {/* No editor section in shared view */}
          {rendererSection}
        </div>
      </div>
    </div>
  );
}

SharedViewLayout.propTypes = {
  header: PropTypes.node.isRequired,
  toolbar: PropTypes.node.isRequired,
  rendererSection: PropTypes.node.isRequired,
};

export default SharedViewLayout;
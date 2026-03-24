import React from 'react';
import PropTypes from 'prop-types';
import { useViewport } from '@/hooks';
import { useDocumentContext } from '@/providers/DocumentContextProvider';

/**
 * MobileViewToggle - Fixed bottom bar for switching between editor and preview on mobile.
 * Only renders when viewport is mobile (≤576px) and not in shared/fullscreen view.
 */
function MobileViewToggle({ isSharedView, fullscreenPreview }) {
  const { isMobile } = useViewport();
  const { mobileViewMode, setMobileViewMode } = useDocumentContext();

  if (!isMobile || isSharedView || fullscreenPreview) {
    return null;
  }

  return (
    <div className="mobile-view-toggle">
      <button
        type="button"
        className={`toggle-btn${mobileViewMode === 'editor' ? ' active' : ''}`}
        onClick={() => setMobileViewMode('editor')}
      >
        <i className="bi bi-pencil-square" />
        Edit
      </button>
      <button
        type="button"
        className={`toggle-btn${mobileViewMode === 'preview' ? ' active' : ''}`}
        onClick={() => setMobileViewMode('preview')}
      >
        <i className="bi bi-eye" />
        Preview
      </button>
    </div>
  );
}

MobileViewToggle.propTypes = {
  isSharedView: PropTypes.bool,
  fullscreenPreview: PropTypes.bool,
};

export default MobileViewToggle;

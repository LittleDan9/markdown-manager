/**
 * ImageControls - Hover overlay controls for user images
 *
 * Renders a fullscreen button that appears when the user hovers over an image
 * in the preview, matching the same UX pattern used by DiagramControls for
 * Mermaid diagrams.
 */
import React, { useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Button } from 'react-bootstrap';
import { useTheme } from '../../providers/ThemeProvider';

function ImageControls({ imageElement, imageId, filename, lineNumber }) {
  const controlsRef = useRef(null);
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';

  // Mirror the DiagramControls hover pattern: JS-driven visibility so the
  // button stays visible when the cursor moves from the image onto the button.
  useEffect(() => {
    if (!imageElement || !controlsRef.current) return;

    const controls = controlsRef.current;

    const show = () => {
      controls.style.opacity = '1';
    };

    const hide = () => {
      if (!controls.matches(':hover')) {
        controls.style.opacity = '';
      }
    };

    imageElement.addEventListener('mouseenter', show);
    imageElement.addEventListener('mouseleave', hide);
    controls.addEventListener('mouseleave', hide);

    return () => {
      imageElement.removeEventListener('mouseenter', show);
      imageElement.removeEventListener('mouseleave', hide);
      controls.removeEventListener('mouseleave', hide);
    };
  }, [imageElement]);

  const handleFullscreen = () => {
    if (!imageElement) return;

    const img = imageElement.querySelector('img');
    if (!img) return;

    window.dispatchEvent(new CustomEvent('image-expand', {
      detail: {
        src: img.src,
        alt: img.alt || filename,
        title: img.title || filename,
        filename,
        lineNumber
      }
    }));
  };

  return (
    <div
      className="image-controls"
      ref={controlsRef}
      style={{ pointerEvents: 'auto' }}
      aria-label={`Image controls for ${filename}`}
    >
      <Button
        variant={isDarkMode ? 'outline-light' : 'outline-secondary'}
        size="sm"
        onClick={handleFullscreen}
        title="View fullscreen"
        aria-label={`View ${filename} fullscreen`}
      >
        <i className={`bi bi-arrows-fullscreen`} aria-hidden="true"></i>
      </Button>
    </div>
  );
}

ImageControls.propTypes = {
  imageElement: PropTypes.object.isRequired,
  imageId: PropTypes.string.isRequired,
  filename: PropTypes.string.isRequired,
  lineNumber: PropTypes.number
};

ImageControls.defaultProps = {
  lineNumber: 1
};

export default ImageControls;

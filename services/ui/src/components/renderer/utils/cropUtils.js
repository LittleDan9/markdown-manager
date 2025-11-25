/**
 * Crop utilities for image processing
 */

/**
 * Apply crop styles to an image element using clipPath with transform for positioning
 */
export const applyCropStyles = (imgElement, cropData) => {
  if (!cropData) {
    // Remove crop styles
    imgElement.style.removeProperty('clip-path');
    imgElement.style.removeProperty('object-fit');
    imgElement.style.removeProperty('object-position');
    imgElement.style.removeProperty('transform');
    imgElement.style.removeProperty('transform-origin');
    imgElement.removeAttribute('data-has-crop');
    return;
  }

  const { x, y, width, height, unit = 'percentage' } = cropData;

  if (unit === 'percentage') {
    // Clip to show only the desired area
    imgElement.style.setProperty('clip-path', `inset(${y}% ${100 - x - width}% ${100 - y - height}% ${x}%)`, 'important');

    // Scale the image so the cropped area fills the container width
    const scaleX = 100 / width;
    const scaleY = 100 / height;

    // Translate to move the cropped area to the top-left
    const translateX = -(x * scaleX);
    const translateY = -(y * scaleY);

    imgElement.style.setProperty('transform', `scale(${scaleX}, ${scaleY}) translate(${translateX}%, ${translateY}%)`, 'important');
    imgElement.style.setProperty('transform-origin', '0 0', 'important');
    imgElement.style.setProperty('object-fit', 'none', 'important');
    imgElement.setAttribute('data-has-crop', 'true');

    console.log('Applied crop styles with transform:', {
      filename: imgElement.getAttribute('data-filename'),
      cropData,
      transform: imgElement.style.getPropertyValue('transform'),
      clipPath: imgElement.style.getPropertyValue('clip-path')
    });
  }
};

/**
 * Get default crop data for new crop operations
 */
export const getDefaultCropData = () => ({
  x: 10,
  y: 10,
  width: 80,
  height: 80,
  unit: 'percentage'
});

/**
 * Prepare container for crop mode
 */
export const prepareCropContainer = (container) => {
  const containerRect = container.getBoundingClientRect();

  // Ensure the container has relative positioning for absolute children
  if (window.getComputedStyle(container).position === 'static') {
    container.style.position = 'relative';
  }

  // Force container to be able to show overlays
  container.style.overflow = 'visible';
  container.style.zIndex = '1';

  // Ensure the container maintains its size during crop mode
  container.style.minWidth = containerRect.width + 'px';
  container.style.minHeight = containerRect.height + 'px';

  return containerRect;
};

/**
 * Restore container after crop mode
 */
export const restoreCropContainer = (container) => {
  container.style.minWidth = '';
  container.style.minHeight = '';
};
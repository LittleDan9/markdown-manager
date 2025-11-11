/**
 * SimpleCropUtils - Clean, simple crop styling utilities
 *
 * Provides straightforward CSS-based image cropping using clip-path.
 * Much simpler than the previous complex transform-based approach.
 */

/**
 * Apply crop styling to an image element
 * @param {HTMLImageElement} img - The image element to crop
 * @param {Object} cropData - Crop data with x, y, width, height percentages
 */
export const applyCropStyles = (img, cropData) => {
  if (!img || !cropData) {
    removeCropStyles(img);
    return;
  }

  const { x, y, width, height } = cropData;

  // Use clip-path for clean, simple cropping
  // inset(top right bottom left)
  const top = `${y}%`;
  const right = `${100 - x - width}%`;
  const bottom = `${100 - y - height}%`;
  const left = `${x}%`;

  img.style.setProperty('clip-path', `inset(${top} ${right} ${bottom} ${left})`, 'important');
  img.style.setProperty('object-fit', 'cover', 'important');
  img.style.setProperty('width', '100%', 'important');
  img.style.setProperty('height', 'auto', 'important');
};

/**
 * Remove crop styling from an image element
 * @param {HTMLImageElement} img - The image element to reset
 */
export const removeCropStyles = (img) => {
  if (!img) return;

  img.style.removeProperty('clip-path');
  img.style.removeProperty('object-fit');
  img.style.removeProperty('width');
  img.style.removeProperty('height');
};

/**
 * Check if an image has crop styling applied
 * @param {HTMLImageElement} img - The image element to check
 * @returns {boolean} - True if crop styling is applied
 */
export const hasCropStyles = (img) => {
  if (!img) return false;
  return img.style.getPropertyValue('clip-path') !== '';
};

/**
 * Get crop boundaries as CSS inset values
 * @param {Object} cropData - Crop data with x, y, width, height percentages
 * @returns {string} - CSS inset() function string
 */
export const getCropInset = (cropData) => {
  if (!cropData) return '';

  const { x, y, width, height } = cropData;
  const top = `${y}%`;
  const right = `${100 - x - width}%`;
  const bottom = `${100 - y - height}%`;
  const left = `${x}%`;

  return `inset(${top} ${right} ${bottom} ${left})`;
};
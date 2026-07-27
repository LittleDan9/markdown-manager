/**
 * Annotation Render Feature
 *
 * Renders annotation overlays on images in the preview pane.
 * Uses Canvas2D for lightweight, non-React rendering.
 * Attaches a ResizeObserver to redraw on size changes.
 */

import { renderAnnotations } from '@/services/image/annotationCanvasRenderer';

export const AnnotationRenderFeature = {
  name: 'annotation-render',

  /**
   * Initialize annotation rendering for an image element.
   * @param {Element} element - The .user-image-container element
   * @param {Object} context - Shared context with metadata accessors
   */
  initialize(element, context) {
    const filename = element.dataset.filename;
    const lineNumber = parseInt(element.dataset.lineNumber || '1', 10);

    if (!filename || !context?.getAnnotationData) return;

    const annotationData = context.getAnnotationData(filename, lineNumber);
    if (!annotationData?.shapes?.length) return;

    // Skip if canvas already exists
    if (element.querySelector('.annotation-canvas')) return;

    const img = element.querySelector('img');
    if (!img) return;

    // Create canvas overlay
    const canvas = document.createElement('canvas');
    canvas.className = 'annotation-canvas';
    canvas.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 5;
    `;

    // Match clip-path from image (for crop support)
    const imgClipPath = img.style.getPropertyValue('clip-path');
    if (imgClipPath) {
      canvas.style.clipPath = imgClipPath;
    }

    element.appendChild(canvas);

    // Draw annotations
    const draw = () => {
      const rect = img.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        try {
          renderAnnotations(canvas, annotationData, rect.width, rect.height);
        } catch (error) {
          console.error('Failed to render annotations:', error);
        }
      }
    };

    // Initial draw (after image loads)
    if (img.complete && img.naturalWidth > 0) {
      draw();
    } else {
      img.addEventListener('load', draw, { once: true });
      img.addEventListener('error', () => {
        console.warn('Image failed to load, skipping annotation render:', filename);
      }, { once: true });
    }

    // Redraw on resize
    const observer = new ResizeObserver(draw);
    observer.observe(element);

    // Store observer for cleanup
    element._annotationObserver = observer;

    // Add annotation indicator badge
    if (!element.querySelector('.annotation-badge')) {
      const badge = document.createElement('span');
      badge.className = 'annotation-badge';
      badge.style.cssText = `
        position: absolute;
        top: 8px;
        left: 8px;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.6);
        color: white;
        border-radius: 50%;
        font-size: 10px;
        z-index: 6;
        pointer-events: none;
      `;
      badge.textContent = '✏';
      element.appendChild(badge);
    }
  },

  /**
   * Cleanup canvas and observer.
   */
  cleanup(element) {
    const canvas = element.querySelector('.annotation-canvas');
    if (canvas) canvas.remove();

    const badge = element.querySelector('.annotation-badge');
    if (badge) badge.remove();

    if (element._annotationObserver) {
      element._annotationObserver.disconnect();
      delete element._annotationObserver;
    }
  },
};

export default AnnotationRenderFeature;

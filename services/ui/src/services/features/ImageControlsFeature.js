/**
 * Image Controls Feature
 *
 * Adds hover controls (crop, expand) to user images.
 * Handles styling and basic event delegation.
 */

export const ImageControlsFeature = {
  name: 'image-controls',

  /**
   * Initialize image controls for an element
   * @param {Element} element - The image container element
   * @param {Object} context - Shared context with handlers and refs
   */
  initialize(element, _context) {
    console.log('🖼️ Initializing image controls for:', element.dataset.filename);

    // Skip if already has controls
    if (element.querySelector('.image-hover-controls')) {
      console.log('Image controls already exist, skipping');
      return;
    }

    const filename = element.dataset.filename;
    const lineNumber = parseInt(element.dataset.lineNumber, 10) || 1;

    if (!filename) {
      console.warn('No filename found for image controls');
      return;
    }

    // Create hover controls HTML
    const controlsHTML = this.createControlsHTML(filename, lineNumber);

    // Insert controls into the container
    element.insertAdjacentHTML('beforeend', controlsHTML);

    // Apply hover styling
    this.applyHoverStyling();

    // Add tap-to-show for touch devices (no hover)
    // Remove existing handler if re-initialized
    if (element._touchHandler) {
      element.removeEventListener('touchstart', element._touchHandler);
    }

    const handleTouchStart = (e) => {
      // Only toggle on single tap on the image itself (not on control buttons)
      if (e.target.closest('.image-hover-controls')) return;

      // Toggle controls visibility
      const isVisible = element.classList.contains('controls-visible');
      // Hide all other open controls first
      document.querySelectorAll('.user-image-container.controls-visible').forEach((el) => {
        if (el !== element) el.classList.remove('controls-visible');
      });
      element.classList.toggle('controls-visible', !isVisible);
    };

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element._touchHandler = handleTouchStart;

    console.log('✅ Image controls initialized for:', filename);
  },

  /**
   * Create the hover controls HTML
   */
  createControlsHTML(filename, lineNumber) {
    // Escape filename for safe HTML insertion
    const safeFilename = this.escapeHtml(filename);

    return `
      <div class="image-hover-controls" style="
        position: absolute;
        top: 8px;
        right: 8px;
        display: none;
        gap: 4px;
        background: rgba(0, 0, 0, 0.7);
        border-radius: 4px;
        padding: 4px;
        z-index: 20;
      ">
        <button
          class="image-control-btn crop-btn"
          title="Crop image"
          onclick="window.handleImageControl && window.handleImageControl('crop', '${safeFilename}', ${lineNumber})"
          style="
            width: 24px;
            height: 24px;
            padding: 0;
            font-size: 12px;
            border: none;
            border-radius: 3px;
            margin-right: 4px;
            transition: all 0.2s ease;
            cursor: pointer;
            background: rgba(255, 255, 255, 0.9);
            color: #333;
          "
        >🗇</button>
        <button
          class="image-control-btn expand-btn"
          title="Expand image"
          onclick="window.handleImageControl && window.handleImageControl('expand', '${safeFilename}', ${lineNumber})"
          style="
            width: 24px;
            height: 24px;
            padding: 0;
            font-size: 12px;
            border: none;
            border-radius: 3px;
            transition: all 0.2s ease;
            cursor: pointer;
            background: rgba(255, 255, 255, 0.9);
            color: #333;
          "
        >⛶</button>
        <button
          class="image-control-btn annotate-btn"
          title="Annotate image"
          onclick="window.handleImageControl && window.handleImageControl('annotate', '${safeFilename}', ${lineNumber})"
          style="
            width: 24px;
            height: 24px;
            padding: 0;
            font-size: 12px;
            border: none;
            border-radius: 3px;
            transition: all 0.2s ease;
            cursor: pointer;
            background: rgba(255, 255, 255, 0.9);
            color: #333;
          "
        >✏</button>
      </div>
    `;
  },

  /**
   * Apply global hover styling (only once)
   */
  applyHoverStyling() {
    // Check if styles already applied
    if (document.getElementById('image-controls-feature-styles')) {
      return;
    }

    const styleSheet = document.createElement('style');
    styleSheet.id = 'image-controls-feature-styles';
    styleSheet.textContent = `
      /* Image control hover behavior */
      .user-image-container:hover .image-hover-controls {
        display: flex !important;
      }

      /* Touch: show controls on tap (toggle via JS class) */
      .user-image-container.controls-visible .image-hover-controls {
        display: flex !important;
      }

      .image-control-btn:hover {
        transform: scale(1.1) !important;
        background: rgba(255, 255, 255, 1) !important;
      }

      /* Dark theme support */
      [data-bs-theme="dark"] .image-control-btn {
        background: rgba(0, 0, 0, 0.8) !important;
        color: #fff !important;
      }

      [data-bs-theme="dark"] .image-control-btn:hover {
        background: rgba(0, 0, 0, 0.9) !important;
      }

      /* Mobile: larger touch targets */
      @media (max-width: 576px) {
        .image-hover-controls {
          gap: 6px !important;
          padding: 6px !important;
        }
        .image-control-btn {
          width: 36px !important;
          height: 36px !important;
          font-size: 16px !important;
        }
      }
    `;

    document.head.appendChild(styleSheet);
    console.log('📋 Image controls styles applied');
  },

  /**
   * Escape HTML special characters
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  /**
   * Cleanup function (optional)
   */
  cleanup(element) {
    const controls = element.querySelector('.image-hover-controls');
    if (controls) {
      controls.remove();
    }
    if (element._touchHandler) {
      element.removeEventListener('touchstart', element._touchHandler);
      delete element._touchHandler;
    }
    element.classList.remove('controls-visible');
  }
};

export default ImageControlsFeature;
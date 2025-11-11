/**
 * Crop Overlay Feature
 *
 * Adds crop overlay functionality to user images.
 * Handles crop mode UI and interactions.
 */

export const CropOverlayFeature = {
  name: 'crop-overlay',

  /**
   * Initialize crop overlay for an element
   * @param {Element} element - The image container element
   * @param {Object} context - Shared context with handlers and refs
   */
  initialize(element, _context) {
    console.log('✂️ Initializing crop overlay for:', element.dataset.filename);

    // Skip if already has overlay
    if (element.querySelector('.image-crop-overlay')) {
      console.log('Crop overlay already exists, skipping');
      return;
    }

    const filename = element.dataset.filename;
    const lineNumber = element.dataset.lineNumber || '1';

    if (!filename) {
      console.warn('No filename found for crop overlay');
      return;
    }

    // Create crop overlay HTML
    const overlayHTML = this.createOverlayHTML(filename, lineNumber);

    // Insert overlay into the container
    element.insertAdjacentHTML('beforeend', overlayHTML);

    console.log('✅ Crop overlay initialized for:', filename);
  },

  /**
   * Create the crop overlay HTML
   */
  createOverlayHTML(filename, lineNumber) {
    // Escape filename for safe HTML insertion
    const safeFilename = this.escapeHtml(filename);

    return `
      <div class="image-crop-overlay" style="
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        display: none;
        background: rgba(0, 0, 0, 0.5);
        z-index: 30;
        pointer-events: auto;
      " data-filename="${safeFilename}" data-line-number="${lineNumber}">

        <!-- Crop selection area -->
        <div class="crop-controls" style="
          position: absolute;
          top: 10%;
          left: 10%;
          width: 80%;
          height: 80%;
          border: 2px dashed #fff;
          background: transparent;
          cursor: move;
          min-width: 50px;
          min-height: 50px;
        ">
          <!-- Resize handles -->
          <div class="crop-handle crop-handle-nw" style="
            position: absolute;
            top: -6px;
            left: -6px;
            width: 12px;
            height: 12px;
            background: #fff;
            border: 1px solid #000;
            cursor: nw-resize;
            border-radius: 2px;
          "></div>
          <div class="crop-handle crop-handle-ne" style="
            position: absolute;
            top: -6px;
            right: -6px;
            width: 12px;
            height: 12px;
            background: #fff;
            border: 1px solid #000;
            cursor: ne-resize;
            border-radius: 2px;
          "></div>
          <div class="crop-handle crop-handle-sw" style="
            position: absolute;
            bottom: -6px;
            left: -6px;
            width: 12px;
            height: 12px;
            background: #fff;
            border: 1px solid #000;
            cursor: sw-resize;
            border-radius: 2px;
          "></div>
          <div class="crop-handle crop-handle-se" style="
            position: absolute;
            bottom: -6px;
            right: -6px;
            width: 12px;
            height: 12px;
            background: #fff;
            border: 1px solid #000;
            cursor: se-resize;
            border-radius: 2px;
          "></div>

          <!-- Edge handles for resizing -->
          <div class="crop-handle crop-handle-n" style="
            position: absolute;
            top: -6px;
            left: 50%;
            transform: translateX(-50%);
            width: 12px;
            height: 12px;
            background: #fff;
            border: 1px solid #000;
            cursor: n-resize;
            border-radius: 2px;
          "></div>
          <div class="crop-handle crop-handle-s" style="
            position: absolute;
            bottom: -6px;
            left: 50%;
            transform: translateX(-50%);
            width: 12px;
            height: 12px;
            background: #fff;
            border: 1px solid #000;
            cursor: s-resize;
            border-radius: 2px;
          "></div>
          <div class="crop-handle crop-handle-w" style="
            position: absolute;
            top: 50%;
            left: -6px;
            transform: translateY(-50%);
            width: 12px;
            height: 12px;
            background: #fff;
            border: 1px solid #000;
            cursor: w-resize;
            border-radius: 2px;
          "></div>
          <div class="crop-handle crop-handle-e" style="
            position: absolute;
            top: 50%;
            right: -6px;
            transform: translateY(-50%);
            width: 12px;
            height: 12px;
            background: #fff;
            border: 1px solid #000;
            cursor: e-resize;
            border-radius: 2px;
          "></div>
        </div>

        <!-- Action buttons -->
        <div class="crop-actions" style="
          position: absolute;
          bottom: 10px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          gap: 8px;
          z-index: 31;
        ">
          <button
            class="crop-save-btn"
            onclick="window.handleImageControl && window.handleImageControl('crop-save', '${safeFilename}', ${lineNumber})"
            style="
              padding: 8px 16px;
              background: #28a745;
              color: white;
              border: none;
              border-radius: 4px;
              cursor: pointer;
              font-size: 14px;
              font-weight: 500;
              box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            "
          >Save Crop</button>
          <button
            class="crop-cancel-btn"
            onclick="window.handleImageControl && window.handleImageControl('crop-cancel', '${safeFilename}', ${lineNumber})"
            style="
              padding: 8px 16px;
              background: #dc3545;
              color: white;
              border: none;
              border-radius: 4px;
              cursor: pointer;
              font-size: 14px;
              font-weight: 500;
              box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            "
          >Cancel</button>
        </div>
      </div>
    `;
  },

  /**
   * Show crop overlay for a specific image
   * @param {Element} element - Image container element
   * @param {Object} cropData - Current crop data
   */
  show(element, cropData = null) {
    const overlay = element.querySelector('.image-crop-overlay');
    if (!overlay) {
      console.warn('No crop overlay found to show');
      return;
    }

    const cropControls = overlay.querySelector('.crop-controls');
    if (!cropControls) {
      console.warn('No crop controls found');
      return;
    }

    // Apply crop data if provided
    if (cropData) {
      const { x, y, width, height } = cropData;
      cropControls.style.left = `${x}%`;
      cropControls.style.top = `${y}%`;
      cropControls.style.width = `${width}%`;
      cropControls.style.height = `${height}%`;
    }

    // Show the overlay
    overlay.style.display = 'block';

    console.log('🎭 Crop overlay shown');
  },

  /**
   * Hide crop overlay for a specific image
   * @param {Element} element - Image container element
   */
  hide(element) {
    const overlay = element.querySelector('.image-crop-overlay');
    if (overlay) {
      overlay.style.display = 'none';
      console.log('🎭 Crop overlay hidden');
    }
  },

  /**
   * Get current crop data from overlay
   * @param {Element} element - Image container element
   * @returns {Object} Crop data
   */
  getCurrentCropData(element) {
    const overlay = element.querySelector('.image-crop-overlay');
    const cropControls = overlay?.querySelector('.crop-controls');

    if (!overlay || !cropControls) {
      return null;
    }

    const overlayRect = overlay.getBoundingClientRect();
    const controlsRect = cropControls.getBoundingClientRect();

    return {
      x: ((controlsRect.left - overlayRect.left) / overlayRect.width) * 100,
      y: ((controlsRect.top - overlayRect.top) / overlayRect.height) * 100,
      width: (controlsRect.width / overlayRect.width) * 100,
      height: (controlsRect.height / overlayRect.height) * 100,
      unit: 'percentage'
    };
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
   * Cleanup function
   */
  cleanup(element) {
    const overlay = element.querySelector('.image-crop-overlay');
    if (overlay) {
      overlay.remove();
    }
  }
};

export default CropOverlayFeature;
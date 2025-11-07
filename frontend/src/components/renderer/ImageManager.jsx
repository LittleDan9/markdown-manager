/**
 * ImageManager - Simplified image functionality handler
 *
 * This component handles event listeners for built-in image controls
 * and manages cropping functionality using a much simpler approach.
 */
import React, { useEffect, useRef } from 'react';
import { Modal, Button } from 'react-bootstrap';
import { useImageMetadata } from '../../services/ImageMetadataService';
import { useRendererContext } from './RendererContext';
import { applyCropStyles, getDefaultCropData, prepareCropContainer, restoreCropContainer } from './utils/cropUtils';

const ImageManager = () => {
  const { getCropData, updateCropData } = useImageMetadata();
  const {
    previewScrollRef,
    cropModeRef,
    cropOverlayKey,
    showImageModal,
    setShowImageModal,
    selectedImage,
    setSelectedImage,
    enterCropMode,
    exitCropMode,
    isCropModeActive,
    previewHTML,
    isRendering
  } = useRendererContext();

  // Ref to store the event handler for proper cleanup
  const controlClickHandlerRef = useRef(null);

  /**
   * Global handler for all image control button clicks
   */
  const handleImageControl = (action, filename, lineNumber) => {
    console.log('=== GLOBAL IMAGE CONTROL HANDLER CALLED ===');
    console.log('Arguments received:', { action, filename, lineNumber, type: typeof action });

    if (!previewScrollRef.current) {
      console.log('No preview scroll ref available');
      return;
    }

    // Find the image and container
    const container = previewScrollRef.current.querySelector(`[data-filename="${filename}"]`);
    const img = container?.querySelector('img[data-is-user-image="true"]');
    const cropOverlay = container?.querySelector('.image-crop-overlay');

    console.log('Found elements:', { container: !!container, img: !!img, cropOverlay: !!cropOverlay });

    if (!container || !img) {
      console.log('Could not find container or image for:', filename);
      return;
    }

    if (action === 'crop') {
      handleCropClick(img, container, cropOverlay, filename, lineNumber);
    } else if (action === 'expand') {
      handleExpandClick(img, filename);
    } else if (action === 'crop-save') {
      handleCropSave(cropOverlay, filename, lineNumber);
    } else if (action === 'crop-cancel') {
      handleCropCancel(cropOverlay, filename);
    }
  };  /**
   * Setup global handler and apply crop styles
   */
  const setupImageControlListeners = () => {
    console.log('=== ImageManager: Setting up global image control handler ===');

    // Register global handler
    window.handleImageControl = handleImageControl;
    console.log('=== GLOBAL HANDLER REGISTERED ===');
    console.log('Global handler registered:', !!window.handleImageControl);

    // Test the handler
    console.log('Testing global handler access...');
    if (window.handleImageControl) {
      console.log('✅ window.handleImageControl is accessible');
    } else {
      console.log('❌ window.handleImageControl is NOT accessible');
    }    // Add CSS for hover behavior and theme support
    const styleSheet = document.createElement('style');
    styleSheet.textContent = `
      /* Base styling for image control buttons */
      .image-control-btn {
        background: rgba(255, 255, 255, 0.9) !important;
        color: #333 !important;
      }

      .image-control-btn:hover {
        transform: scale(1.1) !important;
        background: rgba(255, 255, 255, 1) !important;
      }

      /* Dark mode support */
      [data-bs-theme="dark"] .image-control-btn {
        background: rgba(0, 0, 0, 0.7) !important;
        color: white !important;
      }
      [data-bs-theme="dark"] .image-control-btn:hover {
        background: rgba(0, 0, 0, 0.9) !important;
      }

      /* Show controls on hover */
      .user-image-container:hover .image-hover-controls {
        display: flex !important;
      }
    `;

    // Remove old style sheet if exists
    const oldStyle = document.getElementById('image-controls-style');
    if (oldStyle) {
      oldStyle.remove();
    }

    styleSheet.id = 'image-controls-style';
    document.head.appendChild(styleSheet);
    console.log('Hover styles added to page');

    if (!previewScrollRef.current) {
      console.log('ImageManager: previewScrollRef.current is null');
      return;
    }

    // Add event delegation as backup for image control buttons
    const handleButtonClick = (event) => {
      if (event.target.classList.contains('image-control-btn')) {
        console.log('=== EVENT DELEGATION TRIGGERED ===');
        console.log('Button clicked via event delegation:', event.target);

        // Extract action from class names
        let action = 'unknown';
        if (event.target.classList.contains('crop-btn')) action = 'crop';
        else if (event.target.classList.contains('expand-btn')) action = 'expand';

        // Find the container and extract filename
        const container = event.target.closest('.user-image-container');
        const filename = container?.getAttribute('data-filename');

        console.log('Event delegation data:', { action, filename });

        if (filename) {
          handleImageControl(action, filename, 0);
        }
      }
    };

    // Remove existing listener
    if (controlClickHandlerRef.current) {
      previewScrollRef.current.removeEventListener('click', controlClickHandlerRef.current);
    }

    // Add new listener
    controlClickHandlerRef.current = handleButtonClick;
    previewScrollRef.current.addEventListener('click', handleButtonClick);
    console.log('Event delegation listener added');

    // Apply existing crop styles to images
    const userImages = previewScrollRef.current.querySelectorAll('img[data-is-user-image="true"]');
    console.log('ImageManager: Found', userImages.length, 'user images');

    // Also check for containers with hover controls
    const imageContainers = previewScrollRef.current.querySelectorAll('.user-image-container');
    console.log('ImageManager: Found', imageContainers.length, 'image containers');

    imageContainers.forEach((container, index) => {
      const hoverControls = container.querySelector('.image-hover-controls');
      const buttons = hoverControls?.querySelectorAll('.image-control-btn');
      console.log(`Container ${index}:`, {
        hasHoverControls: !!hoverControls,
        buttonCount: buttons?.length || 0,
        filename: container.getAttribute('data-filename'),
        containerStyle: container.style.position,
        controlsDisplay: hoverControls?.style.display
      });

      // Log the actual HTML structure
      if (hoverControls) {
        console.log(`Controls HTML for ${container.getAttribute('data-filename')}:`, hoverControls.outerHTML);
      }
    });

    userImages.forEach(img => {
      const filename = img.getAttribute('data-filename');
      const lineNumber = parseInt(img.getAttribute('data-line-number')) || 1;

      if (filename) {
        const cropData = getCropData(filename, lineNumber);
        if (cropData) {
          applyCropStyles(img, cropData);
        }
      }
    });
  };

  /**
   * Handle crop button click - show the injected overlay
   */
  const handleCropClick = (img, container, cropOverlay, filename, lineNumber) => {
    console.log('Crop button clicked for:', filename);

    if (!cropOverlay) {
      console.log('No crop overlay found for:', filename);
      return;
    }

    // Get crop data for this image
    const cropData = getCropData(filename, lineNumber) || getDefaultCropData();

    // Position the crop controls based on current crop data
    const cropControls = cropOverlay.querySelector('.crop-controls');
    if (cropControls && cropData) {
      const { x, y, width, height } = cropData;
      cropControls.style.left = `${x}%`;
      cropControls.style.top = `${y}%`;
      cropControls.style.width = `${width}%`;
      cropControls.style.height = `${height}%`;
    }

    // Show the overlay
    cropOverlay.style.display = 'block';

    // Enter crop mode for render protection
    enterCropMode(filename, lineNumber, {
      width: img.naturalWidth || img.width,
      height: img.naturalHeight || img.height
    }, cropData);

    console.log('Crop overlay shown for:', filename);
  };

  /**
   * Handle expand button click
   */
  const handleExpandClick = (img, filename) => {
    console.log('Expand button clicked for:', filename);

    const lineNumber = parseInt(img.getAttribute('data-line-number')) || 1;
    const cropData = getCropData(filename, lineNumber);

    setSelectedImage({
      src: img.src,
      alt: img.alt,
      title: img.title,
      filename: filename,
      cropData: cropData
    });
    setShowImageModal(true);
  };

  /**
   * Handle crop save button click
   */
  const handleCropSave = async (cropOverlay, filename, lineNumber) => {
    console.log('Crop save clicked for:', filename);

    if (!cropOverlay) return;

    // Get the current crop dimensions from the overlay
    const cropControls = cropOverlay.querySelector('.crop-controls');
    if (!cropControls) return;

    // Calculate crop data from current position
    const containerRect = cropOverlay.getBoundingClientRect();
    const controlsRect = cropControls.getBoundingClientRect();

    const cropData = {
      x: ((controlsRect.left - containerRect.left) / containerRect.width) * 100,
      y: ((controlsRect.top - containerRect.top) / containerRect.height) * 100,
      width: (controlsRect.width / containerRect.width) * 100,
      height: (controlsRect.height / containerRect.height) * 100,
      unit: 'percentage'
    };

    try {
      await updateCropData(filename, lineNumber, cropData);
      console.log('Crop saved for:', filename);

      // Apply crop styles to the image
      const container = cropOverlay.parentElement;
      const img = container?.querySelector('img[data-is-user-image="true"]');
      if (img) {
        applyCropStyles(img, cropData);
      }

      // Hide the overlay
      cropOverlay.style.display = 'none';
      exitCropMode();

    } catch (error) {
      console.error('Failed to save crop:', error);
    }
  };

  /**
   * Handle crop cancel button click
   */
  const handleCropCancel = (cropOverlay, filename) => {
    console.log('Crop cancelled for:', filename);

    if (!cropOverlay) return;

    // Hide the overlay
    cropOverlay.style.display = 'none';
    exitCropMode();
  };

  /**
   * Handle crop cancel
   */
  const handleCropCancel = () => {
    const cropMode = cropModeRef.current;
    if (!cropMode) return;

    console.log('Crop cancelled');

    const targetContainer = previewScrollRef.current?.querySelector(`[data-filename="${cropMode.filename}"]`);
    if (targetContainer) {
      restoreCropContainer(targetContainer);
    }

    exitCropMode();
  };

  // Setup global handler and apply styles when preview HTML changes
  useEffect(() => {
    console.log('=== ImageManager useEffect triggered ===', {
      hasPreviewHTML: !!previewHTML,
      hasPreviewScrollRef: !!previewScrollRef.current,
      isRendering: isRendering,
      previewHTMLLength: previewHTML?.length
    });

    // Wait for stable render state before setting up image controls
    if (previewHTML && previewScrollRef.current && !isRendering) {
      console.log('ImageManager: Setting up global handler with stable render delay');

      // Add a delay to ensure all render operations have completed
      // and DOM has stabilized before setting up image controls
      const timeoutId = setTimeout(() => {
        // Double-check conditions haven't changed during timeout
        if (previewHTML && previewScrollRef.current && !isRendering) {
          // Check if orchestrator is available and get its state
          const orchestratorState = window.__renderingOrchestrator;

          if (orchestratorState && orchestratorState.state !== 'idle' && orchestratorState.state !== 'completed') {
            console.log('ImageManager: Orchestrator still processing, waiting longer', {
              orchestratorState: orchestratorState.state,
              queueLength: orchestratorState.queueLength
            });

            // Wait a bit longer if orchestrator is still working
            const longerTimeoutId = setTimeout(() => {
              if (previewHTML && previewScrollRef.current && !isRendering) {
                setupImageControlListeners();
              }
            }, 500);

            return () => clearTimeout(longerTimeoutId);
          } else {
            console.log('ImageManager: Orchestrator idle, setting up controls');
            setupImageControlListeners();
          }
        } else {
          console.log('ImageManager: Conditions changed during timeout, skipping setup');
        }
      }, 400); // Increased delay to ensure stability

      return () => clearTimeout(timeoutId);
    } else {
      console.log('ImageManager: Skipping setup - conditions not met', {
        reason: !previewHTML ? 'no previewHTML' :
                !previewScrollRef.current ? 'no previewScrollRef' :
                isRendering ? 'still rendering' : 'unknown'
      });
    }
  }, [previewHTML, isRendering]);

  // Cleanup global handler on unmount
  useEffect(() => {
    return () => {
      if (window.handleImageControl) {
        delete window.handleImageControl;
      }
      // Clean up event delegation listener
      if (controlClickHandlerRef.current && previewScrollRef.current) {
        previewScrollRef.current.removeEventListener('click', controlClickHandlerRef.current);
      }
    };
  }, []);

  // Clean up old controls when modal closes
  useEffect(() => {
    if (!showImageModal && previewScrollRef.current) {
      // Just reapply crop styles, no need to recreate controls
      const userImages = previewScrollRef.current.querySelectorAll('img[data-is-user-image="true"]');
      userImages.forEach(img => {
        const filename = img.getAttribute('data-filename');
        const lineNumber = parseInt(img.getAttribute('data-line-number')) || 1;

        if (filename) {
          const cropData = getCropData(filename, lineNumber);
          if (cropData) {
            applyCropStyles(img, cropData);
          }
        }
      });
    }
  }, [showImageModal]);

  return (
    <>
      {/* Image Modal */}
      <Modal
        show={showImageModal}
        onHide={() => setShowImageModal(false)}
        size="xl"
        centered
        backdrop="static"
      >
        <Modal.Header closeButton>
          <Modal.Title>
            {selectedImage?.title || selectedImage?.alt || 'Image'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="text-center">
          {selectedImage && (
            <img
              src={selectedImage.src}
              alt={selectedImage.alt}
              className="img-fluid"
              style={{ maxHeight: '70vh', maxWidth: '100%' }}
            />
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowImageModal(false)}>
            Close
          </Button>
          {selectedImage && (
            <Button
              variant="primary"
              onClick={() => {
                const link = document.createElement('a');
                link.href = selectedImage.src;
                link.download = selectedImage.alt || 'image';
                link.click();
              }}
            >
              <i className="bi bi-download me-2"></i>
              Download
            </Button>
          )}
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default React.memo(ImageManager);
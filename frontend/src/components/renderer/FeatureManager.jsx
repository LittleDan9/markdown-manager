/**
 * Feature Manager
 *
 * Replaces ImageManager with a modular feature-based approach.
 * Handles feature registration, initialization, and coordinates between features.
 */
import React, { useEffect, useRef, useCallback } from 'react';
import { Modal, Button } from 'react-bootstrap';
import { useImageMetadata } from '../../services/image/ImageMetadataService';
import { useRendererContext } from '../renderer/RendererContext';
import { applyCropStyles, getDefaultCropData } from '../renderer/utils/cropUtils';

// Feature system imports
import { registerFeature, initializeFeatures, cleanupFeatures } from '../../services/features/FeatureRegistry';
import { ImageControlsFeature } from '../../services/features/ImageControlsFeature';
import { CropOverlayFeature } from '../../services/features/CropOverlayFeature';

const FeatureManager = () => {
  const { getCropData, updateCropData } = useImageMetadata();
  const {
    previewScrollRef,
    previewHTML,
    isRendering,
    showImageModal,
    setShowImageModal,
    selectedImage,
    setSelectedImage,
    enterCropMode,
    exitCropMode
  } = useRendererContext();

  // Track initialization
  const isInitialized = useRef(false);

  /**
   * Handle crop button click
   */
  const handleCropAction = useCallback((container, img, filename, lineNumber) => {
    console.log('🔄 Starting crop mode for:', filename);

    // Get existing crop data or defaults
    const cropData = getCropData(filename, lineNumber) || getDefaultCropData();

    // Show the crop overlay
    CropOverlayFeature.show(container, cropData);

    // Enter crop mode for render protection
    enterCropMode(filename, lineNumber, {
      width: img.naturalWidth || img.width,
      height: img.naturalHeight || img.height
    }, cropData);
  }, [getCropData, enterCropMode]);

  /**
   * Handle expand button click
   */
  const handleExpandAction = useCallback((img, filename, lineNumber) => {
    console.log('🔍 Expanding image:', filename);

    const cropData = getCropData(filename, lineNumber);

    setSelectedImage({
      src: img.src,
      alt: img.alt,
      title: img.title,
      filename: filename,
      cropData: cropData
    });
    setShowImageModal(true);
  }, [getCropData, setSelectedImage, setShowImageModal]);

  /**
   * Handle crop save action
   */
  const handleCropSaveAction = useCallback(async (container, filename, lineNumber) => {
    console.log('💾 Saving crop for:', filename);

    try {
      // Get current crop data from overlay
      const cropData = CropOverlayFeature.getCurrentCropData(container);

      if (!cropData) {
        console.error('Could not get crop data');
        return;
      }

      // Save to metadata service
      await updateCropData(filename, lineNumber, cropData);

      // Apply crop styles to the image
      const img = container.querySelector('img[data-is-user-image="true"]');
      if (img) {
        applyCropStyles(img, cropData);
      }

      // Hide overlay and exit crop mode
      CropOverlayFeature.hide(container);
      exitCropMode();

      console.log('✅ Crop saved successfully');

    } catch (error) {
      console.error('❌ Failed to save crop:', error);
    }
  }, [updateCropData, exitCropMode]);

  /**
   * Handle crop cancel action
   */
  const handleCropCancelAction = useCallback((container, filename) => {
    console.log('❌ Cancelling crop for:', filename);

    // Hide overlay and exit crop mode
    CropOverlayFeature.hide(container);
    exitCropMode();
  }, [exitCropMode]);

  /**
   * Global handler for all image control actions
   */
  const handleImageControl = useCallback((action, filename, lineNumber) => {
    console.log('🎯 Feature action triggered:', { action, filename, lineNumber });

    if (!previewScrollRef.current) {
      console.log('No preview scroll ref available');
      return;
    }

    // Find the image container
    const container = previewScrollRef.current.querySelector(`[data-filename="${filename}"]`);
    const img = container?.querySelector('img[data-is-user-image="true"]');

    if (!container || !img) {
      console.log('Could not find container or image for:', filename);
      return;
    }

    switch (action) {
      case 'crop':
        handleCropAction(container, img, filename, lineNumber);
        break;
      case 'expand':
        handleExpandAction(img, filename, lineNumber);
        break;
      case 'crop-save':
        handleCropSaveAction(container, filename, lineNumber);
        break;
      case 'crop-cancel':
        handleCropCancelAction(container, filename);
        break;
      default:
        console.warn('Unknown action:', action);
    }
  }, [previewScrollRef, handleCropAction, handleExpandAction, handleCropSaveAction, handleCropCancelAction]);

  /**
   * Set up global handler and initialize features when content changes
   */
  useEffect(() => {
    if (previewHTML && previewScrollRef.current && !isRendering && isInitialized.current) {
      console.log('🚀 Initializing features for new content');

      // Set up global handler
      window.handleImageControl = handleImageControl;

      // Initialize all features
      const context = {
        getCropData,
        updateCropData,
        applyCropStyles,
        getDefaultCropData
      };

      // Clean up any existing features first
      cleanupFeatures(previewScrollRef.current);

      // Initialize features with delay to ensure DOM is ready
      setTimeout(() => {
        if (previewScrollRef.current) {
          initializeFeatures(previewScrollRef.current, context);
        }
      }, 100);
    }
  }, [previewHTML, isRendering, getCropData, handleImageControl, previewScrollRef, updateCropData]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    const currentPreviewScrollRef = previewScrollRef.current;
    return () => {
      if (window.handleImageControl) {
        delete window.handleImageControl;
      }

      if (currentPreviewScrollRef) {
        cleanupFeatures(currentPreviewScrollRef);
      }
    };
  }, [previewScrollRef]);

  return (
    <>
      {/* Image Modal for expand functionality */}
      <Modal show={showImageModal} onHide={() => setShowImageModal(false)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>
            {selectedImage?.filename || 'Image'}
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

export default React.memo(FeatureManager);
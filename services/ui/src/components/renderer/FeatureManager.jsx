/**
 * Feature Manager
 *
 * Replaces ImageManager with a modular feature-based approach.
 * Handles feature registration, initialization, and coordinates between features.
 */
import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Modal } from 'react-bootstrap';
import { useImageMetadata } from '../../services/image/ImageMetadataService';
import { useRendererContext } from '../renderer/RendererContext';
import { applyCropStyles, getDefaultCropData } from '../renderer/utils/cropUtils';
import AnnotationEditor from '../image/AnnotationEditor';

// Feature system imports
import { registerFeature, initializeFeatures, cleanupFeatures } from '../../services/features/FeatureRegistry';
import { CropOverlayFeature } from '../../services/features/CropOverlayFeature';
import { ImageControlsFeature } from '../../services/features/ImageControlsFeature';
import { AnnotationRenderFeature } from '../../services/features/AnnotationRenderFeature';

const FeatureManager = () => {
  const { getCropData, updateCropData, getAnnotationData, updateAnnotationData } = useImageMetadata();
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
  const featuresRegistered = useRef(false);

  // Annotation editor state
  const [showAnnotationEditor, setShowAnnotationEditor] = useState(false);
  const [annotationTarget, setAnnotationTarget] = useState(null);

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
   * Handle annotate button click - opens annotation editor modal
   */
  const handleAnnotateAction = useCallback((img, filename, lineNumber) => {
    console.log('✏️ Opening annotation editor for:', filename);

    const existingData = getAnnotationData(filename, lineNumber);

    setAnnotationTarget({
      filename,
      lineNumber,
      imageSrc: img.src,
      annotationData: existingData,
    });
    setShowAnnotationEditor(true);
  }, [getAnnotationData]);

  /**
   * Handle annotation save from editor
   */
  const handleAnnotationSave = useCallback(async (annotationData) => {
    if (!annotationTarget) return;

    const { filename, lineNumber } = annotationTarget;
    await updateAnnotationData(filename, lineNumber, annotationData);

    setShowAnnotationEditor(false);
    setAnnotationTarget(null);
  }, [annotationTarget, updateAnnotationData]);

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
      case 'annotate':
        handleAnnotateAction(img, filename, lineNumber);
        break;
      default:
        console.warn('Unknown action:', action);
    }
  }, [previewScrollRef, handleCropAction, handleExpandAction, handleCropSaveAction, handleCropCancelAction, handleAnnotateAction]);

  /**
   * Register features once on mount
   */
  useEffect(() => {
    if (!featuresRegistered.current) {
      registerFeature('image-controls', ImageControlsFeature);
      registerFeature('crop-overlay', CropOverlayFeature);
      registerFeature('annotation-render', AnnotationRenderFeature);
      featuresRegistered.current = true;
    }
  }, []);

  /**
   * Set up global handler and initialize features when content changes
   */
  useEffect(() => {
    if (previewHTML && previewScrollRef.current && !isRendering && featuresRegistered.current) {
      console.log('🚀 Initializing features for new content');

      // Set up global handler
      window.handleImageControl = handleImageControl;

      // Initialize all features
      const context = {
        getCropData,
        updateCropData,
        applyCropStyles,
        getDefaultCropData,
        getAnnotationData,
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
  }, [previewHTML, isRendering, getCropData, getAnnotationData, handleImageControl, previewScrollRef, updateCropData]);

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

  /**
   * Listen for image-expand events dispatched by ImageControls portals
   */
  useEffect(() => {
    const handleImageExpand = (event) => {
      const { src, alt, title, filename, lineNumber } = event.detail;
      setSelectedImage({ src, alt, title, filename, lineNumber });
      setShowImageModal(true);
    };

    window.addEventListener('image-expand', handleImageExpand);
    return () => window.removeEventListener('image-expand', handleImageExpand);
  }, [setSelectedImage, setShowImageModal]);

  return (
    <>
      {/* Image fullscreen modal */}
      <Modal show={showImageModal} onHide={() => setShowImageModal(false)} fullscreen className="image-fullscreen-modal">
        <Modal.Header closeButton className="py-2">
          <Modal.Title className="text-truncate fs-6">
            {selectedImage?.title || selectedImage?.filename || 'Image'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="d-flex align-items-center justify-content-center p-2" style={{ overflow: 'hidden' }}>
          {selectedImage && (
            <img
              src={selectedImage.src}
              alt={selectedImage.alt}
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
            />
          )}
        </Modal.Body>
        <Modal.Footer className="modal-toolbar">
          <div className="toolbar-actions ms-auto">
            <button className="toolbar-btn toolbar-btn--dismiss" onClick={() => setShowImageModal(false)}>
              <i className="bi bi-x-lg"></i>
            </button>
            {selectedImage && (
              <button
                className="toolbar-btn toolbar-btn--primary"
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = selectedImage.src;
                  link.download = selectedImage.filename || selectedImage.alt || 'image';
                  link.click();
                }}
              >
                <i className="bi bi-download"></i>
                Download
              </button>
            )}
          </div>
        </Modal.Footer>
      </Modal>

      {/* Annotation editor modal */}
      <AnnotationEditor
        show={showAnnotationEditor}
        onHide={() => { setShowAnnotationEditor(false); setAnnotationTarget(null); }}
        imageSrc={annotationTarget?.imageSrc}
        annotationData={annotationTarget?.annotationData}
        onSave={handleAnnotationSave}
      />
    </>
  );
};

export default React.memo(FeatureManager);
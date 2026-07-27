import { useCallback, useState } from 'react';
import { useDocumentContext } from '@/providers/DocumentContextProvider';
import { useNotification } from '@/components/NotificationProvider';
import documentsApi from '@/api/documentsApi';

/**
 * Service for managing image metadata including crop information
 */
class ImageMetadataService {
  /**
   * Extract filename from image URL
   */
  static extractFilename(src) {
    if (!src) return null;

    // Extract filename from various URL patterns
    const patterns = [
      /\/api\/images\/\d+\/([^/?]+)/,  // /api/images/7/filename.jpg
      /\/images\/([^/?]+)/,            // /images/filename.jpg
      /([^/]+\.(jpg|jpeg|png|gif|webp|svg))$/i  // filename.ext at end
    ];

    for (const pattern of patterns) {
      const match = src.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return null;
  }

  /**
   * Get crop data for a specific image instance
   */
  static getCropData(documentImageMetadata, filename, lineNumber) {
    if (!documentImageMetadata || !filename) return null;

    const imageData = documentImageMetadata[filename];
    if (!imageData || !imageData.instances) return null;

    const lineKey = `line_${lineNumber}`;
    const instance = imageData.instances[lineKey];

    return instance?.crop || null;
  }

  /**
   * Set crop data for a specific image instance
   */
  static setCropData(documentImageMetadata, filename, lineNumber, cropData) {
    const metadata = documentImageMetadata || {};
    const lineKey = `line_${lineNumber}`;

    if (!metadata[filename]) {
      metadata[filename] = { instances: {} };
    }

    if (!metadata[filename].instances) {
      metadata[filename].instances = {};
    }

    if (!metadata[filename].instances[lineKey]) {
      metadata[filename].instances[lineKey] = {};
    }

    metadata[filename].instances[lineKey].crop = cropData;
    metadata[filename].instances[lineKey].last_modified = new Date().toISOString();

    return metadata;
  }

  /**
   * Remove crop data for a specific image instance
   */
  static removeCropData(documentImageMetadata, filename, lineNumber) {
    if (!documentImageMetadata || !filename) return documentImageMetadata;

    const metadata = { ...documentImageMetadata };
    const lineKey = `line_${lineNumber}`;

    if (metadata[filename]?.instances?.[lineKey]) {
      delete metadata[filename].instances[lineKey].crop;

      // Clean up empty structures
      if (Object.keys(metadata[filename].instances[lineKey]).length === 0) {
        delete metadata[filename].instances[lineKey];
      }

      if (Object.keys(metadata[filename].instances).length === 0) {
        delete metadata[filename];
      }
    }

    return metadata;
  }

  /**
   * Get all images with crop data in the document
   */
  static getCroppedImages(documentImageMetadata) {
    if (!documentImageMetadata) return [];

    const croppedImages = [];

    Object.entries(documentImageMetadata).forEach(([filename, imageData]) => {
      if (imageData.instances) {
        Object.entries(imageData.instances).forEach(([lineKey, instance]) => {
          if (instance.crop) {
            const lineNumber = parseInt(lineKey.replace('line_', ''));
            croppedImages.push({
              filename,
              lineNumber,
              crop: instance.crop,
              lastModified: instance.last_modified
            });
          }
        });
      }
    });

    return croppedImages;
  }

  /**
   * Get annotation data for a specific image instance
   */
  static getAnnotationData(documentImageMetadata, filename, lineNumber) {
    if (!documentImageMetadata || !filename) return null;

    const imageData = documentImageMetadata[filename];
    if (!imageData || !imageData.instances) return null;

    const lineKey = `line_${lineNumber}`;
    const instance = imageData.instances[lineKey];

    return instance?.annotations || null;
  }

  /**
   * Set annotation data for a specific image instance
   */
  static setAnnotationData(documentImageMetadata, filename, lineNumber, annotationData) {
    const metadata = documentImageMetadata || {};
    const lineKey = `line_${lineNumber}`;

    if (!metadata[filename]) {
      metadata[filename] = { instances: {} };
    }

    if (!metadata[filename].instances) {
      metadata[filename].instances = {};
    }

    if (!metadata[filename].instances[lineKey]) {
      metadata[filename].instances[lineKey] = {};
    }

    metadata[filename].instances[lineKey].annotations = annotationData;
    metadata[filename].instances[lineKey].last_modified = new Date().toISOString();

    return metadata;
  }

  /**
   * Remove annotation data for a specific image instance
   */
  static removeAnnotationData(documentImageMetadata, filename, lineNumber) {
    if (!documentImageMetadata || !filename) return documentImageMetadata;

    const metadata = { ...documentImageMetadata };
    const lineKey = `line_${lineNumber}`;

    if (metadata[filename]?.instances?.[lineKey]) {
      delete metadata[filename].instances[lineKey].annotations;

      // Clean up empty structures (only if no crop either)
      const instance = metadata[filename].instances[lineKey];
      const hasOtherData = instance.crop || instance.original_dimensions;
      if (!hasOtherData && Object.keys(instance).filter(k => k !== 'last_modified').length === 0) {
        delete metadata[filename].instances[lineKey];
      }

      if (Object.keys(metadata[filename].instances).length === 0) {
        delete metadata[filename];
      }
    }

    return metadata;
  }

  /**
   * Check if annotation data exists for a specific image instance
   */
  static hasAnnotations(documentImageMetadata, filename, lineNumber) {
    const data = ImageMetadataService.getAnnotationData(documentImageMetadata, filename, lineNumber);
    return data !== null && data.shapes && data.shapes.length > 0;
  }
}

/**
 * Hook for managing image metadata in the current document
 */
export function useImageMetadata() {
  const { currentDocument, setCurrentDocument } = useDocumentContext();
  const { showSuccess, showError } = useNotification();
  const [saving, setSaving] = useState(false);

  /**
   * Get crop data for a specific image instance
   */
  const getCropData = useCallback((filename, lineNumber) => {
    console.log('getCropData called:', { filename, lineNumber, metadata: currentDocument?.image_metadata });
    return ImageMetadataService.getCropData(
      currentDocument?.image_metadata,
      filename,
      lineNumber
    );
  }, [currentDocument?.image_metadata]);

  /**
   * Update crop data for a specific image instance
   */
  const updateCropData = useCallback(async (filename, lineNumber, cropData) => {
    if (!currentDocument?.id) {
      showError('No document selected');
      return false;
    }

    try {
      setSaving(true);

      // Update local metadata
      const updatedMetadata = ImageMetadataService.setCropData(
        currentDocument.image_metadata || {},
        filename,
        lineNumber,
        cropData
      );

      // Update document locally first for immediate UI feedback
      const newDocument = {
        ...currentDocument,
        image_metadata: updatedMetadata
      };
      console.log('Updating document with new image metadata:', {
        filename,
        lineNumber,
        hasMetadata: !!newDocument.image_metadata,
        metadataKeys: Object.keys(newDocument.image_metadata || {})
      });
      setCurrentDocument(newDocument);

      // Save to backend
      const updatePayload = {
        updates: [{
          filename,
          line_number: lineNumber,
          metadata: {
            crop: cropData,
            last_modified: new Date().toISOString()
          }
        }]
      };

      await documentsApi.updateImageMetadata(currentDocument.id, updatePayload);

      showSuccess('Crop saved successfully');
      return true;
    } catch (error) {
      console.error('Failed to update crop data:', error);
      showError('Failed to save crop: ' + (error.message || 'Unknown error'));

      // Revert local changes on error
      setCurrentDocument(currentDocument);
      return false;
    } finally {
      setSaving(false);
    }
  }, [currentDocument, setCurrentDocument, showSuccess, showError]);

  /**
   * Remove crop data for a specific image instance
   */
  const removeCropData = useCallback(async (filename, lineNumber) => {
    if (!currentDocument?.id) {
      showError('No document selected');
      return false;
    }

    try {
      setSaving(true);

      // Update local metadata
      const updatedMetadata = ImageMetadataService.removeCropData(
        currentDocument.image_metadata || {},
        filename,
        lineNumber
      );

      // Update document locally first for immediate UI feedback
      setCurrentDocument({
        ...currentDocument,
        image_metadata: updatedMetadata
      });

      // Save to backend by sending null crop data
      const updatePayload = {
        updates: [{
          filename,
          line_number: lineNumber,
          metadata: {
            crop: null,
            last_modified: new Date().toISOString()
          }
        }]
      };

      await documentsApi.updateImageMetadata(currentDocument.id, updatePayload);

      showSuccess('Crop removed successfully');
      return true;
    } catch (error) {
      console.error('Failed to remove crop data:', error);
      showError('Failed to remove crop: ' + (error.message || 'Unknown error'));

      // Revert local changes on error
      setCurrentDocument(currentDocument);
      return false;
    } finally {
      setSaving(false);
    }
  }, [currentDocument, setCurrentDocument, showSuccess, showError]);

  /**
   * Get all cropped images in the current document
   */
  const getCroppedImages = useCallback(() => {
    return ImageMetadataService.getCroppedImages(currentDocument?.image_metadata);
  }, [currentDocument?.image_metadata]);

  /**
   * Extract filename from image source URL
   */
  const extractFilename = useCallback((src) => {
    return ImageMetadataService.extractFilename(src);
  }, []);

  /**
   * Get annotation data for a specific image instance
   */
  const getAnnotationData = useCallback((filename, lineNumber) => {
    return ImageMetadataService.getAnnotationData(
      currentDocument?.image_metadata,
      filename,
      lineNumber
    );
  }, [currentDocument?.image_metadata]);

  /**
   * Check if an image instance has annotations
   */
  const hasAnnotations = useCallback((filename, lineNumber) => {
    return ImageMetadataService.hasAnnotations(
      currentDocument?.image_metadata,
      filename,
      lineNumber
    );
  }, [currentDocument?.image_metadata]);

  /**
   * Update annotation data for a specific image instance
   */
  const updateAnnotationData = useCallback(async (filename, lineNumber, annotationData) => {
    if (!currentDocument?.id) {
      showError('No document selected');
      return false;
    }

    try {
      setSaving(true);

      // Update local metadata
      const updatedMetadata = ImageMetadataService.setAnnotationData(
        currentDocument.image_metadata || {},
        filename,
        lineNumber,
        annotationData
      );

      // Update document locally first for immediate UI feedback
      setCurrentDocument({
        ...currentDocument,
        image_metadata: updatedMetadata
      });

      // Save to backend
      const updatePayload = {
        updates: [{
          filename,
          line_number: lineNumber,
          metadata: {
            annotations: annotationData,
            last_modified: new Date().toISOString()
          }
        }]
      };

      await documentsApi.updateImageMetadata(currentDocument.id, updatePayload);

      showSuccess('Annotations saved');
      return true;
    } catch (error) {
      console.error('Failed to update annotation data:', error);
      showError('Failed to save annotations: ' + (error.message || 'Unknown error'));

      // Revert local changes on error
      setCurrentDocument(currentDocument);
      return false;
    } finally {
      setSaving(false);
    }
  }, [currentDocument, setCurrentDocument, showSuccess, showError]);

  /**
   * Remove annotation data for a specific image instance
   */
  const removeAnnotationData = useCallback(async (filename, lineNumber) => {
    if (!currentDocument?.id) {
      showError('No document selected');
      return false;
    }

    try {
      setSaving(true);

      // Update local metadata
      const updatedMetadata = ImageMetadataService.removeAnnotationData(
        currentDocument.image_metadata || {},
        filename,
        lineNumber
      );

      // Update document locally first for immediate UI feedback
      setCurrentDocument({
        ...currentDocument,
        image_metadata: updatedMetadata
      });

      // Save to backend
      const updatePayload = {
        updates: [{
          filename,
          line_number: lineNumber,
          metadata: {
            annotations: null,
            last_modified: new Date().toISOString()
          }
        }]
      };

      await documentsApi.updateImageMetadata(currentDocument.id, updatePayload);

      showSuccess('Annotations removed');
      return true;
    } catch (error) {
      console.error('Failed to remove annotation data:', error);
      showError('Failed to remove annotations: ' + (error.message || 'Unknown error'));

      // Revert local changes on error
      setCurrentDocument(currentDocument);
      return false;
    } finally {
      setSaving(false);
    }
  }, [currentDocument, setCurrentDocument, showSuccess, showError]);

  return {
    // Data accessors
    getCropData,
    getCroppedImages,
    extractFilename,
    getAnnotationData,
    hasAnnotations,

    // Actions
    updateCropData,
    removeCropData,
    updateAnnotationData,
    removeAnnotationData,

    // State
    saving,
    hasImageMetadata: !!currentDocument?.image_metadata
  };
}

export default ImageMetadataService;
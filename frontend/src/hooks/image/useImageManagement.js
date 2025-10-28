// Image Management Hook
import { useState, useCallback } from 'react';
import { useNotification } from '@/components/NotificationProvider';
import { useAuth } from '@/providers/AuthProvider';
import imageApi from '@/api/imageApi';

export function useImageManagement() {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { showSuccess, showError } = useNotification();
  const { user } = useAuth();

  // Load user images
  const loadImages = useCallback(async () => {
    setLoading(true);
    try {
      const response = await imageApi.listImages();
      setImages(response.images || []);
      return response;
    } catch (error) {
      console.error('Failed to load images:', error);
      // Don't show error for 404 (might be expected for new users with no images)
      if (error.response?.status !== 404) {
        showError('Failed to load images');
      }
      // Return empty state on error to prevent loops
      setImages([]);
      return { images: [], statistics: null };
    } finally {
      setLoading(false);
    }
  }, [showError]);

  // Upload single image
  const uploadImage = useCallback(async (file, options = {}) => {
    setUploading(true);
    try {
      const result = await imageApi.uploadImage(file, options);
      showSuccess(`Uploaded ${file.name}`);

      // Add to local state
      if (result.image) {
        setImages(prev => [result.image, ...prev]);
      }

      return result;
    } catch (error) {
      console.error('Failed to upload image:', error);
      showError(`Failed to upload ${file.name}: ` + (error.response?.data?.detail || error.message));
      throw error;
    } finally {
      setUploading(false);
    }
  }, [showSuccess, showError]);

  // Upload multiple images
  const uploadMultipleImages = useCallback(async (files, options = {}) => {
    setUploading(true);
    try {
      const results = await imageApi.uploadMultipleImages(files, options);

      if (results.successful_uploads > 0) {
        showSuccess(`Successfully uploaded ${results.successful_uploads} image${results.successful_uploads > 1 ? 's' : ''}`);

        // Add successful uploads to local state
        const newImages = results.results
          .filter(r => r.success && r.image)
          .map(r => r.image);

        setImages(prev => [...newImages, ...prev]);
      }

      if (results.failed_uploads > 0) {
        showError(`Failed to upload ${results.failed_uploads} image${results.failed_uploads > 1 ? 's' : ''}`);
      }

      return results;
    } catch (error) {
      console.error('Failed to upload images:', error);
      showError('Failed to upload images: ' + (error.response?.data?.detail || error.message));
      throw error;
    } finally {
      setUploading(false);
    }
  }, [showSuccess, showError]);

  // Upload from clipboard
  const uploadFromClipboard = useCallback(async (imageData, filename = 'clipboard_image.png', options = {}) => {
    setUploading(true);
    try {
      const result = await imageApi.uploadFromClipboard(imageData, filename, options);
      showSuccess('Uploaded image from clipboard');

      // Add to local state
      if (result.image) {
        setImages(prev => [result.image, ...prev]);
      }

      return result;
    } catch (error) {
      console.error('Failed to upload from clipboard:', error);
      showError('Failed to upload from clipboard: ' + (error.response?.data?.detail || error.message));
      throw error;
    } finally {
      setUploading(false);
    }
  }, [showSuccess, showError]);  // Delete image
  const deleteImage = useCallback(async (filename) => {
    try {
      await imageApi.deleteImage(filename);
      showSuccess(`Deleted ${filename}`);

      // Remove from local state
      setImages(prev => prev.filter(img => img.filename !== filename));

      return true;
    } catch (error) {
      console.error('Failed to delete image:', error);
      showError('Failed to delete image: ' + (error.response?.data?.detail || error.message));
      return false;
    }
  }, [showSuccess, showError]);

  // Get image metadata
  const getImageMetadata = useCallback(async (filename) => {
    try {
      const response = await imageApi.getImageMetadata(filename);
      return response.image;
    } catch (error) {
      console.error('Failed to get image metadata:', error);
      showError('Failed to get image metadata');
      return null;
    }
  }, [showError]);

  // Handle paste event for clipboard images
  const handlePasteImage = useCallback(async (event, options = {}) => {
    const items = event.clipboardData?.items;
    if (!items) return false;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      // Check if item is an image
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          try {
            // Convert to base64
            const reader = new FileReader();
            return new Promise((resolve, reject) => {
              reader.onload = async () => {
                try {
                  const base64Data = reader.result.split(',')[1]; // Remove data URL prefix
                  const result = await uploadFromClipboard(base64Data, 'clipboard_image.png', options);
                  resolve(result);
                } catch (error) {
                  reject(error);
                }
              };
              reader.onerror = reject;
              reader.readAsDataURL(file);
            });
          } catch (error) {
            console.error('Failed to process pasted image:', error);
            showError('Failed to process pasted image');
            return false;
          }
        }
      }
    }

    return false;
  }, [uploadFromClipboard, showError]);

  // Generate markdown for image
  const generateMarkdown = useCallback((image, altText = '', title = '') => {
    return imageApi.generateMarkdown(image, altText, title, user?.id);
  }, [user?.id]);

  // Get image URL
  const getImageUrl = useCallback((filename) => {
    return imageApi.getImageUrl(filename, user?.id);
  }, [user?.id]);

  // Get thumbnail URL
  const getThumbnailUrl = useCallback((filename) => {
    return imageApi.getThumbnailUrl(filename, user?.id);
  }, [user?.id]);

  return {
    // State
    images,
    loading,
    uploading,

    // Actions
    loadImages,
    uploadImage,
    uploadMultipleImages,
    uploadFromClipboard,
    deleteImage,
    getImageMetadata,
    handlePasteImage,

    // Utilities
    generateMarkdown,
    getImageUrl,
    getThumbnailUrl
  };
}
// Image Management API service
import { Api } from './api';

class ImageApi extends Api {
  /**
   * Upload a single image
   */
  async uploadImage(imageFile, options = {}) {
    const formData = new FormData();
    formData.append('file', imageFile);
    formData.append('optimize_for_pdf', options.optimizeForPdf !== false);
    formData.append('create_thumbnail', options.createThumbnail !== false);

    const response = await this.apiCall(
      '/images/upload',
      'POST',
      formData,
      {},
      {
        isFormData: true,
        timeout: 60000 // 60 seconds for file upload
      }
    );
    return response.data;
  }

  /**
   * Upload multiple images
   */
  async uploadMultipleImages(imageFiles, options = {}) {
    const formData = new FormData();

    imageFiles.forEach((file) => {
      formData.append('files', file);
    });

    formData.append('optimize_for_pdf', options.optimizeForPdf !== false);
    formData.append('create_thumbnail', options.createThumbnail !== false);

    const response = await this.apiCall(
      '/images/upload-multiple',
      'POST',
      formData,
      {},
      {
        isFormData: true,
        timeout: 120000 // 2 minutes for multiple files
      }
    );
    return response.data;
  }

  /**
   * Upload image from clipboard (base64 data)
   */
  async uploadFromClipboard(imageData, filename = 'clipboard_image.png', options = {}) {
    const formData = new FormData();
    formData.append('image_data', imageData);
    formData.append('filename', filename);
    formData.append('optimize_for_pdf', options.optimizeForPdf !== false);
    formData.append('create_thumbnail', options.createThumbnail !== false);

    const response = await this.apiCall(
      '/images/upload-from-clipboard',
      'POST',
      formData,
      {},
      {
        isFormData: true,
        timeout: 60000
      }
    );
    return response.data;
  }

  /**
   * Get list of user images
   */
  async listImages() {
    const response = await this.apiCall('/images/list');
    return response.data;
  }

  /**
   * Get image metadata
   */
  async getImageMetadata(filename) {
    const response = await this.apiCall(`/images/${filename}/metadata`);
    return response.data;
  }

  /**
   * Delete an image
   */
  async deleteImage(filename) {
    const response = await this.apiCall(`/images/${filename}`, 'DELETE');
    return response.data;
  }

  /**
   * Get storage statistics
   */
  async getStorageStats() {
    const response = await this.apiCall('/images/statistics/storage');
    return response.data;
  }

  /**
   * Get image URL for display
   */
  getImageUrl(filename, userId = null) {
    if (!userId) {
      console.error('Cannot generate image URL: userId is required');
      return null;
    }
    return `${this.apiBase}/images/${userId}/${filename}`;
  }

  /**
   * Get authenticated image as blob URL
   * This method fetches the image with authentication headers and returns a blob URL
   */
  async getImageBlobUrl(filename, userId = null) {
    if (!userId) {
      console.error('Cannot fetch image blob: userId is required');
      return null;
    }

    try {
      const response = await this.apiCall(`/images/${userId}/${filename}`, 'GET', null, {}, {
        responseType: 'blob',
        timeout: 30000
      });

      // Create a blob URL from the response
      const blob = response.data;
      return URL.createObjectURL(blob);
    } catch (error) {
      console.error('Failed to fetch image blob:', error);
      return null;
    }
  }

  /**
   * Get thumbnail URL for display
   */
  getThumbnailUrl(filename, userId = null) {
    if (!userId) {
      console.error('Cannot generate thumbnail URL: userId is required');
      return null;
    }
    return `${this.apiBase}/images/thumbnails/${userId}/${filename}`;
  }

  /**
   * Get authenticated thumbnail as blob URL
   */
  async getThumbnailBlobUrl(filename, userId = null) {
    if (!userId) {
      console.error('Cannot fetch thumbnail blob: userId is required');
      return null;
    }

    try {
      const response = await this.apiCall(`/images/thumbnails/${userId}/${filename}`, 'GET', null, {}, {
        responseType: 'blob',
        timeout: 30000
      });

      // Create a blob URL from the response
      const blob = response.data;
      return URL.createObjectURL(blob);
    } catch (error) {
      console.error('Failed to fetch thumbnail blob:', error);
      return null;
    }
  }

  /**
   * Generate markdown syntax for an image
   */
  generateMarkdown(image, altText = '', title = '', userId = null) {
    const url = this.getImageUrl(image.filename, userId);

    if (!url) {
      console.error('Cannot generate markdown: failed to get image URL');
      return '';
    }

    if (title) {
      return `![${altText}](${url} "${title}")`;
    }
    return `![${altText}](${url})`;
  }
}

export default new ImageApi();
// Attachment Management API service
import { Api } from './api';

class AttachmentApi extends Api {
  /**
   * Upload a file attachment to a document
   */
  async uploadAttachment(documentId, file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('document_id', documentId);

    const response = await this.apiCall(
      '/attachments/upload',
      'POST',
      formData,
      {},
      {
        isFormData: true,
        timeout: 120000 // 2 minutes for upload + virus scan
      }
    );
    return response.data;
  }

  /**
   * Get attachments for a specific document
   */
  async getDocumentAttachments(documentId) {
    const response = await this.apiCall(`/attachments/document/${documentId}`);
    return response.data;
  }

  /**
   * Get all user attachments (library view) with quota info
   */
  async getUserAttachments(page = 1, pageSize = 50) {
    const response = await this.apiCall(
      `/attachments/library?page=${page}&page_size=${pageSize}`
    );
    return response.data;
  }

  /**
   * Get metadata for a single attachment
   */
  async getAttachment(attachmentId) {
    const response = await this.apiCall(`/attachments/${attachmentId}`);
    return response.data;
  }

  /**
   * Delete an attachment
   */
  async deleteAttachment(attachmentId) {
    const response = await this.apiCall(`/attachments/${attachmentId}`, 'DELETE');
    return response.data;
  }

  /**
   * Get attachment download URL (public, no auth needed — same as images)
   */
  getDownloadUrl(attachmentId) {
    return `${this.apiBase}/attachments/${attachmentId}/download`;
  }

  /**
   * Get attachment inline view URL (public, no auth needed — same as images)
   */
  getViewUrl(attachmentId) {
    return `${this.apiBase}/attachments/${attachmentId}/view`;
  }

  /**
   * Generate a standard markdown link for an attachment
   */
  generateMarkdownLink(attachment) {
    const url = `/api/attachments/${attachment.id}/download`;
    return `[${attachment.original_filename}](${url})`;
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

export default new AttachmentApi();

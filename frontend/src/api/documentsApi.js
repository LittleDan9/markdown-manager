import { Api } from "./api";

class DocumentsApi extends Api {
  async svgToPngDataUri(svgEl) {
    // 1) Serialize the SVG node to a string
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svgEl);

    // 2) Create a Blob & ObjectURL
    const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    // 3) Load it into an Image
    const img = new Image();
    img.src = url;
    await img.decode();       // wait until it's loaded

    // 4) Draw to a Canvas
    const canvas = document.createElement("canvas");
    canvas.width  = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    // optional: set a white background
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    // 5) Extract PNG data-URI
    const dataUri = canvas.toDataURL("image/png");

    // 6) Clean up
    URL.revokeObjectURL(url);

    return dataUri;
  }

  async exportAsPDF(htmlContent, documentName, isDarkMode = false) {
    const requestData = {
      html_content: htmlContent,
      document_name: documentName,
      is_dark_mode: isDarkMode,
    };
    const res = await this.apiCall(`/pdf/export`, "POST", requestData, {}, { responseType: 'blob' });
    return res.data; // PDF binary or blob
  }

  async getAllDocuments(category = null) {
    let endpoint = "/documents";
    if (category && category !== "All") {
      endpoint += `?category=${encodeURIComponent(category)}`;
    }
    const res = await this.apiCall(endpoint);
    return res.data.documents || [];
  }

  async getDocument(id) {
    const res = await this.apiCall(`/documents/${id}`);
    return res.data;
  }

  async createDocument({ name, content, category, category_id }) {
    // If category_id is provided, use it; otherwise try to resolve category name to ID
    let finalCategoryId = category_id;

    if (!finalCategoryId && category) {
      // Try to get category ID from category name using CategoriesAPI
      try {
        const categoriesApi = (await import('./categoriesApi')).default;
        const categories = await categoriesApi.getCategories();
        const categoryObj = categories.find(cat => cat.name === category);
        finalCategoryId = categoryObj?.id;
      } catch (error) {
        console.warn('Could not resolve category name to ID:', error);
      }
    }

    const requestData = { name, content };
    if (finalCategoryId) {
      requestData.category_id = finalCategoryId;
    }

    const res = await this.apiCall(`/documents`, "POST", requestData);
    return res.data;
  }

  async updateDocument(id, { name, content, category, category_id }) {
    // If category_id is provided, use it; otherwise try to resolve category name to ID
    let finalCategoryId = category_id;

    if (!finalCategoryId && category) {
      // Try to get category ID from category name using CategoriesAPI
      try {
        const categoriesApi = (await import('./categoriesApi')).default;
        const categories = await categoriesApi.getCategories();
        const categoryObj = categories.find(cat => cat.name === category);
        finalCategoryId = categoryObj?.id;
      } catch (error) {
        console.warn('Could not resolve category name to ID:', error);
      }
    }

    const requestData = {};
    if (name !== undefined) requestData.name = name;
    if (content !== undefined) requestData.content = content;
    if (finalCategoryId) requestData.category_id = finalCategoryId;

    const res = await this.apiCall(`/documents/${id}`, "PUT", requestData);
    return res.data;
  }

  async deleteDocument(id) {
    await this.apiCall(`/documents/${id}`, "DELETE");
    return true;
  }

  async getCategories() {
    // Use the proper Categories API instead of document-based categories
    try {
      const categoriesApi = (await import('./categoriesApi')).default;
      const categories = await categoriesApi.getCategories();
      return categories.length ? categories : [{ id: null, name: "General" }];
    } catch (error) {
      console.warn('Could not fetch categories, using fallback:', error);
      return [{ id: null, name: "General" }];
    }
  }

  async addCategory(category) {
    // Use the proper Categories API
    try {
      const categoriesApi = (await import('./categoriesApi')).default;
      const newCategory = await categoriesApi.createCategory(category);
      return newCategory;
    } catch (error) {
      console.error('Failed to create category:', error);
      throw error;
    }
  }

  /**
   * Delete a category using the proper Categories API
   * Note: The new API doesn't support migration - documents with this category
   * will need to be handled by the backend's foreign key constraints
   */
  async deleteCategory(categoryName, options = {}) {
    try {
      const categoriesApi = (await import('./categoriesApi')).default;

      // First, find the category by name to get its ID
      const categories = await categoriesApi.getCategories();
      const category = categories.find(cat => cat.name === categoryName);

      if (!category) {
        throw new Error(`Category "${categoryName}" not found`);
      }

      // Delete using the Categories API
      await categoriesApi.deleteCategory(category.id);

      // Return updated categories
      return await categoriesApi.getCategories();
    } catch (error) {
      console.error('Failed to delete category:', error);
      throw error;
    }
  }

  async getCurrentDocumentId() {
    const res = await this.apiCall(`/documents/current`);
    const doc = res.data;
    return doc && doc.id ? doc.id : null;
  }

  async setCurrentDocumentId(id) {
    const res = await this.apiCall(`/documents/current`, "POST", { doc_id: id });
    return res.data.current_doc_id;
  }

  /**
   * Enable sharing for a document
   * @param {number} id - Document ID
   * @returns {Promise<Object>} - Share response with token and URL
   */
  async enableSharing(id) {
    const res = await this.apiCall(`/documents/${id}/share`, "POST");
    return res.data;
  }

  /**
   * Disable sharing for a document
   * @param {number} id - Document ID
   * @returns {Promise<boolean>} - Success status
   */
  async disableSharing(id) {
    await this.apiCall(`/documents/${id}/share`, "DELETE");
    return true;
  }

  /**
   * Get shared document by token (public access - no auth required)
   * @param {string} shareToken - Share token
   * @returns {Promise<Object>} - Shared document data
   */
  async getSharedDocument(shareToken) {
    const res = await this.apiCall(`/shared/${shareToken}`, "GET", null, {}, { noAuth: true });
    return res.data;
  }
}

export default new DocumentsApi();

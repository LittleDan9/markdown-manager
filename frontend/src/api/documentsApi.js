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
    let endpoint = "/documents/";
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

  async createDocument({ name, content, category }) {
    const res = await this.apiCall(`/documents/`, "POST", { name, content, category });
    return res.data;
  }

  async updateDocument(id, { name, content, category }) {
    const res = await this.apiCall(
      `/documents/${id}`,
      "PUT",
      { name, content, category } );
    return res.data;
  }

  async deleteDocument(id) {
    await this.apiCall(`/documents/${id}`, "DELETE");
    return true;
  }

  async getCategories() {
    const res = await this.apiCall(`/documents/categories/`);
    const cats = res.data;
    return Array.isArray(cats) && cats.length ? cats : ["General"];
  }

  async addCategory(category) {
    // Backend expects { category: string } in body
    const res = await this.apiCall(`/documents/categories/`, "POST", { category });
    return res.data;
  }

  /**
   * Delete a category. If migrateTo is provided, documents are moved to that category.
   * If deleteDocs is true, all documents in the category are deleted.
   * Returns updated categories.
   */
  async deleteCategory(name, { migrateTo = null, deleteDocs = false } = {}) {
    let url = `/documents/categories/${encodeURIComponent(name)}`;
    const params = [];
    if (deleteDocs) params.push("delete_docs=true");
    if (migrateTo) params.push(`migrate_to=${encodeURIComponent(migrateTo)}`);
    if (params.length) url += `?${params.join("&")}`;
    const res = await this.apiCall(url, "DELETE");
    return res.data;
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

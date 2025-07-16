import { Api } from "./api";

class DocumentsApi extends Api {
  async exportAsPDF(htmlContent, documentName, isDarkMode = false) {
    const requestData = {
      html_content: htmlContent,
      document_name: documentName,
      is_dark_mode: isDarkMode,
    };
    const res = await fetch(`${this.baseUrl}/pdf/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestData),
    });
    if (!res.ok) throw new Error("PDF export failed");
    return await res.blob();
  }

  async getAllDocuments(category = null) {
    let endpoint = "/documents/";
    if (category && category !== "All") {
      endpoint += `?category=${encodeURIComponent(category)}`;
    }
    const res = await this.apiCall(endpoint);
    if (!res.ok) throw new Error("Failed to fetch documents");
    const data = await res.json();
    return data.documents || [];
  }

  async getDocument(id) {
    const res = await this.apiCall(`/documents/${id}`);
    if (!res.ok) throw new Error("Failed to fetch document");
    return await res.json();
  }

  async createDocument({ name, content, category }) {
    const res = await this.apiCall(`/documents/`, "POST", { name, content, category });
    if (!res.ok) throw new Error("Failed to create document");
    return await res.json();
  }

  async updateDocument(id, { name, content, category }) {
    const res = await this.apiCall(
      `/documents/${id}`,
      "PUT",
      { name, content, category } );
    if (!res.ok) throw new Error("Failed to update document");
    return await res.json();
  }

  async deleteDocument(id) {
    const res = await this.apiCall(`/documents/${id}`, "DELETE");
    if (!res.ok) throw new Error("Failed to delete document");
    return true;
  }

  async getCategories() {
    const res = await this.apiCall(`/documents/categories/`);
    if (!res.ok) throw new Error("Failed to fetch categories");
    const cats = await res.json();
    return Array.isArray(cats) && cats.length ? cats : ["General"];
  }

  async addCategory(category) {
    // Backend expects { category: string } in body
    const res = await this.apiCall(`/documents/categories/`, "POST", { category });
    if (!res.ok) throw new Error("Failed to add category");
    return await res.json(); // returns updated categories
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
    if (!res.ok) throw new Error("Failed to delete category");
    return await res.json(); // returns updated categories
  }

  async getCurrentDocumentId() {
    const res = await this.apiCall(`/documents/current`);
    if (!res.ok) throw new Error("Failed to fetch current document");
    const doc = await res.json();
    return doc && doc.id ? doc.id : null;
  }

  async setCurrentDocumentId(id) {
    const res = await this.apiCall(`/documents/current`, "POST", { doc_id: id });
    if (!res.ok) throw new Error("Failed to set current document");
    const result = await res.json();
    return result.current_doc_id;
  }
}

export default new DocumentsApi();

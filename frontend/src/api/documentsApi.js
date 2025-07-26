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
    // Create a DOM that will allow extraction of all SVGs
    // const dom = document.createElement("div");
    // dom.innerHTML = htmlContent;

    // // Find all <svg> elements with id starting with "mermaid-"
    // const mermaidSvgs = dom.querySelectorAll('svg[id^="mermaid-"]');

    // // Example: loop and update each SVG (replace with your logic)
    // const jobs = mermaidSvgs.map(async (svg) => {
    //   const dataUri = await this.svgToPngDataUri(svg)
    //   // Replace the SVG with an <img> tag containing the PNG data URI
    //   const img = document.createElement("img");
    //   img.src = dataUri;
    //   img.style.width = "100%"; // Optional: set width to 100% of container
    //   img.style.height = "auto"; // Maintain aspect ratio
    //   svg.replaceWith(img);
    // });

    // await Promise.all(jobs);

    // After modifications, get the updated HTML
    // const renderedHTML = dom.innerHTML;
    const requestData = {
      html_content: htmlContent,
      document_name: documentName,
      is_dark_mode: isDarkMode,
    };
    const res = await this.apiCall(`/pdf/export`, "POST", requestData);
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
    const res = await this.apiCall(`/documents/${id}`, "DELETE");
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
}

export default new DocumentsApi();

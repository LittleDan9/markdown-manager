import { Api } from "./api";

class HighlightingApi extends Api {
  async highlightSyntax(code, language) {
    try {
      const response = await this.apiCall("/highlight/syntax", "POST", { code, language, tokens: "prism" });
      if (!response.ok) throw new Error("Highlighting API error");
      const data = await response.json();
      return data.highlighted_code || code;
    } catch (err) {
      console.warn("Syntax highlighting failed:", err);
      return code;
    }
  }

  async isLanguageSupported(language) {
    try {
      const response = await this.apiCall(`/highlight/languages/${encodeURIComponent(language)}/check`);
      if (!response.ok) return false;
      const data = await response.json();
      return data.languages || {};
    } catch (err) {
      console.warn("Failed to get highlight languages:", err);
      return false;
    }
  }

  async getAvailableLanguages() {
    try {
      const response = await this.apiCall("/highlight/languages");
      if (!response.ok) throw new Error("Failed to fetch languages");
      const data = await response.json();
      return data.languages || {};
    } catch (err) {
      console.warn("Failed to get available languages:", err);
      return {};
    }
  }
}

export default new HighlightingApi();

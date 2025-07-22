import { Api } from "./api";

class HighlightingApi extends Api {
  async highlightSyntax(code, language) {
    try {
      const res = await this.apiCall("/highlight/syntax", "POST", { code, language, tokens: "prism" });
      return res.data.highlighted_code || code;
    } catch (err) {
      console.warn("Syntax highlighting failed:", err);
      return code;
    }
  }

  async isLanguageSupported(language) {
    try {
      const res = await this.apiCall(`/highlight/languages/${encodeURIComponent(language)}/check`);
      return res.data.languages || {};
    } catch (err) {
      console.warn("Failed to get highlight languages:", err);
      return false;
    }
  }

  async getAvailableLanguages() {
    try {
      const res = await this.apiCall("/highlight/languages");
      return res.data.languages || {};
    } catch (err) {
      console.warn("Failed to get available languages:", err);
      return {};
    }
  }
}

export default new HighlightingApi();

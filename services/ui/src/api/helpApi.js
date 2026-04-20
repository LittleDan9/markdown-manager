import { Api } from "./api";

// Detect macOS for OS-specific keyboard shortcuts
const clientOS = /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'mac' : 'windows';

class HelpApi extends Api {
  /**
   * Fetch list of all help topics (slug + title, no content).
   * @returns {Promise<Array<{slug: string, title: string}>>}
   */
  async listTopics() {
    const response = await this.apiCall("/help/topics");
    return response.data;
  }

  /**
   * Fetch a single help topic with full markdown content.
   * OS-specific shortcut substitution is done server-side via ?os= param.
   * @param {string} slug - Topic slug (e.g. "getting-started")
   * @returns {Promise<{slug: string, title: string, content: string}>}
   */
  async getTopic(slug) {
    const response = await this.apiCall(`/help/topics/${encodeURIComponent(slug)}?os=${clientOS}`);
    return response.data;
  }
}

export const helpApi = new HelpApi();
export default helpApi;

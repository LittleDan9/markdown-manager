/**
 * Custom Dictionary API service for managing user's custom spell check words
 */
import { Api } from './api';

class CustomDictionaryAPI extends Api {
  /**
   * Get all custom dictionary words for the current user (words only)
   * @returns {Promise<{words: string[], count: number}>}
   */
  async getWords() {
    const response = await this.apiCall('/dictionary/words');
    return response.data;
  }

  /**
   * Get all custom dictionary entries with details for the current user
   * @returns {Promise<Array>}
   */
  async getEntries() {
    const response = await this.apiCall('/dictionary/');
    return response.data;
  }

  /**
   * Add a new word to the custom dictionary
   * @param {string} word - The word to add
   * @param {string} [notes] - Optional notes about the word
   * @returns {Promise<Object>}
   */
  async addWord(word, notes = null) {
    const response = await this.apiCall('/dictionary/', 'POST', {
      word: word.trim(),
      notes
    });
    return response.data;
  }

  /**
   * Update a custom dictionary word (notes only)
   * @param {number} wordId - The ID of the word to update
   * @param {string} notes - Updated notes
   * @returns {Promise<Object>}
   */
  async updateWord(wordId, notes) {
    const response = await this.apiCall(`/dictionary/${wordId}`, 'PUT', {
      notes
    });
    return response.data;
  }

  /**
   * Delete a word from the custom dictionary by ID
   * @param {number} wordId - The ID of the word to delete
   * @returns {Promise<Object>}
   */
  async deleteWord(wordId) {
    const response = await this.apiCall(`/dictionary/${wordId}`, 'DELETE');
    return response.data;
  }

  /**
   * Delete a word from the custom dictionary by word text
   * @param {string} word - The word to delete
   * @returns {Promise<Object>}
   */
  async deleteWordByText(word) {
    const response = await this.apiCall(`/dictionary/word/${encodeURIComponent(word)}`, 'DELETE');
    return response.data;
  }

  /**
   * Bulk add words to the custom dictionary
   * @param {string[]} words - Array of words to add
   * @returns {Promise<Array>}
   */
  async bulkAddWords(words) {
    const response = await this.apiCall('/dictionary/bulk', 'POST', words);
    return response.data;
  }
}

export default new CustomDictionaryAPI();

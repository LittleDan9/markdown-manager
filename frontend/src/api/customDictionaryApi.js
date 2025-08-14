/**
 * Custom Dictionary API service for managing user's custom spell check words
 */
import { Api } from './api';

class CustomDictionaryAPI extends Api {
  /**
   * Get custom dictionary words for the current user, optionally filtered by category
   * @param {number} [categoryId] - Optional category ID to filter words
   * @returns {Promise<{words: string[], count: number}>}
   */
  async getWords(categoryId = null) {
    const params = categoryId ? { category_id: categoryId } : {};
    const response = await this.apiCall('/dictionary/words', 'GET', null, params);
    return response.data;
  }

  /**
   * Get all custom dictionary words for the current user (both user-level and category-level)
   * @returns {Promise<{words: string[], count: number}>}
   */
  async getAllWords() {
    const response = await this.apiCall('/dictionary/words/all');
    return response.data;
  }

  /**
   * Get custom dictionary words for a specific category
   * @param {number} categoryId - The category ID
   * @returns {Promise<{category_id: number, words: string[], count: number}>}
   */
  async getCategoryWords(categoryId) {
    const response = await this.apiCall(`/dictionary/category/${categoryId}/words`);
    return response.data;
  }

  /**
   * Get custom dictionary entries with details, optionally filtered by category
   * @param {number} [categoryId] - Optional category ID to filter entries
   * @returns {Promise<Array>}
   */
  async getEntries(categoryId = null) {
    const params = categoryId ? { category_id: categoryId } : {};
    const response = await this.apiCall('/dictionary/', 'GET', null, params);
    return response.data;
  }

  /**
   * Add a new word to the custom dictionary
   * @param {string} word - The word to add
   * @param {string} [notes] - Optional notes about the word
   * @param {number} [categoryId] - Optional category ID for category-level dictionary
   * @returns {Promise<Object>}
   */
  async addWord(word, notes = null, categoryId = null) {
    const data = {
      word: word.trim(),
      notes
    };
    if (categoryId) {
      data.category_id = categoryId;
    }

    const response = await this.apiCall('/dictionary/', 'POST', data);
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
   * @param {number} [categoryId] - Optional category ID for category-specific deletion
   * @returns {Promise<Object>}
   */
  async deleteWordByText(word, categoryId = null) {
    const params = categoryId ? { category_id: categoryId } : {};
    const response = await this.apiCall(`/dictionary/word/${encodeURIComponent(word)}`, 'DELETE', null, params);
    return response.data;
  }

  /**
   * Bulk add words to the custom dictionary
   * @param {string[]} words - Array of words to add
   * @param {number} [categoryId] - Optional category ID for category-level dictionary
   * @returns {Promise<Array>}
   */
  async bulkAddWords(words, categoryId = null) {
    const params = categoryId ? { category_id: categoryId } : {};
    const response = await this.apiCall('/dictionary/bulk', 'POST', words, params);
    return response.data;
  }
}

export default new CustomDictionaryAPI();

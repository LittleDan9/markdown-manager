/**
 * Custom Dictionary API service for managing user's custom spell check words
 * Updated to support folder-path based dictionaries
 */
import { Api } from './api';

class CustomDictionaryAPI extends Api {
  /**
   * Get custom dictionary words for the current user, optionally filtered by folder path
   * @param {string} [folderPath] - Optional folder path to filter words
   * @param {number} [categoryId] - Optional category ID for backward compatibility
   * @returns {Promise<{words: string[], count: number}>}
   */
  async getWords(folderPath = null, categoryId = null) {
    const params = {};
    if (folderPath) {
      params.folder_path = folderPath;
    } else if (categoryId) {
      // Backward compatibility
      params.category_id = categoryId;
    }
    const response = await this.apiCall('/dictionary/words', 'GET', null, params);
    return response.data;
  }

  /**
   * Get all custom dictionary words for the current user (user-level and all folder-level)
   * @returns {Promise<{words: string[], count: number}>}
   */
  async getAllWords() {
    const response = await this.apiCall('/dictionary/words/all');
    return response.data;
  }

  /**
   * Get custom dictionary words for a specific folder path
   * @param {string} folderPath - The folder path
   * @returns {Promise<{folder_path: string, words: string[], count: number}>}
   */
  async getFolderWords(folderPath) {
    const response = await this.apiCall(`/dictionary/folder/${encodeURIComponent(folderPath)}/words`);
    return response.data;
  }

  /**
   * Get custom dictionary words for a specific category (backward compatibility)
   * @param {number} categoryId - The category ID
   * @returns {Promise<{category_id: number, words: string[], count: number}>}
   */
  async getCategoryWords(categoryId) {
    const response = await this.apiCall(`/dictionary/category/${categoryId}/words`);
    return response.data;
  }

  /**
   * Get custom dictionary entries with details, optionally filtered by folder path
   * @param {string} [folderPath] - Optional folder path to filter entries
   * @param {number} [categoryId] - Optional category ID for backward compatibility
   * @returns {Promise<Array>}
   */
  async getEntries(folderPath = null, categoryId = null) {
    const params = {};
    if (folderPath) {
      params.folder_path = folderPath;
    } else if (categoryId) {
      // Backward compatibility
      params.category_id = categoryId;
    }
    const response = await this.apiCall('/dictionary/', 'GET', null, params);
    return response.data;
  }

  /**
   * Add a new word to the custom dictionary
   * @param {string} word - The word to add
   * @param {string} [notes] - Optional notes about the word
   * @param {string} [folderPath] - Optional folder path for folder-level dictionary
   * @param {number} [categoryId] - Optional category ID for backward compatibility
   * @returns {Promise<Object>}
   */
  async addWord(word, notes = null, folderPath = null, categoryId = null) {
    const data = {
      word: word.trim(),
      notes
    };
    if (folderPath) {
      data.folder_path = folderPath;
    } else if (categoryId) {
      // Backward compatibility
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
   * @param {string} [folderPath] - Optional folder path for folder-specific deletion
   * @param {number} [categoryId] - Optional category ID for backward compatibility
   * @returns {Promise<Object>}
   */
  async deleteWordByText(word, folderPath = null, categoryId = null) {
    const params = {};
    if (folderPath) {
      params.folder_path = folderPath;
    } else if (categoryId) {
      // Backward compatibility
      params.category_id = categoryId;
    }
    const response = await this.apiCall(`/dictionary/word/${encodeURIComponent(word)}`, 'DELETE', null, params);
    return response.data;
  }

  /**
   * Bulk add words to the custom dictionary
   * @param {string[]} words - Array of words to add
   * @param {string} [folderPath] - Optional folder path for folder-level dictionary
   * @param {number} [categoryId] - Optional category ID for backward compatibility
   * @returns {Promise<Array>}
   */
  async bulkAddWords(words, folderPath = null, categoryId = null) {
    const params = {};
    if (folderPath) {
      params.folder_path = folderPath;
    } else if (categoryId) {
      // Backward compatibility
      params.category_id = categoryId;
    }
    const response = await this.apiCall('/dictionary/bulk', 'POST', words, params);
    return response.data;
  }
}

export default new CustomDictionaryAPI();

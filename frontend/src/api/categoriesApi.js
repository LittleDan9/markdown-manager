/**
 * Categories API service for managing user categories
 */
import { Api } from './api';

class CategoriesAPI extends Api {
  /**
   * Get all categories for the current user
   * @returns {Promise<Array>}
   */
  async getCategories() {
    const response = await this.apiCall('/categories');
    return response.data;
  }

  /**
   * Get all categories with statistics (document and dictionary word counts)
   * @returns {Promise<Array>}
   */
  async getCategoriesWithStats() {
    const response = await this.apiCall('/categories/stats');
    return response.data;
  }

  /**
   * Get a specific category by ID
   * @param {number} categoryId - The category ID
   * @returns {Promise<Object>}
   */
  async getCategory(categoryId) {
    const response = await this.apiCall(`/categories/${categoryId}`);
    return response.data;
  }

  /**
   * Create a new category
   * @param {string} name - The category name
   * @returns {Promise<Object>}
   */
  async createCategory(name) {
    const response = await this.apiCall('/categories', 'POST', {
      name: name.trim()
    });
    return response.data;
  }

  /**
   * Update a category
   * @param {number} categoryId - The category ID
   * @param {string} name - The new category name
   * @returns {Promise<Object>}
   */
  async updateCategory(categoryId, name) {
    const response = await this.apiCall(`/categories/${categoryId}`, 'PUT', {
      name: name.trim()
    });
    return response.data;
  }

  /**
   * Delete a category
   * @param {number} categoryId - The category ID
   * @returns {Promise<Object>}
   */
  async deleteCategory(categoryId) {
    const response = await this.apiCall(`/categories/${categoryId}`, 'DELETE');
    return response.data;
  }
}

export default new CategoriesAPI();

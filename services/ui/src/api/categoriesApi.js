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
   * Delete a category, migrating or deleting its documents first.
   * @param {number} categoryId - The category ID to delete
   * @param {Object} [options]
   * @param {number} [options.migrateToId] - Category ID to migrate documents to
   * @param {boolean} [options.deleteDocs] - Delete documents instead of migrating
   * @returns {Promise<Object>}
   */
  async deleteCategory(categoryId, options = {}) {
    const params = new URLSearchParams();
    if (options.deleteDocs) {
      params.append('delete_documents', 'true');
    } else if (options.migrateToId != null) {
      params.append('migrate_to_id', String(options.migrateToId));
    }
    const qs = params.toString();
    const endpoint = qs ? `/categories/${categoryId}?${qs}` : `/categories/${categoryId}`;
    const response = await this.apiCall(endpoint, 'DELETE');
    return response.data;
  }
}

export default new CategoriesAPI();

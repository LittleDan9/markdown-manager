/**
 * DictionaryEntryFormatter.js
 * Handles formatting dictionary entries for UI display
 */

import customDictionaryApi from '@/api/customDictionaryApi';
import AuthService from '../core/AuthService';
import { DictionaryScopeUtils } from './DictionaryScopeUtils.js';

export class DictionaryEntryFormatter {
  constructor(userService, categoryService, folderService) {
    this.userService = userService;
    this.categoryService = categoryService;
    this.folderService = folderService;
  }

  /**
   * Get formatted dictionary entries for UI display
   * @param {string|null} folderPath - Folder path or null for user-level words
   * @param {string|null} categoryId - Category ID for backward compatibility
   * @returns {Promise<Array>} - Array of formatted entries with id, word, notes, etc.
   */
  async getEntries(folderPath = null, categoryId = null) {
    const { isAuthenticated, token } = AuthService.getAuthState();
    
    if (!isAuthenticated || !token) {
      // Return local entries for guest users
      return this.getLocalEntries(folderPath, categoryId);
    }

    try {
      const data = await customDictionaryApi.getEntries(folderPath, categoryId);
      let filteredEntries = Array.isArray(data) ? data : [];
      
      // Additional frontend filtering as fallback
      if (folderPath) {
        const normalizedPath = DictionaryScopeUtils.normalizeFolderPath(folderPath);
        filteredEntries = filteredEntries.filter(entry => 
          entry.folder_path === normalizedPath
        );
      } else if (categoryId) {
        // Backward compatibility
        filteredEntries = filteredEntries.filter(entry => 
          entry.category_id === parseInt(categoryId)
        );
      } else {
        // User-level entries
        filteredEntries = filteredEntries.filter(entry => 
          entry.category_id === null && entry.folder_path === null
        );
      }
      
      return filteredEntries;
    } catch (error) {
      console.error('Failed to load dictionary entries:', error);
      if (error.message?.includes("Not authenticated")) {
        return this.getLocalEntries(folderPath, categoryId);
      }
      throw error;
    }
  }

  /**
   * Get local entries for guest users or fallback
   * @param {string|null} folderPath - Folder path or null for user-level words
   * @param {string|null} categoryId - Category ID for backward compatibility
   * @returns {Array} - Array of local entries
   */
  getLocalEntries(folderPath = null, categoryId = null) {
    if (folderPath) {
      const normalizedPath = DictionaryScopeUtils.normalizeFolderPath(folderPath);
      const words = this.folderService.getFolderWords(normalizedPath);
      return words.map((word, index) => ({
        id: `local-folder-${normalizedPath}-${index}`,
        word,
        notes: null,
        folder_path: normalizedPath,
        category_id: null,
        isLocal: true
      }));
    } else if (categoryId) {
      // Backward compatibility
      const words = this.categoryService.getCategoryWords(categoryId);
      return words.map((word, index) => ({
        id: `local-${categoryId}-${index}`,
        word,
        notes: null,
        category_id: categoryId,
        folder_path: null,
        isLocal: true
      }));
    } else {
      // User-level words
      const words = this.userService.getCustomWords();
      return words.map((word, index) => ({
        id: `local-user-${index}`,
        word,
        notes: null,
        category_id: null,
        folder_path: null,
        isLocal: true
      }));
    }
  }
}

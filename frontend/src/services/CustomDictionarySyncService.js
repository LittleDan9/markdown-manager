/**
 * Custom Dictionary Sync Service
 * Handles syncing custom dictionary words between localStorage and backend
 */
import customDictionaryApi from '../api/customDictionaryApi';
import SpellCheckService from './SpellCheckService';

class CustomDictionarySyncService {
  /**
   * Sync dictionary with backend after login
   * Loads words from backend and merges with local storage
   */
  async syncAfterLogin() {
    try {
      console.log('Syncing custom dictionary after login...');

      // Check if user has auth token before making API calls
      const token = localStorage.getItem("authToken");
      if (!token) {
        console.log('No auth token found, skipping backend sync');
        return SpellCheckService.getCustomWords();
      }

      // Get words from backend
      const response = await customDictionaryApi.getWords();
      console.log('Backend response:', response);

      // Extract words array from response
      const backendWords = response.words || [];
      console.log('Backend words:', backendWords);

      // Get local words
      const localWords = SpellCheckService.getCustomWords();
      console.log('Local words:', localWords);

      // Merge and update local storage
      const mergedWords = SpellCheckService.syncWithBackend(backendWords);

      // If there are local words not on backend, upload them
      const wordsToUpload = localWords.filter(word =>
        !backendWords.includes(word.toLowerCase())
      );

      if (wordsToUpload.length > 0) {
        console.log(`Uploading ${wordsToUpload.length} local words to backend...`);
        await customDictionaryApi.bulkAddWords(wordsToUpload);
      }

      console.log(`Dictionary sync complete. Total words: ${mergedWords.length}`);
      return mergedWords;
    } catch (error) {
      console.error('Failed to sync custom dictionary:', error);
      // Don't throw error - allow app to continue working with local words
      return SpellCheckService.getCustomWords();
    }
  }

  /**
   * Add word to both local storage and backend
   * @param {string} word - Word to add
   * @param {string} [notes] - Optional notes
   */
  async addWord(word, notes = null) {
    // Add to local storage first (immediate feedback)
    SpellCheckService.addCustomWord(word);

    // Only sync to backend if user is authenticated
    const token = localStorage.getItem("authToken");
    if (!token) {
      console.log('No auth token, word added to local storage only');
      return;
    }

    try {
      // Then add to backend
      await customDictionaryApi.addWord(word, notes);
    } catch (error) {
      console.error('Failed to add word to backend:', error);
      // Word is still added locally, so don't revert
      throw error;
    }
  }

  /**
   * Remove word from both local storage and backend
   * @param {string} word - Word to remove
   */
  async removeWord(word) {
    // Remove from local storage first
    SpellCheckService.removeCustomWord(word);

    // Only sync to backend if user is authenticated
    const token = localStorage.getItem("authToken");
    if (!token) {
      console.log('No auth token, word removed from local storage only');
      return;
    }

    try {
      // Then remove from backend
      await customDictionaryApi.deleteWordByText(word);
    } catch (error) {
      console.error('Failed to remove word from backend:', error);
      // Don't add back to local storage since removal was successful locally
      throw error;
    }
  }

  /**
   * Alias for removeWord to match expected API
   * @param {string} word - Word to delete
   */
  async deleteWord(word) {
    return this.removeWord(word);
  }

  /**
   * Clear local dictionary (for logout)
   */
  clearLocal() {
    SpellCheckService.setCustomWords([]);
    console.log('Local custom dictionary cleared');
  }
}

export default new CustomDictionarySyncService();

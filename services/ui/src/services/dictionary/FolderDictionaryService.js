/**
 * FolderDictionaryService.js
 * Manages folder-level custom dictionary words and localStorage
 */

import { DictionaryScopeUtils } from './DictionaryScopeUtils.js';

export class FolderDictionaryService {
  constructor() {
    this.FOLDER_WORDS_KEY = 'folderCustomDictionary';
    this.folderWords = new Map(); // Map<folderPath, Set<word>>
    this.loadFolderWordsFromStorage();
  }

  /**
   * Load folder words from localStorage
   */
  loadFolderWordsFromStorage() {
    try {
      const stored = localStorage.getItem(this.FOLDER_WORDS_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        this.folderWords = new Map();
        for (const [folderPath, words] of Object.entries(data)) {
          this.folderWords.set(folderPath, new Set(words));
        }
      }
    } catch (err) {
      console.error('Error loading folder words from storage:', err);
    }
  }

  /**
   * Save folder words to localStorage
   */
  saveFolderWordsToStorage() {
    try {
      const data = {};
      for (const [folderPath, wordsSet] of this.folderWords.entries()) {
        data[folderPath] = Array.from(wordsSet);
      }
      localStorage.setItem(this.FOLDER_WORDS_KEY, JSON.stringify(data));
    } catch (err) {
      console.error('Error saving folder words to storage:', err);
    }
  }

  /**
   * Add a word to the folder-specific custom dictionary
   * @param {string} folderPath - The folder path (e.g., '/Work' or '/github/my-repo')
   * @param {string} word - The word to add
   */
  addFolderWord(folderPath, word) {
    const normalizedWord = word.toLowerCase().trim();
    const normalizedPath = DictionaryScopeUtils.normalizeFolderPath(folderPath);
    
    if (normalizedWord && normalizedPath) {
      if (!this.folderWords.has(normalizedPath)) {
        this.folderWords.set(normalizedPath, new Set());
      }
      this.folderWords.get(normalizedPath).add(normalizedWord);
      this.saveFolderWordsToStorage();
      window.dispatchEvent(new CustomEvent('dictionary:folderWordAdded', {
        detail: { folderPath: normalizedPath, word: normalizedWord }
      }));
    }
  }

  /**
   * Remove a word from the folder-specific custom dictionary
   * @param {string} folderPath - The folder path
   * @param {string} word - The word to remove
   */
  removeFolderWord(folderPath, word) {
    const normalizedWord = word.toLowerCase().trim();
    const normalizedPath = DictionaryScopeUtils.normalizeFolderPath(folderPath);
    
    if (this.folderWords.has(normalizedPath)) {
      this.folderWords.get(normalizedPath).delete(normalizedWord);
      if (this.folderWords.get(normalizedPath).size === 0) {
        this.folderWords.delete(normalizedPath);
      }
      this.saveFolderWordsToStorage();
      window.dispatchEvent(new CustomEvent('dictionary:folderWordRemoved', {
        detail: { folderPath: normalizedPath, word: normalizedWord }
      }));
    }
  }

  /**
   * Get words for a specific folder path
   * @param {string} folderPath - The folder path
   * @returns {string[]}
   */
  getFolderWords(folderPath) {
    const normalizedPath = DictionaryScopeUtils.normalizeFolderPath(folderPath);
    if (!this.folderWords.has(normalizedPath)) {
      return [];
    }
    return Array.from(this.folderWords.get(normalizedPath));
  }

  /**
   * Check if a word is in a folder's custom dictionary
   * @param {string} folderPath - The folder path
   * @param {string} word - The word to check
   * @returns {boolean}
   */
  isFolderWord(folderPath, word) {
    const normalizedPath = DictionaryScopeUtils.normalizeFolderPath(folderPath);
    if (!this.folderWords.has(normalizedPath)) {
      return false;
    }
    return this.folderWords.get(normalizedPath).has(word.toLowerCase());
  }

  /**
   * Set folder words (used when loading from backend)
   * @param {Map<string, string[]>} folderWordsMap - Map of folder path to words array
   */
  setFolderWords(folderWordsMap) {
    this.folderWords = new Map();
    for (const [folderPath, words] of folderWordsMap.entries()) {
      this.folderWords.set(folderPath, new Set(words.map(word => word.toLowerCase())));
    }
    this.saveFolderWordsToStorage();
    window.dispatchEvent(new CustomEvent('dictionary:folderUpdated', {
      detail: { folderWords: this.folderWords }
    }));
  }

  /**
   * Clear folder dictionary data
   */
  clear() {
    this.folderWords.clear();
    localStorage.removeItem(this.FOLDER_WORDS_KEY);
  }

  /**
   * Get word count for a specific folder
   * @param {string} folderPath - The folder path
   * @returns {number} - Number of words
   */
  getWordCount(folderPath) {
    const normalizedPath = DictionaryScopeUtils.normalizeFolderPath(folderPath);
    return this.getFolderWords(normalizedPath).length;
  }

  /**
   * Get all folder paths with words
   * @returns {string[]} - Array of folder paths
   */
  getAllFolderPaths() {
    return Array.from(this.folderWords.keys());
  }
}

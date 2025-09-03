// spellCheckService.js
// Combined sync, async (single worker), and parallel pool logic

// import { chunkText } from './utils';
import SpellCheckWorkerPool from './SpellCheckWorkerPool';
import { chunkTextWithOffsets } from '@/utils';
import { DictionaryService } from '../utilities';

export class SpellCheckService {
  constructor(chunkSize = 1000) {
    this.speller = null;
    this.poolSize = Math.max(1, Math.min(4, navigator.hardwareConcurrency || 2));
    this.workerPool = new SpellCheckWorkerPool(this.poolSize);
    this.chunkSize = chunkSize;
    this.progressiveCheckState = {
      isRunning: false,
      currentChunk: 0,
      totalChunks: 0,
      results: [],
      onProgress: null,
      onComplete: null
    };
  }

  async init() {
    if (this.speller) return;
    try {
      const [affResponse, dicResponse] = await Promise.all([
        fetch('/dictionary/index.aff'),
        fetch('/dictionary/index.dic')
      ]);
      const aff = await affResponse.text();
      const dic = await dicResponse.text();

      await this.workerPool.init();
    } catch (err) {
      console.error('SpellCheckService init error', err);
    }
  }

  async scan(text, onProgress = () => {}, categoryId = null, folderPath = null){
    await this.init();

    const bucket = chunkTextWithOffsets(text, this.chunkSize);
    const chunks = bucket.map(chunk => ({
      text: chunk.text,
      startOffset: chunk.offset,
    }));

    this.workerPool._chunkOffsets = chunks.map(c => c.offset);

    // Get applicable custom words for this folder or category
    const customWords = DictionaryService.getAllApplicableWords(folderPath, categoryId);

    const issues = await this.workerPool.runSpellCheckOnChunks(
      chunks,
      customWords,
      onProgress
    );

    return issues;
  }

  /**
   * Get custom words for backward compatibility
   * @param {string} [categoryId] - Optional category ID
   * @param {string} [folderPath] - Optional folder path
   * @returns {string[]} Array of custom words
   */
  getCustomWords(categoryId = null, folderPath = null) {
    return DictionaryService.getAllApplicableWords(folderPath, categoryId);
  }

  /**
   * Add a custom word - delegates to DictionaryService
   * @param {string} word - Word to add
   * @param {string} [categoryId] - Optional category ID
   * @param {string} [folderPath] - Optional folder path
   */
  addCustomWord(word, categoryId = null, folderPath = null) {
    if (folderPath) {
      DictionaryService.addFolderWord(folderPath, word);
    } else if (categoryId) {
      DictionaryService.addCategoryWord(categoryId, word);
    } else {
      DictionaryService.addCustomWord(word);
    }
  }

  /**
   * Remove a custom word - delegates to DictionaryService
   * @param {string} word - Word to remove
   * @param {string} [categoryId] - Optional category ID
   * @param {string} [folderPath] - Optional folder path
   */
  removeCustomWord(word, categoryId = null, folderPath = null) {
    if (folderPath) {
      DictionaryService.removeFolderWord(folderPath, word);
    } else if (categoryId) {
      DictionaryService.removeCategoryWord(categoryId, word);
    } else {
      DictionaryService.removeCustomWord(word);
    }
  }
}

export default new SpellCheckService();
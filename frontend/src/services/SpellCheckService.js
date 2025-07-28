// spellCheckService.js
// Combined sync, async (single worker), and parallel pool logic

// import { chunkText } from './utils';
import { SpellCheckWorkerPool } from './spellCheckWorkerPool';
import WorkerScriptURL from '../workers/spellCheck.worker.js';
import { chunkTextWithOffsets } from '@/utils';
import nspell from 'nspell';

export class SpellCheckService {
  constructor() {
    this.speller = null;
    this.customWords = new Set(); // Local custom words storage
    this.CUSTOM_WORDS_KEY = 'customDictionary';
    this.workerPool = new SpellCheckWorkerPool({
      workerPath: WorkerScriptURL,
      poolSize: 4 // Adjust based on your needs
    });
    this._worker = null;
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
      this.speller = nspell(aff, dic);

      // Load custom words from localStorage
      this.loadCustomWordsFromStorage();
      await this.workerPool.init();
    } catch (err) {
      console.error('SpellCheckService init error', err);
    }
  }

  loadCustomWordsFromStorage() {
    try {
      const stored = localStorage.getItem(this.CUSTOM_WORDS_KEY);
      if (stored) {
        const words = JSON.parse(stored);
        this.customWords = new Set(words);
      }
    } catch (err) {
      console.error('Error loading custom words from storage:', err);
    }
  }

  async scan(text, customWords = [], onProgress = () => {}){
    await this.init();

    customWords.forEach(word => this.addCustomWord(word));

    const bucket = chunkTextWithOffsets(text, 1000); // Adjust chunk size as needed
    const chunks = bucket.map(chunks => chunks.text);
    const offsets = bucket.map(chunks => chunks.offset);

    for (let i = 0; i < text.length; i += chunkSize) {
      chunks.push(text.slice(i, i + chunkSize));
      offsets.push(i);
    }

    this.workerPool._chunkOffsets = offsets;

    const issues = await this.workerPool.checkChunks(
      chunks,
      this.customWords,
      onProgress
    );

    return issues;
  }


  /* Synchronous spell check: returns array of { word, index } */
  check(text) {
    if (!this.speller) {
      throw new Error('SpellCheckService: must init() before check()');
    }

    const issues = [];
    // simple word-splitting; adapt to your tokenizer if needed
    const wordRegex = /\b[^\s]+\b/g;
    let match;
    while ((match = wordRegex.exec(text)) !== null) {
      const word = match[0];
      if (!this.speller.correct(word)) {
        issues.push({
          word,
          offset: match.index,
          suggestions: this.speller.suggest(word).slice(0, 5),
        });
      }
    }
    return issues;
  }

  /* Single-worker async check: returns Promise<issues[]> */
  async checkAsync(text) {
    return this.check(text);
  }


  /* Parallel pool async check: returns Promise<issues[]> */
  async checkAsyncParallel(chunks, customWords = []) {
    if (!this.speller) {
      throw new Error('SpellCheckService: must init() before checkAsyncParallel()');
    }

    // update the customWords set
    customWords.forEach((w) => this.speller.add(w));

    // let your pool handle the rest
    // assume `this.workerPool` was constructed in constructor/init
    return this.workerPool.runSpellCheckOnChunks(
      chunks,
      customWords,
      (progress) => {
        // optional: emit progress events from here
        if (this.onProgress) this.onProgress(progress);
      }
    );
  }

  /* Dictionary Support */
  /**
   * Save custom words to localStorage
   */
  saveCustomWordsToStorage() {
    try {
      const words = Array.from(this.customWords);
      localStorage.setItem(this.CUSTOM_WORDS_KEY, JSON.stringify(words));
    } catch (err) {
      console.error('Error saving custom words to storage:', err);
    }
  }

  /**
   * Add a word to the custom dictionary
   * @param {string} word - The word to add
   */
  addCustomWord(word) {
    const normalizedWord = word.toLowerCase().trim();
    if (normalizedWord) {
      this.customWords.add(normalizedWord);
      this.saveCustomWordsToStorage();
    }
  }

  /**
   * Remove a word from the custom dictionary
   * @param {string} word - The word to remove
   */
  removeCustomWord(word) {
    const normalizedWord = word.toLowerCase().trim();
    this.customWords.delete(normalizedWord);
    this.saveCustomWordsToStorage();
  }

  /**
   * Check if a word is in the custom dictionary
   * @param {string} word - The word to check
   * @returns {boolean}
   */
  isCustomWord(word) {
    return this.customWords.has(word.toLowerCase());
  }

  /**
   * Get all custom words
   * @returns {string[]}
   */
  getCustomWords() {
    return Array.from(this.customWords);
  }

  /**
   * Set custom words (used when loading from backend)
   * @param {string[]} words - Array of words to set
   */
  setCustomWords(words) {
    this.customWords = new Set(words.map(word => word.toLowerCase()));
    this.saveCustomWordsToStorage();
  }

  /**
   * Sync custom words with backend (add any new words from backend)
   * @param {string[]} backendWords - Words from backend
   */
  syncWithBackend(backendWords) {
    const currentWords = this.getCustomWords();

    // Handle undefined or null backendWords
    const safeBackendWords = Array.isArray(backendWords) ? backendWords : [];
    const backendWordsSet = new Set(safeBackendWords.map(word => word.toLowerCase()));

    // Merge backend words with local words
    const mergedWords = new Set([...currentWords, ...backendWordsSet]);
    this.customWords = mergedWords;
    this.saveCustomWordsToStorage();

    return Array.from(mergedWords);
  }

}

export default new SpellCheckService();
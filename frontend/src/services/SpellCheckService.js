// spellCheckService.js
// Combined sync, async (single worker), and parallel pool logic

// import { chunkText } from './utils';
import SpellCheckWorkerPool from '@/services/SpellCheckWorkerPool';
import WorkerScriptURL from 'worker-loader!@/workers/spellCheck.worker.js';
import { chunkTextWithOffsets } from '@/utils';
import DictionaryService from '@/services/DictionaryService';

export class SpellCheckService {
  constructor(chunkSize = 1000) {
    this.speller = null;
    this.poolSize = Math.max(1, Math.min(4, navigator.hardwareConcurrency || 2));
    this.workerPool = new SpellCheckWorkerPool(WorkerScriptURL, this.poolSize);
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

  async scan(text, onProgress = () => {}){
    await this.init();

    const bucket = chunkTextWithOffsets(text, this.chunkSize);
    const chunks = bucket.map(chunks => chunks.text);
    const offsets = bucket.map(chunks => chunks.offset);

    this.workerPool._chunkOffsets = offsets;

    const issues = await this.workerPool.runSpellCheckOnChunks(
      chunks,
      DictionaryService.getCustomWords(),
      onProgress
    );

    return issues;
  }
}

export default new SpellCheckService();
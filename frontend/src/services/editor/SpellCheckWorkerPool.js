// SpellCheckWorkerPool.js
// Manages a pool of spell check workers for parallel chunk processing
const DEFAULT_MAX_WORKERS = 6;

class SpellCheckWorkerPool {
  constructor(maxWorkers) {
    this.maxWorkers = Math.min(
      maxWorkers || navigator.hardwareConcurrency || 2,
      DEFAULT_MAX_WORKERS
    );
    this.workers = [];
    this.idleWorkers = [];
    this.taskQueue = [];
    this.activeTasks = 0;
    this.results = [];
    this.progressCallback = null;
    this.totalChunks = 0;
    this.completedChunks = 0;
  }

  async init() {
    if (this.workers?.length > 0) return;

    for (let i = 0; i < this.maxWorkers; i++) {
      try {
        // Use worker-loader import pattern
        const SpellCheckWorker = require('../../workers/spellCheck.worker.js').default;
        const worker = new SpellCheckWorker();
        worker.onmessage = (e) => this._handleWorkerMessage(worker, e);
        worker.onerror = (err) => {
          console.error(`[SpellCheckWorkerPool] Worker #${i+1} error:`, err.message, err.filename, err.lineno, err.colno, err.error);
          // If this is a network error due to stale bundles, suggest refresh
          if (err.message && err.message.includes('Failed to execute \'importScripts\'')) {
            console.warn('[SpellCheckWorkerPool] Worker failed due to stale bundle. Consider refreshing the page.');
          }
        };
        this.workers.push(worker);
        this.idleWorkers.push(worker);
      } catch (err) {
        console.error(`[SpellCheckWorkerPool] Failed to create worker #${i+1}:`, err);
        if (err && err.message && err.message.includes('Failed to construct')) {
          console.error('[SpellCheckWorkerPool] This may be due to an invalid worker script URL, CORS, or module type issues.');
        }
        // Continue without this worker rather than failing completely
      }
    }

    // If no workers were created successfully, log a warning but don't fail
    if (this.workers.length === 0) {
      console.warn('[SpellCheckWorkerPool] No workers could be created. Spell checking will be disabled.');
    }
  }

  terminate() {
    this.workers.forEach(w => w.terminate());
    this.workers = [];
    this.idleWorkers = [];
    this.taskQueue = [];
    this.results = [];
    this.activeTasks = 0;
    this.progressCallback = null;
    this.totalChunks = 0;
    this.completedChunks = 0;
  }

  runSpellCheckOnChunks(chunks, customWords, progressCallback) {
    this.results = new Array(chunks.length);
    this.progressCallback = progressCallback;
    this.totalChunks = chunks.length;
    this.completedChunks = 0;
    this.taskQueue = chunks.map((chunk, idx) => ({ chunk, idx }));
    this.activeTasks = 0;
    this._customWords = customWords; // Store customWords for use in _dispatchTasks
    return new Promise((resolve, reject) => {
      this._resolve = (...args) => { resolve(...args); };
      this._reject = (...args) => { reject(...args); };
      this._dispatchTasks();
    });
  }

  _dispatchTasks() {
    while (this.idleWorkers.length > 0 && this.taskQueue.length > 0) {
      const worker = this.idleWorkers.pop();
      const { chunk, idx } = this.taskQueue.shift();
      this.activeTasks++;
      worker._currentTaskIdx = idx;
      worker.postMessage({
        type: 'spellCheckChunk',
        chunk,
        customWords: this._customWords
      });
    }
  }

  _handleWorkerMessage(worker, e) {
    if (e.data && e.data.type === 'spellCheckChunkResult') {
      const idx = worker._currentTaskIdx;
      this.results[idx] = e.data.issues;
      this.completedChunks++;
      if (this.progressCallback) {
        this.progressCallback({
          percentComplete: (this.completedChunks / this.totalChunks) * 100,
          currentChunk: this.completedChunks,
          totalChunks: this.totalChunks
        });
      }
      this.activeTasks--;
      this.idleWorkers.push(worker);
      if (this.completedChunks === this.totalChunks) {
        // All done
        this._resolve([].concat(...this.results));
      } else {
        this._dispatchTasks();
      }
    }
  }
}

// Export class (not singleton) because it's instantiated with parameters
export default SpellCheckWorkerPool;
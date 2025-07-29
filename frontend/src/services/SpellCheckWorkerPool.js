// SpellCheckWorkerPool.js
// Manages a pool of spell check workers for parallel chunk processing

const DEFAULT_MAX_WORKERS = 4;

// workerScriptUrl must be a URL object (e.g., new URL('../workers/spellCheck.worker.js', import.meta.url))
class SpellCheckWorkerPool {
  constructor(SpellCheckWorker, maxWorkers) {
    console.log('[SpellCheckWorkerPool] SpellCheckWorker:', SpellCheckWorker);
    this.maxWorkers = Math.min(
      maxWorkers || navigator.hardwareConcurrency || 2,
      DEFAULT_MAX_WORKERS
    );
    this.SpellCheckWorker = SpellCheckWorker;
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
    // Create workers (classic, no module type)
    if (this.workers?.length > 0) return;

    for (let i = 0; i < this.maxWorkers; i++) {
      try {
        // workerScriptUrl is always a URL object
        console.log(`[SpellCheckWorkerPool] Creating worker #${i+1}`);
        const worker = new this.SpellCheckWorker({ type: 'module' });

        worker.onmessage = (e) => this._handleWorkerMessage(worker, e);
        worker.onerror = (err) => {
          console.error(`[SpellCheckWorkerPool] Worker #${i+1} error:`, err.message, err.filename, err.lineno, err.colno, err.error);
        };
        this.workers.push(worker);
        this.idleWorkers.push(worker);
        console.log(`[SpellCheckWorkerPool] Worker #${i+1} created successfully.`);
      } catch (err) {
        console.error(`[SpellCheckWorkerPool] Failed to create worker #${i+1}:`, err);
        if (err && err.message && err.message.includes('Failed to construct')) {
          console.error('[SpellCheckWorkerPool] This may be due to an invalid worker script URL, CORS, or module type issues.');
        }
      }
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
    console.log(`[SpellCheckWorkerPool] Running spell check on ${chunks.length} chunks with ${this.maxWorkers} workers.`);
    this.results = new Array(chunks.length);
    this.progressCallback = progressCallback;
    this.totalChunks = chunks.length;
    this.completedChunks = 0;
    this.taskQueue = chunks.map((chunk, idx) => ({ chunk, idx }));
    this.activeTasks = 0;
    this._customWords = customWords; // Store customWords for use in _disACpatchTasks
    return new Promise((resolve, reject) => {
      this._resolve = (...args) => { console.log('[SpellCheckWorkerPool] Promise resolved with:', ...args); resolve(...args); };
      this._reject = (...args) => { console.log('[SpellCheckWorkerPool] Promise rejected with:', ...args); reject(...args); };
      this._dispatchTasks();
    });
  }

  _dispatchTasks() {
    while (this.idleWorkers.length > 0 && this.taskQueue.length > 0) {
      const worker = this.idleWorkers.pop();
      const { chunk, idx } = this.taskQueue.shift();
      this.activeTasks++;
      worker._currentTaskIdx = idx;
      console.log('[SpellCheckWorkerPool] Dispatching chunk', idx, 'to worker', worker);
      worker.postMessage({
        type: 'spellCheckChunk',
        chunk,
        customWords: this._customWords
      });
    }
  }

  _handleWorkerMessage(worker, e) {
    console.log('[SpellCheckWorkerPool] Worker message received:', e.data);
    if (e.data && e.data.type === 'spellCheckChunkResult') {
      const idx = worker._currentTaskIdx;
      this.results[idx] = e.data.issues;
      this.completedChunks++;
      if (this.progressCallback) {
        this.progressCallback({
          progress: this.completedChunks / this.totalChunks,
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

export default SpellCheckWorkerPool;
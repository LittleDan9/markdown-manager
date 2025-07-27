// SpellCheckService.js (worker integration)
// Add this to your SpellCheckService module

let spellCheckWorker = null;
let workerReady = false;
let pendingRequests = [];

function initWorker() {
  if (spellCheckWorker) return;
  spellCheckWorker = new Worker(new URL('../workers/spellCheck.worker.js', import.meta.url), { type: 'module' });
  spellCheckWorker.onmessage = (e) => {
    const { type, issues, requestId, progress, currentChunk, totalChunks } = e.data;
    const req = pendingRequests.find(r => r.id === requestId);
    if (!req) return;
    if (type === 'progress' && req.onProgress) {
      req.onProgress({ progress, currentChunk, totalChunks });
    }
    // Only resolve and process issues on 'complete' message
    if (type === 'complete') {
      req.resolve(issues);
      pendingRequests = pendingRequests.filter(r => r.id !== requestId);
    }
  };
  workerReady = true;
}

// progressCallback: function({ progress, currentChunk, totalChunks })
export async function checkAsync(text, customWords = [], progressCallback) {
  initWorker();
  return new Promise((resolve, reject) => {
    const requestId = Math.random().toString(36).slice(2);
    pendingRequests.push({ id: requestId, resolve, reject, onProgress: progressCallback });
    spellCheckWorker.postMessage({ text, customWords, requestId });
  });
}

// ...existing SpellCheckService code...

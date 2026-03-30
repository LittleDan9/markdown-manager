/**
 * Async Job Manager
 * Manages background spell-check jobs with Redis-backed state storage.
 * Jobs are processed via setImmediate to avoid blocking the event loop.
 */

const Redis = require('ioredis');
const { v4: uuidv4 } = require('uuid');

const JOB_PREFIX = 'spellcheck:job:';
const JOB_TTL_SECONDS = 300; // 5 minutes — results expire after this

class AsyncJobManager {
  constructor() {
    this.redis = null;
    this.initialized = false;
  }

  /**
   * Initialize Redis connection
   */
  async init() {
    if (this.initialized) return;

    this.redis = new Redis({
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: parseInt(process.env.REDIS_PORT, 10) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB, 10) || 0,
      maxRetriesPerRequest: 3,
      lazyConnect: true
    });

    await this.redis.connect();
    console.log('[AsyncJobManager] Redis connection established');
    this.initialized = true;
  }

  /**
   * Create a new job and return its ID immediately
   * @param {Object} payload - The spell-check request body
   * @returns {string} jobId
   */
  async createJob(payload) {
    const jobId = uuidv4();
    const job = {
      status: 'queued',
      createdAt: Date.now(),
      payload: JSON.stringify(payload)
    };

    await this.redis.hmset(`${JOB_PREFIX}${jobId}`, job);
    await this.redis.expire(`${JOB_PREFIX}${jobId}`, JOB_TTL_SECONDS);
    return jobId;
  }

  /**
   * Mark a job as processing
   */
  async markProcessing(jobId) {
    await this.redis.hset(`${JOB_PREFIX}${jobId}`, 'status', 'processing');
  }

  /**
   * Store completed results
   */
  async markCompleted(jobId, result) {
    const key = `${JOB_PREFIX}${jobId}`;
    await this.redis.hmset(key, {
      status: 'completed',
      completedAt: Date.now(),
      result: JSON.stringify(result)
    });
    // Refresh TTL so result is available for retrieval
    await this.redis.expire(key, JOB_TTL_SECONDS);
  }

  /**
   * Store failure info
   */
  async markFailed(jobId, errorMessage) {
    const key = `${JOB_PREFIX}${jobId}`;
    await this.redis.hmset(key, {
      status: 'failed',
      completedAt: Date.now(),
      error: errorMessage
    });
    await this.redis.expire(key, JOB_TTL_SECONDS);
  }

  /**
   * Get job status and results
   * @returns {{ status, result?, error?, createdAt, completedAt? }}
   */
  async getJob(jobId) {
    const key = `${JOB_PREFIX}${jobId}`;
    const data = await this.redis.hgetall(key);

    if (!data || !data.status) {
      return null;
    }

    const job = {
      status: data.status,
      createdAt: parseInt(data.createdAt, 10)
    };

    if (data.completedAt) {
      job.completedAt = parseInt(data.completedAt, 10);
    }

    if (data.status === 'completed' && data.result) {
      job.result = JSON.parse(data.result);
    }

    if (data.status === 'failed' && data.error) {
      job.error = data.error;
    }

    return job;
  }

  /**
   * Cleanup — called during graceful shutdown
   */
  async cleanup() {
    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
      this.initialized = false;
      console.log('[AsyncJobManager] Redis connection closed');
    }
  }
}

module.exports = new AsyncJobManager();

/**
 * @fileoverview Request Queue with Concurrency Limits and Retry Logic
 * @module core/request-queue
 */

import { createLogger } from '../utils/logger.js';

const logger = createLogger('request-queue.js');

/**
 * @class RequestQueue
 * @description Manages queued requests with concurrency control and exponential backoff retry
 */
class RequestQueue {
    constructor(options = {}) {
        this.maxConcurrent = options.maxConcurrent || 3;
        this.retryDelay = options.retryDelay || 1000;
        this.maxRetries = options.maxRetries || 3;
        this.maxQueueSize = options.maxQueueSize || 100;

        this.running = 0;
        this.queue = [];
        this.pending = new Map();
        this.stats = {
            enqueued: 0,
            dequeued: 0,
            completed: 0,
            failed: 0,
            retried: 0
        };
    }

    /**
     * Add a request to the queue
     * @param {Function} taskFn - Async function to execute
     * @param {object} options - Queue options
     * @returns {Promise<object>} Result or error
     */
    async enqueue(taskFn, options = {}) {
        const id = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const priority = options.priority || 0;

        if (this.queue.length >= this.maxQueueSize) {
            throw new Error(`Queue full (max: ${this.maxQueueSize})`);
        }

        this.stats.enqueued++;

        return new Promise((resolve, reject) => {
            this.queue.push({
                id,
                taskFn,
                priority,
                retries: 0,
                resolve,
                reject,
                createdAt: Date.now(),
                options
            });

            this.queue.sort((a, b) => b.priority - a.priority);
            this._processQueue();
        });
    }

    /**
     * Process next item in queue
     * @private
     */
    _processQueue() {
        if (this.paused) return;
        
        while (this.running < this.maxConcurrent && this.queue.length > 0) {
            const item = this.queue.shift();
            this._executeTask(item);
        }
    }

    /**
     * Execute a queued task with retry logic
     * @private
     */
    async _executeTask(item) {
        this.running++;
        const startTime = Date.now();

        try {
            const result = await this._executeWithRetry(item);
            this.stats.completed++;
            item.resolve({
                success: true,
                data: result,
                duration: Date.now() - startTime,
                attempts: item.retries + 1
            });
        } catch (error) {
            this.stats.failed++;
            item.reject({
                success: false,
                error: error.message,
                attempts: item.retries + 1,
                duration: Date.now() - startTime
            });
        } finally {
            this.running--;
            this._processQueue();
        }
    }

    /**
     * Execute task with exponential backoff retry
     * @private
     */
    async _executeWithRetry(item) {
        const { taskFn, options } = item;
        const maxRetries = options.maxRetries || this.maxRetries;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            item.retries = attempt;

            try {
                return await taskFn();
            } catch (error) {
                const isRetryable = this._isRetryableError(error);
                const shouldRetry = attempt < maxRetries && isRetryable;

                if (!shouldRetry) {
                    throw error;
                }

                this.stats.retried++;
                const delay = this._calculateBackoff(attempt);

                logger.warn(`[${item.id}] Attempt ${attempt + 1} failed: ${error.message}. Retrying in ${delay}ms`);

                await this._sleep(delay);
            }
        }

        throw new Error(`Max retries (${maxRetries}) exceeded`);
    }

    /**
     * Check if error is retryable
     * @private
     */
    _isRetryableError(error) {
        const retryableMessages = [
            'timeout',
            'econnreset',
            'econnrefused',
            'etimedout',
            'socket hang up',
            'network error',
            'temporary failure',
            'service unavailable',
            '429',
            '503',
            '502',
            'ENOTFOUND'
        ];

        const errorMessage = (error.message || '').toLowerCase();
        return retryableMessages.some(msg => errorMessage.includes(msg));
    }

    /**
     * Calculate exponential backoff delay
     * @private
     */
    _calculateBackoff(attempt) {
        const baseDelay = this.retryDelay;
        const maxDelay = 30000;
        const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
        const jitter = Math.random() * 0.3 * delay;

        return Math.floor(delay + jitter);
    }

    /**
     * Sleep utility
     * @private
     */
    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get queue statistics
     * @returns {object}
     */
    getStats() {
        return {
            ...this.stats,
            running: this.running,
            queued: this.queue.length,
            utilization: this.maxConcurrent > 0 ? this.running / this.maxConcurrent : 0
        };
    }

    /**
     * Clear all pending items
     */
    clear() {
        const count = this.queue.length;
        this.queue.forEach(item => {
            item.reject(new Error('Queue cleared'));
        });
        this.queue = [];

        logger.info(`Cleared ${count} queued items`);
    }

    /**
     * Pause queue processing
     */
    pause() {
        this.paused = true;
        logger.info('Queue processing paused');
    }

    /**
     * Resume queue processing
     */
    resume() {
        if (!this.paused) return;
        this.paused = false;
        this._processQueue();
        logger.info('Queue processing resumed');
    }
}

export default RequestQueue;

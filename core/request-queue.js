/**
 * @fileoverview Request Queue with Concurrency Limits and Retry Logic
 * @module core/request-queue
 */

import { createLogger } from '../utils/logger.js';
import { calculateBackoffDelay } from '../utils/retry.js';

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
        this.intervalMs = options.intervalMs ?? options.interval ?? 0;

        this.running = 0;
        this.queue = [];
        this.pending = new Map();
        this.lastStartAt = 0;
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
        let startTime = Date.now();

        try {
            await this._waitForInterval();
            startTime = Date.now();
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
                if (this._isFatalError(error)) {
                    throw error;
                }

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

    _isFatalError(error) {
        if (!error) {
            return false;
        }
        if (error.code === 'CIRCUIT_OPEN') {
            return true;
        }
        return error.fatal === true;
    }

    /**
     * Calculate exponential backoff delay
     * @private
     */
    _calculateBackoff(attempt) {
        return calculateBackoffDelay(attempt, {
            baseDelay: this.retryDelay,
            maxDelay: 30000,
            factor: 2,
            jitterMin: 1,
            jitterMax: 1.3
        });
    }

    /**
     * Sleep utility
     * @private
     */
    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async _waitForInterval() {
        if (!this.intervalMs || this.intervalMs <= 0) {
            this.lastStartAt = Date.now();
            return;
        }

        const now = Date.now();
        const elapsed = this.lastStartAt ? now - this.lastStartAt : this.intervalMs;
        if (elapsed < this.intervalMs) {
            await this._sleep(this.intervalMs - elapsed);
        }
        this.lastStartAt = Date.now();
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

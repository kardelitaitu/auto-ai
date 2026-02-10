/**
 * @fileoverview Request Batcher - Batches similar requests to reduce API calls
 * @module core/request-batcher
 */

import { createLogger } from '../utils/logger.js';

const logger = createLogger('request-batcher.js');

/**
 * @class RequestBatcher
 * @description Batches similar requests together for efficient processing
 */
class RequestBatcher {
    constructor(options = {}) {
        this.batchSize = options.batchSize || 5;
        this.batchDelay = options.batchDelay || 50;
        this.maxBatchDelay = options.maxBatchDelay || 200;
        this.maxBatchAge = options.maxBatchAge || 1000;

        this.batches = new Map();
        this.stats = {
            batchesCreated: 0,
            requestsBatched: 0,
            totalBatchesProcessed: 0,
            avgBatchSize: 0
        };
    }

    /**
     * Add a request to be batched
     * @param {string} batchKey - Key to identify similar requests
     * @param {object} request - Request to batch
     * @returns {Promise<object>} Batch result
     */
    async addToBatch(batchKey, request) {
        const id = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        return new Promise((resolve, reject) => {
            if (!this.batches.has(batchKey)) {
                this.batches.set(batchKey, {
                    requests: [],
                    timer: null,
                    createdAt: Date.now(),
                    resolve,
                    reject
                });
                this.stats.batchesCreated++;

                this._startBatchTimer(batchKey);
            }

            const batch = this.batches.get(batchKey);
            batch.requests.push({
                id,
                request,
                resolve,
                reject
            });
            this.stats.requestsBatched++;

            if (batch.requests.length >= this.batchSize) {
                this._processBatch(batchKey);
            }
        });
    }

    /**
     * Start timer for batch processing
     * @private
     */
    _startBatchTimer(batchKey) {
        const batch = this.batches.get(batchKey);
        if (!batch) return;

        batch.timer = setTimeout(() => {
            this._processBatch(batchKey);
        }, this.batchDelay);
    }

    /**
     * Process a batch of requests
     * @private
     */
    async _processBatch(batchKey) {
        const batch = this.batches.get(batchKey);
        if (!batch) return;

        if (batch.timer) {
            clearTimeout(batch.timer);
            batch.timer = null;
        }

        const age = Date.now() - batch.createdAt;
        if (age > this.maxBatchAge && batch.requests.length === 0) {
            this.batches.delete(batchKey);
            return;
        }

        const requests = batch.requests.splice(0, this.batchSize);
        this.batches.delete(batchKey);

        if (requests.length === 0) return;

        this.stats.totalBatchesProcessed++;
        this._updateAvgBatchSize(requests.length);

        logger.info(`[${batchKey}] Processing batch of ${requests.length} requests (age: ${age}ms)`);

        try {
            const results = await this._executeBatch(requests);

            results.forEach((result, index) => {
                if (result.success) {
                    requests[index].resolve(result);
                } else {
                    requests[index].reject(result);
                }
            });
        } catch (error) {
            requests.forEach(req => {
                req.reject({
                    success: false,
                    error: error.message,
                    batched: true
                });
            });
        }

        if (batch.requests.length > 0) {
            this.batches.set(batchKey, batch);
            this._startBatchTimer(batchKey);
        }
    }

    /**
     * Execute batch of requests - override for custom batching logic
     * @protected
     */
    async _executeBatch(requests) {
        throw new Error('_executeBatch must be implemented by subclass');
    }

    /**
     * Update running average batch size
     * @private
     */
    _updateAvgBatchSize(size) {
        const total = this.stats.totalBatchesProcessed;
        const current = this.stats.avgBatchSize;
        this.stats.avgBatchSize = ((current * (total - 1)) + size) / total;
    }

    /**
     * Get batching statistics
     * @returns {object}
     */
    getStats() {
        const activeBatches = this.batches.size;
        let pendingRequests = 0;

        for (const batch of this.batches.values()) {
            pendingRequests += batch.requests.length;
        }

        return {
            ...this.stats,
            activeBatches,
            pendingRequests,
            efficiency: this.stats.avgBatchSize > 0
                ? Math.round((this.stats.avgBatchSize / this.batchSize) * 100)
                : 0
        };
    }

    /**
     * Clear all pending batches
     */
    clear() {
        for (const [key, batch] of this.batches) {
            if (batch.timer) {
                clearTimeout(batch.timer);
            }
            batch.requests.forEach(req => {
                req.reject(new Error('Batcher cleared'));
            });
        }
        this.batches.clear();
        logger.info('All batches cleared');
    }

    /**
     * Get status of all active batches
     * @returns {object}
     */
    getActiveBatches() {
        const status = {};

        for (const [key, batch] of this.batches) {
            status[key] = {
                count: batch.requests.length,
                age: Date.now() - batch.createdAt,
                waiting: batch.timer !== null
            };
        }

        return status;
    }
}

/**
 * @class LLMBatcher
 * @description Specialized batcher for LLM requests
 */
class LLMBatcher extends RequestBatcher {
    constructor(options = {}) {
        super(options);
        this.maxTokens = options.maxTokens || 500;
        this.localClient = null;
        this.cloudClient = null;
    }

    /**
     * Set LLM clients for batch execution
     * @param {object} clients - { local: LocalClient, cloud: CloudClient }
     */
    setClients(clients) {
        this.localClient = clients.local;
        this.cloudClient = clients.cloud;
    }

    /**
     * Execute batch of LLM requests
     * @protected
     */
    async _executeBatch(requests) {
        if (requests.length === 0) return [];

        const firstRequest = requests[0].request;
        const isVision = firstRequest.payload?.vision !== undefined;

        const batchId = `llm_batch_${Date.now()}`;
        logger.info(`[${batchId}] Executing ${requests.length} LLM requests (vision: ${isVision})`);

        const startTime = Date.now();
        const results = [];

        for (const { request, resolve, reject } of requests) {
            try {
                let response;

                if (isVision) {
                    response = await this.localClient.sendRequest({
                        prompt: request.payload.systemPrompt + '\n\n' + request.payload.userPrompt,
                        vision: request.payload.vision,
                        maxTokens: request.payload.maxTokens || 150,
                        temperature: request.payload.temperature || 0.7
                    });
                } else {
                    response = await this.localClient.sendRequest({
                        prompt: request.payload.systemPrompt + '\n\n' + request.payload.userPrompt,
                        maxTokens: request.payload.maxTokens || 100,
                        temperature: request.payload.temperature || 0.7
                    });
                }

                if (response.success) {
                    results.push({
                        success: true,
                        content: response.content,
                        metadata: {
                            ...response.metadata,
                            batched: true,
                            batchSize: requests.length,
                            batchDuration: Date.now() - startTime
                        }
                    });
                } else {
                    results.push({
                        success: false,
                        error: response.error,
                        batched: true
                    });
                }
            } catch (error) {
                results.push({
                    success: false,
                    error: error.message,
                    batched: true
                });
            }
        }

        logger.info(`[${batchId}] Batch completed in ${Date.now() - startTime}ms`);

        return results;
    }
}

export { RequestBatcher, LLMBatcher };

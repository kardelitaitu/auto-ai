/**
 * @fileoverview Unit tests for RequestBatcher and LLMBatcher
 * @module tests/request-batcher.test
 */

import { RequestBatcher, LLMBatcher } from '../core/request-batcher.js';

describe('RequestBatcher', () => {
    let batcher;

    beforeEach(() => {
        batcher = new RequestBatcher({
            batchSize: 3,
            batchDelay: 50,
            maxBatchDelay: 100,
            maxBatchAge: 500
        });
    });

    afterEach(() => {
        batcher.clear();
    });

    describe('Basic Operations', () => {
        it('should create batch when first request added', async () => {
            const promise = batcher.addToBatch('test-key', { data: 'test' });

            const stats = batcher.getStats();
            expect(stats.batchesCreated).toBe(1);
            expect(stats.activeBatches).toBe(1);

            promise.catch(() => {});
        });

        it('should track statistics', async () => {
            batcher.addToBatch('key1', { data: 'test1' }).catch(() => {});
            batcher.addToBatch('key2', { data: 'test2' }).catch(() => {});
            batcher.addToBatch('key1', { data: 'test3' }).catch(() => {});

            const stats = batcher.getStats();
            expect(stats.requestsBatched).toBe(3);
            expect(stats.activeBatches).toBe(2);
        });
    });

    describe('Batch Processing', () => {
        it('should process batch when size reached', async () => {
            const results = [];

            for (let i = 0; i < 3; i++) {
                const result = batcher.addToBatch('batch-key', { index: i });
                results.push(result);
            }

            const settled = await Promise.allSettled(results);
            expect(settled[0].status).toBe('rejected');
        });

        it('should process batch after delay', async () => {
            const result = batcher.addToBatch('delayed-batch', { data: 'test' });

            await new Promise(r => setTimeout(r, 100));

            const stats = batcher.getStats();
            expect(stats.totalBatchesProcessed).toBe(1);
        }, 1000);
    });

    describe('Batch Keys', () => {
        it('should separate batches by key', async () => {
            batcher.addToBatch('key-a', { data: 'a' }).catch(() => {});
            batcher.addToBatch('key-b', { data: 'b' }).catch(() => {});
            batcher.addToBatch('key-a', { data: 'a2' }).catch(() => {});

            const active = batcher.getActiveBatches();
            expect(active['key-a'].count).toBe(2);
            expect(active['key-b'].count).toBe(1);
        });
    });

    describe('Statistics', () => {
        it('should calculate efficiency', async () => {
            batcher.addToBatch('key1', { data: 'test' }).catch(() => {});
            batcher.addToBatch('key1', { data: 'test' }).catch(() => {});
            batcher.addToBatch('key1', { data: 'test' }).catch(() => {});

            await new Promise(r => setTimeout(r, 100));

            const stats = batcher.getStats();
            expect(stats.efficiency).toBeGreaterThan(0);
        });
    });

    describe('Clear', () => {
        it('should clear all pending batches', async () => {
            batcher.addToBatch('key1', { data: 'test' }).catch(() => {});
            batcher.addToBatch('key2', { data: 'test' }).catch(() => {});

            batcher.clear();

            const stats = batcher.getStats();
            expect(stats.activeBatches).toBe(0);
            expect(stats.pendingRequests).toBe(0);
        });
    });
});

describe('LLMBatcher', () => {
    let batcher;
    let mockLocalClient;

    beforeEach(() => {
        batcher = new LLMBatcher({
            batchSize: 3,
            batchDelay: 50
        });

        mockLocalClient = {
            sendRequest: jest.fn()
        };

        batcher.setClients({ local: mockLocalClient, cloud: {} });
    });

    describe('LLM Request Batching', () => {
        it('should execute batch when size reached', async () => {
            mockLocalClient.sendRequest.mockResolvedValue({
                success: true,
                content: 'test response'
            });

            const request = {
                payload: {
                    systemPrompt: 'You are a helper',
                    userPrompt: 'Say hello',
                    maxTokens: 100
                }
            };

            const result = await batcher.addToBatch('llm-batch', request);

            expect(result.success).toBe(true);
            expect(result.metadata.batched).toBe(true);
        });

        it('should track batch size in metadata', async () => {
            mockLocalClient.sendRequest.mockResolvedValue({
                success: true,
                content: 'test response',
                metadata: { model: 'test-model' }
            });

            await batcher.addToBatch('llm-batch', { payload: { systemPrompt: '', userPrompt: '' } });
            await batcher.addToBatch('llm-batch', { payload: { systemPrompt: '', userPrompt: '' } });
            await batcher.addToBatch('llm-batch', { payload: { systemPrompt: '', userPrompt: '' } });

            await new Promise(r => setTimeout(r, 100));

            const stats = batcher.getStats();
            expect(stats.totalBatchesProcessed).toBe(1);
        });
    });

    describe('Error Handling', () => {
        it('should handle LLM failures', async () => {
            mockLocalClient.sendRequest.mockResolvedValue({
                success: false,
                error: 'Model error'
            });

            const result = await batcher.addToBatch('llm-batch', {
                payload: { systemPrompt: '', userPrompt: '' }
            });

            expect(result.success).toBe(false);
            expect(result.error).toBe('Model error');
        });

        it('should handle exceptions', async () => {
            mockLocalClient.sendRequest.mockRejectedValue(new Error('Network error'));

            const result = await batcher.addToBatch('llm-batch', {
                payload: { systemPrompt: '', userPrompt: '' }
            });

            expect(result.success).toBe(false);
            expect(result.error).toBe('Network error');
        });
    });
});

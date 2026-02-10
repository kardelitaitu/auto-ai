/**
 * @fileoverview Unit tests for RequestQueue
 * @module tests/request-queue.test
 */

import RequestQueue from '../core/request-queue.js';

describe('RequestQueue', () => {
    let queue;

    beforeEach(() => {
        queue = new RequestQueue({
            maxConcurrent: 2,
            maxRetries: 2,
            retryDelay: 50
        });
    });

    afterEach(() => {
        queue.clear();
    });

    describe('Basic Operations', () => {
        it('should enqueue and execute tasks', async () => {
            const result = await queue.enqueue(async () => 'success');
            expect(result.success).toBe(true);
            expect(result.data).toBe('success');
        });

        it('should reject failed tasks', async () => {
            const result = await queue.enqueue(async () => {
                throw new Error('Task failed');
            });
            expect(result.success).toBe(false);
            expect(result.error).toBe('Task failed');
        });

        it('should track statistics', async () => {
            await queue.enqueue(async () => 'task1');
            await queue.enqueue(async () => 'task2');

            const stats = queue.getStats();
            expect(stats.enqueued).toBe(2);
            expect(stats.completed).toBe(2);
        });
    });

    describe('Concurrency Control', () => {
        it('should limit concurrent execution', async () => {
            let running = 0;
            let maxRunning = 0;

            const tasks = Array(5).fill().map(() =>
                queue.enqueue(async () => {
                    running++;
                    maxRunning = Math.max(maxRunning, running);
                    await new Promise(r => setTimeout(r, 50));
                    running--;
                    return 'done';
                })
            );

            await Promise.all(tasks);
            expect(maxRunning).toBeLessThanOrEqual(2);
        });
    });

    describe('Retry Logic', () => {
        it('should retry on failure', async () => {
            let attempts = 0;

            const result = await queue.enqueue(async () => {
                attempts++;
                if (attempts < 3) {
                    throw new Error('Temporary failure');
                }
                return 'success';
            }, { maxRetries: 3 });

            expect(result.attempts).toBe(3);
            expect(result.data).toBe('success');
        });

        it('should fail after max retries', async () => {
            const result = await queue.enqueue(async () => {
                throw new Error('Persistent failure');
            }, { maxRetries: 2 });

            expect(result.success).toBe(false);
            expect(result.attempts).toBe(2);
        });

        it('should not retry non-retryable errors', async () => {
            let attempts = 0;

            const result = await queue.enqueue(async () => {
                attempts++;
                throw new Error('Invalid input');
            }, { maxRetries: 3 });

            expect(attempts).toBe(1);
        });
    });

    describe('Priority Queue', () => {
        it('should execute higher priority tasks first', async () => {
            const order = [];

            const low = queue.enqueue(async () => {
                order.push('low');
                return 'low';
            }, { priority: 1 });

            const high = queue.enqueue(async () => {
                order.push('high');
                return 'high';
            }, { priority: 10 });

            await high;
            await low;

            expect(order[0]).toBe('high');
        });
    });

    describe('Queue Limits', () => {
        it('should throw when queue is full', async () => {
            const smallQueue = new RequestQueue({ maxQueueSize: 2 });

            await smallQueue.enqueue(async () => 'task1');
            await smallQueue.enqueue(async () => 'task2');

            try {
                await smallQueue.enqueue(async () => 'task3');
                fail('Should have thrown');
            } catch (e) {
                expect(e.message).toContain('Queue full');
            }
        });
    });
});

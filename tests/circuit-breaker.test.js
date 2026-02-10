/**
 * @fileoverview Unit tests for CircuitBreaker
 * @module tests/circuit-breaker.test
 */

import CircuitBreaker from '../core/circuit-breaker.js';

describe('CircuitBreaker', () => {
    let breaker;

    beforeEach(() => {
        breaker = new CircuitBreaker({
            failureThreshold: 3,
            successThreshold: 2,
            halfOpenTime: 100,
            monitoringWindow: 1000
        });
    });

    describe('Basic Operations', () => {
        it('should execute successful calls', async () => {
            const result = await breaker.execute('test-model', async () => 'success');
            expect(result).toBe('success');
        });

        it('should record failures', async () => {
            try {
                await breaker.execute('test-model', async () => {
                    throw new Error('Failed');
                });
            } catch (e) {
                // Expected
            }

            const health = breaker.getHealth('test-model');
            expect(health.status).toBe('CLOSED');
            expect(health.recentOperations).toBe(1);
        });
    });

    describe('Circuit States', () => {
        it('should open after failure threshold', async () => {
            for (let i = 0; i < 3; i++) {
                try {
                    await breaker.execute('test-model', async () => {
                        throw new Error('Failed');
                    });
                } catch (e) {
                    // Expected
                }
            }

            const health = breaker.getHealth('test-model');
            expect(health.status).toBe('OPEN');
        });

        it('should reject calls when open', async () => {
            for (let i = 0; i < 3; i++) {
                try {
                    await breaker.execute('test-model', async () => {
                        throw new Error('Failed');
                    });
                } catch (e) {
                    // Expected
                }
            }

            try {
                await breaker.execute('test-model', async () => 'success');
                fail('Should have thrown');
            } catch (e) {
                expect(e.code).toBe('CIRCUIT_OPEN');
            }
        });

        it('should transition to half-open after timeout', async () => {
            for (let i = 0; i < 3; i++) {
                try {
                    await breaker.execute('test-model', async () => {
                        throw new Error('Failed');
                    });
                } catch (e) {
                    // Expected
                }
            }

            await new Promise(r => setTimeout(r, 150));

            const health = breaker.getHealth('test-model');
            expect(health.status).toBe('HALF_OPEN');
        });

        it('should close after successful recovery', async () => {
            for (let i = 0; i < 3; i++) {
                try {
                    await breaker.execute('test-model', async () => {
                        throw new Error('Failed');
                    });
                } catch (e) {
                    // Expected
                }
            }

            await new Promise(r => setTimeout(r, 150));

            await breaker.execute('test-model', async () => 'success');
            await breaker.execute('test-model', async () => 'success');

            const health = breaker.getHealth('test-model');
            expect(health.status).toBe('CLOSED');
        });
    });

    describe('Health Monitoring', () => {
        it('should calculate failure rate', async () => {
            for (let i = 0; i < 5; i++) {
                try {
                    await breaker.execute('test-model', async () => {
                        throw new Error('Failed');
                    });
                } catch (e) {
                    // Expected
                }
            }

            const health = breaker.getHealth('test-model');
            expect(health.failureRate).toBe(100);
        });

        it('should get all breaker status', async () => {
            await breaker.execute('model1', async () => 'success');
            await breaker.execute('model2', async () => 'success');

            const status = breaker.getAllStatus();
            expect(status.model1).toBeDefined();
            expect(status.model2).toBeDefined();
        });
    });

    describe('Manual Control', () => {
        it('should reset specific breaker', async () => {
            await breaker.execute('test-model', async () => 'success');

            breaker.reset('test-model');

            const health = breaker.getHealth('test-model');
            expect(health.status).toBe('unknown');
        });

        it('should reset all breakers', async () => {
            await breaker.execute('model1', async () => 'success');
            await breaker.execute('model2', async () => 'success');

            breaker.resetAll();

            const status = breaker.getAllStatus();
            expect(Object.keys(status).length).toBe(0);
        });

        it('should force open breaker', async () => {
            breaker.forceOpen('test-model');

            const health = breaker.getHealth('test-model');
            expect(health.status).toBe('OPEN');
        });

        it('should force close breaker', async () => {
            breaker.forceClose('test-model');

            const health = breaker.getHealth('test-model');
            expect(health.status).toBe('CLOSED');
        });
    });
});

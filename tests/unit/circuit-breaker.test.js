/**
 * @fileoverview Unit tests for core/circuit-breaker.js
 * @module tests/unit/circuit-breaker.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import CircuitBreaker from '../../core/circuit-breaker.js';

// Mock logger
vi.mock('../../utils/logger.js', () => ({
    createLogger: vi.fn(() => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }))
}));

describe('core/circuit-breaker', () => {
    let breaker;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        breaker = new CircuitBreaker({
            failureThreshold: 20, // 20%
            successThreshold: 2,
            halfOpenTime: 1000,
            monitoringWindow: 5000,
            minSamples: 3
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('Constructor', () => {
        it('should initialize with defaults', () => {
            const cb = new CircuitBreaker();
            expect(cb.failureThreshold).toBe(50);
            expect(cb.halfOpenTime).toBe(30000);
            expect(cb.minSamples).toBe(5);
        });
    });

    describe('execute', () => {
        it('should execute successful function', async () => {
            const fn = vi.fn().mockResolvedValue('ok');
            const result = await breaker.execute('m1', fn);

            expect(result).toBe('ok');
            expect(fn).toHaveBeenCalledTimes(1);
            expect(breaker.getHealth('m1').status).toBe('CLOSED');
        });

        it('should record failures and trip to OPEN after minSamples', async () => {
            const error = new Error('fail');
            const fn = vi.fn().mockRejectedValue(error);

            // 1st failure (minSamples: 3)
            await expect(breaker.execute('m1', fn)).rejects.toThrow('fail');
            expect(breaker.getHealth('m1').status).toBe('CLOSED');

            // 2nd failure
            await expect(breaker.execute('m1', fn)).rejects.toThrow('fail');
            expect(breaker.getHealth('m1').status).toBe('CLOSED');

            // 3rd failure (minSamples reached, failureRate 100% >= 20%)
            await expect(breaker.execute('m1', fn)).rejects.toThrow('fail');
            expect(breaker.getHealth('m1').status).toBe('OPEN');
        });

        it('should reject calls while OPEN and transition to HALF_OPEN', async () => {
            breaker.forceOpen('m1');

            // Should be OPEN
            await expect(breaker.execute('m1', async () => 'ok'))
                .rejects.toThrow(/Circuit breaker OPEN/);

            // Advance time past halfOpenTime
            const b = breaker.getBreaker('m1');
            b.nextAttempt = Date.now() + 1000;
            vi.advanceTimersByTime(1100);

            // Now it should transition to HALF_OPEN upon execution
            const result = await breaker.execute('m1', async () => 'ok');
            expect(result).toBe('ok');
            expect(breaker.getHealth('m1').status).toBe('HALF_OPEN');
        });

        it('should close after successThreshold in HALF_OPEN', async () => {
            const b = breaker.getBreaker('m1');
            b.state = 'OPEN';
            b.nextAttempt = Date.now() - 100;

            // First success in HALF_OPEN
            await breaker.execute('m1', async () => 'ok');
            expect(breaker.getHealth('m1').status).toBe('HALF_OPEN');

            // Second success in HALF_OPEN (threshold 2)
            await breaker.execute('m1', async () => 'ok');
            expect(breaker.getHealth('m1').status).toBe('CLOSED');
        });

        it('should trip back to OPEN if failure occurs in HALF_OPEN', async () => {
            const b = breaker.getBreaker('m1');
            b.state = 'OPEN';
            b.nextAttempt = Date.now() - 100;

            const error = new Error('half-fail');
            await expect(breaker.execute('m1', async () => { throw error; })).rejects.toThrow('half-fail');

            expect(breaker.getHealth('m1').status).toBe('OPEN');
        });
    });

    describe('_isOpen and Internal logic', () => {
        it('should internal _isOpen handle states properly', () => {
            const b = breaker.getBreaker('m1');
            b.state = 'OPEN';
            b.nextAttempt = Date.now() + 1000;
            expect(breaker._isOpen(b)).toBe(true);

            vi.advanceTimersByTime(2000);
            expect(breaker._isOpen(b)).toBe(false);

            b.state = 'CLOSED';
            expect(breaker._isOpen(b)).toBe(false);
        });
    });

    describe('Monitoring Window & History', () => {
        it('should cleanup history old entries', async () => {
            const b = breaker.getBreaker('m1');
            b.history.push({ time: Date.now() - 10000, type: 'failure' });

            await breaker.execute('m1', async () => 'ok');
            const health = breaker.getHealth('m1');
            expect(health.recentOperations).toBe(1);
        });

        it('should cap history at 100 entries', async () => {
            const b = breaker.getBreaker('m1');
            for (let i = 0; i < 150; i++) {
                b.history.push({ time: Date.now(), type: 'success' });
            }

            await breaker.execute('m1', async () => 'ok');
            expect(b.history.length).toBe(100);
        });
    });

    describe('Health & Status', () => {
        it('should return health for unknown model', () => {
            const health = breaker.getHealth('unknown');
            expect(health.status).toBe('unknown');
        });

        it('should return all status', async () => {
            await breaker.execute('m1', async () => 'ok');
            breaker.forceOpen('m2');

            const status = breaker.getAllStatus();
            expect(status.m1.state).toBe('CLOSED');
            expect(status.m2.state).toBe('OPEN');
        });
    });

    describe('Manual Control', () => {
        it('should reset specific breaker', async () => {
            breaker.forceOpen('m1');
            breaker.reset('m1');
            expect(breaker.getHealth('m1').status).toBe('CLOSED');
        });

        it('should reset all breakers', async () => {
            breaker.forceOpen('m1');
            breaker.forceOpen('m2');
            breaker.resetAll();
            expect(breaker.breakers.size).toBe(0);
        });

        it('should force close breaker', async () => {
            breaker.forceOpen('m1');
            breaker.forceClose('m1');
            expect(breaker.getHealth('m1').status).toBe('CLOSED');
        });
    });
});

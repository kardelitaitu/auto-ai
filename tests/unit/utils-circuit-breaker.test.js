/**
 * @fileoverview Unit tests for utils/circuit-breaker.js
 * @module tests/unit/utils-circuit-breaker.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import CircuitBreaker from '../../utils/circuit-breaker.js';

vi.mock('../../utils/logger.js', () => ({
    createLogger: vi.fn(() => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }))
}));

describe('utils/circuit-breaker', () => {
    let breaker;

    beforeEach(() => {
        vi.useFakeTimers();
        breaker = new CircuitBreaker({
            failureThreshold: 3,
            resetTimeout: 5000,
            halfOpenSuccessThreshold: 1
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('Constructor', () => {
        it('should initialize with defaults', () => {
            const cb = new CircuitBreaker();
            expect(cb.failureThreshold).toBe(5);
            expect(cb.resetTimeout).toBe(60000);
            expect(cb.halfOpenSuccessThreshold).toBe(1);
            expect(cb.circuits.size).toBe(0);
        });

        it('should initialize with custom options', () => {
            const cb = new CircuitBreaker({
                failureThreshold: 10,
                resetTimeout: 30000,
                halfOpenSuccessThreshold: 2
            });
            expect(cb.failureThreshold).toBe(10);
            expect(cb.resetTimeout).toBe(30000);
            expect(cb.halfOpenSuccessThreshold).toBe(2);
        });
    });

    describe('getKey', () => {
        it('should generate key with model only', () => {
            expect(breaker.getKey('gpt-4')).toBe('gpt-4::default');
        });

        it('should generate key with model and apiKey', () => {
            expect(breaker.getKey('gpt-4', 'sk-key123')).toBe('gpt-4::sk-key123');
        });
    });

    describe('check', () => {
        it('should allow when no circuit exists', () => {
            const result = breaker.check('new-model');
            expect(result.allowed).toBe(true);
            expect(result.state).toBe('closed');
        });

        it('should allow when circuit is closed', () => {
            breaker.recordFailure('model1');
            breaker.recordFailure('model1');
            const result = breaker.check('model1');
            expect(result.allowed).toBe(true);
            expect(result.state).toBe('closed');
        });

        it('should block when circuit is open', () => {
            breaker.recordFailure('model1');
            breaker.recordFailure('model1');
            breaker.recordFailure('model1'); // threshold is 3
            const result = breaker.check('model1');
            expect(result.allowed).toBe(false);
            expect(result.state).toBe('open');
            expect(result.retryAfter).toBeDefined();
        });

        it('should transition to half-open after timeout', () => {
            breaker.recordFailure('model1');
            breaker.recordFailure('model1');
            breaker.recordFailure('model1');
            
            vi.advanceTimersByTime(6000);
            
            const result = breaker.check('model1');
            expect(result.allowed).toBe(true);
            expect(result.state).toBe('half-open');
        });

        it('should allow in half-open state', () => {
            breaker.recordFailure('model1');
            breaker.recordFailure('model1');
            breaker.recordFailure('model1');
            vi.advanceTimersByTime(6000);
            breaker.check('model1');
            
            const result = breaker.check('model1');
            expect(result.allowed).toBe(true);
            expect(result.state).toBe('half-open');
        });
    });

    describe('recordSuccess', () => {
        it('should do nothing when no circuit exists', () => {
            breaker.recordSuccess('unknown');
            expect(breaker.getState('unknown')).toBeNull();
        });

        it('should do nothing when circuit is closed', () => {
            breaker.recordFailure('model1');
            breaker.recordSuccess('model1');
            const state = breaker.getState('model1');
            expect(state.state).toBe('closed');
            expect(state.successes).toBe(0);
        });

        it('should increment successes but remain half-open if threshold not met', () => {
            breaker = new CircuitBreaker({
                failureThreshold: 3,
                resetTimeout: 5000,
                halfOpenSuccessThreshold: 2
            });
            
            breaker.recordFailure('model1');
            breaker.recordFailure('model1');
            breaker.recordFailure('model1');
            vi.advanceTimersByTime(6000);
            breaker.check('model1'); // half-open
            
            breaker.recordSuccess('model1');
            const state = breaker.getState('model1');
            expect(state.state).toBe('half-open');
            expect(state.successes).toBe(1);
        });

        it('should recover from half-open after success threshold', () => {
            breaker.recordFailure('model1');
            breaker.recordFailure('model1');
            breaker.recordFailure('model1');
            vi.advanceTimersByTime(6000);
            breaker.check('model1');
            
            breaker.recordSuccess('model1');
            expect(breaker.getState('model1').state).toBe('closed');
        });
    });

    describe('recordFailure', () => {
        it('should create circuit on first failure', () => {
            breaker.recordFailure('model1');
            const state = breaker.getState('model1');
            expect(state).not.toBeNull();
            expect(state.failures).toBe(1);
            expect(state.state).toBe('closed');
        });

        it('should open circuit after threshold', () => {
            breaker.recordFailure('model1');
            breaker.recordFailure('model1');
            breaker.recordFailure('model1');
            const state = breaker.getState('model1');
            expect(state.state).toBe('open');
        });

        it('should reopen from half-open on failure', () => {
            breaker.recordFailure('model1');
            breaker.recordFailure('model1');
            breaker.recordFailure('model1');
            vi.advanceTimersByTime(6000);
            breaker.check('model1');
            
            breaker.recordFailure('model1');
            const state = breaker.getState('model1');
            expect(state.state).toBe('open');
        });
    });

    describe('getState', () => {
        it('should return null for unknown model', () => {
            expect(breaker.getState('unknown')).toBeNull();
        });

        it('should return circuit state', () => {
            breaker.recordFailure('model1');
            const state = breaker.getState('model1');
            expect(state.failures).toBe(1);
        });
    });

    describe('getAllStates', () => {
        it('should return empty object when no circuits', () => {
            expect(breaker.getAllStates()).toEqual({});
        });

        it('should return all circuit states', () => {
            breaker.recordFailure('model1');
            breaker.recordFailure('model2');
            const states = breaker.getAllStates();
            expect(Object.keys(states).length).toBe(2);
            expect(states['model1::default']).toBeDefined();
            expect(states['model2::default']).toBeDefined();
        });
    });

    describe('reset', () => {
        it('should reset specific circuit', () => {
            breaker.recordFailure('model1');
            breaker.recordFailure('model1');
            breaker.recordFailure('model1');
            breaker.reset('model1');
            expect(breaker.getState('model1')).toBeNull();
        });

        it('should reset all circuits when no model provided', () => {
            breaker.recordFailure('model1');
            breaker.recordFailure('model2');
            breaker.reset();
            expect(breaker.circuits.size).toBe(0);
        });
    });

    describe('getStats', () => {
        it('should return zero stats initially', () => {
            const stats = breaker.getStats();
            expect(stats.total).toBe(0);
            expect(stats.open).toBe(0);
            expect(stats.halfOpen).toBe(0);
            expect(stats.closed).toBe(0);
        });

        it('should track half-open circuits', () => {
            breaker.recordFailure('model1');
            breaker.recordFailure('model1');
            breaker.recordFailure('model1');
            vi.advanceTimersByTime(6000);
            breaker.check('model1'); // half-open

            const stats = breaker.getStats();
            expect(stats.halfOpen).toBe(1);
        });

        it('should track open circuits', () => {
            breaker.recordFailure('model1');
            breaker.recordFailure('model1');
            breaker.recordFailure('model1');
            
            breaker.recordFailure('model2');
            
            const stats = breaker.getStats();
            expect(stats.total).toBe(2);
            expect(stats.open).toBe(1);
            expect(stats.closed).toBe(1);
        });
    });

    describe('Edge Cases', () => {
        it('should handle multiple models independently', () => {
            breaker.recordFailure('model1');
            breaker.recordFailure('model1');
            breaker.recordFailure('model1');
            
            breaker.recordFailure('model2');
            
            expect(breaker.getState('model1').state).toBe('open');
            expect(breaker.getState('model2').state).toBe('closed');
            expect(breaker.check('model1').allowed).toBe(false);
            expect(breaker.check('model2').allowed).toBe(true);
        });

        it('should handle apiKey differences', () => {
            breaker.recordFailure('model1', 'key1');
            breaker.recordFailure('model1', 'key1');
            breaker.recordFailure('model1', 'key1');
            
            expect(breaker.getState('model1', 'key1').state).toBe('open');
            expect(breaker.check('model1', 'key2').allowed).toBe(true);
        });
    });
});

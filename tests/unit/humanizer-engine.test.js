
import { describe, it, expect, vi, beforeEach } from 'vitest';
import HumanizerEngine from '../../core/humanizer-engine.js';

// Mock Logger
vi.mock('../../utils/logger.js', () => ({
    createLogger: vi.fn().mockReturnValue({
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    })
}));

describe('HumanizerEngine', () => {
    let engine;

    beforeEach(async () => {
        engine = new HumanizerEngine();
        // Wait for async config loading
        await new Promise(resolve => setTimeout(resolve, 10));
    });

    describe('generateMousePath', () => {
        it('should generate a standard path for short distances', () => {
            const start = { x: 0, y: 0 };
            const end = { x: 100, y: 100 };
            const path = engine.generateMousePath(start, end, { overshoot: false });

            expect(path.points.length).toBeGreaterThan(0);
            expect(path.metadata.distance).toBeCloseTo(141.42, 1);
            expect(path.metadata.overshoot).toBe(false);
        });

        it('should generate an overshoot path for long distances', () => {
            // Force overshoot by distance > 300 and mocking Math.random
            const start = { x: 0, y: 0 };
            const end = { x: 500, y: 500 };
            
            // Mock Math.random to always be > 0.3 for overshoot check
            vi.spyOn(Math, 'random').mockReturnValue(0.5);

            const path = engine.generateMousePath(start, end, { overshoot: true });

            expect(path.metadata.overshoot).toBe(true);
            expect(path.points.length).toBeGreaterThan(20); // main + correction
            
            vi.restoreAllMocks();
        });

        it('should respect overshoot: false option even for long distances', () => {
            const start = { x: 0, y: 0 };
            const end = { x: 500, y: 500 };
            const path = engine.generateMousePath(start, end, { overshoot: false });
            expect(path.metadata.overshoot).toBe(false);
        });
    });

    describe('generateKeystrokeTiming', () => {
        it('should generate timing for each character', () => {
            const text = 'hello';
            const timings = engine.generateKeystrokeTiming(text, 0); // 0 typo chance
            expect(timings).toHaveLength(5);
            expect(timings[0].char).toBe('h');
            expect(timings[0].delay).toBeGreaterThan(0);
        });

        it('should inject typos when typoChance is high', () => {
            const text = 'a';
            // Mock Math.random to trigger typo
            vi.spyOn(Math, 'random').mockReturnValue(0.01); 
            
            const timings = engine.generateKeystrokeTiming(text, 0.5);
            
            // Expect typo: wrong char, backspace, correction
            // Note: index 1 is 'Delay' pause, so we check for Backspace
            expect(timings.some(t => t.char === 'Backspace')).toBe(true);
            expect(timings.some(t => t.char === 'a')).toBe(true);
            
            vi.restoreAllMocks();
        });

        it('should add extra delay for spaces and punctuation', () => {
            // Since _generateKeyDelay uses gaussianRandom, this might be flaky, 
            // but the logic adds 40ms to the same base.
            // Let's mock gaussianRandom for stability.
            vi.spyOn(engine, '_gaussianRandom').mockReturnValue(100);
            
            expect(engine._generateKeyDelay(' ')).toBe(140);
            expect(engine._generateKeyDelay('a')).toBe(100);
            
            vi.restoreAllMocks();
        });
    });

    describe('generatePause', () => {
        it('should return a value within specified range', () => {
            const pause = engine.generatePause({ min: 100, max: 200 });
            expect(pause).toBeGreaterThanOrEqual(100);
            expect(pause).toBeLessThanOrEqual(200);
        });

        it('should use default range if not specified', () => {
            const pause = engine.generatePause();
            expect(pause).toBeGreaterThanOrEqual(500);
            expect(pause).toBeLessThanOrEqual(2000);
        });
    });

    describe('Helper Methods', () => {
        it('_calculateDistance should work correctly', () => {
            expect(engine._calculateDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
        });

        it('_calculateDuration should be bounded by min/max', () => {
            expect(engine._calculateDuration(10)).toBeGreaterThanOrEqual(engine.minDuration);
            expect(engine._calculateDuration(10000)).toBeLessThanOrEqual(engine.maxDuration);
        });

        it('_cubicBezier should return point on curve', () => {
            const p0 = { x: 0, y: 0 };
            const p1 = { x: 50, y: 0 };
            const p2 = { x: 50, y: 100 };
            const p3 = { x: 100, y: 100 };
            
            const mid = engine._cubicBezier(p0, p1, p2, p3, 0.5);
            expect(mid.x).toBe(50);
            expect(mid.y).toBe(50);
        });

        it('_generateControlPoint should return point with offset', () => {
            const start = { x: 0, y: 0 };
            const end = { x: 100, y: 0 };
            const cp = engine._generateControlPoint(start, end, 0.5);
            
            expect(cp.x).toBe(50);
            expect(cp.y).not.toBe(0); // Should have perpendicular offset
        });
    });

    describe('getStats', () => {
        it('should return configuration stats', () => {
            const stats = engine.getStats();
            expect(stats.mode).toBe('Advanced Fitts v2');
            expect(stats.jitterRange).toBe(2);
        });
    });
});

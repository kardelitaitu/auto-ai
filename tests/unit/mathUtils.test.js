
import { describe, it, expect, vi, afterEach } from 'vitest';
import { mathUtils } from '../../utils/mathUtils.js';

describe('mathUtils', () => {
    describe('gaussian', () => {
        it('should return value within bounds', () => {
            for(let i=0; i<100; i++) {
                const val = mathUtils.gaussian(100, 10, 80, 120);
                expect(val).toBeGreaterThanOrEqual(80);
                expect(val).toBeLessThanOrEqual(120);
            }
        });
    });

    describe('randomInRange', () => {
        it('should return value within bounds', () => {
            for(let i=0; i<100; i++) {
                const val = mathUtils.randomInRange(10, 20);
                expect(val).toBeGreaterThanOrEqual(10);
                expect(val).toBeLessThanOrEqual(20);
            }
        });
    });

    describe('roll', () => {
        it('should return true if under threshold', () => {
            vi.spyOn(Math, 'random').mockReturnValue(0.4);
            expect(mathUtils.roll(0.5)).toBe(true);
        });

        it('should return false if over threshold', () => {
            vi.spyOn(Math, 'random').mockReturnValue(0.6);
            expect(mathUtils.roll(0.5)).toBe(false);
        });
        
        afterEach(() => {
            vi.restoreAllMocks();
        });
    });

    describe('sample', () => {
        it('should return random element', () => {
            const arr = [1, 2, 3];
            vi.spyOn(Math, 'random').mockReturnValue(0.5); // Index 1
            expect(mathUtils.sample(arr)).toBe(2);
        });

        it('should return null for empty array', () => {
            expect(mathUtils.sample([])).toBeNull();
            expect(mathUtils.sample(null)).toBeNull();
        });
    });
});

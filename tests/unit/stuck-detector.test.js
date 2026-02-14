import { describe, it, expect, beforeEach } from 'vitest';
import StuckDetector from '../../core/stuck-detector.js';

describe('StuckDetector', () => {
    let detector;

    beforeEach(() => {
        detector = new StuckDetector(3);
    });

    it('should initialize with threshold', () => {
        expect(detector.threshold).toBe(3);
        expect(detector.counter).toBe(0);
    });

    it('should detect stuck state after threshold is reached', () => {
        const img = 'data:image/png;base64,ABC';

        expect(detector.check(img).isStuck).toBe(false);
        expect(detector.check(img).isStuck).toBe(false);
        expect(detector.check(img).isStuck).toBe(false);
        expect(detector.check(img).isStuck).toBe(true);
        expect(detector.counter).toBe(3);
    });

    it('should reset counter when image changes', () => {
        const img1 = 'data:image/png;base64,ABC';
        const img2 = 'data:image/png;base64,XYZ';

        detector.check(img1);
        detector.check(img1);
        expect(detector.counter).toBe(1);

        detector.check(img2);
        expect(detector.counter).toBe(0);
        expect(detector.check(img2).isStuck).toBe(false);
    });

    it('should handle null/empty image', () => {
        const result = detector.check(null);
        expect(result.isStuck).toBe(false);
        expect(result.counter).toBe(0);
    });

    it('should reset state completely', () => {
        detector.check('ABC');
        detector.check('ABC');
        detector.reset();
        expect(detector.counter).toBe(0);
        expect(detector.lastHash).toBe(null);
    });
});

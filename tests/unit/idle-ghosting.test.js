
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import IdleGhosting from '../../core/idle-ghosting.js';

// Mock Logger
vi.mock('../../utils/logger.js', () => ({
    createLogger: vi.fn().mockReturnValue({
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    })
}));

describe('IdleGhosting', () => {
    let ghosting;
    let mockPage;

    beforeEach(() => {
        vi.useFakeTimers();
        ghosting = new IdleGhosting();
        mockPage = {
            viewportSize: vi.fn().mockReturnValue({ width: 1000, height: 1000 }),
            mouse: {
                move: vi.fn().mockResolvedValue(undefined)
            }
        };
    });

    afterEach(() => {
        ghosting.stop();
        vi.useRealTimers();
        vi.clearAllMocks();
    });

    describe('start/stop', () => {
        it('should start ghosting with default options', async () => {
            await ghosting.start(mockPage);

            expect(ghosting.isActive).toBe(true);
            expect(ghosting.wiggleInterval).not.toBeNull();
            expect(mockPage.mouse.move).toHaveBeenCalled();
        });

        it('should not start if already active', async () => {
            await ghosting.start(mockPage);
            const firstInterval = ghosting.wiggleInterval;

            await ghosting.start(mockPage);
            expect(ghosting.wiggleInterval).toBe(firstInterval);
        });

        it('should start with micro-scroll and no wiggle', async () => {
            await ghosting.start(mockPage, { wiggle: false, scroll: true });
            expect(ghosting.isActive).toBe(true);
            expect(ghosting.wiggleInterval).toBeNull();
        });

        it('should stop ghosting correctly', async () => {
            await ghosting.start(mockPage);
            expect(ghosting.isActive).toBe(true);

            await ghosting.stop();
            expect(ghosting.isActive).toBe(false);
            expect(ghosting.wiggleInterval).toBeNull();
        });

        it('should handle stop when not active', async () => {
            await ghosting.stop();
            expect(ghosting.isActive).toBe(false);
        });
    });

    describe('_randomWiggle', () => {
        it('should move mouse near center of viewport', async () => {
            await ghosting._randomWiggle(mockPage);

            expect(mockPage.mouse.move).toHaveBeenCalledWith(
                expect.any(Number),
                expect.any(Number)
            );

            const [x, y] = mockPage.mouse.move.mock.calls[0];
            // Center is 500,500. Magnitude is 5. Max offset is 5.
            expect(x).toBeGreaterThanOrEqual(495);
            expect(x).toBeLessThanOrEqual(505);
            expect(y).toBeGreaterThanOrEqual(495);
            expect(y).toBeLessThanOrEqual(505);
        });

        it('should use default viewport if page.viewportSize returns null', async () => {
            mockPage.viewportSize.mockReturnValue(null);
            await ghosting._randomWiggle(mockPage);

            const [x, y] = mockPage.mouse.move.mock.calls[0];
            // Default center is 1920/2, 1080/2 = 960, 540
            expect(x).toBeGreaterThanOrEqual(955);
            expect(x).toBeLessThanOrEqual(965);
        });

        it('should handle Target closed error silently', async () => {
            mockPage.mouse.move.mockRejectedValue(new Error('Target closed'));
            await expect(ghosting._randomWiggle(mockPage)).resolves.not.toThrow();
        });

        it('should throw other errors', async () => {
            mockPage.mouse.move.mockRejectedValue(new Error('Other error'));
            await expect(ghosting._randomWiggle(mockPage)).rejects.toThrow('Other error');
        });
    });

    describe('Interval Execution', () => {
        it('should perform periodic wiggles', async () => {
            await ghosting.start(mockPage);
            mockPage.mouse.move.mockClear();

            // Advance time by 2 seconds (wiggleFrequency)
            await vi.advanceTimersByTimeAsync(2000);
            expect(mockPage.mouse.move).toHaveBeenCalledTimes(1);

            await vi.advanceTimersByTimeAsync(2000);
            expect(mockPage.mouse.move).toHaveBeenCalledTimes(2);
        });

        it('should skip wiggle if not active when interval fires', async () => {
            await ghosting.start(mockPage);
            mockPage.mouse.move.mockClear();

            // Manually set isActive to false without stopping (to keep interval running)
            ghosting.isActive = false;

            await vi.advanceTimersByTimeAsync(2000);
            expect(mockPage.mouse.move).not.toHaveBeenCalled();
        });

        it('should handle wiggle failure silently', async () => {
            await ghosting.start(mockPage);
            
            // Mock _randomWiggle to throw after the initial call
            vi.spyOn(ghosting, '_randomWiggle').mockRejectedValueOnce(new Error('Async error'));
            
            await vi.advanceTimersByTimeAsync(2000);
            // Should not throw, but should have been called
            expect(ghosting._randomWiggle).toHaveBeenCalled();
        });

        it('should handle wiggle failure in interval silently', async () => {
            await ghosting.start(mockPage);
            // Use an error that IS rethrown by _randomWiggle
            mockPage.mouse.move.mockRejectedValue(new Error('Unexpected error'));

            await vi.advanceTimersByTimeAsync(2000);
            // Should not crash the interval and should hit the logger.warn
            expect(ghosting.isActive).toBe(true);
        });
    });

    describe('Configuration and Stats', () => {
        it('should update wiggle params', () => {
            ghosting.setWiggleParams(5000, 10);
            expect(ghosting.wiggleFrequency).toBe(5000);
            expect(ghosting.wiggleMagnitude).toBe(10);
        });

        it('should return correct stats', () => {
            const stats = ghosting.getStats();
            expect(stats.isActive).toBe(false);
            expect(stats.wiggleFrequency).toBe(2000);
        });

        it('should report ghosting status', async () => {
            expect(ghosting.isGhosting()).toBe(false);
            await ghosting.start(mockPage);
            expect(ghosting.isGhosting()).toBe(true);
        });
    });
});

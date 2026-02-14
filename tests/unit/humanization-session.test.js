
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SessionManager } from '../../utils/humanization/session.js';
import { mathUtils } from '../../utils/mathUtils.js';
import * as scrollHelper from '../../utils/scroll-helper.js';

// Mock dependencies
vi.mock('../../utils/mathUtils.js', () => ({
    mathUtils: {
        randomInRange: vi.fn(),
        gaussian: vi.fn(),
        sample: vi.fn()
    }
}));

vi.mock('../../utils/scroll-helper.js', () => ({
    scrollRandom: vi.fn()
}));

describe('SessionManager', () => {
    let sessionManager;
    let mockPage;
    let mockLogger;

    beforeEach(() => {
        vi.useFakeTimers();
        // Set default time to Monday noon (weekday, lunch)
        vi.setSystemTime(new Date('2024-01-01T12:00:00')); // Monday
        
        vi.clearAllMocks();

        mockPage = {
            waitForTimeout: vi.fn().mockResolvedValue(undefined),
            mouse: {
                move: vi.fn().mockResolvedValue(undefined)
            }
        };

        mockLogger = {
            log: vi.fn()
        };

        // Default mock behaviors
        mathUtils.randomInRange.mockImplementation((min, max) => min);
        mathUtils.gaussian.mockImplementation((mean, dev) => mean);
        mathUtils.sample.mockImplementation((arr) => arr[0]);

        sessionManager = new SessionManager(mockPage, mockLogger);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('getOptimalLength', () => {
        it('should return lunch peak config for 12pm weekday', () => {
            const config = sessionManager.getOptimalLength();
            // Lunch peak: 12 mins
            // 12 * 60 * 1000 = 720000
            expect(config.targetMs).toBe(720000);
            expect(config.reason).toContain('lunch');
            expect(config.reason).toContain('weekday');
        });

        it('should return morning peak config', () => {
            vi.setSystemTime(new Date('2024-01-01T09:00:00')); // 9 AM
            
            const config = sessionManager.getOptimalLength();
            // Morning peak weekday: 10 mins = 600000
            expect(config.targetMs).toBe(600000);
            expect(config.reason).toContain('morning');
        });

        it('should return weekend config', () => {
            vi.setSystemTime(new Date('2024-01-06T12:00:00')); // Saturday 12 PM
            
            const config = sessionManager.getOptimalLength();
            // Lunch peak is always 12 mins regardless of weekend in the code
            // Wait, logic:
            // if (hour >= 12 && hour <= 14) baseLength = 12;
            expect(config.targetMs).toBe(720000);
            expect(config.reason).toContain('weekend');
        });

        it('should return late night config', () => {
             vi.setSystemTime(new Date('2024-01-01T23:00:00')); // 11 PM
             
             const config = sessionManager.getOptimalLength();
             // Late night weekday: 5 mins = 300000
             expect(config.targetMs).toBe(300000);
             expect(config.reason).toContain('late night');
        });
    });

    describe('shouldTakeBreak', () => {
        it('should return true if duration exceeds threshold', () => {
             // Target is 720000 (12 mins)
             // Threshold is 80% = 576000
             
             const result = sessionManager.shouldTakeBreak(600000);
             expect(result).toBe(true);
        });

        it('should return false if duration is below threshold', () => {
             const result = sessionManager.shouldTakeBreak(100000);
             expect(result).toBe(false);
        });
    });

    describe('warmup', () => {
        it('should wait for warmup steps', async () => {
            mathUtils.randomInRange.mockReturnValue(3); // 3 steps
            
            await sessionManager.warmup();
            
            expect(mockPage.waitForTimeout).toHaveBeenCalledTimes(3);
        });
    });

    describe('boredomPause', () => {
        it('should execute random behavior and wait', async () => {
             // sample returns first behavior (scrollRandom)
             
             await sessionManager.boredomPause(mockPage);
             
             expect(scrollHelper.scrollRandom).toHaveBeenCalled();
             expect(mockPage.waitForTimeout).toHaveBeenCalled();
             expect(mockPage.mouse.move).toHaveBeenCalled(); // Moves back at end
        });
    });

    describe('wrapUp', () => {
        it('should execute wrap up behavior', async () => {
             // Math.random < 0.5 -> behaviors[2] (Final scroll)
             vi.spyOn(Math, 'random').mockReturnValue(0.4);
             
             await sessionManager.wrapUp(mockPage);
             
             expect(scrollHelper.scrollRandom).toHaveBeenCalled();
             expect(mockPage.waitForTimeout).toHaveBeenCalled();
        });
    });
});

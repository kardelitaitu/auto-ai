
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HumanTiming } from '../../utils/humanization/timing.js';
import { mathUtils } from '../../utils/mathUtils.js';
import { entropy } from '../../utils/entropyController.js';

// Mock dependencies
vi.mock('../../utils/mathUtils.js', () => ({
    mathUtils: {
        randomInRange: vi.fn(),
        gaussian: vi.fn(),
        roll: vi.fn()
    }
}));

vi.mock('../../utils/entropyController.js', () => ({
    entropy: {
        reactionTime: vi.fn()
    }
}));

describe('HumanTiming', () => {
    let humanTiming;
    let mockPage;
    let mockLogger;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2024-01-01T12:00:00'));
        vi.clearAllMocks();

        mockPage = {
            waitForTimeout: vi.fn().mockResolvedValue(undefined)
        };

        mockLogger = {
            log: vi.fn()
        };

        // Default mock behaviors
        mathUtils.randomInRange.mockImplementation((min, max) => min);
        mathUtils.gaussian.mockImplementation((mean, dev) => mean);

        humanTiming = new HumanTiming(mockPage, mockLogger);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('getThinkTime', () => {
        it('should return default time for unknown action', () => {
            const time = humanTiming.getThinkTime('unknown');
            // Default gaussian is 500
            expect(time).toBe(500);
        });

        it('should return specific time for known action (like)', () => {
            const time = humanTiming.getThinkTime('like');
            // Like gaussian is 800
            expect(time).toBe(800);
        });

        it('should increase time for interesting content', () => {
            // Mock gaussian to return mean directly to verify multiplier
            mathUtils.gaussian.mockImplementation((mean, dev) => mean);
            
            const normalTime = humanTiming.getThinkTime('read_tweet'); // 3000
            const interestingTime = humanTiming.getThinkTime('read_tweet', { interesting: true });
            
            expect(interestingTime).toBeGreaterThan(normalTime);
        });

        it('should decrease time for boring content', () => {
            mathUtils.gaussian.mockImplementation((mean, dev) => mean);
            
            const normalTime = humanTiming.getThinkTime('read_tweet');
            const boringTime = humanTiming.getThinkTime('read_tweet', { boring: true });
            
            expect(boringTime).toBeLessThan(normalTime);
        });

        it('should adjust time based on time of day (morning)', () => {
            // Mock Date to 8 AM
            vi.setSystemTime(new Date('2024-01-01T08:00:00'));
            
            mathUtils.gaussian.mockImplementation((mean, dev) => mean);
            
            const time = humanTiming.getThinkTime('general'); // default 1000
            // Morning multiplier 1.2 -> 1200
            expect(time).toBe(1200);
            
            vi.useRealTimers();
        });

        it('should adjust time based on time of day (late night)', () => {
            // Mock Date to 11 PM
            vi.setSystemTime(new Date('2024-01-01T23:00:00'));
            
            mathUtils.gaussian.mockImplementation((mean, dev) => mean);
            
            const time = humanTiming.getThinkTime('general'); // default 1000
            // Late night multiplier 0.8 -> 800
            expect(time).toBe(800);
            
            vi.useRealTimers();
        });
        
        it('should clamp to min/max values', () => {
             // Force gaussian to return very high value
             mathUtils.gaussian.mockReturnValue(100000);
             
             // 'like' max is 1500
             const time = humanTiming.getThinkTime('like');
             expect(time).toBe(1500);
        });

        it('should apply fatigue variation at higher cycle counts', () => {
            mathUtils.gaussian.mockImplementation((mean, dev) => mean);
            const time = humanTiming.getThinkTime('general', { cycleCount: 60 });
            expect(time).toBe(900);
        });
    });

    describe('getNaturalPause', () => {
        it('should return transition pause by default', () => {
            // Transition gaussian is 500
            const pause = humanTiming.getNaturalPause();
            expect(pause).toBe(500);
        });

        it('should return specific pause type', () => {
            // Micro gaussian is 180
            const pause = humanTiming.getNaturalPause('micro');
            expect(pause).toBe(180);
        });

        it('should return default pause for unknown context', () => {
            const pause = humanTiming.getNaturalPause('unknown');
            expect(pause).toBe(350);
        });
    });

    describe('sessionRampUp', () => {
        it('should wait for ramp up steps', async () => {
            await humanTiming.sessionRampUp();
            
            // 2 steps
            expect(mockPage.waitForTimeout).toHaveBeenCalledTimes(2);
        });
    });

    describe('getFatigueMultiplier', () => {
        it('should return 1.0 for low cycle count', () => {
            expect(humanTiming.getFatigueMultiplier(5)).toBe(1.0);
        });

        it('should return lower multiplier for high cycle count', () => {
            expect(humanTiming.getFatigueMultiplier(100)).toBe(0.8);
        });

        it('should return mid-range multipliers', () => {
            expect(humanTiming.getFatigueMultiplier(20)).toBe(0.95);
            expect(humanTiming.getFatigueMultiplier(40)).toBe(0.9);
            expect(humanTiming.getFatigueMultiplier(70)).toBe(0.85);
        });
    });

    describe('getTypingDelay', () => {
        it('should be slower for first few chars', () => {
            mathUtils.randomInRange.mockReturnValue(200);
            const delay = humanTiming.getTypingDelay(1, 100);
            expect(delay).toBe(200);
        });

        it('should be faster for middle chars', () => {
            // Mock randomInRange for middle section
            // It uses randomInRange(30, 100) for normal typing
            mathUtils.randomInRange.mockReturnValue(50);
            // Force normal typing path
            vi.spyOn(Math, 'random').mockReturnValue(0.5); 
            
            const delay = humanTiming.getTypingDelay(50, 100);
            expect(delay).toBe(50);
        });
        
        it('should occasionally pause while typing', () => {
            mathUtils.randomInRange.mockReturnValue(300);
            // Force pause path (< 0.1)
            vi.spyOn(Math, 'random').mockReturnValue(0.05);
            
            const delay = humanTiming.getTypingDelay(50, 100);
            expect(delay).toBe(300);
        });

        it('should type fast when variation is high', () => {
            mathUtils.randomInRange.mockReturnValue(25);
            vi.spyOn(Math, 'random').mockReturnValue(0.95);
            
            const delay = humanTiming.getTypingDelay(50, 100);
            expect(delay).toBe(25);
        });

        it('should slow down at the end', () => {
            mathUtils.randomInRange.mockReturnValue(80);
            const delay = humanTiming.getTypingDelay(90, 100);
            expect(delay).toBe(80);
        });
    });

    describe('getHoverTime', () => {
        it('should return hover time for default action', () => {
            const hover = humanTiming.getHoverTime();
            expect(hover).toBe(350);
        });
    });

    describe('getReadingTime', () => {
        it('should compute reading time with multipliers', () => {
            vi.spyOn(Math, 'random').mockReturnValue(0.5);
            const time = humanTiming.getReadingTime(200, 'thread');
            expect(time).toBeGreaterThan(0);
        });

        it('should use default multiplier for unknown type', () => {
            vi.spyOn(Math, 'random').mockReturnValue(0.5);
            const time = humanTiming.getReadingTime(200, 'unknown');
            expect(time).toBeGreaterThan(0);
        });
    });

    describe('withJitter', () => {
        it('should apply jitter around base', () => {
            const value = humanTiming.withJitter(1000, 0.1);
            expect(value).toBe(1000);
        });
    });

    describe('humanBackoff', () => {
        it('should return capped value when attempt exceeds max', () => {
            const value = humanTiming.humanBackoff(6, 1000, 5);
            expect(value).toBe(5000);
        });

        it('should compute backoff within cap', () => {
            const value = humanTiming.humanBackoff(2, 1000, 5);
            expect(value).toBe(2250);
        });
    });

    describe('random', () => {
        it('should return random range value', () => {
            const value = humanTiming.random(10, 20);
            expect(value).toBe(10);
        });
    });
});

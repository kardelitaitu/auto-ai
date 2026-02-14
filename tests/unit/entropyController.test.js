
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EntropyController, entropy } from '../../utils/entropyController.js';

// Mock logger
vi.mock('../../utils/logger.js', () => ({
    createLogger: vi.fn(() => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }))
}));

describe('EntropyController', () => {
    let controller;

    beforeEach(() => {
        vi.useFakeTimers();
        controller = new EntropyController({ sessionId: 'test-session' });
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    describe('Initialization', () => {
        it('should initialize with correct defaults', () => {
            expect(controller.sessionId).toBe('test-session');
            expect(controller.sessionEntropy).toBeDefined();
            expect(controller.sessionEntropy.paceMultiplier).toBeGreaterThan(0);
            expect(controller.fatigueEnabled).toBe(true);
            expect(controller.fatigueActive).toBe(false);
        });

        it('should generate unique session profiles', () => {
            const c2 = new EntropyController({ sessionId: 's2' });
            // It's statistically improbable they are exactly equal
            expect(c2.sessionEntropy).not.toEqual(controller.sessionEntropy);
        });
    });

    describe('Fatigue System', () => {
        it('should not activate fatigue before threshold', () => {
            controller.fatigueActivationTime = 5000; // 5s
            vi.advanceTimersByTime(1000); // 1s
            expect(controller.checkFatigue()).toBe(false);
        });

        it('should activate fatigue after threshold', () => {
            controller.fatigueActivationTime = 5000; // 5s
            vi.advanceTimersByTime(6000); // 6s
            expect(controller.checkFatigue()).toBe(true);
            expect(controller.fatigueActive).toBe(true);
            expect(controller.fatigueLevel).toBeGreaterThan(0);
        });

        it('should calculate fatigue level correctly', () => {
            controller.fatigueActivationTime = 0;
            controller.sessionStart = Date.now();
            
            // 5 minutes past activation
            vi.advanceTimersByTime(5 * 60 * 1000);
            
            controller.checkFatigue();
            // Fatigue rate is 1 / 10min. So 5min should be ~0.5
            expect(controller.fatigueLevel).toBeCloseTo(0.5, 1);
        });

        it('should cap fatigue level at 1.0', () => {
            controller.fatigueActivationTime = 0;
            vi.advanceTimersByTime(20 * 60 * 1000); // 20 mins
            controller.checkFatigue();
            expect(controller.fatigueLevel).toBe(1.0);
        });

        it('should return null modifiers if fatigue not active', () => {
            expect(controller.getFatigueModifiers()).toBeNull();
        });

        it('should return modifiers when fatigue is active', () => {
            controller.fatigueActive = true;
            controller.fatigueLevel = 0.5;
            const mods = controller.getFatigueModifiers();
            
            expect(mods).toBeDefined();
            expect(mods.movementSpeed).toBeLessThan(1.0);
            expect(mods.hesitationIncrease).toBeGreaterThan(1.0);
        });
    });

    describe('Timing Functions', () => {
        it('should generate gaussian values within range (probabilistic)', () => {
            // Run multiple times to check bounds logic
            for (let i = 0; i < 100; i++) {
                const val = controller.gaussian(100, 10, 80, 120);
                expect(val).toBeGreaterThanOrEqual(80);
                expect(val).toBeLessThanOrEqual(120);
            }
        });

        it('should apply fatigue to timing', () => {
            controller.fatigueActive = true;
            controller.fatigueLevel = 0.5;
            
            const base = 1000;
            const mods = controller.getFatigueModifiers();
            
            const movement = controller.applyFatigueToTiming('movement', base);
            expect(movement).toBe(base / mods.movementSpeed);
            
            const click = controller.applyFatigueToTiming('click', base);
            expect(click).toBe(base * mods.clickHoldTime);
        });
    });

    describe('Micro-Breaks', () => {
        it('should respect micro-break probability', () => {
            // Mock random to force break
            vi.spyOn(Math, 'random').mockReturnValue(0.001); // Very low, should trigger
            expect(controller.shouldMicroBreak()).toBe(true);
        });

        it('should respect micro-break duration', () => {
            const duration = controller.microBreakDuration();
            expect(duration).toBeGreaterThan(0);
        });
    });

    describe('Singleton & Parallel Safety', () => {
        it('should export a default singleton', () => {
            expect(entropy).toBeInstanceOf(EntropyController);
        });

        it('should allow creating independent instances', () => {
            const e1 = new EntropyController({ sessionId: '1' });
            const e2 = new EntropyController({ sessionId: '2' });
            
            e1.logAction('test');
            expect(e1.actionLog.length).toBe(1);
            expect(e2.actionLog.length).toBe(0);
        });
    });

    describe('Audit Logging', () => {
        it('should log actions and limit log size', () => {
            // Fill log
            for (let i = 0; i < 600; i++) {
                controller.logAction('action-' + i);
            }
            
            expect(controller.actionLog.length).toBeLessThanOrEqual(500);
            expect(controller.getSessionStats().actionCount).toBe(controller.actionLog.length);
        });
        
        it('should reset session', () => {
            controller.logAction('test');
            controller.resetSession();
            expect(controller.actionLog.length).toBe(0);
            expect(controller.fatigueActive).toBe(false);
        });
    });
});

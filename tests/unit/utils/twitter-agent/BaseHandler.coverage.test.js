import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseHandler } from '../../../../utils/twitter-agent/BaseHandler.js';
import { mathUtils } from '../../../../utils/mathUtils.js';

// Mock dependencies
vi.mock('../../../../utils/mathUtils.js', () => ({
    mathUtils: {
        random: vi.fn(),
        gaussian: vi.fn(),
        randomInRange: vi.fn(),
        roll: vi.fn()
    }
}));

vi.mock('../../../../utils/entropyController.js', () => ({
    entropy: {
        add: vi.fn()
    }
}));

describe('BaseHandler Coverage Gaps', () => {
    let handler;
    let mockAgent;
    let mockPage;
    let mockLogger;

    beforeEach(() => {
        mockPage = {
            content: vi.fn().mockResolvedValue('<html></html>'),
            locator: vi.fn(),
            waitForTimeout: vi.fn().mockResolvedValue(),
            goto: vi.fn().mockResolvedValue(),
            reload: vi.fn().mockResolvedValue(),
            url: vi.fn().mockReturnValue('https://twitter.com/home'),
            mouse: { move: vi.fn(), down: vi.fn(), up: vi.fn(), click: vi.fn() },
            keyboard: { type: vi.fn(), press: vi.fn() },
            evaluate: vi.fn().mockImplementation(async (fn, arg) => {
                if (typeof fn === 'function') return await fn(arg);
                return Promise.resolve();
            }),
            viewportSize: vi.fn().mockReturnValue({ width: 1920, height: 1080 })
        };

        mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
        
        // Mock window global
        global.window = { 
            innerWidth: 1920, 
            innerHeight: 1080,
            getComputedStyle: vi.fn().mockReturnValue({ visibility: 'visible' }) 
        };

        mockAgent = {
            page: mockPage,
            config: {
                timings: { 
                    readingPhase: { mean: 5000, deviation: 1000 },
                    // actionSpecific intentionally missing for default value test
                },
                probabilities: {},
            },
            logger: mockLogger,
            human: { consumeContent: vi.fn(), scroll: vi.fn() },
            ghost: { move: vi.fn() },
            state: { consecutiveSoftErrors: 0, fatigueBias: 0, activityMode: 'NORMAL' }
        };

        handler = new BaseHandler(mockAgent);
    });

    it('simulateReading should use default actionDelays when config is missing', async () => {
        // Ensure actionSpecific is missing
        mockAgent.config.timings.actionSpecific = undefined;
        
        mathUtils.roll.mockReturnValue(false); // Skip random actions to keep it simple
        mathUtils.gaussian.mockReturnValue(100); // Short duration

        await handler.simulateReading();
        // Just executing it covers the branch
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Reading'));
    });

    it('normalizeProbabilities should skip non-number values', () => {
        const probs = { tweetDive: 'invalid', profileDive: 0.5 };
        const normalized = handler.normalizeProbabilities(probs);
        
        expect(normalized.tweetDive).toBe('invalid'); // Should remain unchanged/unprocessed
        expect(normalized.profileDive).toBe(0.5);
    });

    it('normalizeProbabilities should handle fatigue bias with missing keys', () => {
        handler.state.fatigueBias = 1;
        // Input probs that don't have the keys we check for
        const probs = { otherKey: 0.5 };
        const normalized = handler.normalizeProbabilities(probs);
        
        expect(normalized.otherKey).toBe(0.5);
        // Should not crash and branches for tweetDive != null should be false
    });

    it('normalizeProbabilities should handle burst mode with missing keys', () => {
        handler.state.activityMode = 'BURST';
        const probs = { otherKey: 0.5 };
        const normalized = handler.normalizeProbabilities(probs);
        
        expect(normalized.otherKey).toBe(0.5);
    });

    it.skip('dismissOverlays should handle modals correctly', async () => {
        const mockModals = { count: vi.fn().mockResolvedValue(1) };
        const mockToasts = { count: vi.fn().mockResolvedValue(0) };
        
        mockPage.locator.mockImplementation((selector) => {
            if (selector.includes('dialog')) return mockModals;
            return mockToasts;
        });

        await handler.dismissOverlays();
        
        expect(mockPage.keyboard.press).toHaveBeenCalledWith('Escape');
    });
});


import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ErrorRecovery } from '../../utils/humanization/error.js';
import { mathUtils } from '../../utils/mathUtils.js';
import { entropy } from '../../utils/entropyController.js';
import * as scrollHelper from '../../utils/scroll-helper.js';

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

vi.mock('../../utils/scroll-helper.js', () => ({
    scrollRandom: vi.fn()
}));

describe('ErrorRecovery', () => {
    let errorRecovery;
    let mockPage;
    let mockLogger;

    beforeEach(() => {
        vi.clearAllMocks();

        mockPage = {
            waitForTimeout: vi.fn().mockResolvedValue(undefined),
            reload: vi.fn().mockResolvedValue(undefined),
            goBack: vi.fn().mockResolvedValue(undefined),
            $$: vi.fn().mockResolvedValue([]),
            $: vi.fn().mockResolvedValue(null)
        };

        mockLogger = {
            log: vi.fn(),
            error: vi.fn(),
            warn: vi.fn(),
            debug: vi.fn(),
            info: vi.fn()
        };

        mathUtils.randomInRange.mockReturnValue(100);
        mathUtils.gaussian.mockReturnValue(100);

        errorRecovery = new ErrorRecovery(mockPage, mockLogger);
    });

    describe('handle', () => {
        it('should handle element_not_found with scroll strategy', async () => {
            const mockLocator = { count: vi.fn().mockResolvedValue(1) };
            const context = { locator: mockLocator };
            
            const result = await errorRecovery.handle('element_not_found', context);
            
            expect(scrollHelper.scrollRandom).toHaveBeenCalled();
            expect(result.success).toBe(true);
            expect(result.strategy).toBe('scroll');
        });

        it('should fall through strategies if first fails', async () => {
            // element_not_found strategies: scroll, refresh, give up
            
            // 1. Scroll fails
            const mockLocator = { count: vi.fn().mockResolvedValue(0) };
            const context = { locator: mockLocator };
            
            // 2. Refresh succeeds
            // _refreshAndRetry always returns success in implementation
            
            const result = await errorRecovery.handle('element_not_found', context);
            
            expect(scrollHelper.scrollRandom).toHaveBeenCalled(); // 1st try
            expect(mockPage.reload).toHaveBeenCalled(); // 2nd try
            expect(result.success).toBe(true);
            expect(result.strategy).toBe('refresh');
        });

        it('should give up if all fail', async () => {
             // force _scrollAndRetry to fail (return success: false)
             const mockLocator = { count: vi.fn().mockResolvedValue(0) };
             const context = { locator: mockLocator };
             
             // force _refreshAndRetry to fail by making gaussian throw when called
             mathUtils.gaussian.mockImplementation((mean) => {
                 if (mean === 1500) throw new Error('Gaussian failed');
                 return 100;
             });
             
             const result = await errorRecovery.handle('element_not_found', context);
             
             // giveUp strategy returns success: true
             expect(result.success).toBe(true);
             expect(result.strategy).toBe('gave_up');
        });

        it('should return exhausted if even give up fails', async () => {
             // Mock scrollRandom to throw error (used in _scrollAndRetry and _giveUp)
             scrollHelper.scrollRandom.mockRejectedValue(new Error('Scroll failed'));
             
             // Force refresh to fail (throw in gaussian)
             // Need to ensure gaussian throws only when called from refresh?
             // refresh calls gaussian(1500, 500). scroll calls gaussian(500, 200).
             // Since scrollRandom throws, scrollAndRetry fails immediately before calling gaussian?
             // No, scrollAndRetry calls scrollRandom first. So it fails.
             // Then refresh calls reload (catch) then gaussian.
             // So we mock gaussian to throw.
             
             mathUtils.gaussian.mockImplementation(() => { throw new Error('Gaussian failed'); });
             
             const context = { locator: { count: vi.fn() } };
             
             const result = await errorRecovery.handle('element_not_found', context);
             
             expect(result.success).toBe(false);
             expect(result.strategy).toBe('exhausted');
        });

        it('should handle click_failed with click nearby', async () => {
            // click_failed strategies: nearby, force, give up
            
            // Setup nearby click success
            // _clickNearby searches for selectors. We need mockPage.$$ to return elements
            const mockElement = { click: vi.fn().mockResolvedValue(undefined) };
            mockPage.$$.mockResolvedValue([mockElement, mockElement]); // Need at least 2 elements
            
            const result = await errorRecovery.handle('click_failed');
            
            expect(result.success).toBe(true);
            expect(result.strategy).toBe('nearby_click');
        });

        it('should handle timeout with wait strategy', async () => {
            // timeout strategies: wait, refresh, give up
            
            const result = await errorRecovery.handle('timeout');
            
            expect(mockPage.waitForTimeout).toHaveBeenCalled();
            expect(result.success).toBe(true);
            expect(result.strategy).toBe('wait');
        });
    });
});

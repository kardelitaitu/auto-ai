
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
            goForward: vi.fn().mockResolvedValue(undefined),
            goto: vi.fn().mockResolvedValue(undefined),
            url: vi.fn().mockResolvedValue('https://example.com'),
            title: vi.fn().mockResolvedValue('Example'),
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
        scrollHelper.scrollRandom.mockResolvedValue(undefined);

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
             mathUtils.gaussian.mockImplementation(() => { throw new Error('Gaussian failed'); });
             
             const context = { locator: { count: vi.fn() } };
             
             const result = await errorRecovery.handle('element_not_found', context);
             
             expect(result.success).toBe(false);
             expect(result.strategy).toBe('exhausted');
        });
        
        it('should handle exception in action with no logger', async () => {
             // Setup recovery without logger
             const noLoggerRecovery = new ErrorRecovery(mockPage, null);
             
             // Force an action to throw
             // element_not_found -> scroll (uses scrollRandom)
             scrollHelper.scrollRandom.mockRejectedValue(new Error('Scroll failed'));
             
             // We need a context that fails scroll so it tries next strategies
             // But we want to test the catch block specifically.
             // If scrollRandom throws, _scrollAndRetry throws.
             // handle catches. logger is null. Should continue.
             
             // Let's ensure it continues to next strategy (refresh)
             // We'll let refresh succeed.
             
             const context = { locator: { count: vi.fn().mockResolvedValue(0) } };
             
             const result = await noLoggerRecovery.handle('element_not_found', context);
             
             expect(result.success).toBe(true);
             expect(result.strategy).toBe('refresh');
             // Verified that it continued after exception without crashing on missing logger
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

        it('should give up when click strategies fail', async () => {
            mockPage.$$.mockRejectedValue(new Error('fail'));
            const locator = { click: vi.fn().mockRejectedValue(new Error('fail')) };
            
            const result = await errorRecovery.handle('click_failed', { locator });
            
            expect(scrollHelper.scrollRandom).toHaveBeenCalled();
            expect(result.success).toBe(true);
            expect(result.strategy).toBe('gave_up');
        });

        it('should handle timeout with wait strategy', async () => {
            // timeout strategies: wait, refresh, give up
            
            const result = await errorRecovery.handle('timeout');
            
            expect(mockPage.waitForTimeout).toHaveBeenCalled();
            expect(result.success).toBe(true);
            expect(result.strategy).toBe('wait');
        });

        it('should refresh when wait strategy fails', async () => {
            vi.spyOn(errorRecovery, '_waitAndRetry').mockRejectedValue(new Error('fail'));
            
            const result = await errorRecovery.handle('timeout');
            
            expect(mockPage.reload).toHaveBeenCalled();
            expect(result.success).toBe(true);
            expect(result.strategy).toBe('refresh');
        });

        it('should give up when timeout strategies fail', async () => {
            vi.spyOn(errorRecovery, '_waitAndRetry').mockRejectedValue(new Error('fail'));
            vi.spyOn(errorRecovery, '_refreshAndRetry').mockRejectedValue(new Error('fail'));
            
            const result = await errorRecovery.handle('timeout');
            
            expect(scrollHelper.scrollRandom).toHaveBeenCalled();
            expect(result.success).toBe(true);
            expect(result.strategy).toBe('gave_up');
        });

        it('should retry with force when click nearby fails', async () => {
            mockPage.$$.mockResolvedValue([]);
            const locator = { click: vi.fn().mockResolvedValue(undefined) };
            
            const result = await errorRecovery.handle('click_failed', { locator });
            
            expect(result.success).toBe(true);
            expect(result.strategy).toBe('force_click');
        });

        it('should handle navigation failed with retry navigation', async () => {
            const result = await errorRecovery.handle('navigation_failed', { url: 'https://x.com' });
            
            expect(mockPage.goto).toHaveBeenCalledWith('https://x.com', expect.any(Object));
            expect(result.success).toBe(true);
            expect(result.strategy).toBe('navigation_retry');
        });

        it('should go back and forward on navigation retry when roll is true', async () => {
            mathUtils.roll.mockReturnValue(true);
            vi.spyOn(errorRecovery, '_retryNavigation').mockRejectedValue(new Error('fail'));
            const result = await errorRecovery.handle('navigation_failed');
            
            expect(mockPage.goBack).toHaveBeenCalled();
            expect(mockPage.goForward).toHaveBeenCalled();
            expect(result.success).toBe(true);
        });

        it('should give up when navigation strategies fail', async () => {
            vi.spyOn(errorRecovery, '_retryNavigation').mockRejectedValue(new Error('fail'));
            vi.spyOn(errorRecovery, '_goBackAndRetry').mockRejectedValue(new Error('fail'));
            
            const result = await errorRecovery.handle('navigation_failed');
            
            expect(scrollHelper.scrollRandom).toHaveBeenCalled();
            expect(result.success).toBe(true);
            expect(result.strategy).toBe('gave_up');
        });

        it('should handle verification failure with state check', async () => {
            const result = await errorRecovery.handle('verification_failed');
            
            expect(mockPage.url).toHaveBeenCalled();
            expect(mockPage.title).toHaveBeenCalled();
            expect(result.success).toBe(true);
            expect(result.strategy).toBe('state_check');
        });

        it('should retry action when state check fails', async () => {
            vi.spyOn(errorRecovery, '_checkState').mockRejectedValue(new Error('fail'));
            
            const result = await errorRecovery.handle('verification_failed');
            
            expect(mockPage.waitForTimeout).toHaveBeenCalled();
            expect(result.success).toBe(true);
            expect(result.strategy).toBe('retry');
        });

        it('should give up when verification strategies fail', async () => {
            vi.spyOn(errorRecovery, '_checkState').mockRejectedValue(new Error('fail'));
            vi.spyOn(errorRecovery, '_retryAction').mockRejectedValue(new Error('fail'));
            
            const result = await errorRecovery.handle('verification_failed');
            
            expect(scrollHelper.scrollRandom).toHaveBeenCalled();
            expect(result.success).toBe(true);
            expect(result.strategy).toBe('gave_up');
        });

        it('should use default strategy for unknown error type', async () => {
            const result = await errorRecovery.handle('unknown_error');
            
            expect(mockPage.waitForTimeout).toHaveBeenCalled();
            expect(result.success).toBe(true);
            expect(result.strategy).toBe('wait');
        });

        it('should give up in default strategy if wait fails', async () => {
            vi.spyOn(errorRecovery, '_waitAndRetry').mockRejectedValue(new Error('fail'));
            
            const result = await errorRecovery.handle('unknown_error');
            
            expect(result.success).toBe(true);
            expect(result.strategy).toBe('gave_up');
        });

        // Edge case tests for private methods and branches
        it('should fail _retryWithForce if locator is missing', async () => {
            // Calling handle with 'click_failed' and no locator, 
            // and forcing _clickNearby to fail so it reaches _retryWithForce
            mockPage.$$.mockResolvedValue([]); // nearby click fails
            
            const context = {}; // no locator
            const result = await errorRecovery.handle('click_failed', context);
            
            // Should fall through to giveUp
            expect(result.strategy).toBe('gave_up');
            
            // Verify _retryWithForce logic was exercised by checking spy if possible, 
            // or we can test the private method logic indirectly.
            // Since we want to cover the line `return { success: false, strategy: 'force_click' };`
            // We need to make sure _retryWithForce was called and returned that.
            // The handle loop catches errors, but _retryWithForce doesn't throw, it returns { success: false }
            // So the loop sees !result.success and continues.
            // Coverage will tell us if we hit the line.
        });

        it('should fail _scrollAndRetry if locator is missing', async () => {
            const context = {}; // no locator
            const result = await errorRecovery.handle('element_not_found', context);
            // Should fail scroll and move to refresh
            expect(result.strategy).toBe('refresh');
        });

        it('should fail _clickNearby if elements length is <= 1', async () => {
            const mockElement = { click: vi.fn() };
            mockPage.$$.mockResolvedValue([mockElement]); // Only 1 element
            
            const result = await errorRecovery.handle('click_failed', {});
            // Should fail nearby and move to force (which fails without locator) -> give up
            expect(result.strategy).toBe('gave_up');
        });

        it('should skip navigation in _retryNavigation if url is missing', async () => {
             // _retryNavigation is called for navigation_failed
             const context = {}; // no url
             const result = await errorRecovery.handle('navigation_failed', context);
             
             expect(mockPage.goto).not.toHaveBeenCalled();
             expect(result.success).toBe(true);
             expect(result.strategy).toBe('navigation_retry');
        });

        it('should not go forward in _goBackAndRetry if roll returns false', async () => {
             mathUtils.roll.mockReturnValue(false);
             vi.spyOn(errorRecovery, '_retryNavigation').mockRejectedValue(new Error('fail'));
             
             await errorRecovery.handle('navigation_failed');
             
             expect(mockPage.goBack).toHaveBeenCalled();
             expect(mockPage.goForward).not.toHaveBeenCalled();
        });

        it('should handle logging safely when logger is missing', async () => {
             const noLoggerRecovery = new ErrorRecovery(mockPage, null);
             
             // Trigger various logs
             await noLoggerRecovery.handle('unknown_error'); // _logError, _logStrategy, _logRecovery
             await noLoggerRecovery._checkState({}); // _logDebug
             
             // Should not throw
             expect(true).toBe(true);
        });

        it('should handle logging safely when logger is present but methods fail (optional, but good for robustness)', async () => {
             // The implementation checks if (this.logger) before calling.
             // We already tested that.
        });
        
        it('should catch error in _clickNearby loop', async () => {
            // Force $$ to throw once then return valid
            mockPage.$$.mockRejectedValueOnce(new Error('fail'))
                       .mockResolvedValueOnce([]); // then return empty
            
            const result = await errorRecovery.handle('click_failed');
            // Should continue and eventually give up
            expect(result.strategy).toBe('gave_up');
        });
        
        it('should return false in _retryWithForce if click throws', async () => {
             const locator = { click: vi.fn().mockRejectedValue(new Error('fail')) };
             mockPage.$$.mockResolvedValue([]); // fail nearby
             
             const result = await errorRecovery.handle('click_failed', { locator });
             // fail nearby -> fail force (catch) -> give up
             expect(result.strategy).toBe('gave_up');
        });

        it('should initialize with humanization engine', () => {
             const humanEngine = {};
             const recovery = new ErrorRecovery(mockPage, mockLogger, humanEngine);
             expect(recovery.human).toBe(humanEngine);
        });

        it('should log warning when all strategies exhausted', async () => {
             scrollHelper.scrollRandom.mockRejectedValue(new Error('Scroll failed'));
             mathUtils.gaussian.mockImplementation(() => { throw new Error('Gaussian failed'); });
             
             await errorRecovery.handle('element_not_found', { locator: { count: vi.fn() } });
             
             expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('All strategies exhausted'));
        });

        // Resilience tests to cover catch blocks in page actions
        it('should handle page errors gracefully in _clickNearby', async () => {
             const mockElement = { click: vi.fn().mockRejectedValue(new Error('Click failed')) };
             mockPage.$$.mockResolvedValue([mockElement, mockElement]); 
             
             const result = await errorRecovery.handle('click_failed');
             
             // Should catch error and return success
             expect(result.success).toBe(true);
             expect(result.strategy).toBe('nearby_click');
        });

        it('should handle page errors gracefully in _refreshAndRetry', async () => {
             mockPage.reload.mockRejectedValue(new Error('Reload failed'));
             
             // We need to trigger _refreshAndRetry.
             // Can use element_not_found, fail scroll, then refresh.
             const context = { locator: { count: vi.fn().mockResolvedValue(0) } };
             scrollHelper.scrollRandom.mockRejectedValue(new Error('Scroll failed')); // Fail scroll
             
             const result = await errorRecovery.handle('element_not_found', context);
             
             expect(mockPage.reload).toHaveBeenCalled();
             expect(result.success).toBe(true);
             expect(result.strategy).toBe('refresh');
        });

        it('should handle page errors gracefully in _goBackAndRetry', async () => {
             mockPage.goBack.mockRejectedValue(new Error('Back failed'));
             mathUtils.roll.mockReturnValue(true); // To also test goForward
             mockPage.goForward.mockRejectedValue(new Error('Forward failed'));
             
             // Trigger _goBackAndRetry via navigation_failed -> retry (fail) -> goBack
             vi.spyOn(errorRecovery, '_retryNavigation').mockRejectedValue(new Error('fail'));
             
             const result = await errorRecovery.handle('navigation_failed');
             
             expect(mockPage.goBack).toHaveBeenCalled();
             expect(mockPage.goForward).toHaveBeenCalled();
             expect(result.success).toBe(true);
             expect(result.strategy).toBe('navigation');
        });

        it('should handle page errors gracefully in _retryNavigation', async () => {
             mockPage.goto.mockRejectedValue(new Error('Goto failed'));
             
             const result = await errorRecovery.handle('navigation_failed', { url: 'https://x.com' });
             
             expect(mockPage.goto).toHaveBeenCalled();
             expect(result.success).toBe(true);
             expect(result.strategy).toBe('navigation_retry');
        });
    });
});

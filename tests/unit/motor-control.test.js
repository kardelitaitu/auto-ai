import { describe, it, expect, vi, beforeEach } from 'vitest';
import { motorControl } from '../../utils/motor-control.js';

vi.mock('../../utils/logger.js', () => ({
    createLogger: vi.fn(() => ({
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn()
    }))
}));

describe('motorControl', () => {
    let controller;
    let mockPage;

    beforeEach(() => {
        vi.clearAllMocks();
        controller = motorControl.createMotorController();
        
        mockPage = {
            $: vi.fn(),
            evaluate: vi.fn(),
            mouse: {
                click: vi.fn()
            },
            waitForTimeout: vi.fn(),
            waitForSelector: vi.fn()
        };
    });

    describe('createMotorController', () => {
        it('should create with default config', () => {
            const ctrl = motorControl.createMotorController();
            expect(ctrl.config.layoutShiftThreshold).toBe(5);
            expect(ctrl.config.spiralSearchAttempts).toBe(4);
        });

        it('should merge custom config', () => {
            const ctrl = motorControl.createMotorController({ maxRetries: 10 });
            expect(ctrl.config.maxRetries).toBe(10);
            expect(ctrl.config.layoutShiftThreshold).toBe(5);
        });
    });

    describe('getXSelectors', () => {
        it('should return selectors for tweet_text', () => {
            const selectors = controller.getXSelectors('tweet_text');
            expect(selectors.primary).toBe('[data-testid="tweetText"]');
            expect(selectors.fallbacks.length).toBeGreaterThan(0);
        });

        it('should return selectors for reply', () => {
            const selectors = controller.getXSelectors('reply');
            expect(selectors.primary).toBe('[data-testid="reply"]');
        });

        it('should return selectors for retweet', () => {
            const selectors = controller.getXSelectors('retweet');
            expect(selectors.primary).toBe('[data-testid="retweet"]');
        });

        it('should return selectors for like', () => {
            const selectors = controller.getXSelectors('like');
            expect(selectors.primary).toBe('[data-testid="like"]');
        });

        it('should return selectors for bookmark', () => {
            const selectors = controller.getXSelectors('bookmark');
            expect(selectors.primary).toBe('[data-testid="bookmark"]');
        });

        it('should return selectors for follow', () => {
            const selectors = controller.getXSelectors('follow');
            expect(selectors.primary).toBe('[data-testid="follow"]');
        });

        it('should return selectors for home', () => {
            const selectors = controller.getXSelectors('home');
            expect(selectors.primary).toBe('[aria-label="Home"]');
        });

        it('should return primary as context for unknown context', () => {
            const selectors = controller.getXSelectors('unknown');
            expect(selectors.primary).toBe('unknown');
            expect(selectors.fallbacks).toEqual([]);
        });
    });

    describe('smartSelector', () => {
        it('should return primary selector if found and visible', async () => {
            const mockElement = { isVisible: vi.fn().mockResolvedValue(true) };
            mockPage.$.mockResolvedValue(mockElement);

            const result = await controller.smartSelector(mockPage, '.test-selector');

            expect(result.selector).toBe('.test-selector');
            expect(result.element).toBe(mockElement);
            expect(result.usedFallback).toBe(false);
        });

        it('should return null element if primary not found', async () => {
            mockPage.$.mockResolvedValue(null);

            const result = await controller.smartSelector(mockPage, '.test-selector');

            expect(result.element).toBeNull();
        });

        it('should try fallbacks if primary not visible', async () => {
            const invisibleElement = { isVisible: vi.fn().mockResolvedValue(false) };
            const visibleFallback = { isVisible: vi.fn().mockResolvedValue(true) };
            
            mockPage.$
                .mockResolvedValueOnce(invisibleElement)
                .mockResolvedValueOnce(visibleFallback);

            const fallbacks = [
                { selector: '.fallback1', reason: 'test_reason' }
            ];

            const result = await controller.smartSelector(mockPage, '.primary', fallbacks);

            expect(result.usedFallback).toBe(true);
            expect(result.selector).toBe('.fallback1');
            expect(result.reason).toBe('test_reason');
        });

        it('should handle errors gracefully', async () => {
            mockPage.$.mockRejectedValue(new Error('Selector error'));

            const result = await controller.smartSelector(mockPage, '.test');

            expect(result.element).toBeNull();
        });
    });

    describe('getStableTarget', () => {
        it('should return timeout if element never stabilizes', async () => {
            const mockElement = {};
            const box1 = { x: 100, y: 100 };
            const box2 = { x: 200, y: 200 };
            
            mockPage.$.mockResolvedValue(mockElement);
            let callCount = 0;
            mockPage.evaluate = vi.fn().mockImplementation(() => {
                callCount++;
                return callCount % 2 === 1 ? box1 : box2;
            });
            mockPage.waitForTimeout = vi.fn().mockResolvedValue();

            const result = await controller.getStableTarget(mockPage, '.test', { timeout: 100 });

            expect(result.success).toBe(false);
            expect(result.reason).toBe('timeout');
        });

        it('should return timeout if element not found', async () => {
            mockPage.$.mockResolvedValue(null);
            mockPage.waitForTimeout = vi.fn().mockResolvedValue();

            const result = await controller.getStableTarget(mockPage, '.test', { timeout: 100 });

            expect(result.success).toBe(false);
            expect(result.reason).toBe('timeout');
        });
    });

    describe('checkOverlap', () => {
        it('should return element at position', async () => {
            const mockElement = { tagName: 'DIV' };
            mockPage.evaluate = vi.fn().mockResolvedValue(mockElement);

            const result = await controller.checkOverlap(mockPage, 100, 100);

            expect(result).toEqual(mockElement);
        });

        it('should return null on error', async () => {
            mockPage.evaluate = vi.fn().mockRejectedValue(new Error('Error'));

            const result = await controller.checkOverlap(mockPage, 100, 100);

            expect(result).toBeNull();
        });
    });

    describe('findUncoveredArea', () => {
        it('should find uncovered area', async () => {
            mockPage.evaluate
                .mockResolvedValueOnce(null)
                .mockResolvedValue({ tagName: 'DIV' });

            const box = { x: 100, y: 100, width: 50, height: 50 };

            const result = await controller.findUncoveredArea(mockPage, box);

            expect(result.success).toBe(true);
        });

        it('should return failure if no uncovered area', async () => {
            mockPage.evaluate = vi.fn().mockResolvedValue({ tagName: 'DIV' });

            const box = { x: 100, y: 100, width: 50, height: 50 };

            const result = await controller.findUncoveredArea(mockPage, box);

            expect(result.success).toBe(false);
        });
    });

    describe('spiralSearch', () => {
        it('should find uncovered position', async () => {
            mockPage.evaluate
                .mockResolvedValueOnce(null);

            const result = await controller.spiralSearch(mockPage, 100, 100);

            expect(result.success).toBe(true);
            expect(result.attempts).toBe(1);
        });

        it('should return failure after max attempts', async () => {
            mockPage.evaluate = vi.fn().mockResolvedValue({ tagName: 'DIV' });

            const result = await controller.spiralSearch(mockPage, 100, 100, { maxAttempts: 2 });

            expect(result.success).toBe(false);
            expect(result.reason).toBe('spiral_failed');
        });
    });

    describe('scrollToElement', () => {
        it('should scroll to element', async () => {
            const mockElement = {};
            const box = { x: 100, y: 200, width: 50, height: 50 };
            
            mockPage.$.mockResolvedValue(mockElement);
            mockElement.boundingBox = vi.fn().mockResolvedValue(box);
            mockPage.evaluate = vi.fn();
            mockPage.waitForTimeout = vi.fn();

            const result = await controller.scrollToElement(mockPage, '.test');

            expect(result.success).toBe(true);
            expect(result.y).toBe(100);
        });

        it('should return failure if element not found', async () => {
            mockPage.$.mockResolvedValue(null);

            const result = await controller.scrollToElement(mockPage, '.test');

            expect(result.success).toBe(false);
            expect(result.reason).toBe('no_element');
        });

        it('should return failure if no bounding box', async () => {
            const mockElement = {};
            mockPage.$.mockResolvedValue(mockElement);
            mockElement.boundingBox = vi.fn().mockResolvedValue(null);

            const result = await controller.scrollToElement(mockPage, '.test');

            expect(result.success).toBe(false);
            expect(result.reason).toBe('no_box');
        });
    });

    describe('smartClick', () => {
        it('should return failure if no context or selector', async () => {
            const result = await controller.smartClick(mockPage, null);

            expect(result.success).toBe(false);
            expect(result.reason).toBe('no_context_or_selector');
        });

        it('should return failure if element not found', async () => {
            mockPage.$.mockResolvedValue(null);

            const result = await controller.smartClick(mockPage, { primary: '.test' });

            expect(result.success).toBe(false);
            expect(result.reason).toBe('selector_not_found');
        });
    });

    describe('defaults', () => {
        it('should export defaults', () => {
            expect(motorControl.defaults).toBeDefined();
            expect(motorControl.defaults.layoutShiftThreshold).toBe(5);
        });
    });

    describe('clickWithRecovery', () => {
        it('should click directly if stable', async () => {
            const mockElement = { boundingBox: vi.fn().mockResolvedValue({ x: 100, y: 100, width: 50, height: 50 }) };
            mockPage.$.mockResolvedValue(mockElement);
            // Mock getStableTarget to return success
            vi.spyOn(controller, 'getStableTarget').mockResolvedValue({ 
                success: true, 
                box: { x: 100, y: 100, width: 50, height: 50 },
                stable: true 
            });
            // Mock checkOverlap to return null (no overlap)
            vi.spyOn(controller, 'checkOverlap').mockResolvedValue(null);

            const result = await controller.clickWithRecovery(mockPage, '.test');

            expect(result.success).toBe(true);
            expect(mockPage.mouse.click).toHaveBeenCalledWith(125, 125);
        });

        it('should attempt scroll recovery if not stable', async () => {
            // First attempt fails, second succeeds (mocked by recursion or just checking logic)
            // Since it's recursive, we need to be careful.
            // Let's mock getStableTarget to fail first time, then succeed? 
            // It calls itself recursively with recovery='spiral' if 'scroll' fails.
            
            const stableSpy = vi.spyOn(controller, 'getStableTarget')
                .mockResolvedValueOnce({ success: false }) // First call fails
                .mockResolvedValueOnce({ success: true, box: { x: 100, y: 100, width: 50, height: 50 } }); // Second call (recursive) succeeds

            vi.spyOn(controller, 'checkOverlap').mockResolvedValue(null);
            mockPage.$.mockResolvedValue({});

            const result = await controller.clickWithRecovery(mockPage, '.test');

            expect(result.success).toBe(true);
            expect(mockPage.evaluate).toHaveBeenCalled(); // scrollBy
            expect(stableSpy).toHaveBeenCalledTimes(2);
        });
    });

    describe('clickWithVerification', () => {
        it('should verify click with selector', async () => {
            vi.spyOn(controller, 'clickWithRecovery').mockResolvedValue({ success: true });
            mockPage.waitForSelector.mockResolvedValue(true);

            const result = await controller.clickWithVerification(mockPage, '.target', { verifySelector: '.verified' });

            expect(result.verified).toBe(true);
            expect(mockPage.waitForSelector).toHaveBeenCalledWith('.verified', expect.any(Object));
        });

        it('should return unverified if selector does not appear', async () => {
            vi.spyOn(controller, 'clickWithRecovery').mockResolvedValue({ success: true });
            mockPage.waitForSelector.mockRejectedValue(new Error('Timeout'));

            const result = await controller.clickWithVerification(mockPage, '.target', { verifySelector: '.verified' });

            expect(result.verified).toBe(false);
        });
    });

    describe('retryWithBackoff', () => {
        it('should retry on failure', async () => {
            const fn = vi.fn()
                .mockRejectedValueOnce(new Error('Fail 1'))
                .mockRejectedValueOnce(new Error('Fail 2'))
                .mockResolvedValue('Success');

            const result = await controller.retryWithBackoff(mockPage, fn, { maxRetries: 3, baseDelay: 10 });

            expect(result).toBe('Success');
            expect(fn).toHaveBeenCalledTimes(3);
        });

        it('should throw after max retries', async () => {
            const fn = vi.fn().mockRejectedValue(new Error('Fail'));

            await expect(controller.retryWithBackoff(mockPage, fn, { maxRetries: 3, baseDelay: 10 }))
                .rejects.toThrow('Fail');
            
            expect(fn).toHaveBeenCalledTimes(3);
        });
    });
});

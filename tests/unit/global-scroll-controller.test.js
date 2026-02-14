/**
 * @fileoverview Unit tests for utils/global-scroll-controller.js
 * @module tests/unit/global-scroll-controller.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../utils/configLoader.js', () => ({
    getSettings: vi.fn().mockResolvedValue({
        twitter: {
            timing: {
                globalScrollMultiplier: 1.5
            }
        }
    })
}));

vi.mock('../../utils/logger.js', () => ({
    createLogger: vi.fn().mockReturnValue({
        info: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn()
    })
}));

describe('utils/global-scroll-controller', () => {
    let gsc;

    beforeEach(async () => {
        vi.clearAllMocks();
        gsc = await import('../../utils/global-scroll-controller.js');
        await gsc.globalScroll.reload();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should initialize with multiplier from settings', async () => {
        expect(gsc.getScrollMultiplier()).toBe(1.5);
    });

    it('should fallback to 1.0 if settings fail', async () => {
        const { getSettings } = await import('../../utils/configLoader.js');
        getSettings.mockRejectedValueOnce(new Error('Load failed'));
        
        await gsc.globalScroll.reload();
        expect(gsc.getScrollMultiplier()).toBe(1.0);
    });

    it('scrollDown should call page.mouse.wheel with adjusted amount', async () => {
        const mockPage = {
            mouse: { wheel: vi.fn().mockResolvedValue() },
            waitForTimeout: vi.fn().mockResolvedValue()
        };
        
        await gsc.scrollDown(mockPage, 100, { delay: 100 });
        
        expect(mockPage.waitForTimeout).toHaveBeenCalledWith(100);
        expect(mockPage.mouse.wheel).toHaveBeenCalledWith(0, 150);
    });

    it('scrollUp should call page.mouse.wheel with negative adjusted amount and handle delay', async () => {
        const mockPage = {
            mouse: { wheel: vi.fn().mockResolvedValue() },
            waitForTimeout: vi.fn().mockResolvedValue()
        };
        
        await gsc.scrollUp(mockPage, 100, { delay: 50 });
        
        expect(mockPage.waitForTimeout).toHaveBeenCalledWith(50);
        expect(mockPage.mouse.wheel).toHaveBeenCalledWith(0, -150);
    });

    it('scrollRandom should call page.mouse.wheel in either direction and handle delay', async () => {
        const mockPage = {
            mouse: { wheel: vi.fn().mockResolvedValue() },
            waitForTimeout: vi.fn().mockResolvedValue()
        };
        
        vi.spyOn(Math, 'random').mockReturnValue(0.6); // > 0.5 means direction = 1
        await gsc.scrollRandom(mockPage, 100, 100, { delay: 30 });
        expect(mockPage.waitForTimeout).toHaveBeenCalledWith(30);
        expect(mockPage.mouse.wheel).toHaveBeenCalledWith(0, 150);
    });

    it('scrollToElement should call page.evaluate with correct arguments', async () => {
        const mockPage = {
            evaluate: vi.fn().mockResolvedValue()
        };
        
        await gsc.globalScroll.scrollToElement(mockPage, '#test-selector', { behavior: 'smooth', block: 'end' });
        
        expect(mockPage.evaluate).toHaveBeenCalledWith(expect.any(Function), '#test-selector', 'smooth', 'end');
    });

    it('scrollToTop should call page.evaluate via export', async () => {
        const mockPage = {
            evaluate: vi.fn().mockResolvedValue()
        };
        await gsc.scrollToTop(mockPage);
        expect(mockPage.evaluate).toHaveBeenCalled();
    });

    it('scrollToBottom should call page.evaluate via export', async () => {
        const mockPage = {
            evaluate: vi.fn().mockResolvedValue()
        };
        await gsc.scrollToBottom(mockPage);
        expect(mockPage.evaluate).toHaveBeenCalled();
    });

    it('scrollBy should call page.mouse.wheel via export', async () => {
        const mockPage = {
            mouse: { wheel: vi.fn().mockResolvedValue() },
            waitForTimeout: vi.fn().mockResolvedValue()
        };
        await gsc.scrollBy(mockPage, 200, { delay: 10 });
        expect(mockPage.waitForTimeout).toHaveBeenCalledWith(10);
        expect(mockPage.mouse.wheel).toHaveBeenCalledWith(0, 300);
    });

    it('smoothScroll should call page.mouse.wheel multiple times via export', async () => {
        const mockPage = {
            mouse: { wheel: vi.fn().mockResolvedValue() },
            waitForTimeout: vi.fn().mockResolvedValue()
        };
        await gsc.smoothScroll(mockPage, 300, { steps: 3 });
        expect(mockPage.mouse.wheel).toHaveBeenCalledTimes(3);
        expect(mockPage.mouse.wheel).toHaveBeenCalledWith(0, 150);
    });

    it('scrollReplies should perform multiple iterations via export', async () => {
        const mockPage = {
            mouse: { wheel: vi.fn().mockResolvedValue() },
            waitForTimeout: vi.fn().mockResolvedValue()
        };
        await gsc.scrollReplies(mockPage, 5, { minScroll: 100, maxScroll: 100 });
        expect(mockPage.mouse.wheel).toHaveBeenCalledTimes(5);
        expect(mockPage.mouse.wheel).toHaveBeenCalledWith(0, 150);
    });
});

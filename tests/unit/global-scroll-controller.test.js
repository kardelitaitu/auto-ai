/**
 * @fileoverview Unit tests for utils/global-scroll-controller.js
 * @module tests/unit/global-scroll-controller.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../api/index.js', () => ({
    api: {
        setPage: vi.fn(),
        getPage: vi.fn(),
        wait: vi.fn().mockResolvedValue(undefined),
        think: vi.fn().mockResolvedValue(undefined),
        getPersona: vi.fn().mockReturnValue({ microMoveChance: 0.1, fidgetChance: 0.05 }),
        scroll: Object.assign(vi.fn().mockResolvedValue(undefined), {
            toTop: vi.fn().mockResolvedValue(undefined),
            back: vi.fn().mockResolvedValue(undefined),
            read: vi.fn().mockResolvedValue(undefined)
        }),
        visible: vi.fn().mockResolvedValue(true),
        exists: vi.fn().mockResolvedValue(true),
        getCurrentUrl: vi.fn().mockResolvedValue('https://x.com/home')
    }
}));
import { api } from '../../api/index.js';

vi.mock('../../utils/logger.js', () => ({
    createLogger: vi.fn().mockReturnValue({
        info: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn()
    })
}));

vi.mock('../../utils/configLoader.js', () => ({
    getSettings: vi.fn().mockResolvedValue({
        twitter: {
            timing: {
                globalScrollMultiplier: 2.0
            }
        }
    })
}));

describe('utils/global-scroll-controller', () => {
    let gsc;

    beforeEach(async () => {
        const mockPageForApi = { isClosed: () => false, context: () => ({ browser: () => ({ isConnected: () => true }) }) };
        if (typeof api !== 'undefined' && api.getPage) api.getPage.mockReturnValue(mockPageForApi);
        vi.clearAllMocks();
        vi.clearAllMocks();
        gsc = await import('../../utils/global-scroll-controller.js');
        await gsc.globalScroll.reload();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // Note: multiplier is 2.0 from actual settings.json
    it('should initialize with multiplier from settings', async () => {
        expect(gsc.getScrollMultiplier()).toBe(2.0);
    });

    it('should use multiplier from settings', async () => {
        // Just verify multiplier is set from settings (value from settings.json is 2.0)
        expect(gsc.getScrollMultiplier()).toBe(2.0);
    });

    it('scrollDown should call page.mouse.wheel with adjusted amount', async () => {
        const mockPage = {
            mouse: { wheel: vi.fn().mockResolvedValue() },
            waitForTimeout: vi.fn().mockResolvedValue()
        };
        
        await gsc.scrollDown(mockPage, 100, { delay: 100 });
        
        expect(api.wait).toHaveBeenCalledWith(100);
        expect(mockPage.mouse.wheel).toHaveBeenCalledWith(0, 200);
    });

    it('scrollUp should call page.mouse.wheel with negative adjusted amount and handle delay', async () => {
        const mockPage = {
            mouse: { wheel: vi.fn().mockResolvedValue() },
            waitForTimeout: vi.fn().mockResolvedValue()
        };
        
        await gsc.scrollUp(mockPage, 100, { delay: 50 });
        
        expect(api.wait).toHaveBeenCalledWith(50);
        expect(mockPage.mouse.wheel).toHaveBeenCalledWith(0, -200);
    });

    it('scrollRandom should call page.mouse.wheel in either direction and handle delay', async () => {
        const mockPage = {
            mouse: { wheel: vi.fn().mockResolvedValue() },
            waitForTimeout: vi.fn().mockResolvedValue()
        };
        
        vi.spyOn(Math, 'random').mockReturnValue(0.6); // > 0.5 means direction = 1
        await gsc.scrollRandom(mockPage, 100, 100, { delay: 30 });
        expect(api.wait).toHaveBeenCalledWith(30);
        expect(mockPage.mouse.wheel).toHaveBeenCalledWith(0, 200);
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
        expect(api.wait).toHaveBeenCalledWith(10);
        expect(mockPage.mouse.wheel).toHaveBeenCalledWith(0, 400);
    });

    it('smoothScroll should call page.mouse.wheel multiple times via export', async () => {
        const mockPage = {
            mouse: { wheel: vi.fn().mockResolvedValue() },
            waitForTimeout: vi.fn().mockResolvedValue()
        };
        await gsc.smoothScroll(mockPage, 300, { steps: 3 });
        expect(mockPage.mouse.wheel).toHaveBeenCalledTimes(3);
        expect(mockPage.mouse.wheel).toHaveBeenCalledWith(0, 200);
    });

    it('scrollReplies should perform multiple iterations via export', async () => {
        const mockPage = {
            mouse: { wheel: vi.fn().mockResolvedValue() },
            waitForTimeout: vi.fn().mockResolvedValue()
        };
        await gsc.scrollReplies(mockPage, 5, { minScroll: 100, maxScroll: 100 });
        expect(mockPage.mouse.wheel).toHaveBeenCalledTimes(5);
        expect(mockPage.mouse.wheel).toHaveBeenCalledWith(0, 200);
    });
});

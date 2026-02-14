/**
 * @fileoverview Unit tests for utils/scroll-helper.js
 * @module tests/unit/scroll-helper.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockGlobalScroll = {
    scrollBy: vi.fn(),
    scrollDown: vi.fn(),
    scrollUp: vi.fn(),
    scrollRandom: vi.fn(),
    scrollToTop: vi.fn(),
    scrollToBottom: vi.fn(),
    getMultiplier: vi.fn().mockReturnValue(1.0)
};

vi.mock('../../utils/global-scroll-controller.js', () => ({
    globalScroll: mockGlobalScroll
}));

describe('utils/scroll-helper', () => {
    let scrollHelper;

    beforeEach(async () => {
        vi.clearAllMocks();
        scrollHelper = await import('../../utils/scroll-helper.js');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('scrollWheel should call globalScroll.scrollBy', async () => {
        const page = {};
        await scrollHelper.scrollWheel(page, 100, { delay: 10 });
        expect(mockGlobalScroll.scrollBy).toHaveBeenCalledWith(page, 100, { delay: 10 });
    });

    it('scrollDown should call globalScroll.scrollDown', async () => {
        const page = {};
        await scrollHelper.scrollDown(page, 200);
        expect(mockGlobalScroll.scrollDown).toHaveBeenCalledWith(page, 200, {});
    });

    it('scrollUp should call globalScroll.scrollUp', async () => {
        const page = {};
        await scrollHelper.scrollUp(page, 150);
        expect(mockGlobalScroll.scrollUp).toHaveBeenCalledWith(page, 150, {});
    });

    it('scrollRandom should call globalScroll.scrollRandom', async () => {
        const page = {};
        await scrollHelper.scrollRandom(page, 100, 300);
        expect(mockGlobalScroll.scrollRandom).toHaveBeenCalledWith(page, 100, 300, {});
    });

    it('scrollToTop should call globalScroll.scrollToTop', async () => {
        const page = {};
        await scrollHelper.scrollToTop(page);
        expect(mockGlobalScroll.scrollToTop).toHaveBeenCalledWith(page, {});
    });

    it('scrollToBottom should call globalScroll.scrollToBottom', async () => {
        const page = {};
        await scrollHelper.scrollToBottom(page);
        expect(mockGlobalScroll.scrollToBottom).toHaveBeenCalledWith(page, {});
    });

    it('scroll should call globalScroll.scrollBy', async () => {
        const page = {};
        await scrollHelper.scroll(page, 500);
        expect(mockGlobalScroll.scrollBy).toHaveBeenCalledWith(page, 500);
    });

    it('getScrollMultiplier should call globalScroll.getMultiplier', () => {
        const result = scrollHelper.getScrollMultiplier();
        expect(mockGlobalScroll.getMultiplier).toHaveBeenCalled();
        expect(result).toBe(1.0);
    });
});

/**
 * @fileoverview Unit tests for utils/scroll-helper.js
 * @module tests/unit/scroll-helper.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { globalScroll } from '../../utils/global-scroll-controller.js';
import * as scrollHelper from '../../utils/scroll-helper.js';

describe('utils/scroll-helper', () => {
    beforeEach(() => {
        vi.spyOn(globalScroll, 'scrollBy').mockImplementation(() => Promise.resolve());
        vi.spyOn(globalScroll, 'scrollDown').mockImplementation(() => Promise.resolve());
        vi.spyOn(globalScroll, 'scrollUp').mockImplementation(() => Promise.resolve());
        vi.spyOn(globalScroll, 'scrollRandom').mockImplementation(() => Promise.resolve());
        vi.spyOn(globalScroll, 'scrollToTop').mockImplementation(() => Promise.resolve());
        vi.spyOn(globalScroll, 'scrollToBottom').mockImplementation(() => Promise.resolve());
        vi.spyOn(globalScroll, 'getMultiplier').mockReturnValue(1.0);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('scrollWheel should call globalScroll.scrollBy', async () => {
        const page = {};
        await scrollHelper.scrollWheel(page, 100, { delay: 10 });
        expect(globalScroll.scrollBy).toHaveBeenCalledWith(page, 100, { delay: 10 });
    });

    it('scrollDown should call globalScroll.scrollDown', async () => {
        const page = {};
        await scrollHelper.scrollDown(page, 200);
        expect(globalScroll.scrollDown).toHaveBeenCalledWith(page, 200, {});
    });

    it('scrollUp should call globalScroll.scrollUp', async () => {
        const page = {};
        await scrollHelper.scrollUp(page, 150);
        expect(globalScroll.scrollUp).toHaveBeenCalledWith(page, 150, {});
    });

    it('scrollRandom should call globalScroll.scrollRandom', async () => {
        const page = {};
        await scrollHelper.scrollRandom(page, 100, 300);
        expect(globalScroll.scrollRandom).toHaveBeenCalledWith(page, 100, 300, {});
    });

    it('scrollToTop should call globalScroll.scrollToTop', async () => {
        const page = {};
        await scrollHelper.scrollToTop(page);
        expect(globalScroll.scrollToTop).toHaveBeenCalledWith(page, {});
    });

    it('scrollToBottom should call globalScroll.scrollToBottom', async () => {
        const page = {};
        await scrollHelper.scrollToBottom(page);
        expect(globalScroll.scrollToBottom).toHaveBeenCalledWith(page, {});
    });

    it('scroll should call globalScroll.scrollBy', async () => {
        const page = {};
        await scrollHelper.scroll(page, 500);
        expect(globalScroll.scrollBy).toHaveBeenCalledWith(page, 500);
    });

    it('getScrollMultiplier should call globalScroll.getMultiplier', () => {
        const result = scrollHelper.getScrollMultiplier();
        expect(globalScroll.getMultiplier).toHaveBeenCalled();
        expect(result).toBe(1.0);
    });
});

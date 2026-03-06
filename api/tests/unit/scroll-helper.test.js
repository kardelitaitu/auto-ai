/**
 * @fileoverview Unit tests for utils/scroll-helper.js
 * @module tests/unit/scroll-helper.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('utils/scroll-helper', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('scrollWheel should wait if delay is provided', async () => {
        const { scrollWheel } = await import('../../behaviors/scroll-helper.js');
        const api = (await import('../../index.js')).api;

        vi.spyOn(api, 'wait').mockResolvedValue();
        vi.spyOn(api, 'scroll').mockResolvedValue();

        await scrollWheel(100, { delay: 500 });

        expect(api.wait).toHaveBeenCalledWith(500);
        expect(api.scroll).toHaveBeenCalledWith(100);
    });

    it('scrollWheel should not wait if delay is not provided', async () => {
        const { scrollWheel } = await import('../../behaviors/scroll-helper.js');
        const api = (await import('../../index.js')).api;

        vi.spyOn(api, 'wait').mockResolvedValue();
        vi.spyOn(api, 'scroll').mockResolvedValue();

        await scrollWheel(100);

        expect(api.wait).not.toHaveBeenCalled();
        expect(api.scroll).toHaveBeenCalledWith(100);
    });

    it('scrollDown should scroll down with delay', async () => {
        const { scrollDown } = await import('../../behaviors/scroll-helper.js');
        const api = (await import('../../index.js')).api;

        vi.spyOn(api, 'wait').mockResolvedValue();
        vi.spyOn(api, 'scroll').mockResolvedValue();

        await scrollDown(200, { delay: 500 });

        expect(api.wait).toHaveBeenCalledWith(500);
        expect(api.scroll).toHaveBeenCalledWith(200);
    });

    it('scrollUp should scroll up with delay', async () => {
        const { scrollUp } = await import('../../behaviors/scroll-helper.js');
        const api = (await import('../../index.js')).api;

        vi.spyOn(api, 'wait').mockResolvedValue();
        vi.spyOn(api, 'scroll').mockResolvedValue();

        await scrollUp(200, { delay: 500 });

        expect(api.wait).toHaveBeenCalledWith(500);
        expect(api.scroll).toHaveBeenCalledWith(-200);
    });

    it('scrollRandom should use mathUtils and scroll with delay', async () => {
        const { scrollRandom } = await import('../../behaviors/scroll-helper.js');
        const api = (await import('../../index.js')).api;

        vi.spyOn(api, 'wait').mockResolvedValue();
        vi.spyOn(api, 'scroll').mockResolvedValue();

        const mathUtils = (await import('../../utils/math.js')).mathUtils;
        vi.spyOn(mathUtils, 'randomInRange').mockReturnValue(150);

        await scrollRandom(100, 200, { delay: 500 });

        expect(api.wait).toHaveBeenCalledWith(500);
        expect(mathUtils.randomInRange).toHaveBeenCalledWith(100, 200);
        expect(api.scroll).toHaveBeenCalledWith(150);
    });

    it('scrollToTop should call api.scroll.toTop', async () => {
        const { scrollToTop } = await import('../../behaviors/scroll-helper.js');
        const api = (await import('../../index.js')).api;

        vi.spyOn(api.scroll, 'toTop').mockResolvedValue();

        await scrollToTop();

        expect(api.scroll.toTop).toHaveBeenCalled();
    });

    it('scrollToBottom should call api.scroll.toBottom', async () => {
        const { scrollToBottom } = await import('../../behaviors/scroll-helper.js');
        const api = (await import('../../index.js')).api;

        vi.spyOn(api.scroll, 'toBottom').mockResolvedValue();

        await scrollToBottom();

        expect(api.scroll.toBottom).toHaveBeenCalled();
    });

    it('scroll should call api.scroll', async () => {
        const { scroll } = await import('../../behaviors/scroll-helper.js');
        const api = (await import('../../index.js')).api;

        vi.spyOn(api, 'scroll').mockResolvedValue();

        await scroll(300);

        expect(api.scroll).toHaveBeenCalledWith(300);
    });

    it('getScrollMultiplier should return 1.0', async () => {
        const { getScrollMultiplier } = await import('../../behaviors/scroll-helper.js');
        expect(getScrollMultiplier()).toBe(1.0);
    });

    it('scrollToElement should call api.scroll.focus', async () => {
        const { scrollToElement } = await import('../../behaviors/scroll-helper.js');
        const api = (await import('../../index.js')).api;

        vi.spyOn(api.scroll, 'focus').mockResolvedValue();

        await scrollToElement('#test-el', { behavior: 'smooth' });

        expect(api.scroll.focus).toHaveBeenCalledWith('#test-el', { behavior: 'smooth' });
    });
});

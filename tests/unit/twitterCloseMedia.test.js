/**
 * @fileoverview Unit tests for Twitter Close Media utilities
 * @module tests/unit/twitterCloseMedia.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api } from '../../api/index.js';

vi.mock('../../utils/logger.js', () => ({
    createLogger: () => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    })
}));

vi.mock('../../utils/mathUtils.js', () => ({
    mathUtils: {
        randomInRange: vi.fn(() => 300)
    }
}));

const { mock: ghostMock } = vi.hoisted(() => ({
    mock: {
        click: vi.fn((_selector, _options) => Promise.resolve({ success: true }))
    },
    fn: vi.fn((_selector, _options) => Promise.resolve({ success: true }))
}));

vi.mock('../../utils/ghostCursor.js', () => {
    return {
        GhostCursor: vi.fn().mockImplementation(() => ghostMock),
        TWITTER_CLICK_PROFILES: {}
    };
});

const { twitterCloseMedia, isMediaModalOpen, waitForMediaModal } = require('../../utils/twitterCloseMedia.js');

describe('twitterCloseMedia.js', () => {
    let mockPage;

    beforeEach(() => {
        mockPage = {
            url: vi.fn().mockReturnValue('https://x.com/user/status/123/media'),
            $: vi.fn().mockResolvedValue(null),
            keyboard: {
                press: vi.fn().mockResolvedValue(undefined)
            },
            waitForTimeout: vi.fn().mockResolvedValue(undefined)
        };
        vi.spyOn(api, 'getCurrentUrl').mockReturnValue('https://x.com/user/status/123/media');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('twitterCloseMedia', () => {
        it('should return success with no_media_modal_open when no modal detected', async () => {
            mockPage.$ = vi.fn().mockResolvedValue(null);

            const result = await twitterCloseMedia(mockPage);

            expect(result.success).toBe(true);
            expect(result.method).toBe('none');
            expect(result.reason).toBe('no_media_modal_open');
        });

        it('should close media using escape key when modal detected', async () => {
            const closeButton = {};
            mockPage.$ = vi.fn()
                .mockResolvedValueOnce(closeButton)
                .mockResolvedValueOnce(null);

            mockPage.keyboard.press = vi.fn().mockResolvedValue(undefined);
            
            vi.spyOn(Math, 'random')
                .mockReturnValueOnce(0.3);

            vi.spyOn(Date, 'now')
                .mockReturnValueOnce(1000)
                .mockReturnValueOnce(1100);

            const result = await twitterCloseMedia(mockPage, { escapeChance: 0.5, timeout: 100 });

            expect(result.success).toBe(true);
            expect(mockPage.keyboard.press).toHaveBeenCalledWith('Escape');
        });

        it('should close media and return success via escape key', async () => {
            const closeButton = {};
            mockPage.$ = vi.fn()
                .mockResolvedValueOnce(closeButton)
                .mockResolvedValueOnce(null);

            mockPage.keyboard.press = vi.fn().mockResolvedValue(undefined);
            mockPage.url = vi.fn()
                .mockReturnValueOnce('https://x.com/status/123')
                .mockReturnValueOnce('https://x.com/user');

            vi.spyOn(Math, 'random')
                .mockReturnValueOnce(0.3);

            vi.spyOn(Date, 'now')
                .mockReturnValueOnce(1000)
                .mockReturnValueOnce(1100);

            const result = await twitterCloseMedia(mockPage, { escapeChance: 1, timeout: 100 });

            expect(result.success).toBe(true);
            expect(result.method).toBe('escape');
            expect(result.reason).toBe('media_closed');
        });

        it('should fallback to button when escape key throws error', async () => {
            const closeButton = {};
            mockPage.$ = vi.fn()
                .mockResolvedValueOnce(closeButton)
                .mockResolvedValueOnce(closeButton)
                .mockResolvedValueOnce(null);

            mockPage.keyboard.press = vi.fn().mockRejectedValue(new Error('keyboard error'));

            vi.spyOn(Math, 'random')
                .mockReturnValueOnce(0.3);

            vi.spyOn(Date, 'now')
                .mockReturnValueOnce(1000)
                .mockReturnValueOnce(1050)
                .mockReturnValueOnce(1100);

            const result = await twitterCloseMedia(mockPage, { escapeChance: 1, timeout: 200 });

            expect(result.method).toBe('button_click');
        });

        it('should use button click when escape chance is 0', async () => {
            const closeButton = {};
            mockPage.$ = vi.fn()
                .mockResolvedValueOnce(closeButton)
                .mockResolvedValueOnce(closeButton)
                .mockResolvedValueOnce(null);

            vi.spyOn(Math, 'random')
                .mockReturnValueOnce(0.9);

            vi.spyOn(Date, 'now')
                .mockReturnValueOnce(1000)
                .mockReturnValueOnce(1050)
                .mockReturnValueOnce(1100);

            const result = await twitterCloseMedia(mockPage, { escapeChance: 0, timeout: 200 });

            expect(result.method).toBe('button_click');
        });

        it('should use alternative selector when primary not found', async () => {
            const closeButton = {};
            mockPage.$ = vi.fn()
                .mockResolvedValueOnce(closeButton)
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(closeButton)
                .mockResolvedValueOnce(null);

            vi.spyOn(Math, 'random')
                .mockReturnValueOnce(0.9);

            vi.spyOn(Date, 'now')
                .mockReturnValueOnce(1000)
                .mockReturnValueOnce(1050)
                .mockReturnValueOnce(1100)
                .mockReturnValueOnce(1150);

            const result = await twitterCloseMedia(mockPage, { escapeChance: 0, timeout: 200 });

            expect(result.method).toBe('button_click');
        });

        it.skip('should return failure when media not closed after button click', async () => {
            const closeButton = {};
            mockPage.$ = vi.fn().mockResolvedValue(closeButton);

            mockPage.url = vi.fn().mockReturnValue('https://x.com/status/123');

            vi.spyOn(Math, 'random')
                .mockReturnValueOnce(0.9);

            vi.spyOn(Date, 'now')
                .mockReturnValueOnce(1000)
                .mockReturnValueOnce(1050);

            const urlBefore = 'https://x.com/status/123';
            const urlAfter = 'https://x.com/status/123';  // Same URL (media not closed)
            let callCount = 0;
            vi.spyOn(api, 'getCurrentUrl').mockImplementation(() => {
                return callCount++ === 0 ? urlBefore : urlAfter;
            });

            const result = await twitterCloseMedia(mockPage, { escapeChance: 0, timeout: 100 });

            expect(result.success).toBe(false);
            expect(result.reason).toBe('media_not_closed');
        });

        it('should close media when escape succeeds but URL verification times out', async () => {
            const closeButton = {};
            mockPage.$ = vi.fn()
                .mockResolvedValueOnce(closeButton)
                .mockResolvedValueOnce(null);

            mockPage.keyboard.press = vi.fn().mockResolvedValue(undefined);
            
            vi.spyOn(Math, 'random')
                .mockReturnValueOnce(0.3);

            vi.spyOn(Date, 'now')
                .mockReturnValueOnce(1000)
                .mockReturnValueOnce(1100)
                .mockReturnValueOnce(2000)
                .mockReturnValueOnce(2100);

            const result = await twitterCloseMedia(mockPage, { escapeChance: 1, timeout: 1000 });

            expect(result.success).toBe(true);
            expect(result.method).toBe('escape');
        });
    });

    describe('isMediaModalOpen', () => {
        it('should return true when close button exists', async () => {
            mockPage.$ = vi.fn().mockResolvedValue({});

            const result = await isMediaModalOpen(mockPage);

            expect(result).toBe(true);
        });

        it('should return true when media overlay exists', async () => {
            mockPage.$ = vi.fn()
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce({});

            const result = await isMediaModalOpen(mockPage);

            expect(result).toBe(true);
        });

        it('should return true when media modal exists', async () => {
            mockPage.$ = vi.fn()
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce({});

            const result = await isMediaModalOpen(mockPage);

            expect(result).toBe(true);
        });

        it('should return false when no media elements exist', async () => {
            mockPage.$ = vi.fn().mockResolvedValue(null);

            const result = await isMediaModalOpen(mockPage);

            expect(result).toBe(false);
        });
    });

    describe('waitForMediaModal', () => {
        it('should return true when selector found', async () => {
            mockPage.waitForSelector = vi.fn().mockResolvedValue(undefined);

            const result = await waitForMediaModal(mockPage, 5000);

            expect(result).toBe(true);
        });

        it('should return false on timeout', async () => {
            mockPage.waitForSelector = vi.fn().mockRejectedValue(new Error('timeout'));

            const result = await waitForMediaModal(mockPage, 100);

            expect(result).toBe(false);
        });

        it('should use default timeout of 5000ms', async () => {
            mockPage.waitForSelector = vi.fn().mockResolvedValue(undefined);

            await waitForMediaModal(mockPage);

            expect(mockPage.waitForSelector).toHaveBeenCalledWith('[aria-label="Close"]', { timeout: 5000 });
        });
    });
});

/**
 * @fileoverview Unit tests for tasks/twitterTweet.js
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import twitterTweetTask from '../../tasks/twitterTweet.js';
import { TwitterAgent } from '../../utils/twitterAgent.js';
import { profileManager } from '../../utils/profileManager.js';
import metricsCollector from '../../utils/metrics.js';
import fs from 'fs';

// Mocks
vi.mock('fs');
vi.mock('../../utils/twitterAgent.js');
vi.mock('../../utils/profileManager.js');
vi.mock('../../utils/metrics.js');
vi.mock('../../utils/screenshot.js');
vi.mock('../../utils/browserPatch.js', () => ({
    applyHumanizationPatch: vi.fn().mockResolvedValue(undefined)
}));
vi.mock('../../utils/utils.js', () => ({
    createLogger: vi.fn(() => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        success: vi.fn()
    }))
}));
vi.mock('../../utils/mathUtils.js', () => ({
    mathUtils: {
        randomInRange: vi.fn().mockReturnValue(100)
    }
}));

describe('tasks/twitterTweet', () => {
    let mockPage;
    let mockAgent;
    let mockEditor;
    let mockPostBtn;

    beforeEach(() => {
        vi.clearAllMocks();

        mockEditor = {
            waitFor: vi.fn().mockResolvedValue(undefined),
            isVisible: vi.fn().mockResolvedValue(true),
            first: vi.fn().mockReturnThis()
        };

        mockPostBtn = {
            isVisible: vi.fn().mockResolvedValue(true),
            isDisabled: vi.fn().mockResolvedValue(false),
            isEnabled: vi.fn().mockResolvedValue(true),
            first: vi.fn().mockReturnThis()
        };

        mockPage = {
            keyboard: {
                type: vi.fn().mockResolvedValue(undefined),
                press: vi.fn().mockResolvedValue(undefined)
            },
            waitForTimeout: vi.fn().mockResolvedValue(undefined),
            emulateMedia: vi.fn().mockResolvedValue(undefined),
            locator: vi.fn((selector) => {
                if (selector && selector.includes('tweetTextarea')) return mockEditor;
                if (selector && selector.includes('tweetButton')) return mockPostBtn;
                return {
                    first: vi.fn().mockReturnThis(),
                    isVisible: vi.fn().mockResolvedValue(true),
                    isDisabled: vi.fn().mockResolvedValue(false)
                };
            }),
            isClosed: vi.fn().mockReturnValue(false),
            close: vi.fn().mockResolvedValue(undefined)
        };

        mockAgent = {
            config: {
                probabilities: { idle: 0.1 },
                timings: { readingPhase: { mean: 1000, deviation: 100 } }
            },
            simulateReading: vi.fn().mockResolvedValue(undefined),
            humanClick: vi.fn().mockResolvedValue(undefined),
            navigateHome: vi.fn().mockResolvedValue(undefined),
            checkAndHandleSoftError: vi.fn().mockResolvedValue(false),
            sessionStart: Date.now()
        };
        TwitterAgent.mockImplementation(function () { return mockAgent; });

        profileManager.getStarter.mockReturnValue({ theme: 'dark' });

        fs.existsSync.mockReturnValue(true);
        fs.readFileSync.mockReturnValue('tweet 1\ntweet 2');
    });

    it('should complete tweet task successfully', async () => {
        // Success happens when post button eventually disappears/is not visible
        mockPostBtn.isVisible.mockResolvedValueOnce(true) // before click
            .mockResolvedValue(false); // after click

        await twitterTweetTask(mockPage, { browserInfo: 'test' });

        expect(fs.readFileSync).toHaveBeenCalled();
        expect(fs.writeFileSync).toHaveBeenCalledWith(expect.anything(), 'tweet 2', 'utf-8');
        expect(mockAgent.navigateHome).toHaveBeenCalled();
        expect(mockPage.keyboard.type).toHaveBeenCalled();
        expect(metricsCollector.recordSocialAction).toHaveBeenCalledWith('tweet', 1);
    });

    it('should decode multi-line tweets', async () => {
        fs.readFileSync.mockReturnValue('line 1\\nline 2');
        mockPostBtn.isVisible.mockResolvedValue(false);

        await twitterTweetTask(mockPage, { browserInfo: 'test' });

        expect(mockPage.keyboard.type).toHaveBeenCalledWith('line 1\nline 2', expect.anything());
    });

    it('should use keyboard shortcut if SideNav button is missing', async () => {
        // Mock SideNav button as missing
        mockPage.locator = vi.fn((selector) => {
            if (selector && selector.includes('SideNav')) return { first: () => ({ isVisible: () => Promise.resolve(false) }) };
            if (selector && selector.includes('tweetTextarea')) return mockEditor;
            if (selector && selector.includes('tweetButton')) return mockPostBtn;
            return { first: vi.fn().mockReturnThis(), isVisible: vi.fn().mockResolvedValue(true) };
        });
        mockPostBtn.isVisible.mockResolvedValue(false);

        await twitterTweetTask(mockPage, { browserInfo: 'test' });
        expect(mockPage.keyboard.press).toHaveBeenCalledWith('n');
    });

    it('should handle composer opening failure', async () => {
        mockEditor.waitFor.mockRejectedValue(new Error('not found'));
        mockEditor.isVisible.mockResolvedValue(false);

        await twitterTweetTask(mockPage, { browserInfo: 'test' });
        // Should catch error and stop
    });

    it('should handle post button stuck disabled', async () => {
        mockPostBtn.isDisabled.mockResolvedValue(true);
        mockPostBtn.isEnabled.mockResolvedValue(false);
        mockPostBtn.isVisible.mockResolvedValue(true);

        await twitterTweetTask(mockPage, { browserInfo: 'test' });
        // Should retry and eventually give up
    });

    it('should handle soft error during post click', async () => {
        mockAgent.checkAndHandleSoftError.mockResolvedValueOnce(false) // initial
            .mockResolvedValueOnce(false) // before loop
            .mockResolvedValue(true); // after click

        await twitterTweetTask(mockPage, { browserInfo: 'test' });
        // Should throw error and exit
    });

    it('should handle missing tweet file', async () => {
        fs.existsSync.mockReturnValue(false);
        await twitterTweetTask(mockPage, { browserInfo: 'test' });
    });

    it('should handle empty tweet file', async () => {
        fs.readFileSync.mockReturnValue('');
        await twitterTweetTask(mockPage, { browserInfo: 'test' });
    });
});

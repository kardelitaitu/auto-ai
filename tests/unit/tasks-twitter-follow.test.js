/**
 * @fileoverview Unit tests for tasks/twitterFollow.js
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import twitterFollowTask from '../../tasks/twitterFollow.js';
import { TwitterAgent } from '../../utils/twitterAgent.js';
import { profileManager } from '../../utils/profileManager.js';
import { ReferrerEngine } from '../../utils/urlReferrer.js';
import metricsCollector from '../../utils/metrics.js';

// Mocks
vi.mock('../../utils/twitterAgent.js');
vi.mock('../../utils/profileManager.js');
vi.mock('../../utils/urlReferrer.js');
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

describe('tasks/twitterFollow', () => {
    let mockPage;
    let mockAgent;
    let mockReferrerEngine;

    beforeEach(() => {
        vi.clearAllMocks();

        mockPage = {
            goto: vi.fn().mockResolvedValue(undefined),
            waitForSelector: vi.fn().mockResolvedValue(undefined),
            waitForTimeout: vi.fn().mockResolvedValue(undefined),
            setExtraHTTPHeaders: vi.fn().mockResolvedValue(undefined),
            emulateMedia: vi.fn().mockResolvedValue(undefined),
            url: vi.fn().mockReturnValue('https://x.com/profile'),
            locator: vi.fn().mockReturnValue({
                first: vi.fn().mockReturnThis(),
                count: vi.fn().mockResolvedValue(1),
                isVisible: vi.fn().mockResolvedValue(true)
            }),
            isClosed: vi.fn().mockReturnValue(false),
            close: vi.fn().mockResolvedValue(undefined),
            waitForLoadState: vi.fn().mockResolvedValue(undefined)
        };

        mockAgent = {
            config: {
                probabilities: {
                    refresh: 1, profileDive: 1, tweetDive: 1, idle: 0.1,
                    likeTweetAfterDive: 1, bookmarkAfterDive: 1, followOnProfile: 1
                },
                timings: {
                    readingPhase: { mean: 1000, deviation: 100 }
                }
            },
            simulateReading: vi.fn().mockResolvedValue(undefined),
            humanClick: vi.fn().mockResolvedValue(undefined),
            robustFollow: vi.fn().mockResolvedValue({ success: true, attempts: 1 }),
            navigateHome: vi.fn().mockResolvedValue(undefined),
            checkLoginState: vi.fn().mockResolvedValue(true),
            sessionStart: Date.now()
        };
        TwitterAgent.mockImplementation(function () { return mockAgent; });

        mockReferrerEngine = {
            generateContext: vi.fn().mockReturnValue({
                strategy: 'dynamic',
                referrer: 'https://google.com',
                headers: { 'Referer': 'https://google.com' },
                targetWithParams: 'https://x.com/status/123?utm=test'
            })
        };
        ReferrerEngine.mockImplementation(function () { return mockReferrerEngine; });

        profileManager.getStarter.mockReturnValue({ theme: 'dark' });
        profileManager.getById.mockReturnValue({ id: 'p1', theme: 'light' });
    });

    it('should complete follow task successfully', async () => {
        const payload = { browserInfo: 'test', targetUrl: 'https://x.com/user/status/123' };
        await twitterFollowTask(mockPage, payload);

        expect(mockPage.goto).toHaveBeenCalled();
        expect(mockAgent.simulateReading).toHaveBeenCalled();
        expect(mockAgent.humanClick).toHaveBeenCalled();
        expect(mockAgent.robustFollow).toHaveBeenCalled();
        expect(metricsCollector.recordSocialAction).toHaveBeenCalledWith('follow', 1);
        expect(mockPage.close).toHaveBeenCalled();
    });

    it('should handle custom profile ID in payload', async () => {
        const payload = { browserInfo: 'test', profileId: 'p1' };
        await twitterFollowTask(mockPage, payload);
        expect(profileManager.getById).toHaveBeenCalledWith('p1');
        expect(mockPage.emulateMedia).toHaveBeenCalledWith({ colorScheme: 'light' });
    });

    it('should handle profile navigation retry via avatar if handle click fails', async () => {
        // First call to url() returns status, second returns profile
        mockPage.url.mockReturnValueOnce('https://x.com/user/status/123')
            .mockReturnValueOnce('https://x.com/user/status/123')
            .mockReturnValue('https://x.com/user');

        await twitterFollowTask(mockPage, { browserInfo: 'test' });
        expect(mockAgent.humanClick).toHaveBeenCalledTimes(2); // Handle, then Avatar
    });

    it('should handle navigation failures with retry', async () => {
        mockPage.goto.mockRejectedValueOnce(new Error('nav error'))
            .mockResolvedValueOnce(undefined);

        await twitterFollowTask(mockPage, { browserInfo: 'test' });
        expect(mockPage.goto).toHaveBeenCalledTimes(2);
    });

    it('should handle fatal redirect loop error', async () => {
        mockPage.goto.mockRejectedValue(new Error('ERR_TOO_MANY_REDIRECTS'));
        await twitterFollowTask(mockPage, { browserInfo: 'test' });
        // Should catch and log, not crash
    });

    it('should handle tweet selector timeout', async () => {
        mockPage.waitForSelector.mockRejectedValue(new Error('timeout'));
        await twitterFollowTask(mockPage, { browserInfo: 'test' });
        // Should stop task
    });

    it('should handle follow failure', async () => {
        mockAgent.robustFollow.mockResolvedValue({ success: false, attempts: 0 });
        await twitterFollowTask(mockPage, { browserInfo: 'test' });
        expect(metricsCollector.recordSocialAction).not.toHaveBeenCalled();
    });

    it('should handle fatal follow error', async () => {
        mockAgent.robustFollow.mockResolvedValue({ success: false, fatal: true, reason: 'banned' });
        await twitterFollowTask(mockPage, { browserInfo: 'test' });
    });

    it('should handle task timeout', async () => {
        // Force timeout by providing extremely small timeout
        await twitterFollowTask(mockPage, { browserInfo: 'test', taskTimeoutMs: 1 });
        // Should log timeout error
    });
});

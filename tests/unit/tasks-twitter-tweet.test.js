import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../../api/index.js', () => {
    const api = {
        setPage: vi.fn(),
        getPage: vi.fn(),
        wait: vi.fn().mockResolvedValue(undefined),
        think: vi.fn().mockResolvedValue(undefined),
        getPersona: vi.fn().mockReturnValue({ microMoveChance: 0.1, fidgetChance: 0.05 }),
        scroll: Object.assign(vi.fn().mockResolvedValue(undefined), {
            toTop: vi.fn().mockResolvedValue(undefined),
            back: vi.fn().mockResolvedValue(undefined),
            read: vi.fn().mockResolvedValue(undefined),
            focus: vi.fn().mockResolvedValue(undefined)
        }),
        visible: vi.fn().mockImplementation(async (el) => {
            if (el && typeof el.isVisible === 'function') return await el.isVisible();
            if (el && typeof el.count === 'function') return (await el.count()) > 0;
            return true;
        }),
        exists: vi.fn().mockImplementation(async (el) => {
            if (el && typeof el.count === 'function') return (await el.count()) > 0;
            return el !== null;
        }),
        getCurrentUrl: vi.fn().mockResolvedValue('https://x.com/home'),
        goto: vi.fn().mockResolvedValue(undefined),
        reload: vi.fn().mockResolvedValue(undefined),
        eval: vi.fn().mockResolvedValue('mock title'),
        text: vi.fn().mockResolvedValue('mock text'),
        click: vi.fn().mockResolvedValue(undefined),
        type: vi.fn().mockResolvedValue(undefined),
        keyboardPress: vi.fn().mockResolvedValue(undefined),
        emulateMedia: vi.fn().mockResolvedValue(undefined),
        setExtraHTTPHeaders: vi.fn().mockResolvedValue(undefined),
        clearContext: vi.fn(),
        checkSession: vi.fn().mockResolvedValue(true),
        isSessionActive: vi.fn().mockReturnValue(true),
        waitVisible: vi.fn().mockResolvedValue(undefined),
        count: vi.fn().mockResolvedValue(1),
        waitForLoadState: vi.fn().mockResolvedValue(undefined)
    };
    return { api, default: api };
});

import { api } from '../../api/index.js';
import twitterTweetTask from '../../tasks/twitterTweet.js';
import { TwitterAgent } from '../../utils/twitterAgent.js';
import { profileManager } from '../../utils/profileManager.js';
import metricsCollector from '../../utils/metrics.js';
import fs from 'fs';

// Mocks
vi.mock('../../utils/twitterAgent.js');
vi.mock('../../utils/profileManager.js');
vi.mock('../../utils/metrics.js');
vi.mock('../../utils/screenshot.js');
vi.mock('fs');
vi.mock('../../utils/utils.js', () => ({
    createLogger: vi.fn((name) => ({
        info: vi.fn((msg) => console.log(`[INFO][${name}] ${msg}`)),
        warn: vi.fn((msg) => console.warn(`[WARN][${name}] ${msg}`)),
        error: vi.fn((msg, err) => console.error(`[ERROR][${name}] ${msg}`, err || '')),
        success: vi.fn((msg) => console.log(`[SUCCESS][${name}] ${msg}`)),
        debug: vi.fn((msg) => console.log(`[DEBUG][${name}] ${msg}`))
    }))
}));
vi.mock('../../utils/mathUtils.js', () => ({
    mathUtils: {
        randomInRange: vi.fn().mockReturnValue(100),
        roll: vi.fn().mockReturnValue(true)
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
            first: vi.fn().mockReturnThis(),
            click: vi.fn().mockResolvedValue(undefined)
        };

        mockPostBtn = {
            isDisabled: vi.fn().mockResolvedValue(false),
            isEnabled: vi.fn().mockResolvedValue(true),
            isVisible: vi.fn().mockResolvedValue(true),
            click: vi.fn().mockResolvedValue(undefined),
            first: vi.fn().mockReturnThis()
        };

        mockPage = {
            waitForSelector: vi.fn().mockResolvedValue(undefined),
            waitForTimeout: vi.fn().mockResolvedValue(undefined),
            locator: vi.fn().mockImplementation((sel) => {
                if (sel.includes('tweetTextarea')) return mockEditor;
                if (sel.includes('SideNav_NewTweet_Button') || sel.includes('tweetButton')) return mockPostBtn;
                return { first: vi.fn().mockReturnThis(), isVisible: vi.fn().mockResolvedValue(true), click: vi.fn() };
            }),
            keyboard: {
                type: vi.fn().mockResolvedValue(undefined),
                press: vi.fn().mockResolvedValue(undefined)
            },
            isClosed: vi.fn().mockReturnValue(false),
            close: vi.fn().mockResolvedValue(undefined),
            addInitScript: vi.fn().mockResolvedValue(undefined),
            url: vi.fn().mockReturnValue('https://x.com/home'),
            context: vi.fn().mockReturnValue({ browser: vi.fn().mockReturnValue({ isConnected: vi.fn().mockReturnValue(true) }) }),
            emulateMedia: vi.fn().mockResolvedValue(undefined)
        };

        api.getPage.mockReturnValue(mockPage);
        api.setPage.mockReturnValue(undefined);

        mockAgent = {
            config: {
                probabilities: {
                    refresh: 0.1, profileDive: 0.1, tweetDive: 0.1, idle: 0.7,
                    likeTweetAfterDive: 0, bookmarkAfterDive: 0, followOnProfile: 0
                },
                timings: {
                    readingPhase: { mean: 1000, deviation: 100 }
                }
            },
            navigateHome: vi.fn().mockResolvedValue(undefined),
            humanClick: vi.fn().mockResolvedValue(undefined),
            checkLoginState: vi.fn().mockResolvedValue(true),
            simulateReading: vi.fn().mockResolvedValue(undefined),
            checkAndHandleSoftError: vi.fn().mockResolvedValue(false)
        };
        TwitterAgent.mockImplementation(function () { return mockAgent; });

        profileManager.getStarter.mockReturnValue({ theme: 'dark' });
        
        fs.existsSync.mockReturnValue(true);
        fs.readFileSync.mockReturnValue('tweet 1\ntweet 2\ntweet 3');
    });

    it('should complete tweet task successfully', async () => {
        mockPostBtn.isVisible
            .mockResolvedValueOnce(true) // Initial check
            .mockResolvedValueOnce(true) // Loop start check
            .mockResolvedValueOnce(false); // After click check

        await twitterTweetTask(mockPage, { browserInfo: 'test' });

        expect(fs.writeFileSync).toHaveBeenCalled();
        expect(mockAgent.navigateHome).toHaveBeenCalled();
        expect(mockPage.keyboard.type).toHaveBeenCalled();
        expect(metricsCollector.recordSocialAction).toHaveBeenCalledWith('tweet', 1);
    });

    it('should decode multi-line tweets', async () => {
        mockPostBtn.isVisible
            .mockResolvedValueOnce(true)
            .mockResolvedValueOnce(true)
            .mockResolvedValueOnce(false);
            
        fs.readFileSync.mockReturnValue('line 1\\nline 2');
        await twitterTweetTask(mockPage, { browserInfo: 'test' });

        expect(mockPage.keyboard.type).toHaveBeenCalledWith(expect.stringContaining('line 1\nline 2'), expect.any(Object));
    });

    it('should use keyboard shortcut if SideNav button is missing', async () => {
        // Mock SideNav button not visible
        mockPage.locator.mockImplementation((sel) => {
            if (sel.includes('SideNav_NewTweet_Button')) return { first: vi.fn().mockReturnThis(), isVisible: vi.fn().mockResolvedValue(false) };
            if (sel.includes('tweetTextarea')) return mockEditor;
            if (sel.includes('tweetButton')) return mockPostBtn;
            return { first: vi.fn().mockReturnThis(), isVisible: vi.fn().mockResolvedValue(true), click: vi.fn() };
        });

        await twitterTweetTask(mockPage, { browserInfo: 'test' });
        expect(mockPage.keyboard.press).toHaveBeenCalledWith('n');
    });
});

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.mock('../../../../api/index.js', () => {
    const api = {
        setPage: vi.fn(),
        getPage: vi.fn(),
        wait: vi.fn().mockResolvedValue(undefined),
        click: vi.fn().mockResolvedValue(undefined),
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
        reload: vi.fn().mockResolvedValue(undefined),
        goto: vi.fn().mockResolvedValue(undefined),
        eval: vi.fn().mockResolvedValue([]),
        text: vi.fn().mockResolvedValue('mock text'),
        scroll: Object.assign(vi.fn().mockResolvedValue(undefined), {
            toTop: vi.fn().mockResolvedValue(undefined),
            back: vi.fn().mockResolvedValue(undefined),
            focus: vi.fn().mockResolvedValue(undefined)
        }),
        count: vi.fn().mockResolvedValue(1)
    };
    return { api, default: api };
});

import { api } from '../../../../api/index.js';
import { EngagementHandler } from '../../../../utils/twitter-agent/EngagementHandler.js';
import { mathUtils } from '../../../../utils/mathUtils.js';

vi.mock('../../../../utils/mathUtils.js', () => ({
    mathUtils: {
        randomInRange: vi.fn((min, max) => min),
        roll: vi.fn(() => true)
    }
}));

describe('EngagementHandler', () => {
    let handler;
    let mockAgent;
    let mockPage;
    let mockLogger;
    let mockGhost;

    beforeEach(() => {
        vi.clearAllMocks();
        
        const mockLocator = {
            first: vi.fn().mockReturnThis(),
            count: vi.fn().mockImplementation(async () => 1),
            isVisible: vi.fn().mockResolvedValue(true),
            boundingBox: vi.fn().mockResolvedValue({ x: 0, y: 0, width: 100, height: 100 }),
            click: vi.fn().mockResolvedValue(undefined),
            all: vi.fn().mockResolvedValue([]),
            textContent: vi.fn().mockResolvedValue('follow'),
            getAttribute: vi.fn().mockResolvedValue('mock attr'),
            evaluate: vi.fn().mockResolvedValue(undefined)
        };

        mockPage = {
            locator: vi.fn().mockImplementation((sel) => {
                // Return different visibility based on selector to avoid "Already following"
                const isUnfollow = sel.includes('unfollow') || sel.includes('Following') || sel.includes('Pending');
                return {
                    ...mockLocator,
                    count: vi.fn().mockResolvedValue(isUnfollow ? 0 : 1),
                    isVisible: vi.fn().mockResolvedValue(!isUnfollow)
                };
            }),
            url: vi.fn().mockReturnValue('https://x.com/home'),
            isClosed: vi.fn().mockReturnValue(false),
            context: vi.fn().mockReturnValue({ browser: vi.fn().mockReturnValue({ isConnected: vi.fn().mockReturnValue(true) }) }),
            evaluate: vi.fn().mockResolvedValue(undefined),
            goBack: vi.fn().mockResolvedValue(undefined)
        };

        api.getPage.mockReturnValue(mockPage);
        api.setPage.mockReturnValue(undefined);

        mockLogger = {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            log: vi.fn()
        };

        mockGhost = {
            click: vi.fn().mockResolvedValue({ success: true, x: 50, y: 50 }),
            move: vi.fn().mockResolvedValue(undefined)
        };

        mockAgent = {
            page: mockPage,
            log: vi.fn(),
            ghost: mockGhost,
            state: { follows: 0, likes: 0, bookmarks: 0, consecutiveSoftErrors: 0 },
            human: {
                safeHumanClick: vi.fn().mockResolvedValue({ success: true }),
                humanClick: vi.fn().mockResolvedValue({ success: true }),
                fixation: vi.fn().mockResolvedValue(undefined),
                microMove: vi.fn().mockResolvedValue(undefined),
                think: vi.fn().mockResolvedValue(undefined),
                recoverFromError: vi.fn().mockResolvedValue(undefined),
                consumeContent: vi.fn().mockResolvedValue(undefined),
                scroll: vi.fn().mockResolvedValue(undefined)
            },
            mathUtils: mathUtils,
            twitterConfig: {},
            sessionStart: Date.now(),
            fatigueThreshold: 1000000
        };

        handler = new EngagementHandler(mockAgent);
    });

    it('likeTweet should succeed', async () => {
        const mockTweet = {
            isVisible: vi.fn().mockResolvedValue(true),
            boundingBox: vi.fn().mockResolvedValue({ x: 0, y: 0, width: 100, height: 100 }),
            locator: vi.fn().mockReturnValue({
                first: vi.fn().mockReturnThis(),
                isVisible: vi.fn().mockResolvedValue(true),
                click: vi.fn().mockResolvedValue(undefined),
                evaluate: vi.fn().mockResolvedValue(undefined)
            })
        };
        const result = await handler.likeTweet(mockTweet);
        expect(result).toBe(true);
    });

    it('robustFollow should succeed', async () => {
        vi.spyOn(handler, 'isElementActionable').mockResolvedValue(true);
        vi.spyOn(handler, 'sixLayerClick').mockResolvedValue(true);
        vi.spyOn(handler, 'pollForFollowState').mockResolvedValue(true);
        const result = await handler.robustFollow();
        expect(result.success).toBe(true);
    });
});

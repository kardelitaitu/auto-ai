import { describe, it, expect, vi, beforeEach } from 'vitest';
import AITwitterAgent from '../../utils/ai-twitterAgent/index.js';

// Mock dependencies
vi.mock('../../utils/async-queue.js', () => {
    const mockDiveQueue = vi.fn().mockImplementation(function () {
        return {
            canEngage: vi.fn().mockReturnValue(true),
            recordEngagement: vi.fn().mockReturnValue(true),
            getEngagementProgress: vi.fn().mockReturnValue({
                likes: { current: 1, limit: 10, remaining: 9, percentUsed: 10 },
                replies: { current: 1, limit: 10, remaining: 9, percentUsed: 10 },
                retweets: { current: 1, limit: 10, remaining: 9, percentUsed: 10 },
                quotes: { current: 1, limit: 10, remaining: 9, percentUsed: 10 },
                follows: { current: 1, limit: 10, remaining: 9, percentUsed: 10 },
                bookmarks: { current: 1, limit: 10, remaining: 9, percentUsed: 10 }
            }),
            disableQuickMode: vi.fn(),
            resetEngagement: vi.fn(),
            enqueue: vi.fn(),
            on: vi.fn()
        };
    });
    return {
        DiveQueue: mockDiveQueue,
        default: vi.fn()
    };
});

vi.mock('../../utils/engagement-limits.js', () => {
    const mockTracker = {
        canPerform: vi.fn().mockReturnValue(true),
        record: vi.fn().mockReturnValue(true),
        getProgress: vi.fn().mockReturnValue('1/10'),
        getStatus: vi.fn().mockReturnValue({
            likes: { current: 1, limit: 10, remaining: 9, percentage: '10%' }
        }),
        getSummary: vi.fn().mockReturnValue('likes: 1/10'),
        getUsageRate: vi.fn().mockReturnValue(0.1)
    };
    const mockCreate = vi.fn().mockReturnValue(mockTracker);
    const engagementLimits = {
        createEngagementTracker: mockCreate,
        defaults: {},
        thresholds: {}
    };
    return {
        engagementLimits,
        default: engagementLimits
    };
});

vi.mock('../../core/agent-connector.js', () => {
    const mockConnector = vi.fn().mockImplementation(function () { return {}; });
    return {
        AgentConnector: mockConnector,
        default: mockConnector
    };
});

vi.mock('../../utils/ai-reply-engine.js', () => ({
    AIReplyEngine: vi.fn().mockImplementation(function () {
        return {
            getStats: vi.fn().mockReturnValue({}),
            updateConfig: vi.fn(),
            config: { REPLY_PROBABILITY: 0.5 }
        };
    })
}));

vi.mock('../../utils/ai-quote-engine.js', () => ({
    AIQuoteEngine: vi.fn().mockImplementation(function () {
        return {
            getStats: vi.fn().mockReturnValue({}),
            updateConfig: vi.fn(),
            config: { QUOTE_PROBABILITY: 0.5 }
        };
    })
}));

vi.mock('../../utils/ai-context-engine.js', () => ({
    AIContextEngine: vi.fn().mockImplementation(function () { return {}; })
}));

vi.mock('../../utils/micro-interactions.js', () => {
    const microInteractions = {
        createMicroInteractionHandler: vi.fn().mockImplementation(() => ({})),
        defaults: {}
    };
    return {
        microInteractions,
        default: microInteractions
    };
});

vi.mock('../../utils/motor-control.js', () => {
    const motorControl = {
        createMotorController: vi.fn().mockImplementation(() => ({})),
        defaults: {}
    };
    return {
        motorControl,
        default: motorControl
    };
});

vi.mock('../../utils/entropyController.js', () => ({
    entropy: {}
}));

vi.mock('../../utils/session-phases.js', () => ({
    sessionPhases: {}
}));

vi.mock('../../utils/sentiment-service.js', () => ({
    sentimentService: {}
}));

vi.mock('../../utils/mathUtils.js', () => ({
    mathUtils: {
        randomInRange: vi.fn().mockReturnValue(100),
        getRandomItem: vi.fn().mockImplementation(arr => arr[0])
    }
}));

vi.mock('../../utils/logger.js', () => ({
    createLogger: vi.fn().mockReturnValue({
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }),
    createBufferedLogger: vi.fn().mockReturnValue({
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        shutdown: vi.fn().mockResolvedValue(true)
    })
}));

// Mock browser-agent/twitterAgent since AITwitterAgent extends it
vi.mock('../../utils/twitterAgent.js', () => ({
    TwitterAgent: class {
        constructor(page, profile, logger) {
            this.page = page;
            this.config = profile;
            this.logger = logger;
            this.log = vi.fn();
            this.logWarn = vi.fn();
            this.logError = vi.fn();
        }
        navigateHome() { return Promise.resolve(); }
    }
}));

// Mock Actions
vi.mock('../../utils/actions/ai-twitter-reply.js', () => ({ AIReplyAction: vi.fn().mockImplementation(function () { return { getStats: vi.fn().mockReturnValue({}) }; }) }));
vi.mock('../../utils/actions/ai-twitter-quote.js', () => ({ AIQuoteAction: vi.fn().mockImplementation(function () { return { getStats: vi.fn().mockReturnValue({}) }; }) }));
vi.mock('../../utils/actions/ai-twitter-like.js', () => ({ LikeAction: vi.fn().mockImplementation(function () { return { getStats: vi.fn().mockReturnValue({}) }; }) }));
vi.mock('../../utils/actions/ai-twitter-bookmark.js', () => ({ BookmarkAction: vi.fn().mockImplementation(function () { return { getStats: vi.fn().mockReturnValue({}) }; }) }));
vi.mock('../../utils/actions/ai-twitter-retweet.js', () => ({ RetweetAction: vi.fn().mockImplementation(function () { return { getStats: vi.fn().mockReturnValue({}) }; }) }));
vi.mock('../../utils/actions/ai-twitter-go-home.js', () => ({ GoHomeAction: vi.fn().mockImplementation(function () { return { getStats: vi.fn().mockReturnValue({}) }; }) }));
vi.mock('../../utils/actions/index.js', () => ({
    ActionRunner: vi.fn().mockImplementation(function () {
        return {
            getStats: vi.fn().mockReturnValue({})
        };
    })
}));

vi.mock('../../utils/scroll-helper.js', () => ({
    scrollDown: vi.fn(),
    scrollRandom: vi.fn()
}));

vi.mock('../../utils/human-interaction.js', () => ({
    HumanInteraction: vi.fn()
}));

describe('AITwitterAgent Gaps', () => {
    let mockPage;
    let mockBrowser;
    let mockContext;
    let agent;

    beforeEach(() => {
        mockBrowser = {
            isConnected: vi.fn().mockReturnValue(true)
        };
        mockContext = {
            browser: vi.fn().mockReturnValue(mockBrowser)
        };
        mockPage = {
            context: vi.fn().mockReturnValue(mockContext),
            evaluate: vi.fn().mockResolvedValue({ readyState: 'complete', title: 'X', hasBody: true }),
            url: vi.fn().mockReturnValue('https://x.com/home'),
            on: vi.fn(),
            waitForTimeout: vi.fn().mockResolvedValue(true),
            locator: vi.fn().mockReturnValue({
                isVisible: vi.fn().mockResolvedValue(false),
                catch: vi.fn().mockImplementation(fn => fn())
            }),
            keyboard: {
                press: vi.fn().mockResolvedValue(true)
            },
            mouse: {
                move: vi.fn().mockResolvedValue(true)
            }
        };

        const mockLogger = {
            info: vi.fn(),
            debug: vi.fn(),
            warn: vi.fn(),
            error: vi.fn()
        };

        agent = new AITwitterAgent(mockPage, { name: 'test', description: 'test' }, mockLogger, {
            engagementLimits: {
                replies: 5,
                retweets: 5,
                quotes: 5,
                likes: 5,
                follows: 5,
                bookmarks: 5
            }
        });
    });

    describe('performHealthCheck', () => {
        it('should return unhealthy if browser is disconnected', async () => {
            mockBrowser.isConnected.mockReturnValue(false);
            const result = await agent.performHealthCheck();
            expect(result.healthy).toBe(false);
            expect(result.reason).toBe('browser_disconnected');
        });

        it('should return unhealthy if page is not ready', async () => {
            mockPage.evaluate.mockResolvedValue({ readyState: 'loading', title: 'X', hasBody: true });
            const result = await agent.performHealthCheck();
            expect(result.healthy).toBe(false);
            expect(result.reason).toBe('page_not_ready');
        });

        it('should navigate home if on unexpected URL', async () => {
            mockPage.url.mockReturnValue('https://random-site.com');
            const navigateHomeSpy = vi.spyOn(agent, 'navigateHome').mockResolvedValue(true);
            const result = await agent.performHealthCheck();
            expect(result.healthy).toBe(false);
            expect(result.reason).toBe('unexpected_url');
            expect(navigateHomeSpy).toHaveBeenCalled();
        });

        it('should handle evaluation errors gracefully', async () => {
            mockPage.evaluate.mockRejectedValue(new Error('Eval failed'));
            const result = await agent.performHealthCheck();
            expect(result.healthy).toBe(false);
            expect(result.reason).toBe('page_not_ready');
        });

        it('should handle general errors in health check', async () => {
            mockPage.context.mockImplementation(() => { throw new Error('Context failed'); });
            const result = await agent.performHealthCheck();
            expect(result.healthy).toBe(false);
            expect(result.reason).toBe('Context failed');
        });
    });

    describe('Stats and Reporting', () => {
        it('getAIStats should return combined stats', () => {
            const stats = agent.getAIStats();
            expect(stats).toHaveProperty('successRate');
            expect(stats).toHaveProperty('actions');
        });

        it('getEngagementStats should return tracker status', () => {
            const stats = agent.getEngagementStats();
            expect(stats).toHaveProperty('tracker');
            expect(stats).toHaveProperty('summary');
        });

        it('logEngagementStatus should log info for each action', () => {
            agent.engagementLogger = { info: vi.fn() };
            agent.logEngagementStatus();
            expect(agent.engagementLogger.info).toHaveBeenCalled();
        });
    });

    describe('Cleanup', () => {
        it('flushLogs should shutdown loggers', async () => {
            agent.queueLogger = { shutdown: vi.fn().mockResolvedValue() };
            agent.engagementLogger = { shutdown: vi.fn().mockResolvedValue() };
            await agent.flushLogs();
            expect(agent.queueLogger.shutdown).toHaveBeenCalled();
            expect(agent.engagementLogger.shutdown).toHaveBeenCalled();
        });
    });
});

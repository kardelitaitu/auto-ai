
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIReplyAction } from '../../utils/actions/ai-twitter-reply.js';

// Mock logger
vi.mock('../../utils/logger.js', () => ({
    createLogger: vi.fn(() => ({
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn()
    }))
}));

describe('AIReplyAction', () => {
    let replyAction;
    let mockAgent;

    beforeEach(() => {
        vi.clearAllMocks();

        mockAgent = {
            twitterConfig: {
                actions: {
                    reply: {
                        enabled: true,
                        probability: 0.5
                    }
                }
            },
            contextEngine: {
                extractEnhancedContext: vi.fn().mockResolvedValue({ replies: [], sentiment: {} })
            },
            replyEngine: {
                generateReply: vi.fn().mockResolvedValue({ success: true, reply: 'Nice reply!' })
            },
            executeAIReply: vi.fn().mockResolvedValue(undefined),
            diveQueue: {
                canEngage: vi.fn().mockReturnValue(true)
            },
            page: {}
        };

        replyAction = new AIReplyAction(mockAgent);
    });

    describe('constructor', () => {
        it('should load config', () => {
            expect(replyAction.enabled).toBe(true);
            expect(replyAction.probability).toBe(0.5);
        });
    });

    describe('canExecute', () => {
        it('should allow if all data present', async () => {
            const context = { tweetText: 'text', username: 'user', tweetUrl: 'url' };
            const result = await replyAction.canExecute(context);
            expect(result.allowed).toBe(true);
        });

        it('should reject if data missing', async () => {
            const result = await replyAction.canExecute({});
            expect(result.allowed).toBe(false);
            expect(result.reason).toBe('no_tweet_text');
        });
    });

    describe('execute', () => {
        const context = { tweetText: 'text', username: 'user', tweetUrl: 'url' };

        it('should generate and post reply successfully', async () => {
            const result = await replyAction.execute(context);
            
            expect(mockAgent.contextEngine.extractEnhancedContext).toHaveBeenCalled();
            expect(mockAgent.replyEngine.generateReply).toHaveBeenCalled();
            expect(mockAgent.executeAIReply).toHaveBeenCalledWith('Nice reply!');
            expect(result.success).toBe(true);
        });

        it('should handle AI generation failure', async () => {
            mockAgent.replyEngine.generateReply.mockResolvedValue({ success: false, reason: 'Too controversial' });
            
            const result = await replyAction.execute(context);
            
            expect(result.success).toBe(false);
            expect(result.reason).toBe('Too controversial');
            expect(mockAgent.executeAIReply).not.toHaveBeenCalled();
        });

        it('should handle exception', async () => {
            mockAgent.contextEngine.extractEnhancedContext.mockRejectedValue(new Error('Context failed'));
            
            const result = await replyAction.execute(context);
            
            expect(result.success).toBe(false);
            expect(result.reason).toBe('exception');
        });
    });

    describe('stats', () => {
        const context = { tweetText: 'text', username: 'user', tweetUrl: 'url' };

        it('should track stats correctly', async () => {
            await replyAction.execute(context);
            
            const stats = replyAction.getStats();
            expect(stats.attempts).toBe(1);
            expect(stats.successes).toBe(1);
            expect(stats.successRate).toBe('100.0%');
        });

        it('should reset stats', async () => {
            await replyAction.execute(context);
            replyAction.resetStats();
            
            const stats = replyAction.getStats();
            expect(stats.attempts).toBe(0);
            expect(stats.successes).toBe(0);
        });
    });
});

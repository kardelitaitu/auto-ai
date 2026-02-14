
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIQuoteAction } from '../../utils/actions/ai-twitter-quote.js';

// Mock logger
vi.mock('../../utils/logger.js', () => ({
    createLogger: vi.fn(() => ({
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn()
    }))
}));

describe('AIQuoteAction', () => {
    let quoteAction;
    let mockAgent;

    beforeEach(() => {
        vi.clearAllMocks();

        mockAgent = {
            twitterConfig: {
                actions: {
                    quote: {
                        enabled: true,
                        probability: 0.5
                    }
                }
            },
            contextEngine: {
                extractEnhancedContext: vi.fn().mockResolvedValue({ replies: [], sentiment: {} })
            },
            quoteEngine: {
                generateQuote: vi.fn().mockResolvedValue({ success: true, quote: 'Nice quote!' })
            },
            executeAIQuote: vi.fn().mockResolvedValue(undefined),
            diveQueue: {
                canEngage: vi.fn().mockReturnValue(true)
            },
            page: {}
        };

        quoteAction = new AIQuoteAction(mockAgent);
    });

    describe('constructor', () => {
        it('should load config', () => {
            expect(quoteAction.enabled).toBe(true);
            expect(quoteAction.probability).toBe(0.5);
        });
    });

    describe('canExecute', () => {
        it('should allow if all data present', async () => {
            const context = { tweetText: 'text', username: 'user', tweetUrl: 'url' };
            const result = await quoteAction.canExecute(context);
            expect(result.allowed).toBe(true);
        });

        it('should reject if data missing', async () => {
            const result = await quoteAction.canExecute({});
            expect(result.allowed).toBe(false);
            expect(result.reason).toBe('no_tweet_text');
        });
    });

    describe('execute', () => {
        const context = { tweetText: 'text', username: 'user', tweetUrl: 'url' };

        it('should generate and post quote successfully', async () => {
            const result = await quoteAction.execute(context);
            
            expect(mockAgent.contextEngine.extractEnhancedContext).toHaveBeenCalled();
            expect(mockAgent.quoteEngine.generateQuote).toHaveBeenCalled();
            expect(mockAgent.executeAIQuote).toHaveBeenCalledWith('Nice quote!', 'url');
            expect(result.success).toBe(true);
        });

        it('should handle AI generation failure', async () => {
            mockAgent.quoteEngine.generateQuote.mockResolvedValue({ success: false, reason: 'Too boring' });
            
            const result = await quoteAction.execute(context);
            
            expect(result.success).toBe(false);
            expect(result.reason).toBe('Too boring');
            expect(mockAgent.executeAIQuote).not.toHaveBeenCalled();
        });

        it('should handle exception', async () => {
            mockAgent.contextEngine.extractEnhancedContext.mockRejectedValue(new Error('Context failed'));
            
            const result = await quoteAction.execute(context);
            
            expect(result.success).toBe(false);
            expect(result.reason).toBe('exception');
        });
    });

    describe('stats', () => {
        const context = { tweetText: 'text', username: 'user', tweetUrl: 'url' };

        it('should track stats correctly', async () => {
            await quoteAction.execute(context);
            
            const stats = quoteAction.getStats();
            expect(stats.attempts).toBe(1);
            expect(stats.successes).toBe(1);
            expect(stats.successRate).toBe('100.0%');
        });

        it('should reset stats', async () => {
            await quoteAction.execute(context);
            quoteAction.resetStats();
            
            const stats = quoteAction.getStats();
            expect(stats.attempts).toBe(0);
            expect(stats.successes).toBe(0);
        });
    });
});


import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EngagementHandler } from '../../../../utils/twitter-agent/EngagementHandler.js';

describe('EngagementHandler Gaps', () => {
    let handler;
    let mockPage;
    let mockLogger;
    let mockConfig;
    let mockState;
    let mockMathUtils;

    beforeEach(() => {
        mockPage = {
            click: vi.fn(),
            waitForTimeout: vi.fn(),
            locator: vi.fn(),
            evaluate: vi.fn(),
            reload: vi.fn(),
            goto: vi.fn(),
            $$eval: vi.fn(),
            goBack: vi.fn()
        };

        mockLogger = {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn()
        };

        mockConfig = {
            probabilities: {
                likeTweetAfterDive: 0.3,
                bookmarkAfterDive: 0.1
            }
        };

        mockState = {
            follows: 0,
            likes: 0
        };

        mockMathUtils = {
            roll: vi.fn(),
            randomInRange: vi.fn().mockReturnValue(100),
            weightedRandom: vi.fn()
        };

        const mockAgent = {
            page: mockPage,
            logger: mockLogger,
            config: mockConfig,
            state: mockState,
            human: {},
            ghost: {},
            sessionStart: Date.now(),
            sessionEndTime: null,
            loopIndex: 0,
            isFatigued: false
        };

        handler = new EngagementHandler(mockAgent);
        handler.mathUtils = mockMathUtils;
        
        // Mock BaseHandler methods
        handler.performHealthCheck = vi.fn().mockResolvedValue({ healthy: true });
        handler.isElementActionable = vi.fn().mockResolvedValue(true);
        handler.sixLayerClick = vi.fn().mockResolvedValue(true);
        handler.pollForFollowState = vi.fn().mockResolvedValue(true);
        handler.safeHumanClick = vi.fn().mockResolvedValue(true);
        handler.simulateReading = vi.fn().mockResolvedValue();
        handler.likeTweet = vi.fn().mockResolvedValue(true);
        handler.bookmarkTweet = vi.fn().mockResolvedValue(true);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('should log layer failure in sixLayerClick (Line 120)', async () => {
        // Restore original sixLayerClick to test its internals
        handler.sixLayerClick = EngagementHandler.prototype.sixLayerClick;
        
        const mockElement = {
            click: vi.fn().mockRejectedValue(new Error('Native click failed')),
            evaluate: vi.fn().mockRejectedValue(new Error('JS click failed')),
            dispatchEvent: vi.fn().mockRejectedValue(new Error('Event dispatch failed')),
            hover: vi.fn().mockResolvedValue(),
            boundingBox: vi.fn().mockResolvedValue({ x: 0, y: 0, width: 10, height: 10 }),
            elementHandle: vi.fn().mockRejectedValue(new Error('No handle')) // Layer 1 fail
        };

        // Make Layer 2 (Ghost Click Fallback) succeed
        // Update ghost mock to have click method that returns success object
        handler.ghost.click = vi.fn().mockResolvedValue({ success: true });
        
        // Debug: ensure logger works
        handler.log('DEBUG: Starting sixLayerClick test');

        await handler.sixLayerClick(mockElement, '[Test]');

        // Check if ghost.click was called
        expect(handler.ghost.click).toHaveBeenCalled();

        // Check if the failure was logged (Line 120)
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Layer 1 failed'));
        // Layer 2 should succeed
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Success with layer 2'));
    });

    it('should succeed in robustFollow if post-poll text check succeeds (Line 289)', async () => {
        // Restore robustFollow
        handler.robustFollow = EngagementHandler.prototype.robustFollow;
        
        const mockFollowBtn = {
            isVisible: vi.fn().mockResolvedValue(true),
            textContent: vi.fn()
                .mockResolvedValueOnce('Follow') // 1. Pre-check (Line 167)
                .mockResolvedValueOnce('Follow') // 2. Fresh check (Line 227)
                .mockResolvedValueOnce('Follow') // 3. Pre-click check (Line 249)
                .mockResolvedValue('Following'), // 4. Final check (Line 287)
            getAttribute: vi.fn().mockResolvedValue('Follow'), // aria-label check fails
            elementHandle: vi.fn().mockResolvedValue({})
        };
        
        mockPage.locator.mockImplementation(sel => {
            if (sel.includes('unfollow')) return { first: () => ({ isVisible: vi.fn().mockResolvedValue(false) }) };
            if (sel.includes('follow')) return { first: () => mockFollowBtn };
            return { first: () => ({ isVisible: vi.fn().mockResolvedValue(false) }) };
        });

        // Mock pollForFollowState to fail
        handler.pollForFollowState = vi.fn().mockResolvedValue(false);

        const result = await handler.robustFollow();
        
        expect(result.success).toBe(true);
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('post-poll text indicates following'));
    });

    it('should update maxScore when a better tweet is found in diveTweet (Line 344)', async () => {
        // Restore diveTweet
        handler.diveTweet = EngagementHandler.prototype.diveTweet;
        
        const mockTweet1 = {
            isVisible: vi.fn().mockResolvedValue(true),
            boundingBox: vi.fn().mockResolvedValue({ x: 0, y: 0, width: 100, height: 100 }), // Far from 400
            scrollIntoViewIfNeeded: vi.fn().mockResolvedValue(),
            locator: vi.fn().mockReturnValue({ count: vi.fn().mockResolvedValue(1), isVisible: vi.fn().mockResolvedValue(true) })
        };
        
        const mockTweet2 = {
            isVisible: vi.fn().mockResolvedValue(true),
            boundingBox: vi.fn().mockResolvedValue({ x: 0, y: 400, width: 100, height: 100 }), // Perfect score
            scrollIntoViewIfNeeded: vi.fn().mockResolvedValue(),
            locator: vi.fn().mockReturnValue({ count: vi.fn().mockResolvedValue(1), isVisible: vi.fn().mockResolvedValue(true) })
        };

        const mockTweets = {
            count: vi.fn().mockResolvedValue(2),
            nth: vi.fn()
                .mockReturnValueOnce(mockTweet1)
                .mockReturnValueOnce(mockTweet2)
        };
        
        mockPage.locator.mockReturnValue(mockTweets);
        
        // Mock mathUtils.roll to avoid triggering like/bookmark
        mockMathUtils.roll.mockReturnValue(false);

        await handler.diveTweet();
        
        // Should select tweet 2 (mockTweet2) because it has better score
        expect(mockTweet2.scrollIntoViewIfNeeded).toHaveBeenCalled();
        expect(mockTweet1.scrollIntoViewIfNeeded).not.toHaveBeenCalled();
    });

    it('should trigger like and bookmark in diveTweet when probability roll succeeds (Lines 367-372)', async () => {
        // Restore diveTweet
        handler.diveTweet = EngagementHandler.prototype.diveTweet;
        
        const mockTweet = {
            isVisible: vi.fn().mockResolvedValue(true),
            boundingBox: vi.fn().mockResolvedValue({ x: 0, y: 400, width: 100, height: 100 }),
            scrollIntoViewIfNeeded: vi.fn().mockResolvedValue(),
            locator: vi.fn().mockReturnValue({ count: vi.fn().mockResolvedValue(1), isVisible: vi.fn().mockResolvedValue(true) })
        };
        
        const mockTweets = {
            count: vi.fn().mockResolvedValue(1),
            nth: vi.fn().mockReturnValue(mockTweet)
        };
        
        mockPage.locator.mockReturnValue(mockTweets);
        
        // Force rolls to succeed
        mockMathUtils.roll.mockReturnValue(true);

        await handler.diveTweet();
        
        expect(handler.likeTweet).toHaveBeenCalledWith(mockTweet);
        expect(handler.bookmarkTweet).toHaveBeenCalledWith(mockTweet);
    });
});

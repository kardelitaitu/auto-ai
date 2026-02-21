import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EngagementHandler } from '../../../../utils/twitter-agent/EngagementHandler.js';

describe('EngagementHandler Coverage', () => {
    let handler;
    let mockPage;
    let mockAgent;
    let mockLogger;
    let mathUtils;

    beforeEach(() => {
        mockPage = {
            locator: vi.fn().mockReturnValue({
                first: vi.fn().mockReturnValue({
                    isVisible: vi.fn().mockResolvedValue(false),
                    textContent: vi.fn().mockResolvedValue(''),
                    getAttribute: vi.fn().mockResolvedValue(''),
                    elementHandle: vi.fn().mockResolvedValue(null),
                    click: vi.fn().mockResolvedValue(undefined),
                    evaluate: vi.fn().mockResolvedValue(undefined)
                }),
                count: vi.fn().mockResolvedValue(0),
                nth: vi.fn()
            }),
            evaluate: vi.fn(),
            waitForTimeout: vi.fn().mockResolvedValue(undefined),
            reload: vi.fn().mockResolvedValue(undefined),
            goto: vi.fn().mockResolvedValue(undefined),
            $$eval: vi.fn().mockResolvedValue([])
        };

        mockLogger = {
            log: vi.fn(),
            info: vi.fn(),
            error: vi.fn(),
            warn: vi.fn(),
            debug: vi.fn()
        };

        mathUtils = {
            randomInRange: vi.fn().mockReturnValue(100),
            roll: vi.fn().mockReturnValue(true),
            gaussian: vi.fn().mockReturnValue(100)
        };

        mockAgent = {
            page: mockPage,
            logger: mockLogger,
            state: { follows: 0 },
            config: {
                timings: {},
                probabilities: {
                    likeTweetAfterDive: 1.0,
                    bookmarkAfterDive: 1.0
                }
            },
            ghost: {
                click: vi.fn().mockResolvedValue({ success: true })
            },
            human: {
                click: vi.fn().mockResolvedValue(undefined)
            },
            mathUtils
        };

        handler = new EngagementHandler(mockAgent);
        
        // Mock base class methods
        handler.humanClick = vi.fn().mockResolvedValue(undefined);
        handler.safeHumanClick = vi.fn().mockResolvedValue(undefined);
        handler.isElementActionable = vi.fn().mockResolvedValue(true);
        handler.simulateReading = vi.fn().mockResolvedValue(undefined);
        handler.performHealthCheck = vi.fn().mockResolvedValue({ healthy: true });
        // Mock pollForFollowState to return true by default to avoid loops
        vi.spyOn(handler, 'pollForFollowState').mockResolvedValue(true);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('sixLayerClick', () => {
        it('should log failure for individual layers', async () => {
            const mockElement = {
                elementHandle: vi.fn().mockResolvedValue({}),
                click: vi.fn().mockRejectedValue(new Error('Native failed')),
                evaluate: vi.fn().mockRejectedValue(new Error('JS failed'))
            };

            // Fail Ghost Click (Primary)
            mockAgent.ghost.click.mockResolvedValueOnce({ success: false, error: 'Ghost failed' });
            // Fail Ghost Click (Fallback)
            mockAgent.ghost.click.mockResolvedValueOnce({ success: false, error: 'Ghost fallback failed' });
            // Fail Human Click
            handler.humanClick.mockRejectedValue(new Error('Human failed'));
            // Fail Safe Human Click
            handler.safeHumanClick.mockRejectedValue(new Error('SafeHuman failed'));

            // We expect it to fail all layers eventually
            const result = await handler.sixLayerClick(mockElement, '[Test]');
            
            expect(result).toBe(false);
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Layer 1 failed'));
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Layer 2 failed'));
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Layer 3 failed'));
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Layer 4 failed'));
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Layer 5 failed'));
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Layer 6 failed'));
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('All 6 click layers failed'));
        });
    });

    describe('robustFollow', () => {
        it('should reload page after max attempts', async () => {
            const followBtn = {
                isVisible: vi.fn().mockResolvedValue(true),
                textContent: vi.fn().mockResolvedValue('Follow'),
                getAttribute: vi.fn().mockResolvedValue('Follow'),
                elementHandle: vi.fn().mockResolvedValue({})
            };
            const unfollowBtn = {
                isVisible: vi.fn().mockResolvedValue(false)
            };

            mockPage.locator.mockImplementation((selector) => {
                if (selector.includes('unfollow')) return { first: () => unfollowBtn };
                return { first: () => followBtn };
            });

            // Make sixLayerClick fail every time
            vi.spyOn(handler, 'sixLayerClick').mockResolvedValue(false);

            const result = await handler.robustFollow('[Test]');
            
            expect(mockPage.reload).toHaveBeenCalled();
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Reloading page'));
            expect(result.reloaded).toBe(true);
        });

        it('should handle reload failure', async () => {
            const followBtn = {
                isVisible: vi.fn().mockResolvedValue(true),
                textContent: vi.fn().mockResolvedValue('Follow'),
                getAttribute: vi.fn().mockResolvedValue('Follow'),
                elementHandle: vi.fn().mockResolvedValue({})
            };
            const unfollowBtn = {
                isVisible: vi.fn().mockResolvedValue(false)
            };

            mockPage.locator.mockImplementation((selector) => {
                if (selector.includes('unfollow')) return { first: () => unfollowBtn };
                return { first: () => followBtn };
            });

            vi.spyOn(handler, 'sixLayerClick').mockResolvedValue(false);
            mockPage.reload.mockRejectedValue(new Error('Reload crash'));

            const result = await handler.robustFollow('[Test]');
            
            expect(result.error).toContain('Reload failed');
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Reload failed'));
        });

        it('should abort if health check fails', async () => {
            handler.performHealthCheck.mockResolvedValue({ healthy: false, reason: 'Network down' });
            
            const result = await handler.robustFollow('[Test]');
            
            expect(result.error).toContain('Health failure');
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('CRITICAL HEALTH FAILURE'));
        });

        it('should skip if button says "Following" (case insensitive)', async () => {
            const followBtn = {
                isVisible: vi.fn().mockResolvedValue(true),
                textContent: vi.fn().mockResolvedValue('Following'),
                getAttribute: vi.fn().mockResolvedValue('Following')
            };
            const unfollowBtn = {
                isVisible: vi.fn().mockResolvedValue(false)
            };

            mockPage.locator.mockImplementation((selector) => {
                if (selector.includes('unfollow')) return { first: () => unfollowBtn };
                return { first: () => followBtn };
            });

            const result = await handler.robustFollow('[Test]');
            expect(result.skipped).toBe(true);
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Already following'));
        });

        it('should skip if button says "Pending"', async () => {
            const followBtn = {
                isVisible: vi.fn().mockResolvedValue(true),
                textContent: vi.fn().mockResolvedValue('Pending'),
                getAttribute: vi.fn().mockResolvedValue('Pending')
            };
            const unfollowBtn = {
                isVisible: vi.fn().mockResolvedValue(false)
            };

            mockPage.locator.mockImplementation((selector) => {
                if (selector.includes('unfollow')) return { first: () => unfollowBtn };
                return { first: () => followBtn };
            });

            const result = await handler.robustFollow('[Test]');
            expect(result.skipped).toBe(true);
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Follow request pending'));
        });

        it('should retry if button is not actionable', async () => {
            const followBtn = {
                isVisible: vi.fn().mockResolvedValue(true),
                textContent: vi.fn().mockResolvedValue('Follow'),
                getAttribute: vi.fn().mockResolvedValue('Follow')
            };
            const unfollowBtn = {
                isVisible: vi.fn().mockResolvedValue(false)
            };

            mockPage.locator.mockImplementation((selector) => {
                if (selector.includes('unfollow')) return { first: () => unfollowBtn };
                return { first: () => followBtn };
            });

            // First attempt not actionable, then health check fails to break loop
            handler.isElementActionable.mockResolvedValueOnce(false);
            handler.performHealthCheck
                .mockResolvedValueOnce({ healthy: true })
                .mockResolvedValueOnce({ healthy: false, reason: 'Stop' });

            await handler.robustFollow('[Test]');
            
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Button not actionable'));
        });

        it('should handle pre-click text check showing "following"', async () => {
             const followBtn = {
                isVisible: vi.fn().mockResolvedValue(true),
                textContent: vi.fn()
                    .mockResolvedValue('Follow') // Default fallback
                    .mockResolvedValueOnce('Follow') // Initial check (pre-check)
                    .mockResolvedValueOnce('Follow') // Loop start check
                    .mockResolvedValueOnce('Following'), // Pre-click check
                getAttribute: vi.fn().mockResolvedValue('Follow')
            };
            const unfollowBtn = {
                isVisible: vi.fn().mockResolvedValue(false)
            };

            mockPage.locator.mockImplementation((selector) => {
                if (selector.includes('unfollow')) return { first: () => unfollowBtn };
                return { first: () => followBtn };
            });

            handler.isElementActionable.mockResolvedValue(true);
            
            const result = await handler.robustFollow('[Test]');
            
            expect(result.skipped).toBe(true);
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Already in following/pending state'));
        });

        it('should recover if poll fails but post-poll text check succeeds', async () => {
             const followBtn = {
                isVisible: vi.fn().mockResolvedValue(true),
                textContent: vi.fn()
                    .mockResolvedValueOnce('Follow') // 1. Pre-check
                    .mockResolvedValueOnce('Follow') // 2. Loop start
                    .mockResolvedValueOnce('Follow') // 3. Pre-click
                    .mockResolvedValue('Following'), // 4. Post-poll
                getAttribute: vi.fn().mockResolvedValue('Follow'),
                elementHandle: vi.fn().mockResolvedValue({})
            };
            const unfollowBtn = {
                isVisible: vi.fn().mockResolvedValue(false)
            };

            mockPage.locator.mockImplementation((selector) => {
                if (selector.includes('unfollow')) return { first: () => unfollowBtn };
                return { first: () => followBtn };
            });

            vi.spyOn(handler, 'sixLayerClick').mockResolvedValue(true);
            // Poll fails
            handler.pollForFollowState.mockResolvedValue(false);
            
            const result = await handler.robustFollow('[Test]');
            
            expect(result.success).toBe(true);
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('post-poll text indicates following'));
        });

        it('should continue if fresh button is not visible', async () => {
            const followBtn = {
                isVisible: vi.fn()
                    .mockResolvedValueOnce(true) // Pre-check
                    .mockResolvedValueOnce(false), // Loop start
                textContent: vi.fn().mockResolvedValue('Follow'),
                getAttribute: vi.fn().mockResolvedValue('Follow')
            };
             const unfollowBtn = {
                isVisible: vi.fn().mockResolvedValue(false)
            };

            mockPage.locator.mockImplementation((selector) => {
                if (selector.includes('unfollow')) return { first: () => unfollowBtn };
                return { first: () => followBtn };
            });

            // Make sure we stop after a few tries
            handler.performHealthCheck
                .mockResolvedValueOnce({ healthy: true })
                .mockResolvedValueOnce({ healthy: true })
                .mockResolvedValueOnce({ healthy: false, reason: 'Stop' });

            await handler.robustFollow('[Test]');
            // Should retry
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Waiting'));
        });
    });

    describe('diveTweet', () => {
        it('should score tweets and pick the best one', async () => {
            const tweet1 = {
                isVisible: vi.fn().mockResolvedValue(true),
                boundingBox: vi.fn().mockResolvedValue({ y: 0, height: 100 }), // Far from center (400)
                scrollIntoViewIfNeeded: vi.fn().mockResolvedValue(),
                locator: vi.fn().mockReturnValue({ count: vi.fn().mockResolvedValue(1), isVisible: vi.fn().mockResolvedValue(true) })
            };
            const tweet2 = {
                isVisible: vi.fn().mockResolvedValue(true),
                boundingBox: vi.fn().mockResolvedValue({ y: 400, height: 100 }), // Perfect center
                scrollIntoViewIfNeeded: vi.fn().mockResolvedValue(),
                locator: vi.fn().mockReturnValue({ count: vi.fn().mockResolvedValue(1), isVisible: vi.fn().mockResolvedValue(true) })
            };

            const tweets = {
                count: vi.fn().mockResolvedValue(2),
                nth: vi.fn((i) => i === 0 ? tweet1 : tweet2)
            };
            mockPage.locator.mockReturnValue(tweets);
            
            // Spy on likeTweet to verify it was called (indicating selection)
            const likeSpy = vi.spyOn(handler, 'likeTweet').mockResolvedValue(true);
            
            await handler.diveTweet();
            
            // Should select tweet2 (better score)
            expect(tweet2.scrollIntoViewIfNeeded).toHaveBeenCalled();
            expect(likeSpy).toHaveBeenCalledWith(tweet2);
        });

        it('should skip tweets that are not visible or poorly scored', async () => {
            const tweet1 = {
                isVisible: vi.fn().mockResolvedValue(false), // Invisible
                boundingBox: vi.fn().mockResolvedValue({ y: 400, height: 100 })
            };
            const tweet2 = {
                isVisible: vi.fn().mockResolvedValue(true),
                boundingBox: vi.fn().mockResolvedValue({ y: 400, height: 100 }),
                scrollIntoViewIfNeeded: vi.fn().mockResolvedValue(),
                locator: vi.fn().mockReturnValue({ count: vi.fn().mockResolvedValue(0) }) // No text content
            };

             const tweets = {
                count: vi.fn().mockResolvedValue(2),
                nth: vi.fn((i) => i === 0 ? tweet1 : tweet2)
            };
            mockPage.locator.mockReturnValue(tweets);
            
            await handler.diveTweet();
            
            // Tweet 1 skipped (invisible), Tweet 2 skipped (no text content)
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('No suitable tweets found'));
        });

        it('should handle errors during engagement', async () => {
             const tweet = {
                isVisible: vi.fn().mockResolvedValue(true),
                boundingBox: vi.fn().mockResolvedValue({ y: 400, height: 100 }),
                scrollIntoViewIfNeeded: vi.fn().mockRejectedValue(new Error('Scroll failed'))
            };

            const tweets = {
                count: vi.fn().mockResolvedValue(1),
                nth: vi.fn(() => tweet)
            };
            mockPage.locator.mockReturnValue(tweets);

            await handler.diveTweet();
            
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Error engaging with tweet'));
        });
    });

    describe('likeTweet', () => {
        it('should handle errors gracefully', async () => {
            const tweetElement = {
                locator: vi.fn().mockReturnValue({
                    count: vi.fn().mockRejectedValue(new Error('Locator failed'))
                })
            };

            const result = await handler.likeTweet(tweetElement);
            expect(result).toBe(false);
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Error: Locator failed'));
        });
    });

    describe('bookmarkTweet', () => {
        it('should handle errors gracefully', async () => {
            const tweetElement = {
                locator: vi.fn().mockReturnValue({
                    count: vi.fn().mockRejectedValue(new Error('Locator failed'))
                })
            };

            const result = await handler.bookmarkTweet(tweetElement);
            expect(result).toBe(false);
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Error: Locator failed'));
        });
    });
});

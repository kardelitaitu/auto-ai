import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EngagementHandler } from '../../../../utils/twitter-agent/EngagementHandler.js';
import { mathUtils } from '../../../../utils/mathUtils.js';

vi.mock('../../../../utils/mathUtils.js', () => ({
    mathUtils: {
        roll: vi.fn(),
        randomInRange: vi.fn().mockReturnValue(100)
    }
}));

describe('EngagementHandler', () => {
    let handler;
    let mockPage;
    let mockAgent;
    let mockLogger;
    let mockGhost;

    beforeEach(() => {
        mockPage = {
            locator: vi.fn(),
            evaluate: vi.fn().mockImplementation((fn, arg) => {
                if (typeof fn === 'function') {
                    const mockEl = { scrollIntoView: vi.fn(), click: vi.fn() };
                    try {
                        return fn(mockEl);
                    } catch (e) {
                        return Promise.resolve();
                    }
                }
                return Promise.resolve();
            }),
            waitForTimeout: vi.fn(),
            reload: vi.fn(),
            goto: vi.fn(),
            goBack: vi.fn(),
            $$eval: vi.fn(),
            url: vi.fn().mockReturnValue('https://twitter.com/home')
        };

        mockLogger = {
            log: vi.fn(),
            error: vi.fn(),
            info: vi.fn(),
            warn: vi.fn()
        };

        mockGhost = {
            click: vi.fn(),
            move: vi.fn()
        };

        mockAgent = {
            page: mockPage,
            logger: mockLogger,
            config: {
                probabilities: {
                    likeTweetAfterDive: 0.3,
                    bookmarkAfterDive: 0.1
                }
            },
            state: {
                likes: 0,
                follows: 0,
                stamina: 100
            },
            human: {},
            ghost: mockGhost
        };

        handler = new EngagementHandler(mockAgent);
        
        // Mock BaseHandler methods that are inherited
        handler.safeHumanClick = vi.fn().mockResolvedValue(true);
        handler.humanClick = vi.fn().mockResolvedValue(true);
        handler.simulateReading = vi.fn().mockResolvedValue();
        handler.isElementActionable = vi.fn().mockResolvedValue(true);
        handler.performHealthCheck = vi.fn().mockResolvedValue({ healthy: true });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('pollForFollowState', () => {
        it('should return true if unfollow button becomes visible immediately', async () => {
            mockPage.locator.mockImplementation(sel => {
                if (sel === 'unfollow') return { first: () => ({ isVisible: vi.fn().mockResolvedValue(true) }) };
                return { first: () => ({ isVisible: vi.fn().mockResolvedValue(false) }) };
            });

            const result = await handler.pollForFollowState('unfollow', 'follow');
            expect(result).toBe(true);
        });

        it('should poll and return true when unfollow button appears later', async () => {
            const isVisibleMock = vi.fn()
                .mockResolvedValueOnce(false)
                .mockResolvedValueOnce(false)
                .mockResolvedValue(true);

            mockPage.locator.mockImplementation(sel => {
                if (sel === 'unfollow') return { first: () => ({ isVisible: isVisibleMock }) };
                return { first: () => ({ 
                    isVisible: vi.fn().mockResolvedValue(true),
                    textContent: vi.fn().mockResolvedValue('Follow') 
                }) };
            });

            const result = await handler.pollForFollowState('unfollow', 'follow', 5000);
            expect(result).toBe(true);
            expect(mockPage.waitForTimeout).toHaveBeenCalled();
        });

        it('should return true if follow button disappears', async () => {
            const isVisibleMock = vi.fn()
                .mockResolvedValueOnce(true)
                .mockResolvedValue(false);

            mockPage.locator.mockImplementation(sel => {
                if (sel === 'unfollow') return { first: () => ({ isVisible: vi.fn().mockResolvedValue(false) }) };
                if (sel === 'follow') return { first: () => ({ 
                    isVisible: isVisibleMock,
                    textContent: vi.fn().mockResolvedValue('Follow')
                }) };
                return { first: () => ({ isVisible: vi.fn().mockResolvedValue(false) }) };
            });

            const result = await handler.pollForFollowState('unfollow', 'follow');
            expect(result).toBe(true);
        });

        it('should return true if follow button text changes to following', async () => {
            mockPage.locator.mockImplementation(sel => {
                if (sel === 'unfollow') return { first: () => ({ isVisible: vi.fn().mockResolvedValue(false) }) };
                if (sel === 'follow') return { first: () => ({ 
                    isVisible: vi.fn().mockResolvedValue(true),
                    textContent: vi.fn().mockResolvedValue('Following')
                }) };
                return { first: () => ({ isVisible: vi.fn().mockResolvedValue(false) }) };
            });

            const result = await handler.pollForFollowState('unfollow', 'follow');
            expect(result).toBe(true);
        });

        it('should wait between polls and return false on timeout', async () => {
             mockPage.locator.mockImplementation(sel => {
                if (sel === 'unfollow') return { first: () => ({ isVisible: vi.fn().mockResolvedValue(false) }) };
                if (sel === 'follow') return { first: () => ({ 
                    isVisible: vi.fn().mockResolvedValue(true),
                    textContent: vi.fn().mockResolvedValue('Follow')
                }) };
                return { first: () => ({ isVisible: vi.fn().mockResolvedValue(false) }) };
            });

            // 3 iterations: 0, 1, 2. Waits at 0 and 1.
            const result = await handler.pollForFollowState('unfollow', 'follow', 5000); // 5000 / 2000 = 2.5 -> 3 polls
            
            expect(result).toBe(false);
            expect(mockPage.waitForTimeout).toHaveBeenCalledTimes(2);
        });
    });

    describe('sixLayerClick', () => {
        let element;

        beforeEach(() => {
            element = {
                elementHandle: vi.fn().mockResolvedValue({}),
                click: vi.fn().mockResolvedValue(),
                evaluate: vi.fn().mockResolvedValue()
            };
        });

        it('should succeed with layer 1 (Ghost Click Primary)', async () => {
            mockGhost.click.mockResolvedValue({ success: true });
            
            const result = await handler.sixLayerClick(element, '[Test]');
            
            expect(result).toBe(true);
            expect(mockGhost.click).toHaveBeenCalledWith(expect.anything(), { allowNativeFallback: false });
            // Verify scrollIntoView execution coverage
            expect(mockPage.evaluate).toHaveBeenCalled();
        });

        it('should succeed with layer 2 (Ghost Click Fallback) when layer 1 fails', async () => {
            mockGhost.click
                .mockRejectedValueOnce(new Error('Layer 1 failed'))
                .mockResolvedValue({ success: true });

            const result = await handler.sixLayerClick(element, '[Test]');
            
            expect(result).toBe(true);
            expect(mockGhost.click).toHaveBeenCalledTimes(2);
        });

        it('should succeed with layer 3 (Human Click) when layers 1-2 fail', async () => {
            mockGhost.click.mockRejectedValue(new Error('Ghost failed'));
            handler.humanClick.mockResolvedValue();

            const result = await handler.sixLayerClick(element, '[Test]');
            
            expect(result).toBe(true);
            expect(handler.humanClick).toHaveBeenCalled();
        });

        it('should succeed with layer 4 (Safe Human Click) when layers 1-3 fail', async () => {
            mockGhost.click.mockRejectedValue(new Error('Ghost failed'));
            handler.humanClick.mockRejectedValue(new Error('Human failed'));
            handler.safeHumanClick.mockResolvedValue();

            const result = await handler.sixLayerClick(element, '[Test]');
            
            expect(result).toBe(true);
            expect(handler.safeHumanClick).toHaveBeenCalled();
        });

        it('should succeed with layer 5 (Native Click) when layers 1-4 fail', async () => {
            mockGhost.click.mockRejectedValue(new Error('Ghost failed'));
            handler.humanClick.mockRejectedValue(new Error('Human failed'));
            handler.safeHumanClick.mockRejectedValue(new Error('Safe failed'));
            
            const result = await handler.sixLayerClick(element, '[Test]');
            
            expect(result).toBe(true);
            expect(element.click).toHaveBeenCalled();
        });

        it('should succeed with layer 6 (JS Click) when layers 1-5 fail', async () => {
            mockGhost.click.mockRejectedValue(new Error('Ghost failed'));
            handler.humanClick.mockRejectedValue(new Error('Human failed'));
            handler.safeHumanClick.mockRejectedValue(new Error('Safe failed'));
            element.click.mockRejectedValue(new Error('Native failed'));
            
            const result = await handler.sixLayerClick(element, '[Test]');
            
            expect(result).toBe(true);
            expect(element.evaluate).toHaveBeenCalled();
        });

        it('should return false if all layers fail', async () => {
            mockGhost.click.mockRejectedValue(new Error('Ghost failed'));
            handler.humanClick.mockRejectedValue(new Error('Human failed'));
            handler.safeHumanClick.mockRejectedValue(new Error('Safe failed'));
            element.click.mockRejectedValue(new Error('Native failed'));
            element.evaluate.mockRejectedValue(new Error('JS failed'));
            
            const result = await handler.sixLayerClick(element, '[Test]');
            
            expect(result).toBe(false);
        });
    });

    describe('sixLayerClick', () => {
        it('should log layer failure', async () => {
            const mockEl = {
                elementHandle: vi.fn().mockRejectedValue(new Error('Handle Error')),
                click: vi.fn().mockRejectedValue(new Error('Native Error')),
                evaluate: vi.fn().mockRejectedValue(new Error('JS Error'))
            };
            mockGhost.click.mockRejectedValue(new Error('Ghost Error'));
            handler.humanClick.mockRejectedValue(new Error('Human Error'));
            handler.safeHumanClick.mockRejectedValue(new Error('Safe Error'));

            await handler.sixLayerClick(mockEl, '[Test]');
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Layer 1 failed'));
        });

        it('should handle missing element handle in layer 1', async () => {
            const mockEl = {
                elementHandle: vi.fn().mockResolvedValue(null),
                click: vi.fn().mockRejectedValue(new Error('Native Error')),
                evaluate: vi.fn().mockRejectedValue(new Error('JS Error'))
            };
            mockGhost.click.mockRejectedValue(new Error('Ghost Error'));
            handler.humanClick.mockRejectedValue(new Error('Human Error'));
            handler.safeHumanClick.mockRejectedValue(new Error('Safe Error'));

            await handler.sixLayerClick(mockEl, '[Test]');
            // Should fail layer 1 without throwing
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('All 6 click layers failed'));
        });
    });

    describe('robustFollow', () => {
        it('should skip if already unfollowing', async () => {
            mockPage.locator.mockImplementation(sel => {
                if (sel.includes('unfollow')) return { first: () => ({ isVisible: vi.fn().mockResolvedValue(true) }) };
                return { first: () => ({ isVisible: vi.fn().mockResolvedValue(false) }) };
            });

            const result = await handler.robustFollow();
            expect(result.skipped).toBe(true);
            expect(result.success).toBe(true);
        });

        it('should perform follow if button is actionable', async () => {
            // Setup: Not unfollowing, Follow button visible and says "Follow"
            const mockFollowBtn = {
                isVisible: vi.fn().mockResolvedValue(true),
                textContent: vi.fn().mockResolvedValue('Follow'),
                getAttribute: vi.fn().mockResolvedValue('Follow'),
                elementHandle: vi.fn().mockResolvedValue({})
            };
            
            mockPage.locator.mockImplementation(sel => {
                if (sel.includes('unfollow')) return { first: () => ({ isVisible: vi.fn().mockResolvedValue(false) }) };
                if (sel.includes('follow')) return { first: () => mockFollowBtn };
                return { first: () => ({ isVisible: vi.fn().mockResolvedValue(false) }) };
            });

            // Mock successful click
            mockGhost.click.mockResolvedValue({ success: true });
            
            // Mock poll success
            vi.spyOn(handler, 'pollForFollowState').mockResolvedValue(true);

            const result = await handler.robustFollow();
            
            expect(result.success).toBe(true);
            expect(mockGhost.click).toHaveBeenCalled(); // Layer 1
            expect(handler.state.follows).toBe(1);
        });

        it('should reload and retry if attempts fail', async () => {
            // Setup: Always fails click/poll until reload
            const mockFollowBtn = {
                isVisible: vi.fn().mockResolvedValue(true),
                textContent: vi.fn().mockResolvedValue('Follow'),
                getAttribute: vi.fn().mockResolvedValue('Follow'),
                elementHandle: vi.fn().mockResolvedValue({})
            };

            mockPage.locator.mockImplementation(sel => {
                if (sel.includes('unfollow')) return { first: () => ({ isVisible: vi.fn().mockResolvedValue(false) }) };
                if (sel.includes('follow')) return { first: () => mockFollowBtn };
                return { first: () => ({ isVisible: vi.fn().mockResolvedValue(false) }) };
            });

            // Fail clicks
            mockGhost.click.mockRejectedValue(new Error('Click failed'));
            handler.humanClick.mockRejectedValue(new Error('Fail'));
            handler.safeHumanClick.mockRejectedValue(new Error('Fail'));
            // Native/JS fails handled by mockElement defaults (if we didn't mock them, they'd crash, so we should mock them to throw or just let sixLayerClick handle it)
            mockFollowBtn.click = vi.fn().mockRejectedValue(new Error('Native fail'));
            mockFollowBtn.evaluate = vi.fn().mockRejectedValue(new Error('JS fail'));

            // Mock reload
            mockPage.reload.mockResolvedValue();

            // We need to stop the loop eventually or it will run 4 times.
            // Let's just verify it tries multiple times and reloads.
            // But wait, if it fails *all* layers, it continues to next attempt.
            // So 3 attempts -> reload -> 1 attempt.
            
            const result = await handler.robustFollow();
            
            expect(mockPage.reload).toHaveBeenCalled();
            expect(result.reloaded).toBe(true);
            expect(result.success).toBe(false);
        });

        it('should abort if health check fails', async () => {
            handler.performHealthCheck.mockResolvedValue({ healthy: false, reason: 'Test Reason' });
            
            // Setup to pass pre-checks
            mockPage.locator.mockImplementation(sel => {
                if (sel.includes('unfollow')) return { first: () => ({ isVisible: vi.fn().mockResolvedValue(false) }) };
                return { 
                    first: () => ({ 
                        isVisible: vi.fn().mockResolvedValue(sel.includes('follow') ? true : false),
                        textContent: vi.fn().mockResolvedValue('Follow')
                    }) 
                };
            });

            const result = await handler.robustFollow();

            expect(result.error).toContain('Health failure');
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('CRITICAL HEALTH FAILURE'));
        });

        it('should detect already following via text check', async () => {
             const mockFollowBtn = {
                isVisible: vi.fn().mockResolvedValue(true),
                textContent: vi.fn().mockResolvedValue('Following'),
                getAttribute: vi.fn().mockResolvedValue('Following')
            };
            
            mockPage.locator.mockImplementation(sel => {
                if (sel.includes('unfollow')) return { first: () => ({ isVisible: vi.fn().mockResolvedValue(false) }) };
                if (sel.includes('follow')) return { first: () => mockFollowBtn };
                return { first: () => ({ isVisible: vi.fn().mockResolvedValue(false) }) };
            });

            const result = await handler.robustFollow();
            expect(result.success).toBe(true);
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Already following'));
        });

        it('should retry if button is not actionable', async () => {
             const mockFollowBtn = {
                isVisible: vi.fn().mockResolvedValue(true),
                textContent: vi.fn().mockResolvedValue('Follow'),
                getAttribute: vi.fn().mockResolvedValue('Follow'),
                elementHandle: vi.fn().mockResolvedValue({})
            };
            
            mockPage.locator.mockImplementation(sel => {
                if (sel.includes('unfollow')) return { first: () => ({ isVisible: vi.fn().mockResolvedValue(false) }) };
                if (sel.includes('follow')) return { first: () => mockFollowBtn };
                return { first: () => ({ isVisible: vi.fn().mockResolvedValue(false) }) };
            });

            // First check false, second true
            handler.isElementActionable
                .mockResolvedValueOnce(false)
                .mockResolvedValueOnce(true);
            
            mockGhost.click.mockResolvedValue({ success: true });
            vi.spyOn(handler, 'pollForFollowState').mockResolvedValue(true);

            const result = await handler.robustFollow();
            
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Button not actionable'));
            expect(result.success).toBe(true);
        });

        it('should verify follow via aria-label if poll fails', async () => {
             const mockFollowBtn = {
                isVisible: vi.fn().mockResolvedValue(true),
                textContent: vi.fn().mockResolvedValue('Follow'),
                getAttribute: vi.fn().mockImplementation(async (attr) => {
                    if (attr === 'aria-label') return 'Following @user';
                    return 'Follow';
                }),
                elementHandle: vi.fn().mockResolvedValue({})
            };
            
            mockPage.locator.mockImplementation(sel => {
                if (sel.includes('unfollow')) return { first: () => ({ isVisible: vi.fn().mockResolvedValue(false) }) };
                if (sel.includes('follow')) return { first: () => mockFollowBtn };
                return { first: () => ({ isVisible: vi.fn().mockResolvedValue(false) }) };
            });

            mockGhost.click.mockResolvedValue({ success: true });
            // Poll returns false
            vi.spyOn(handler, 'pollForFollowState').mockResolvedValue(false);

            const result = await handler.robustFollow();
            
            expect(result.success).toBe(true);
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('aria-label indicates following'));
        });

        it('should verify follow via post-poll text if poll fails', async () => {
             const mockFollowBtn = {
                isVisible: vi.fn().mockResolvedValue(true),
                textContent: vi.fn()
                    .mockResolvedValueOnce('Follow') // Initial check
                    .mockResolvedValueOnce('Follow') // Pre-click check
                    .mockResolvedValueOnce('Follow') // Buffer
                    .mockResolvedValue('Following'), // Post-poll check
                getAttribute: vi.fn().mockResolvedValue('Follow'),
                elementHandle: vi.fn().mockResolvedValue({})
            };
            
            mockPage.locator.mockImplementation(sel => {
                if (sel.includes('unfollow')) return { first: () => ({ isVisible: vi.fn().mockResolvedValue(false) }) };
                if (sel.includes('follow')) return { first: () => mockFollowBtn };
                return { first: () => ({ isVisible: vi.fn().mockResolvedValue(false) }) };
            });

            mockGhost.click.mockResolvedValue({ success: true });
            vi.spyOn(handler, 'pollForFollowState').mockResolvedValue(false);

            const result = await handler.robustFollow();
            
            expect(result.success).toBe(true);
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('post-poll text indicates following'));
        });

        it('should skip if pending request found in pre-check', async () => {
             const mockFollowBtn = {
                isVisible: vi.fn().mockResolvedValue(true),
                textContent: vi.fn().mockResolvedValue('Pending'),
            };
            
            mockPage.locator.mockImplementation(sel => {
                if (sel.includes('unfollow')) return { first: () => ({ isVisible: vi.fn().mockResolvedValue(false) }) };
                if (sel.includes('follow')) return { first: () => mockFollowBtn };
                return { first: () => ({ isVisible: vi.fn().mockResolvedValue(false) }) };
            });

            const result = await handler.robustFollow();
            expect(result.skipped).toBe(true);
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Follow request pending'));
        });

        it('should handle reload with specific URL', async () => {
             const mockFollowBtn = {
                isVisible: vi.fn().mockResolvedValue(true),
                textContent: vi.fn().mockResolvedValue('Follow'),
                getAttribute: vi.fn().mockResolvedValue('Follow'),
                elementHandle: vi.fn().mockResolvedValue({})
            };
            
            mockPage.locator.mockImplementation(sel => {
                if (sel.includes('unfollow')) return { first: () => ({ isVisible: vi.fn().mockResolvedValue(false) }) };
                if (sel.includes('follow')) return { first: () => mockFollowBtn };
                return { first: () => ({ isVisible: vi.fn().mockResolvedValue(false) }) };
            });

            // Fail clicks to trigger reload
            mockGhost.click.mockRejectedValue(new Error('Fail'));
            handler.humanClick.mockRejectedValue(new Error('Fail'));
            handler.safeHumanClick.mockRejectedValue(new Error('Fail'));
            mockFollowBtn.click = vi.fn().mockRejectedValue(new Error('Fail'));
            mockFollowBtn.evaluate = vi.fn().mockRejectedValue(new Error('Fail'));

            const result = await handler.robustFollow('[Follow]', 'https://twitter.com/user');
            
            expect(mockPage.goto).toHaveBeenCalledWith('https://twitter.com/user');
            expect(result.reloaded).toBe(true);
        });

        it('should handle reload failure', async () => {
             const mockFollowBtn = {
                isVisible: vi.fn().mockResolvedValue(true),
                textContent: vi.fn().mockResolvedValue('Follow'),
                getAttribute: vi.fn().mockResolvedValue('Follow'),
                elementHandle: vi.fn().mockResolvedValue({})
            };
            
            mockPage.locator.mockImplementation(sel => {
                if (sel.includes('unfollow')) return { first: () => ({ isVisible: vi.fn().mockResolvedValue(false) }) };
                if (sel.includes('follow')) return { first: () => mockFollowBtn };
                return { first: () => ({ isVisible: vi.fn().mockResolvedValue(false) }) };
            });

            // Fail clicks
            mockGhost.click.mockRejectedValue(new Error('Fail'));
            handler.humanClick.mockRejectedValue(new Error('Fail'));
            handler.safeHumanClick.mockRejectedValue(new Error('Fail'));
            mockFollowBtn.click = vi.fn().mockRejectedValue(new Error('Fail'));
            mockFollowBtn.evaluate = vi.fn().mockRejectedValue(new Error('Fail'));

            mockPage.reload.mockRejectedValue(new Error('Reload failed'));

            const result = await handler.robustFollow();
            
            expect(result.error).toContain('Reload failed');
        });

        it('should detect unfollow button after reload', async () => {
             const mockFollowBtn = {
                 isVisible: vi.fn().mockResolvedValue(true),
                 textContent: vi.fn().mockResolvedValue('Follow'),
                 getAttribute: vi.fn().mockResolvedValue('Follow'),
                 elementHandle: vi.fn().mockResolvedValue({})
             };
             
             // Setup mock for unfollow button visibility
             // 1. Initial pre-check: false
             // 2. Attempt 1: false
             // 3. Attempt 2: false
             // 4. Attempt 3: false
             // 5. Attempt 4 (After reload): true
             const unfollowVisibleMock = vi.fn()
                .mockResolvedValueOnce(false)
                .mockResolvedValueOnce(false)
                .mockResolvedValueOnce(false)
                .mockResolvedValueOnce(false)
                .mockResolvedValue(true);

             mockPage.locator.mockImplementation(sel => {
                 if (sel.includes('unfollow')) {
                      return { first: () => ({ isVisible: unfollowVisibleMock }) };
                 }
                 if (sel.includes('follow')) return { first: () => mockFollowBtn };
                 return { first: () => ({ isVisible: vi.fn().mockResolvedValue(false) }) };
             });

             // Make clicks fail to force reload
             mockGhost.click.mockRejectedValue(new Error('Fail'));
             handler.humanClick.mockRejectedValue(new Error('Fail'));
             handler.safeHumanClick.mockRejectedValue(new Error('Fail'));
             mockFollowBtn.click = vi.fn().mockRejectedValue(new Error('Fail'));
             mockFollowBtn.evaluate = vi.fn().mockRejectedValue(new Error('Fail'));
             
             const result = await handler.robustFollow();
             
             expect(result.success).toBe(true);
             expect(result.reloaded).toBe(true);
             expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('unfollow button visible after reload'));
         });

         it('should detect state change to following/pending before click', async () => {
             // Setup:
             // 1. Pre-check: Follow visible, text 'Follow'
             // 2. Loop check 1: Follow visible, text 'Following'
             const mockFollowBtn = {
                isVisible: vi.fn().mockResolvedValue(true),
                textContent: vi.fn()
                    .mockResolvedValueOnce('Follow') // Pre-check
                    .mockResolvedValueOnce('Following'), // Loop check
                getAttribute: vi.fn().mockResolvedValue('Follow'),
                elementHandle: vi.fn().mockResolvedValue({})
            };
            
            mockPage.locator.mockImplementation(sel => {
                if (sel.includes('unfollow')) return { first: () => ({ isVisible: vi.fn().mockResolvedValue(false) }) };
                if (sel.includes('follow')) return { first: () => mockFollowBtn };
                return { first: () => ({ isVisible: vi.fn().mockResolvedValue(false) }) };
            });

            const result = await handler.robustFollow();
            
            expect(result.success).toBe(true);
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("Already following (button text: 'Following')"));
        });

        it('should handle pending state detected during pre-click check', async () => {
             // Setup:
             // 1. Pre-check: Follow visible, text 'Follow'
             // 2. Loop check: Follow visible, text 'Follow'
             // 3. Actionable: true
             // 4. Pre-click check: text 'Pending'
             // 5. Unfollow visible: false (continue loop)
             const mockFollowBtn = {
                isVisible: vi.fn().mockResolvedValue(true),
                textContent: vi.fn()
                    .mockResolvedValue('Follow') // Default for subsequent calls
                    .mockResolvedValueOnce('Follow') // Pre-check
                    .mockResolvedValueOnce('Follow') // Loop check
                    .mockResolvedValueOnce('Pending'), // Pre-click check
                getAttribute: vi.fn().mockResolvedValue('Follow'),
                elementHandle: vi.fn().mockResolvedValue({})
            };
            
            mockPage.locator.mockImplementation(sel => {
                if (sel.includes('unfollow')) return { first: () => ({ isVisible: vi.fn().mockResolvedValue(false) }) };
                if (sel.includes('follow')) return { first: () => mockFollowBtn };
                return { first: () => ({ isVisible: vi.fn().mockResolvedValue(false) }) };
            });

            // Make attempts fail so we exit after loop
            mockGhost.click.mockRejectedValue(new Error('Fail'));
            handler.humanClick.mockRejectedValue(new Error('Fail'));
            handler.safeHumanClick.mockRejectedValue(new Error('Fail'));
            mockFollowBtn.click = vi.fn().mockRejectedValue(new Error('Fail'));
            mockFollowBtn.evaluate = vi.fn().mockRejectedValue(new Error('Fail'));
            
            const result = await handler.robustFollow();
            
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("Already in following/pending state: 'Pending'"));
        });

        it('should handle following state detected during pre-click check with unfollow visible', async () => {
             // Setup:
             // 1. Pre-check: Follow visible, text 'Follow'
             // 2. Loop check: Follow visible, text 'Follow'
             // 3. Actionable: true
             // 4. Pre-click check: text 'Following'
             // 5. Unfollow visible: true (Success)
             const mockFollowBtn = {
                isVisible: vi.fn().mockResolvedValue(true),
                textContent: vi.fn()
                    .mockResolvedValue('Follow') // Default
                    .mockResolvedValueOnce('Follow') // Pre-check
                    .mockResolvedValueOnce('Follow') // Loop check
                    .mockResolvedValueOnce('Following'), // Pre-click check
                getAttribute: vi.fn().mockResolvedValue('Follow'),
                elementHandle: vi.fn().mockResolvedValue({})
            };
            
            // Mock unfollow visibility specifically for this test case
            const unfollowVisibleMock = vi.fn()
                .mockResolvedValueOnce(false) // Pre-check
                .mockResolvedValueOnce(false) // Loop check
                .mockResolvedValueOnce(true); // Pre-click check
            
            mockPage.locator.mockImplementation(sel => {
                if (sel.includes('unfollow')) return { first: () => ({ isVisible: unfollowVisibleMock }) };
                if (sel.includes('follow')) return { first: () => mockFollowBtn };
                return { first: () => ({ isVisible: vi.fn().mockResolvedValue(false) }) };
            });

            const result = await handler.robustFollow();
            
            expect(result.success).toBe(true);
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("Already in following/pending state: 'Following'"));
        });

        it('should log click error and retry', async () => {
             const mockFollowBtn = {
                isVisible: vi.fn().mockResolvedValue(true),
                textContent: vi.fn().mockResolvedValue('Follow'),
                getAttribute: vi.fn().mockResolvedValue('Follow'),
                elementHandle: vi.fn().mockResolvedValue({})
            };
            
            mockPage.locator.mockImplementation(sel => {
                if (sel.includes('unfollow')) return { first: () => ({ isVisible: vi.fn().mockResolvedValue(false) }) };
                if (sel.includes('follow')) return { first: () => mockFollowBtn };
                return { first: () => ({ isVisible: vi.fn().mockResolvedValue(false) }) };
            });

            // Simulate click error
            vi.spyOn(handler, 'sixLayerClick').mockRejectedValue(new Error('Simulated Click Error'));

            const result = await handler.robustFollow();
            
            expect(result.success).toBe(false);
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Click error: Simulated Click Error'));
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Waiting 2000ms before retry'));
        });

        it('should verify follow via post-poll text', async () => {
             const mockFollowBtn = {
                isVisible: vi.fn().mockResolvedValue(true),
                textContent: vi.fn()
                    .mockResolvedValue('Follow')
                    .mockResolvedValueOnce('Follow') // Pre-check
                    .mockResolvedValueOnce('Follow') // Loop check
                    .mockResolvedValueOnce('Follow') // Pre-click check
                    .mockResolvedValueOnce('Following'), // Post-poll check
                getAttribute: vi.fn().mockResolvedValue('Follow'),
                elementHandle: vi.fn().mockResolvedValue({})
            };
            
            mockPage.locator.mockImplementation(sel => {
                if (sel.includes('unfollow')) return { first: () => ({ isVisible: vi.fn().mockResolvedValue(false) }) };
                if (sel.includes('follow')) return { first: () => mockFollowBtn };
                return { first: () => ({ isVisible: vi.fn().mockResolvedValue(false) }) };
            });

            // Mock pollForFollowState to return false
            vi.spyOn(handler, 'pollForFollowState').mockResolvedValue(false);
            
            // Mock click success
            vi.spyOn(handler, 'sixLayerClick').mockResolvedValue(true);

            const result = await handler.robustFollow();
            
            expect(result.success).toBe(true);
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('post-poll text indicates following'));
        });
    });

    describe('diveTweet', () => {
        beforeEach(() => {
            vi.spyOn(handler, 'likeTweet').mockResolvedValue(true);
            vi.spyOn(handler, 'bookmarkTweet').mockResolvedValue(true);
        });

        it('should find and engage with a tweet', async () => {
            const mockTweet = {
                isVisible: vi.fn().mockResolvedValue(true),
                boundingBox: vi.fn().mockResolvedValue({ y: 400, height: 100 }),
                scrollIntoViewIfNeeded: vi.fn().mockResolvedValue(),
                locator: vi.fn().mockReturnValue({ count: vi.fn().mockResolvedValue(1), isVisible: vi.fn().mockResolvedValue(true) })
            };
            
            const mockTweets = {
                count: vi.fn().mockResolvedValue(1),
                nth: vi.fn().mockReturnValue(mockTweet)
            };
            
            mockPage.locator.mockReturnValue(mockTweets);
            
            // Force like and bookmark
            mathUtils.roll.mockReturnValue(true);

            const result = await handler.diveTweet();

            expect(result).toBe(true);
            expect(handler.simulateReading).toHaveBeenCalled();
            expect(handler.likeTweet).toHaveBeenCalledWith(mockTweet);
            expect(handler.bookmarkTweet).toHaveBeenCalledWith(mockTweet);
        });

        it('should prioritize tweets near center', async () => {
            const tweetNear = {
                isVisible: vi.fn().mockResolvedValue(true),
                boundingBox: vi.fn().mockResolvedValue({ y: 400, height: 100 }), // Score: 1000 - 0 = 1000
                scrollIntoViewIfNeeded: vi.fn().mockResolvedValue(),
                locator: vi.fn().mockReturnValue({ count: vi.fn().mockResolvedValue(1), isVisible: vi.fn().mockResolvedValue(true) })
            };
            const tweetFar = {
                isVisible: vi.fn().mockResolvedValue(true),
                boundingBox: vi.fn().mockResolvedValue({ y: 0, height: 100 }), // Score: 1000 - 400 = 600
                scrollIntoViewIfNeeded: vi.fn().mockResolvedValue(),
                locator: vi.fn().mockReturnValue({ count: vi.fn().mockResolvedValue(1), isVisible: vi.fn().mockResolvedValue(true) })
            };
            
            const mockTweets = {
                count: vi.fn().mockResolvedValue(2),
                nth: vi.fn().mockImplementation(i => i === 0 ? tweetFar : tweetNear)
            };
            
            mockPage.locator.mockReturnValue(mockTweets);

            // Force like to ensure it's called
            mathUtils.roll.mockReturnValue(true);

            await handler.diveTweet();

            expect(handler.likeTweet).toHaveBeenCalledWith(tweetNear);
        });

        it('should return false if no tweets found', async () => {
            const mockTweets = {
                count: vi.fn().mockResolvedValue(0)
            };
            mockPage.locator.mockReturnValue(mockTweets);

            const result = await handler.diveTweet();

            expect(result).toBe(false);
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('No suitable tweets found'));
        });

        it('should handle errors during engagement', async () => {
            const mockTweet = {
                isVisible: vi.fn().mockResolvedValue(true),
                boundingBox: vi.fn().mockResolvedValue({ y: 400, height: 100 }),
                scrollIntoViewIfNeeded: vi.fn().mockRejectedValue(new Error('Scroll failed'))
            };
            
            const mockTweets = {
                count: vi.fn().mockResolvedValue(1),
                nth: vi.fn().mockReturnValue(mockTweet)
            };
            
            mockPage.locator.mockReturnValue(mockTweets);

            const result = await handler.diveTweet();

            expect(result).toBe(false);
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('[Dive] Error engaging'));
        });

        it('should ignore tweets with invalid bounding box', async () => {
            const mockTweets = {
                count: vi.fn().mockResolvedValue(3),
                nth: vi.fn().mockImplementation(i => {
                    const tweets = [
                        { // No box
                            isVisible: vi.fn().mockResolvedValue(true),
                            boundingBox: vi.fn().mockResolvedValue(null)
                        },
                        { // Invalid Y
                            isVisible: vi.fn().mockResolvedValue(true),
                            boundingBox: vi.fn().mockResolvedValue({ y: -100, height: 100 })
                        },
                        { // Valid
                            isVisible: vi.fn().mockResolvedValue(true),
                            boundingBox: vi.fn().mockResolvedValue({ y: 400, height: 100 }),
                            scrollIntoViewIfNeeded: vi.fn().mockResolvedValue(),
                            locator: vi.fn().mockReturnValue({ count: vi.fn().mockResolvedValue(1), isVisible: vi.fn().mockResolvedValue(true) })
                        }
                    ];
                    return tweets[i];
                })
            };
            
            mockPage.locator.mockReturnValue(mockTweets);
            mathUtils.roll.mockReturnValue(true);

            const result = await handler.diveTweet();
            
            expect(result).toBe(true);
            // Should engage with the 3rd tweet (index 2)
            expect(handler.likeTweet).toHaveBeenCalled();
        });
    });

    describe('likeTweet', () => {
        it('should like a tweet if button is visible', async () => {
            const mockLikeBtn = {
                count: vi.fn().mockResolvedValue(1),
                isVisible: vi.fn().mockResolvedValue(true)
            };
            const mockTweet = {
                locator: vi.fn().mockReturnValue(mockLikeBtn)
            };

            const result = await handler.likeTweet(mockTweet);

            expect(result).toBe(true);
            expect(handler.safeHumanClick).toHaveBeenCalledWith(mockLikeBtn, 'Like Button');
            expect(mockAgent.state.likes).toBe(1);
        });

        it('should return false if button is not visible', async () => {
            const mockLikeBtn = {
                count: vi.fn().mockResolvedValue(0),
                isVisible: vi.fn().mockResolvedValue(false)
            };
            const mockTweet = {
                locator: vi.fn().mockReturnValue(mockLikeBtn)
            };

            const result = await handler.likeTweet(mockTweet);

            expect(result).toBe(false);
            expect(handler.safeHumanClick).not.toHaveBeenCalled();
        });

        it('should handle errors during like', async () => {
            const mockLikeBtn = {
                count: vi.fn().mockResolvedValue(1),
                isVisible: vi.fn().mockResolvedValue(true)
            };
            const mockTweet = {
                locator: vi.fn().mockReturnValue(mockLikeBtn)
            };

            handler.safeHumanClick.mockRejectedValue(new Error('Click failed'));

            const result = await handler.likeTweet(mockTweet);

            expect(result).toBe(false);
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('[Like] Error: Click failed'));
        });
    });

    describe('bookmarkTweet', () => {
        it('should bookmark a tweet if button is visible', async () => {
            const mockBookmarkBtn = {
                count: vi.fn().mockResolvedValue(1),
                isVisible: vi.fn().mockResolvedValue(true)
            };
            const mockTweet = {
                locator: vi.fn().mockReturnValue(mockBookmarkBtn)
            };

            const result = await handler.bookmarkTweet(mockTweet);

            expect(result).toBe(true);
            expect(handler.safeHumanClick).toHaveBeenCalledWith(mockBookmarkBtn, 'Bookmark Button');
        });

        it('should handle errors during bookmark', async () => {
            const mockBookmarkBtn = {
                count: vi.fn().mockResolvedValue(1),
                isVisible: vi.fn().mockResolvedValue(true)
            };
            const mockTweet = {
                locator: vi.fn().mockReturnValue(mockBookmarkBtn)
            };

            handler.safeHumanClick.mockRejectedValue(new Error('Click failed'));

            const result = await handler.bookmarkTweet(mockTweet);

            expect(result).toBe(false);
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('[Bookmark] Error: Click failed'));
        });

        it('should return false if button is not visible', async () => {
             const mockBookmarkBtn = {
                count: vi.fn().mockResolvedValue(0),
                isVisible: vi.fn().mockResolvedValue(false)
            };
            const mockTweet = {
                locator: vi.fn().mockReturnValue(mockBookmarkBtn)
            };

            const result = await handler.bookmarkTweet(mockTweet);

            expect(result).toBe(false);
            expect(handler.safeHumanClick).not.toHaveBeenCalled();
        });
    });

    describe('diveProfile', () => {
        it('should click a valid profile link', async () => {
            // Mock $$eval to return indices of valid links (e.g., index 0 is valid)
            mockPage.$$eval.mockResolvedValue([0, -1]);
            
            const mockLink = {};
            mockPage.locator.mockReturnValue({
                nth: vi.fn().mockReturnValue(mockLink)
            });

            const result = await handler.diveProfile();

            expect(result).toBe(true);
            expect(handler.safeHumanClick).toHaveBeenCalledWith(mockLink, 'Profile Link');
            expect(mockPage.goBack).toHaveBeenCalled();
        });

        it('should return false if no valid links found', async () => {
            mockPage.$$eval.mockResolvedValue([-1, -1]);

            const result = await handler.diveProfile();

            expect(result).toBe(false);
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('No valid profile links'));
        });

        it('should handle errors during diveProfile interaction', async () => {
            mockPage.$$eval.mockResolvedValue([0]); // Valid index
            
            mockPage.locator.mockReturnValue({
                nth: vi.fn().mockReturnValue({})
            });

            // Fail interaction
            handler.safeHumanClick.mockRejectedValue(new Error('Click failed'));
            
            const result = await handler.diveProfile();
            
            expect(result).toBe(false);
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Profile interaction failed'));
        });

        it('should filter valid profile links correctly', async () => {
            const mockElements = [
                { getAttribute: () => '/validuser' },
                { getAttribute: () => '/home' }, // reserved
                { getAttribute: () => '/user/status/123' }, // status
                { getAttribute: () => null },
                { getAttribute: () => '/hashtag/tag' }, // hashtag
                { getAttribute: () => '/validuser/' } // trailing slash
            ];

            // Mock $$eval to simulate the browser-side function execution
            mockPage.$$eval.mockImplementation(async (selector, fn) => {
                return fn(mockElements);
            });
            
            // Mock interaction with valid element
            mockPage.locator.mockReturnValue({
                nth: vi.fn().mockReturnValue({})
            });
            handler.safeHumanClick.mockResolvedValue();

            const result = await handler.diveProfile();
            
            expect(result).toBe(true);
        });
    });

    describe('Coverage Gaps', () => {
        it('sixLayerClick should log failure for each layer', async () => {
            const mockElement = { elementHandle: vi.fn().mockResolvedValue({}) };
            
            // Mock all layers to fail
            mockGhost.click.mockResolvedValue({ success: false, error: 'Ghost error' });
            handler.humanClick.mockRejectedValue(new Error('Human error'));
            handler.safeHumanClick.mockRejectedValue(new Error('SafeHuman error'));
            mockElement.click = vi.fn().mockRejectedValue(new Error('Native error'));
            mockElement.evaluate = vi.fn().mockRejectedValue(new Error('JS error'));
            
            await handler.sixLayerClick(mockElement, '[Test]');
            
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Layer 1 failed'));
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Layer 2 failed'));
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Layer 3 failed'));
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('All 6 click layers failed'));
        });

        it('robustFollow should handle catch block in pre-check follow visibility', async () => {
            const mockFollowBtn = {
                isVisible: vi.fn()
                    .mockRejectedValueOnce(new Error('Visibility check failed')) // Pre-check triggers catch
                    .mockResolvedValue(true), // Loop check
                textContent: vi.fn().mockResolvedValue('Follow'),
                elementHandle: vi.fn().mockResolvedValue({})
            };
            
             mockPage.locator.mockImplementation(sel => {
                if (sel.includes('unfollow')) return { first: () => ({ isVisible: vi.fn().mockResolvedValue(false) }) };
                if (sel.includes('follow')) return { first: () => mockFollowBtn };
                return { first: () => ({ isVisible: vi.fn().mockResolvedValue(false) }) };
            });

            // Fail the rest to exit cleanly
            vi.spyOn(handler, 'sixLayerClick').mockResolvedValue(false);
            
            await handler.robustFollow();
            // Should complete without error
        });

        it('robustFollow should detect already following in loop check', async () => {
             const mockFollowBtn = {
                isVisible: vi.fn().mockResolvedValue(true),
                textContent: vi.fn().mockResolvedValue('Following'), // Already following
                elementHandle: vi.fn().mockResolvedValue({})
            };
            
            mockPage.locator.mockImplementation(sel => {
                if (sel.includes('unfollow')) return { first: () => ({ isVisible: vi.fn().mockResolvedValue(false) }) };
                if (sel.includes('follow')) return { first: () => mockFollowBtn };
                return { first: () => ({ isVisible: vi.fn().mockResolvedValue(false) }) };
            });

            const result = await handler.robustFollow();
            expect(result.success).toBe(true);
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Already following'));
        });

        it('should handle freshFollowBtn not visible (Line 226)', async () => {
            const mockFollowBtn = {
                isVisible: vi.fn().mockResolvedValue(false), // Not visible
                textContent: vi.fn().mockResolvedValue('Follow'),
                getAttribute: vi.fn().mockResolvedValue('Follow'),
                elementHandle: vi.fn().mockResolvedValue({})
            };
            
            mockPage.locator.mockImplementation(sel => {
                if (sel.includes('unfollow')) return { first: () => ({ isVisible: vi.fn().mockResolvedValue(false) }) };
                if (sel.includes('follow')) return { first: () => mockFollowBtn };
                return { first: () => ({ isVisible: vi.fn().mockResolvedValue(false) }) };
            });
    
            const result = await handler.robustFollow();
            
            expect(result.success).toBe(false);
        });
    
        it('should skip if button text does not include follow (Line 238)', async () => {
            const mockFollowBtn = {
                isVisible: vi.fn().mockResolvedValue(true),
                textContent: vi.fn().mockResolvedValue('SomethingElse'), // Not 'follow', 'following', 'unfollow', 'pending'
                getAttribute: vi.fn().mockResolvedValue('SomethingElse'),
                elementHandle: vi.fn().mockResolvedValue({})
            };
            
            mockPage.locator.mockImplementation(sel => {
                if (sel.includes('unfollow')) return { first: () => ({ isVisible: vi.fn().mockResolvedValue(false) }) };
                if (sel.includes('follow')) return { first: () => mockFollowBtn };
                return { first: () => ({ isVisible: vi.fn().mockResolvedValue(false) }) };
            });
    
            const result = await handler.robustFollow();
            
            expect(result.success).toBe(false);
        });

        it('should handle tweet visibility check (Line 339)', async () => {
            const mockTweets = {
                count: vi.fn().mockResolvedValue(1),
                nth: vi.fn().mockReturnValue({
                    isVisible: vi.fn().mockResolvedValue(false) // Not visible
                })
            };
            
            mockPage.locator.mockReturnValue(mockTweets);
            vi.spyOn(handler, 'likeTweet'); // Spy on likeTweet
    
            await handler.diveTweet();
            
            expect(handler.likeTweet).not.toHaveBeenCalled();
        });

        it('should select best tweet based on score (Line 344)', async () => {
             // Mock 2 tweets, one with better score (closer to 400)
             // Tweet 1: y=0 (score = 1000 - |0-400| = 600)
             // Tweet 2: y=400 (score = 1000 - |400-400| = 1000)
             
             const tweet1 = {
                 isVisible: vi.fn().mockResolvedValue(true),
                 boundingBox: vi.fn().mockResolvedValue({ y: 0, height: 100 }),
                 scrollIntoViewIfNeeded: vi.fn().mockResolvedValue(),
                 locator: vi.fn().mockReturnValue({ 
                    count: vi.fn().mockResolvedValue(1), 
                    isVisible: vi.fn().mockResolvedValue(true) 
                })
             };
             
             const tweet2 = {
                 isVisible: vi.fn().mockResolvedValue(true),
                 boundingBox: vi.fn().mockResolvedValue({ y: 400, height: 100 }), // Best score
                 scrollIntoViewIfNeeded: vi.fn().mockResolvedValue(),
                 locator: vi.fn().mockReturnValue({ 
                    count: vi.fn().mockResolvedValue(1), 
                    isVisible: vi.fn().mockResolvedValue(true) 
                })
             };
             
             const mockTweets = {
                 count: vi.fn().mockResolvedValue(2),
                 nth: vi.fn()
                     .mockReturnValueOnce(tweet1)
                     .mockReturnValueOnce(tweet2)
             };
             
             mockPage.locator.mockReturnValue(mockTweets);
             
             // Spy on scrollIntoViewIfNeeded to see which one was called
             const scrollSpy1 = vi.spyOn(tweet1, 'scrollIntoViewIfNeeded');
             const scrollSpy2 = vi.spyOn(tweet2, 'scrollIntoViewIfNeeded');
             
             await handler.diveTweet();
             
             expect(scrollSpy2).toHaveBeenCalled();
             expect(scrollSpy1).not.toHaveBeenCalled();
        });

        it('robustFollow should verify follow via post-poll text', async () => {
            const mockFollowBtn = {
                isVisible: vi.fn().mockResolvedValue(true),
                textContent: vi.fn()
                    .mockResolvedValueOnce('Follow') // Pre-check (optional if mocked right)
                    .mockResolvedValueOnce('Follow') // Loop check
                    .mockResolvedValueOnce('Follow') // Pre-click check
                    .mockResolvedValue('Following'), // Post-poll check
                getAttribute: vi.fn().mockResolvedValue('Follow'),
                elementHandle: vi.fn().mockResolvedValue({})
            };
            
            mockPage.locator.mockImplementation(sel => {
                if (sel.includes('unfollow')) return { first: () => ({ isVisible: vi.fn().mockResolvedValue(false) }) };
                if (sel.includes('follow')) return { first: () => mockFollowBtn };
                return { first: () => ({ isVisible: vi.fn().mockResolvedValue(false) }) };
            });

            vi.spyOn(handler, 'pollForFollowState').mockResolvedValue(false);
            vi.spyOn(handler, 'sixLayerClick').mockResolvedValue(true);
            vi.spyOn(handler, 'isElementActionable').mockResolvedValue(true);

            const result = await handler.robustFollow();
            expect(result.success).toBe(true);
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('post-poll text indicates following'));
        });

        it('diveTweet should handle visible tweet with valid bounding box', async () => {
            const mockTweet = {
                isVisible: vi.fn().mockResolvedValue(true),
                boundingBox: vi.fn().mockResolvedValue({ y: 400, height: 100 }),
                scrollIntoViewIfNeeded: vi.fn().mockResolvedValue(),
                locator: vi.fn().mockReturnValue({ count: vi.fn().mockResolvedValue(1), isVisible: vi.fn().mockResolvedValue(true) })
            };
            
            const mockTweets = {
                count: vi.fn().mockResolvedValue(1),
                nth: vi.fn().mockReturnValue(mockTweet)
            };
            mockPage.locator.mockReturnValue(mockTweets);
            
            mathUtils.roll.mockReturnValue(true); // Ensure engagement
            vi.spyOn(handler, 'likeTweet').mockResolvedValue(true);

            await handler.diveTweet();
            
            expect(mockTweet.isVisible).toHaveBeenCalled();
            expect(mockTweet.boundingBox).toHaveBeenCalled();
            expect(handler.likeTweet).toHaveBeenCalled();
        });
    });
});

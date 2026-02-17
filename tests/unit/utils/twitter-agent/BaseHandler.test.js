
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BaseHandler } from '../../../../utils/twitter-agent/BaseHandler.js';
import { mathUtils } from '../../../../utils/mathUtils.js';

// Mock dependencies
vi.mock('../../../../utils/mathUtils.js', () => ({
    mathUtils: {
        random: vi.fn(),
        gaussian: vi.fn(),
        randomInRange: vi.fn(),
        roll: vi.fn()
    }
}));

vi.mock('../../../../utils/entropyController.js', () => ({
    entropy: {
        add: vi.fn()
    }
}));

describe('BaseHandler', () => {
    let handler;
    let mockAgent;
    let mockPage;
    let mockLogger;

    beforeEach(() => {
        mockPage = {
            content: vi.fn().mockResolvedValue('<html></html>'),
            locator: vi.fn(),
            waitForTimeout: vi.fn().mockResolvedValue(),
            goto: vi.fn().mockResolvedValue(),
            reload: vi.fn().mockResolvedValue(),
            url: vi.fn().mockReturnValue('https://twitter.com/home'),
            mouse: {
                move: vi.fn(),
                down: vi.fn(),
                up: vi.fn(),
                click: vi.fn()
            },
            keyboard: {
                type: vi.fn(),
                press: vi.fn()
            },
            evaluate: vi.fn().mockImplementation(async (fn, arg) => {
                if (typeof fn === 'function') {
                    try {
                        return await fn(arg);
                    } catch (error) {
                        console.error('Evaluate mock error:', error);
                        throw error;
                    }
                }
                return Promise.resolve();
            }),
            viewportSize: vi.fn().mockReturnValue({ width: 1920, height: 1080 })
        };

        mockLogger = {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn()
        };

        // Mock window global for non-JSDOM environment
        global.window = {
            innerWidth: 1920,
            innerHeight: 1080,
            getComputedStyle: vi.fn().mockReturnValue({
                visibility: 'visible',
                display: 'block',
                opacity: '1',
                pointerEvents: 'auto'
            }),
            scrollBy: vi.fn()
        };

        mockAgent = {
            page: mockPage,
            config: {
                timings: { 
                    scrollPause: { mean: 1000 },
                    readingPhase: { mean: 5000, deviation: 1000 },
                    actionSpecific: {
                        space: { mean: 1000, deviation: 200 },
                        keys: { mean: 100, deviation: 30 }
                    }
                },
                getFatiguedVariant: vi.fn(),
                probabilities: { tweetDive: 0.5, profileDive: 0.3, followOnProfile: 0.2 },
                maxSessionDuration: 3600000 // 1h
            },
            logger: mockLogger,
            human: {
                think: vi.fn(),
                recoverFromError: vi.fn(),
                consumeContent: vi.fn(),
                scroll: vi.fn()
            },
            ghost: {
                click: vi.fn().mockResolvedValue({ success: true, x: 100, y: 100 }),
                move: vi.fn()
            },
            state: { consecutiveSoftErrors: 0, fatigueBias: 0, activityMode: 'NORMAL' },
            sessionStart: Date.now(),
            sessionEndTime: Date.now() + 3600000,
            loopIndex: 0,
            isFatigued: false,
            fatigueThreshold: 3600000,
            lastNetworkActivity: Date.now()
        };

        handler = new BaseHandler(mockAgent);

        // Default mathUtils mocks
        mathUtils.randomInRange.mockReturnValue(100);
        mathUtils.roll.mockReturnValue(false);
        mathUtils.gaussian.mockReturnValue(100);
    });

    afterEach(() => {
        delete global.window;
        vi.restoreAllMocks();
    });

    describe('Constructor & Properties', () => {
        it('should initialize with agent properties', () => {
            expect(handler.page).toBe(mockAgent.page);
            expect(handler.config).toBe(mockAgent.config);
            expect(handler.logger).toBe(mockAgent.logger);
        });

        it('should delegate property access to agent', () => {
            // Getters
            expect(handler.state).toBe(mockAgent.state);
            expect(handler.sessionStart).toBe(mockAgent.sessionStart);
            expect(handler.sessionEndTime).toBe(mockAgent.sessionEndTime);
            expect(handler.loopIndex).toBe(mockAgent.loopIndex);
            expect(handler.isFatigued).toBe(mockAgent.isFatigued);
            expect(handler.fatigueThreshold).toBe(mockAgent.fatigueThreshold);
            expect(handler.lastNetworkActivity).toBe(mockAgent.lastNetworkActivity);

            // Setters
            handler.state = { newState: true };
            expect(mockAgent.state).toEqual({ newState: true });

            handler.loopIndex = 5;
            expect(mockAgent.loopIndex).toBe(5);

            handler.isFatigued = true;
            expect(mockAgent.isFatigued).toBe(true);

            handler.sessionEndTime = 12345;
            expect(mockAgent.sessionEndTime).toBe(12345);

            handler.fatigueThreshold = 999;
            expect(mockAgent.fatigueThreshold).toBe(999);
            
            handler.lastNetworkActivity = 1000;
            expect(mockAgent.lastNetworkActivity).toBe(1000);
        });
    });

    describe('Utility Methods', () => {
        it('should log messages via agent logger', () => {
            handler.log('test message');
            expect(mockLogger.info).toHaveBeenCalledWith('test message');
        });

        it('should fallback to console.log if logger missing', () => {
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
            handler.logger = null;
            handler.log('console message');
            expect(consoleSpy).toHaveBeenCalledWith('console message');
            consoleSpy.mockRestore();
        });

        it('should clamp values', () => {
            expect(handler.clamp(10, 0, 5)).toBe(5);
            expect(handler.clamp(-5, 0, 5)).toBe(0);
            expect(handler.clamp(3, 0, 5)).toBe(3);
        });

        it('should get random scroll method', () => {
            const methods = ['WHEEL_DOWN', 'PAGE_DOWN', 'ARROW_DOWN'];
            const method = handler.getScrollMethod();
            expect(methods).toContain(method);
        });

        describe('normalizeProbabilities', () => {
            it('should normalize probabilities and apply fatigue bias', () => {
                handler.state.fatigueBias = 1;
                const probs = { tweetDive: 1.0, profileDive: 1.0, followOnProfile: 1.0 };
                const normalized = handler.normalizeProbabilities(probs);
                
                expect(normalized.tweetDive).toBeCloseTo(0.7);
                expect(normalized.profileDive).toBeCloseTo(0.7);
                expect(normalized.followOnProfile).toBeCloseTo(0.5);
            });

            it('should apply burst mode adjustments', () => {
                handler.state.activityMode = 'BURST';
                const probs = { tweetDive: 1.0, profileDive: 1.0 };
                const normalized = handler.normalizeProbabilities(probs);
                
                expect(normalized.tweetDive).toBe(0.2);
                expect(normalized.profileDive).toBe(0.2);
            });

            it('should clamp values between 0 and 1', () => {
                const probs = { test: 1.5, test2: -0.5 };
                const normalized = handler.normalizeProbabilities(probs);
                
                expect(normalized.test).toBe(1);
                expect(normalized.test2).toBe(0);
            });

            it('should apply fatigue bias', () => {
                handler.state.fatigueBias = 1;
                const probs = { tweetDive: 1.0, profileDive: 1.0, followOnProfile: 1.0 };
                const normalized = handler.normalizeProbabilities(probs);
                
                expect(normalized.tweetDive).toBeCloseTo(0.7);
                expect(normalized.profileDive).toBeCloseTo(0.7);
                expect(normalized.followOnProfile).toBeCloseTo(0.5);
            });
        });
    });

    describe('Fatigue Management', () => {
        it('should trigger fatigue if threshold exceeded', () => {
            handler.sessionStart = Date.now() - (handler.fatigueThreshold + 1000);
            expect(handler.checkFatigue()).toBe(true);
            expect(mockAgent.isFatigued).toBe(true);
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Fatigue triggered'));
        });

        it('should not trigger fatigue if within threshold', () => {
            handler.sessionStart = Date.now();
            expect(handler.checkFatigue()).toBe(false);
            expect(mockAgent.isFatigued).toBe(false);
        });

        it('should hot-swap config when triggered', () => {
            const newConfig = { ...mockAgent.config, swapped: true };
            mockAgent.config.getFatiguedVariant.mockReturnValue(newConfig);

            handler.triggerHotSwap();

            expect(handler.config).toBe(newConfig);
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Hot-swapped'));
        });

        it('should do nothing if no fatigued variant available', () => {
            mockAgent.config.getFatiguedVariant.mockReturnValue(null);
            const originalConfig = handler.config;

            handler.triggerHotSwap();

            expect(handler.config).toBe(originalConfig);
        });
    });

    describe('Health Check', () => {
        it('should report unhealthy if network inactive', async () => {
            handler.lastNetworkActivity = Date.now() - 31000; // > 30s
            const result = await handler.performHealthCheck();
            expect(result.healthy).toBe(false);
            expect(result.reason).toContain('network_inactivity');
        });

        it('should report unhealthy on critical error page', async () => {
            mockPage.content.mockResolvedValue('Error: ERR_TOO_MANY_REDIRECTS');
            const result = await handler.performHealthCheck();
            expect(result.healthy).toBe(false);
            expect(result.reason).toBe('critical_error_page_redirects');
        });

        it('should report healthy if everything is fine', async () => {
            mockPage.content.mockResolvedValue('<html>Normal Page</html>');
            const result = await handler.performHealthCheck();
            expect(result.healthy).toBe(true);
        });

        it('should return healthy on check failure (conservative)', async () => {
            mockPage.content.mockRejectedValue(new Error('Page crashed'));
            const result = await handler.performHealthCheck();
            expect(result.healthy).toBe(true);
            expect(result.reason).toBe('check_failed');
        });
    });

    describe('isSessionExpired', () => {
        it('should return true if session duration exceeded', () => {
            handler.sessionStart = Date.now() - (handler.config.maxSessionDuration + 1000);
            expect(handler.isSessionExpired()).toBe(true);
        });

        it('should return false if session duration within limit', () => {
            handler.sessionStart = Date.now();
            expect(handler.isSessionExpired()).toBe(false);
        });
        
        it('should use default duration if config missing', () => {
            handler.config.maxSessionDuration = undefined;
            handler.sessionStart = Date.now() - (45 * 60 * 1000 + 1000); // > 45 mins
            expect(handler.isSessionExpired()).toBe(true);
        });
    });

    describe('getScrollMethod', () => {
        it('should return a valid scroll method', () => {
            const method = handler.getScrollMethod();
            expect(['WHEEL_DOWN', 'PAGE_DOWN', 'ARROW_DOWN']).toContain(method);
        });
    });

    describe('Interaction Methods', () => {
        describe('humanClick', () => {
            it('should perform human-like click sequence', async () => {
                const mockTarget = {
                    evaluate: vi.fn(),
                    click: vi.fn()
                };
                
                await handler.humanClick(mockTarget);
                
                expect(mockAgent.human.think).toHaveBeenCalled();
                expect(mockTarget.evaluate).toHaveBeenCalled(); // scrollIntoView
                expect(mockAgent.ghost.click).toHaveBeenCalledWith(mockTarget, {
                    label: 'Target',
                    hoverBeforeClick: true
                });
            });

            it('should recover from error and force click', async () => {
                const mockTarget = {
                    evaluate: vi.fn()
                };
                
                mockAgent.ghost.click.mockRejectedValue(new Error('Ghost click failed'));
                
                await expect(handler.humanClick(mockTarget)).rejects.toThrow('Ghost click failed');
                
                expect(mockAgent.human.recoverFromError).toHaveBeenCalled();
            });

            it('should return early if target is null', async () => {
                await handler.humanClick(null);
                expect(mockAgent.human.think).not.toHaveBeenCalled();
            });
        });

        describe('safeHumanClick', () => {
            it('should return true on first attempt success', async () => {
                const mockTarget = { evaluate: vi.fn() };
                mockAgent.ghost.click.mockResolvedValue({ success: true });
                
                const result = await handler.safeHumanClick(mockTarget);
                expect(result).toBe(true);
                expect(mockAgent.ghost.click).toHaveBeenCalledTimes(1);
            });

            it('should retry on failure and eventually succeed', async () => {
                const mockTarget = { 
                    evaluate: vi.fn()
                };
                
                // First attempt fails
                mockAgent.ghost.click.mockRejectedValueOnce(new Error('Fail 1'));
                
                // Second attempt succeeds
                mockAgent.ghost.click.mockResolvedValueOnce({ success: true });
                
                const result = await handler.safeHumanClick(mockTarget, 'Test', 3);
                
                expect(result).toBe(true);
            });

            it('should return false after max retries', async () => {
                const mockTarget = { 
                    evaluate: vi.fn()
                };
                
                // All attempts fail
                mockAgent.ghost.click.mockRejectedValue(new Error('Fail'));
                
                const result = await handler.safeHumanClick(mockTarget, 'Test', 3);
                
                expect(result).toBe(false);
            });

            it('should return false immediately if retries is 0', async () => {
                const result = await handler.safeHumanClick({}, 'Test', 0);
                expect(result).toBe(false);
            });
        });

        describe('isElementActionable', () => {
            it('should return true for visible actionable element', async () => {
                const mockEl = {
                    getBoundingClientRect: () => ({ width: 100, height: 100, left: 100, top: 100 }),
                    disabled: false,
                    hidden: false
                };
                const mockElement = { elementHandle: vi.fn().mockResolvedValue(mockEl) };
                
                const result = await handler.isElementActionable(mockElement);
                expect(result).toBe(true);
            });

            it('should return false if pointerEvents is none', async () => {
                global.window.getComputedStyle.mockReturnValue({
                    visibility: 'visible',
                    display: 'block',
                    opacity: '1',
                    pointerEvents: 'none'
                });

                const mockEl = {
                    getBoundingClientRect: () => ({ width: 100, height: 100, left: 100, top: 100 }),
                    disabled: false,
                    hidden: false
                };
                const mockElement = { elementHandle: vi.fn().mockResolvedValue(mockEl) };
                
                const result = await handler.isElementActionable(mockElement);
                expect(result).toBe(false);
            });

            it('should return false if element is out of viewport', async () => {
                const mockEl = {
                    getBoundingClientRect: () => ({ width: 100, height: 100, left: -200, top: 100 }), // Left is negative
                    disabled: false,
                    hidden: false
                };
                const mockElement = { elementHandle: vi.fn().mockResolvedValue(mockEl) };
                
                const result = await handler.isElementActionable(mockElement);
                expect(result).toBe(false);
            });
            
            it('should return false if element has zero size', async () => {
                const mockEl = {
                    getBoundingClientRect: () => ({ width: 0, height: 0, left: 100, top: 100 }),
                    disabled: false,
                    hidden: false
                };
                const mockElement = { elementHandle: vi.fn().mockResolvedValue(mockEl) };
                
                const result = await handler.isElementActionable(mockElement);
                expect(result).toBe(false);
            });

            it('should return false if element is hidden by style', async () => {
                 global.window.getComputedStyle.mockReturnValue({
                     visibility: 'hidden',
                     display: 'block',
                     opacity: '1',
                     pointerEvents: 'auto'
                 });

                const mockEl = {
                    getBoundingClientRect: () => ({ width: 100, height: 100, left: 100, top: 100 }),
                    disabled: false,
                    hidden: false
                };
                const mockElement = { elementHandle: vi.fn().mockResolvedValue(mockEl) };
                
                const result = await handler.isElementActionable(mockElement);
                expect(result).toBe(false);
            });

            it('should return false if elementHandle is null', async () => {
                const mockElement = { elementHandle: vi.fn().mockResolvedValue(null) };
                const result = await handler.isElementActionable(mockElement);
                expect(result).toBe(false);
            });
            
            it('should return false if evaluate throws', async () => {
                 const mockElement = { elementHandle: vi.fn().mockResolvedValue({}) };
                 mockPage.evaluate.mockRejectedValue(new Error('Eval error'));
                 const result = await handler.isElementActionable(mockElement);
                 expect(result).toBe(false);
            });
        });

        describe('scrollToGoldenZone', () => {
            it('should attempt to scroll element to golden zone', async () => {
                 const mockElement = { 
                     evaluate: vi.fn().mockImplementation((fn) => {
                         const el = {
                             getBoundingClientRect: () => ({ top: 0, height: 100 }) // At top
                         };
                         return fn(el);
                     }) 
                 };
                 
                 global.window.scrollBy = vi.fn();
                 
                 await handler.scrollToGoldenZone(mockElement);
                 
                 expect(mockElement.evaluate).toHaveBeenCalled();
                 expect(global.window.scrollBy).toHaveBeenCalled();
            });

            it('should scroll up if element is below golden zone', async () => {
                const mockElement = { 
                     evaluate: vi.fn().mockImplementation((fn) => {
                         const el = {
                             getBoundingClientRect: () => ({ top: 1000, height: 100 }) // Below
                         };
                         return fn(el);
                     }) 
                 };
                 
                 global.window.scrollBy = vi.fn();
                 
                 await handler.scrollToGoldenZone(mockElement);
                 
                 expect(global.window.scrollBy).toHaveBeenCalledWith(0, expect.any(Number));
                 const callArgs = global.window.scrollBy.mock.calls[0];
                 expect(callArgs[1]).toBeLessThan(0);
            });
            
            it('should not scroll if element is in golden zone', async () => {
                const mockElement = { 
                    evaluate: vi.fn().mockImplementation((fn) => {
                        const el = {
                            getBoundingClientRect: () => ({ top: 540, height: 100 }) // Center
                        };
                        return fn(el);
                    }) 
                };
                global.window.scrollBy = vi.fn();
                await handler.scrollToGoldenZone(mockElement);
                expect(global.window.scrollBy).not.toHaveBeenCalled();
            });

            it('should handle errors gracefully', async () => {
                 const mockElement = { 
                     evaluate: vi.fn().mockRejectedValue(new Error('Scroll failed')) 
                 };
                 
                 await handler.scrollToGoldenZone(mockElement);
                 
                 expect(mockElement.evaluate).toHaveBeenCalled();
            });
        });

        describe('humanType', () => {
            it('should type text with human characteristics', async () => {
                const mockElement = {
                    click: vi.fn(),
                    press: vi.fn()
                };
                
                await handler.humanType(mockElement, 'abc');
                
                expect(mockElement.click).toHaveBeenCalled();
                expect(mockElement.press).toHaveBeenCalledTimes(3); // a, b, c
            });

            it('should simulate typing errors', async () => {
                const mockElement = {
                    click: vi.fn(),
                    press: vi.fn()
                };
                
                mathUtils.roll.mockReturnValue(true); // Always make errors
                
                await handler.humanType(mockElement, 'a');
                
                expect(mockElement.press).toHaveBeenCalledWith('Backspace');
            });

            it('should handle errors', async () => {
                const mockElement = {
                    click: vi.fn().mockRejectedValue(new Error('Type error'))
                };
                
                await expect(handler.humanType(mockElement, 'abc')).rejects.toThrow('Type error');
                expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('humanType error'));
            });
        });
        
        describe('dismissOverlays', () => {
            it('should dismiss toasts and modals', async () => {
                 const mockToasts = { count: vi.fn().mockResolvedValue(1) };
                 const mockModals = { count: vi.fn().mockResolvedValue(1) };
                 
                 mockPage.locator.mockImplementation((selector) => {
                     if (selector.includes('toast')) return mockToasts;
                     if (selector.includes('dialog')) return mockModals;
                     return { count: vi.fn().mockResolvedValue(0) };
                 });
                 
                 await handler.dismissOverlays();
                 
                 expect(mockPage.keyboard.press).toHaveBeenCalledTimes(2); // Once for toast, once for modal
                 expect(mockPage.keyboard.press).toHaveBeenCalledWith('Escape');
            });
            
            it('should handle errors gracefully', async () => {
                 mockPage.locator.mockImplementation(() => { throw new Error('Locator error'); });
                 await handler.dismissOverlays();
                 // Should not throw
            });
        });
        
        describe('simulateReading', () => {
            it('should perform reading actions', async () => {
                 mockAgent.config.timings.readingPhase = { mean: 1000, deviation: 0 };
                 mathUtils.gaussian.mockReturnValue(1000); // 1s duration
                 mathUtils.roll.mockReturnValue(true); // Trigger all actions
                 
                 await handler.simulateReading();
                 
                 expect(mockAgent.human.scroll).toHaveBeenCalled();
                 expect(mockAgent.ghost.move).toHaveBeenCalled();
                 expect(mockPage.keyboard.type).toHaveBeenCalled();
            });
            
            it('should cover else blocks', async () => {
                 mockAgent.config.timings.readingPhase = { mean: 100, deviation: 0 };
                 mathUtils.gaussian.mockReturnValue(100);
                 
                 // False for all actions
                 mathUtils.roll.mockReturnValue(false);
                 
                 await handler.simulateReading();
                 
                 expect(mockAgent.human.scroll).not.toHaveBeenCalled();
            });
        });
        
        describe('checkAndHandleSoftError', () => {
            it('should detect soft error and click retry', async () => {
                // Mock soft error locator
                const softErrorLocator = {
                    isVisible: vi.fn().mockResolvedValue(true),
                    first: function() { return this; }
                };
                // Mock retry button locator
                const retryBtnLocator = {
                    isVisible: vi.fn().mockResolvedValue(true),
                    click: vi.fn().mockResolvedValue(),
                    first: function() { return this; }
                };

                mockPage.locator.mockImplementation((selector) => {
                    if (selector.includes('Something went wrong')) return softErrorLocator;
                    if (selector.includes('Retry')) return retryBtnLocator;
                    return { first: () => ({ isVisible: vi.fn().mockResolvedValue(false) }), isVisible: vi.fn().mockResolvedValue(false) };
                });

                const result = await handler.checkAndHandleSoftError();

                expect(result).toBe(true);
                expect(handler.state.consecutiveSoftErrors).toBe(1);
                expect(retryBtnLocator.click).toHaveBeenCalled();
            });

            it('should skip retry button if consecutive errors > 1', async () => {
                 handler.state.consecutiveSoftErrors = 1; // Will become 2
                 
                 const softErrorLocator = { isVisible: vi.fn().mockResolvedValue(true), first: function() { return this; } };
                 const retryBtnLocator = { isVisible: vi.fn().mockResolvedValue(true), click: vi.fn() };
                 
                 mockPage.locator.mockImplementation((selector) => {
                     if (selector.includes('Something went wrong')) return softErrorLocator;
                     if (selector.includes('Retry')) return retryBtnLocator;
                     return { first: () => ({ isVisible: vi.fn().mockResolvedValue(false) }), isVisible: vi.fn().mockResolvedValue(false) };
                 });
                 
                 await handler.checkAndHandleSoftError();
                 
                 expect(handler.state.consecutiveSoftErrors).toBe(2);
                 expect(retryBtnLocator.click).not.toHaveBeenCalled();
                 expect(mockPage.goto).toHaveBeenCalled(); // Default is http, so goto
            });

            it('should use page.reload() if url is not http', async () => {
                 mockPage.url.mockReturnValue('about:blank');
                 const softErrorLocator = { 
                     isVisible: vi.fn().mockResolvedValue(true),
                     first: function() { return this; }
                 };
                 
                 mockPage.locator.mockImplementation((selector) => {
                     if (selector.includes('Something went wrong')) return softErrorLocator;
                     return { first: () => ({ isVisible: vi.fn().mockResolvedValue(false) }), isVisible: vi.fn().mockResolvedValue(false) };
                 });
                 
                 const result = await handler.checkAndHandleSoftError();
                 
                 expect(mockPage.reload).toHaveBeenCalled();
                 expect(mockPage.goto).not.toHaveBeenCalled();
            });

            it('should reload page if retry fails or not found', async () => {
                // 1. Soft error visible
                const mockSoftError = { isVisible: vi.fn().mockResolvedValue(true) };
                
                // 2. Retry button NOT visible
                const mockRetryBtn = { isVisible: vi.fn().mockResolvedValue(false) };
                
                mockPage.locator.mockImplementation((selector) => {
                    if (selector.includes('Something went wrong')) {
                         return { 
                             first: () => mockSoftError,
                             isVisible: vi.fn().mockResolvedValue(false) // Verification check (not visible)
                         };
                    }
                    if (selector.includes('Retry')) return { first: () => mockRetryBtn };
                    return { first: () => ({ isVisible: vi.fn().mockResolvedValue(false) }) };
                });
                
                handler.state.consecutiveSoftErrors = 0;
                
                const result = await handler.checkAndHandleSoftError();
                
                expect(result).toBe(true);
                expect(mockPage.goto).toHaveBeenCalled();
                expect(handler.state.consecutiveSoftErrors).toBe(0);
            });

            it('should throw if max consecutive errors reached', async () => {
                 handler.state.consecutiveSoftErrors = 3;
                 const softErrorLocator = { isVisible: vi.fn().mockResolvedValue(true), first: function() { return this; } };
                 mockPage.locator.mockImplementation((sel) => {
                     if (sel.includes('Something went wrong')) return softErrorLocator;
                     return { first: () => ({ isVisible: vi.fn().mockResolvedValue(false) }), isVisible: vi.fn().mockResolvedValue(false) };
                 });

                 await expect(handler.checkAndHandleSoftError()).rejects.toThrow('potential twitter logged out');
            });

            it('should rethrow specific errors', async () => {
                 mockPage.locator.mockImplementation(() => {
                     throw new Error('potential twitter logged out');
                 });
                 await expect(handler.checkAndHandleSoftError()).rejects.toThrow('potential twitter logged out');
            });

            it('should ignore other errors', async () => {
                 mockPage.locator.mockImplementation(() => {
                     throw new Error('Some random error');
                 });
                 const result = await handler.checkAndHandleSoftError();
                 expect(result).toBe(false);
            });

            it('should throw error if max retries reached', async () => {
                const mockSoftError = { isVisible: vi.fn().mockResolvedValue(true) };
                mockPage.locator.mockReturnValue({ first: () => mockSoftError });
                
                handler.state.consecutiveSoftErrors = 3;
                
                await expect(handler.checkAndHandleSoftError()).rejects.toThrow('potential twitter logged out');
            });
            
            it('should return false if no soft error', async () => {
                 const softErrorLocator = {
                    isVisible: vi.fn().mockResolvedValue(false),
                    first: function() { return this; }
                 };
                
                mockPage.locator.mockImplementation(() => ({ first: () => softErrorLocator }));

                const result = await handler.checkAndHandleSoftError();
                expect(result).toBe(false);
                expect(handler.state.consecutiveSoftErrors).toBe(0);
            });
            
            it('should handle reload failure', async () => {
                 const softErrorLocator = { 
                     isVisible: vi.fn().mockResolvedValue(true),
                     first: function() { return this; }
                 };
                 
                 mockPage.locator.mockImplementation((selector) => {
                     if (selector.includes('Something went wrong')) return softErrorLocator;
                     return { first: () => ({ isVisible: vi.fn().mockResolvedValue(false) }), isVisible: vi.fn().mockResolvedValue(false) };
                 });
                 
                 // Force reload error
                 mockPage.goto.mockRejectedValue(new Error('Reload failed'));
                 
                 const result = await handler.checkAndHandleSoftError();
                 expect(result).toBe(true);
                 expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Reload failed'));
            });

            it('should use page.reload() if url is not http', async () => {
                 mockPage.url.mockReturnValue('about:blank');
                 const softErrorLocator = { 
                     isVisible: vi.fn().mockResolvedValue(true),
                     first: function() { return this; }
                 };
                 
                 mockPage.locator.mockImplementation((selector) => {
                     if (selector.includes('Something went wrong')) return softErrorLocator;
                     return { first: () => ({ isVisible: vi.fn().mockResolvedValue(false) }), isVisible: vi.fn().mockResolvedValue(false) };
                 });
                 
                 const result = await handler.checkAndHandleSoftError();
                 
                 expect(mockPage.reload).toHaveBeenCalled();
                 expect(mockPage.goto).not.toHaveBeenCalled();
            });
        });

        describe('isSessionExpired', () => {
            it('should return true if session expired', () => {
                handler.sessionStart = Date.now() - (3600000 + 1000); // Expired
                expect(handler.isSessionExpired()).toBe(true);
            });

            it('should return false if session active', () => {
                handler.sessionStart = Date.now();
                expect(handler.isSessionExpired()).toBe(false);
            });
        });

        describe('simulateReading additional coverage', () => {
             it('should cover look around else block', async () => {
                 mockAgent.config.timings.readingPhase = { mean: 1000, deviation: 0 };
                 mathUtils.gaussian.mockReturnValue(1000); 
                 
                 // Mock roll sequence:
                 // 1. roll(0.15) -> false (scroll)
                 // 2. roll(0.25) -> false (mouse move)
                 // 3. roll(0.15) -> false (type)
                 // 4. roll(0.15) -> true (look around)
                 // 5. roll(0.2) -> false (simple look, trigger else block)
                 mathUtils.roll
                     .mockReturnValueOnce(false)
                     .mockReturnValueOnce(false)
                     .mockReturnValueOnce(false)
                     .mockReturnValueOnce(true)
                     .mockReturnValueOnce(false);
                 
                 await handler.simulateReading();
                 
                 // Verify the else block was hit (simple move)
                 // The else block calls: this.ghost.move(distance, 0, ...)
                 // The if block calls: this.ghost.move(safeX, safeY, ...)
                 // We can distinguish by arguments or just general call
                 expect(mockAgent.ghost.move).toHaveBeenCalled();
             });
        });
    });
});


import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NavigationHandler } from '../../../../utils/twitter-agent/NavigationHandler.js';
import { mathUtils } from '../../../../utils/mathUtils.js';
import { scrollRandom } from '../../../../utils/scroll-helper.js';

// Mock dependencies
vi.mock('../../../../utils/mathUtils.js', () => ({
    mathUtils: {
        roll: vi.fn(),
        randomInRange: vi.fn().mockReturnValue(100),
        random: vi.fn().mockReturnValue(0.5)
    }
}));

vi.mock('../../../../utils/scroll-helper.js', () => ({
    scrollRandom: vi.fn().mockResolvedValue()
}));

describe('NavigationHandler', () => {
    let handler;
    let mockAgent;
    let mockPage;
    let mockLogger;
    let mockHuman;
    let mockGhost;

    beforeEach(() => {
        vi.clearAllMocks();
        mockPage = {
            waitForTimeout: vi.fn().mockResolvedValue(),
            goto: vi.fn().mockResolvedValue(),
            reload: vi.fn().mockResolvedValue(),
            waitForURL: vi.fn().mockResolvedValue(),
            waitForSelector: vi.fn().mockResolvedValue(),
            locator: vi.fn(),
            $$eval: vi.fn(),
            evaluate: vi.fn().mockResolvedValue()
        };

        mockLogger = {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn()
        };

        mockHuman = {
            think: vi.fn().mockResolvedValue(),
            recoverFromError: vi.fn().mockResolvedValue()
        };

        mockGhost = {
            click: vi.fn().mockResolvedValue({ success: true }),
            move: vi.fn().mockResolvedValue()
        };

        mockAgent = {
            page: mockPage,
            config: {},
            logger: mockLogger,
            state: {},
            human: mockHuman,
            ghost: mockGhost,
            mathUtils
        };

        handler = new NavigationHandler(mockAgent);
        
        // Spy on safeHumanClick since it's inherited
        vi.spyOn(handler, 'safeHumanClick').mockResolvedValue();
        vi.spyOn(handler, 'ensureForYouTab').mockResolvedValue();
        vi.spyOn(handler, 'checkAndClickShowPostsButton').mockResolvedValue(true);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('navigateHome', () => {
        it('should navigate via direct URL (10% chance)', async () => {
            mathUtils.roll.mockReturnValue(true); // 10% chance
            
            await handler.navigateHome();
            
            expect(mockPage.goto).toHaveBeenCalledWith('https://x.com/home');
            expect(handler.ensureForYouTab).toHaveBeenCalled();
        });

        it('should handle direct URL failure and fallback to click', async () => {
            handler.mathUtils.roll.mockReturnValue(true);
            mockPage.goto.mockRejectedValue(new Error('Goto failed'));
            
            // Should fall through to click logic
            // Mock click logic
            const mockBtn = { isVisible: vi.fn().mockResolvedValue(true) };
            mockPage.locator.mockReturnValue({ first: () => mockBtn });
            
            await handler.navigateHome();
            
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Direct URL failed'));
            // Should proceed to click logic
            expect(mockPage.locator).toHaveBeenCalled();
        });

        it('should navigate via Home Icon click', async () => {
            vi.spyOn(handler.mathUtils, 'roll').mockReturnValue(false);
            vi.spyOn(Math, 'random').mockReturnValue(0.5); // < 0.8 use home icon
            
            const mockBtn = { isVisible: vi.fn().mockResolvedValue(true) };
            mockPage.locator.mockReturnValue({ first: () => mockBtn });
            
            await handler.navigateHome();
            
            expect(handler.safeHumanClick).toHaveBeenCalledTimes(2); // 2 clicks
            expect(mockPage.waitForURL).toHaveBeenCalledWith('**/home**', expect.any(Object));
            expect(handler.ensureForYouTab).toHaveBeenCalled();
        });

        it('should navigate via X Logo click', async () => {
            vi.spyOn(handler.mathUtils, 'roll').mockReturnValue(false);
            vi.spyOn(Math, 'random').mockReturnValue(0.9); // > 0.8 use X logo
            
            const mockBtn = { isVisible: vi.fn().mockResolvedValue(true) };
            mockPage.locator.mockReturnValue({ first: () => mockBtn });
            
            await handler.navigateHome();
            
            expect(handler.safeHumanClick).toHaveBeenCalledTimes(2);
            expect(mockPage.waitForURL).toHaveBeenCalledWith('**/home**', expect.any(Object));
        });

        it('should switch target if preferred is not visible', async () => {
            vi.spyOn(handler.mathUtils, 'roll').mockReturnValue(false);
            vi.spyOn(Math, 'random').mockReturnValue(0.5); // Prefer Home Icon
            
            const mockHomeBtn = { isVisible: vi.fn().mockResolvedValue(false) };
            const mockXBtn = { isVisible: vi.fn().mockResolvedValue(true) };
            
            mockPage.locator.mockImplementation(sel => {
                if (sel.includes('Home')) return { first: () => mockHomeBtn };
                if (sel.includes('X')) return { first: () => mockXBtn };
                return { first: () => ({ isVisible: vi.fn().mockResolvedValue(false) }) };
            });
            
            await handler.navigateHome();
            
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('not visible'));
            expect(handler.safeHumanClick).toHaveBeenCalledWith(mockXBtn, expect.any(String), expect.any(Number));
        });

        it('should switch target from X Logo to Home Icon if X Logo is not visible', async () => {
            vi.spyOn(handler.mathUtils, 'roll').mockReturnValue(false);
            vi.spyOn(Math, 'random').mockReturnValue(0.9); // Prefer X Logo

            const mockHomeBtn = { isVisible: vi.fn().mockResolvedValue(true) };
            const mockXBtn = { isVisible: vi.fn().mockResolvedValue(false) };

            mockPage.locator.mockImplementation(sel => {
                if (sel.includes('Home')) return { first: () => mockHomeBtn };
                if (sel.includes('X')) return { first: () => mockXBtn };
                return { first: () => ({ isVisible: vi.fn().mockResolvedValue(false) }) };
            });

            await handler.navigateHome();

            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('not visible'));
            expect(handler.safeHumanClick).toHaveBeenCalledWith(mockHomeBtn, expect.any(String), expect.any(Number));
        });

        it('should fallback to native click if ghost click fails', async () => {
            vi.spyOn(handler.mathUtils, 'roll').mockReturnValue(false);
            
            const mockBtn = { 
                isVisible: vi.fn().mockResolvedValue(true),
                click: vi.fn().mockResolvedValue()
            };
            mockPage.locator.mockReturnValue({ first: () => mockBtn });
            
            mockPage.waitForURL.mockRejectedValueOnce(new Error('Timeout')); // Ghost click wait fails
            mockPage.waitForURL.mockResolvedValueOnce(); // Native click wait succeeds
            
            await handler.navigateHome();
            
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Ghost click'));
            expect(mockBtn.click).toHaveBeenCalledTimes(2);
        });

        it('should fallback to direct URL if all interactions fail', async () => {
            vi.spyOn(handler.mathUtils, 'roll').mockReturnValue(false);
            
            const mockBtn = { isVisible: vi.fn().mockResolvedValue(false) };
            mockPage.locator.mockReturnValue({ first: () => mockBtn });
            
            mockPage.locator.mockImplementation(_sel => {
                return { first: () => ({ isVisible: vi.fn().mockResolvedValue(false) }) };
            });
            
            await handler.navigateHome();
            
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('direct URL'));
            expect(mockPage.goto).toHaveBeenCalledWith('https://x.com/home');
        });

        it('should catch and log errors during navigation interactions', async () => {
            vi.spyOn(handler.mathUtils, 'roll').mockReturnValue(false);
            vi.spyOn(Math, 'random').mockReturnValue(0.5); // Home Icon
            
            mockPage.locator.mockImplementation(() => {
                throw new Error('Locator Exploded');
            });
            
            await handler.navigateHome();
            
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Interaction failed'));
            // Should still fallback to direct URL
            expect(mockPage.goto).toHaveBeenCalledWith('https://x.com/home');
        });
    });

    describe('ensureForYouTab', () => {
        beforeEach(() => {
            // Restore spy to test actual method
            handler.ensureForYouTab.mockRestore();
        });

        it('should select "For you" tab via text', async () => {
            const mockTab = {
                textContent: vi.fn().mockResolvedValue('For you'),
                getAttribute: vi.fn().mockResolvedValue('false'), // Not selected
                isVisible: vi.fn().mockResolvedValue(true)
            };
            
            const mockTabs = {
                count: vi.fn().mockResolvedValue(1),
                nth: vi.fn().mockReturnValue(mockTab)
            };
            
            mockPage.locator.mockReturnValue({ 
                locator: vi.fn().mockReturnValue(mockTabs),
                first: vi.fn().mockReturnValue({ locator: vi.fn().mockReturnValue(mockTabs) }) // tablist
            });
            
            await handler.ensureForYouTab();
            
            expect(handler.safeHumanClick).toHaveBeenCalledWith(mockTab, 'For You Tab', 3);
            expect(handler.checkAndClickShowPostsButton).toHaveBeenCalled();
        });

        it('should do nothing if already selected', async () => {
            const mockTab = {
                textContent: vi.fn().mockResolvedValue('For you'),
                getAttribute: vi.fn().mockResolvedValue('true'), // Selected
                isVisible: vi.fn().mockResolvedValue(true)
            };
            
            const mockTabs = {
                count: vi.fn().mockResolvedValue(1),
                nth: vi.fn().mockReturnValue(mockTab)
            };
            
             mockPage.locator.mockReturnValue({ 
                locator: vi.fn().mockReturnValue(mockTabs),
                first: vi.fn().mockReturnValue({ locator: vi.fn().mockReturnValue(mockTabs) })
            });
            
            await handler.ensureForYouTab();
            
            expect(handler.safeHumanClick).not.toHaveBeenCalled();
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('already selected'));
        });

        it('should fallback to index if text not found', async () => {
            const mockTab = {
                textContent: vi.fn().mockResolvedValue('Other'),
                getAttribute: vi.fn().mockResolvedValue('false'),
                isVisible: vi.fn().mockResolvedValue(true)
            };
            
            const mockTabs = {
                count: vi.fn().mockResolvedValue(1),
                nth: vi.fn().mockReturnValue(mockTab)
            };
            
             mockPage.locator.mockReturnValue({ 
                locator: vi.fn().mockReturnValue(mockTabs),
                first: vi.fn().mockReturnValue({ locator: vi.fn().mockReturnValue(mockTabs) })
            });
            
            await handler.ensureForYouTab();
            
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Fallback to index'));
            expect(handler.safeHumanClick).toHaveBeenCalled();
        });

        it('should handle tablist not found', async () => {
            mockPage.waitForSelector.mockRejectedValue(new Error('Timeout'));
            
            await handler.ensureForYouTab();
            
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Tablist not found'));
        });

        it('should fallback to native click if safeHumanClick fails', async () => {
            const mockTab = {
                textContent: vi.fn().mockResolvedValue('For you'),
                getAttribute: vi.fn().mockResolvedValue('false'),
                isVisible: vi.fn().mockResolvedValue(true),
                click: vi.fn().mockResolvedValue()
            };
            
            const mockTabs = {
                count: vi.fn().mockResolvedValue(1),
                nth: vi.fn().mockReturnValue(mockTab)
            };
            
             mockPage.locator.mockReturnValue({ 
                locator: vi.fn().mockReturnValue(mockTabs),
                first: vi.fn().mockReturnValue({ locator: vi.fn().mockReturnValue(mockTabs) })
            });
            
            handler.safeHumanClick.mockRejectedValue(new Error('Fail'));
            
            await handler.ensureForYouTab();
            
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Ghost click failed'));
            expect(mockTab.click).toHaveBeenCalled();
        });

        it('should skip click if target tab is not visible', async () => {
             const mockTab = {
                textContent: vi.fn().mockResolvedValue('For you'),
                getAttribute: vi.fn().mockResolvedValue('false'), // Not selected
                isVisible: vi.fn().mockResolvedValue(false) // Not visible
            };
            
            const mockTabs = {
                count: vi.fn().mockResolvedValue(1),
                nth: vi.fn().mockReturnValue(mockTab)
            };
            
            mockPage.locator.mockReturnValue({ 
                locator: vi.fn().mockReturnValue(mockTabs),
                first: vi.fn().mockReturnValue({ locator: vi.fn().mockReturnValue(mockTabs) })
            });

            await handler.ensureForYouTab();

            expect(handler.safeHumanClick).not.toHaveBeenCalled();
            expect(handler.checkAndClickShowPostsButton).toHaveBeenCalled();
        });

        it('should handle errors in ensureForYouTab', async () => {
            // Mock tablist locator to throw error
            mockPage.locator.mockImplementation(() => {
                throw new Error('Tablist Exploded');
            });
            
            await handler.ensureForYouTab();
            
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Failed to ensure timeline tab: Tablist Exploded'));
        });

        it('should handle case where "For you" tab is not found via text or index', async () => {
            const mockTab = {
                textContent: vi.fn().mockResolvedValue('Other'),
                getAttribute: vi.fn().mockResolvedValue('false'),
                isVisible: vi.fn().mockResolvedValue(true)
            };
            
            const mockTabs = {
                count: vi.fn().mockResolvedValue(0), // No tabs found
                nth: vi.fn().mockReturnValue(mockTab)
            };
            
            mockPage.locator.mockReturnValue({ 
                locator: vi.fn().mockReturnValue(mockTabs),
                first: vi.fn().mockReturnValue({ locator: vi.fn().mockReturnValue(mockTabs) })
            });
            
            await handler.ensureForYouTab();
            
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('not be found via text or index'));
        });
    });

    describe('checkAndClickShowPostsButton', () => {
        beforeEach(() => {
            handler.checkAndClickShowPostsButton.mockRestore();
        });

        it('should click "Show posts" button if found', async () => {
            const mockBtn = {
                count: vi.fn().mockResolvedValue(1),
                isVisible: vi.fn().mockResolvedValue(true),
                textContent: vi.fn().mockResolvedValue('Show 5 posts'),
                evaluate: vi.fn().mockResolvedValue(),
                boundingBox: vi.fn().mockResolvedValue({ x: 0, y: 0, width: 10, height: 10 })
            };
            
            mockPage.locator.mockReturnValue({ first: () => mockBtn });
            
            const result = await handler.checkAndClickShowPostsButton();
            
            expect(result).toBe(true);
            expect(handler.safeHumanClick).toHaveBeenCalledWith(mockBtn, 'Show Posts Button', 3);
            expect(scrollRandom).toHaveBeenCalled();
        });

        it('should return false if button not found', async () => {
            const mockBtn = {
                count: vi.fn().mockResolvedValue(0),
                isVisible: vi.fn().mockResolvedValue(false)
            };
            
            mockPage.locator.mockReturnValue({ first: () => mockBtn });
            
            const result = await handler.checkAndClickShowPostsButton();
            
            expect(result).toBe(false);
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('No "Show X posts" button found'));
        });
        
        it('should skip button if text does not match regex', async () => {
            const mockBtn = {
                count: vi.fn().mockResolvedValue(1),
                isVisible: vi.fn().mockResolvedValue(true),
                textContent: vi.fn().mockResolvedValue('Show random stuff')
            };
            
            mockPage.locator.mockReturnValue({ first: () => mockBtn });
            
            const result = await handler.checkAndClickShowPostsButton();
            
            expect(result).toBe(false);
        });

        it('should handle errors', async () => {
            mockPage.waitForTimeout.mockRejectedValue(new Error('Timeout failed'));
            
            const result = await handler.checkAndClickShowPostsButton();
            
            expect(result).toBe(false);
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Error checking'));
        });
        
         it('should handle null bounding box', async () => {
            const mockBtn = {
                count: vi.fn().mockResolvedValue(1),
                isVisible: vi.fn().mockResolvedValue(true),
                textContent: vi.fn().mockResolvedValue('Show 5 posts'),
                evaluate: vi.fn().mockResolvedValue(),
                boundingBox: vi.fn().mockResolvedValue(null)
            };
            
            mockPage.locator.mockReturnValue({ first: () => mockBtn });
            
            const result = await handler.checkAndClickShowPostsButton();
            
            expect(result).toBe(true);
            expect(mockGhost.move).not.toHaveBeenCalled();
        });
    });
});

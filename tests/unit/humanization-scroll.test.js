
// Mock dependencies
vi.mock('../../utils/mathUtils.js', () => ({
    mathUtils: {
        randomInRange: vi.fn((min) => min),
        gaussian: vi.fn(() => 100),
        roll: vi.fn(() => false),
        sample: vi.fn((arr) => arr ? arr[0] : null)
    }
}));

vi.mock('../../utils/entropyController.js', () => ({
    entropy: {
        reactionTime: vi.fn(() => 100)
    },
    EntropyController: function () {
        return {
            reactionTime: vi.fn(() => 100)
        };
    }
}));

vi.mock('../../utils/global-scroll-controller.js', () => ({
    globalScroll: {
        scrollBy: vi.fn(() => Promise.resolve()),
        scrollDown: vi.fn(() => Promise.resolve()),
        scrollUp: vi.fn(() => Promise.resolve()),
        scrollRandom: vi.fn(() => Promise.resolve()),
        getMultiplier: vi.fn(() => 1.0)
    }
}));

vi.mock('../../utils/scroll-helper.js', () => ({
    scrollRandom: vi.fn(() => Promise.resolve()),
    scrollDown: vi.fn(() => Promise.resolve()),
    scrollUp: vi.fn(() => Promise.resolve()),
    scrollToTop: vi.fn(() => Promise.resolve()),
    scrollToBottom: vi.fn(() => Promise.resolve()),
    getScrollMultiplier: vi.fn(() => 1.0),
    globalScroll: {
        scrollBy: vi.fn(() => Promise.resolve()),
        scrollRandom: vi.fn(() => Promise.resolve())
    }
}));

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HumanScroll } from '../../utils/humanization/scroll.js';
import { mathUtils } from '../../utils/mathUtils.js';
import { entropy } from '../../utils/entropyController.js';
import * as scrollHelper from '../../utils/scroll-helper.js';

describe('HumanScroll', () => {
    let humanScroll;
    let mockPage;
    let mockLogger;

    beforeEach(() => {
        // Reset mocks
        vi.clearAllMocks();

        // Setup mock page
        mockPage = {
            evaluate: vi.fn(),
            waitForTimeout: vi.fn().mockResolvedValue(undefined),
            mouse: {
                wheel: vi.fn().mockResolvedValue(undefined)
            }
        };

        // Setup mock logger
        mockLogger = {
            log: vi.fn(),
            debug: vi.fn(),
            error: vi.fn()
        };

        // Default mock behaviors
        mathUtils.randomInRange.mockImplementation((min, _max) => min); // Return min by default for predictability
        mathUtils.gaussian.mockReturnValue(100);
        mathUtils.roll.mockReturnValue(false); // Default to false for probabilistic branches
        entropy.reactionTime.mockReturnValue(100);

        humanScroll = new HumanScroll(mockPage, mockLogger);
    });

    describe('execute', () => {
        it('should scroll down with normal intensity by default', async () => {
            // Setup
            mathUtils.randomInRange.mockReturnValue(100); // Constant scroll amount

            // Execute
            await humanScroll.execute();

            // Verify
            // Should call scrollRandom at least once
            expect(scrollHelper.scrollRandom).toHaveBeenCalled();
            // Should wait between bursts
            expect(mockPage.waitForTimeout).toHaveBeenCalled();
        });

        it('should handle "up" direction', async () => {
            // Setup
            mathUtils.randomInRange.mockReturnValue(100);

            // Execute
            await humanScroll.execute('up');

            // Verify
            // scrollRandom arguments should be negative for up
            // Since we mocked randomInRange to return 100, and execute uses random variation
            // We just check if it was called. The actual value might vary slightly due to logic.
            expect(scrollHelper.scrollRandom).toHaveBeenCalled();
        });

        it('should respect intensity configurations', async () => {
            // Setup
            // Mock randomInRange to capture the burst count call
            mathUtils.randomInRange.mockImplementation((min, max) => {
                if (min === 2 && max === 4) return 2; // Burst count for default/random
                return 100;
            });

            // Execute
            await humanScroll.execute('down', 'light');

            // Verify
            // Light intensity has specific config (bursts: 2)
            // We verify interaction happened
            expect(scrollHelper.scrollRandom).toHaveBeenCalled();
        });

        it('should log if agent is set', async () => {
            const mockAgent = { log: vi.fn() };
            humanScroll.setAgent(mockAgent);

            await humanScroll.execute();

            expect(mockAgent.log).toHaveBeenCalled();
        });

        it('should handle random direction', async () => {
            vi.spyOn(Math, 'random').mockReturnValue(0.6);

            await humanScroll.execute('random');

            expect(scrollHelper.scrollRandom).toHaveBeenCalled();
        });

        it('should fallback to normal intensity for unknown', async () => {
            mathUtils.randomInRange.mockReturnValue(100);

            await humanScroll.execute('down', 'unknown');

            expect(scrollHelper.scrollRandom).toHaveBeenCalled();
        });

        it('should scroll back slightly on roll when not first burst', async () => {
            mathUtils.randomInRange.mockImplementation((min, max) => {
                if (min === 2 && max === 4) return 2;
                return 100;
            });
            mathUtils.roll.mockReturnValue(true);

            await humanScroll.execute('down', 'normal');

            expect(scrollHelper.scrollRandom).toHaveBeenCalledWith(mockPage, 20, 50);
        });
    });

    describe('toElement', () => {
        let mockLocator;
        let mockElement;
        let mockBox;

        beforeEach(() => {
            mockBox = { x: 0, y: 1000, width: 100, height: 100 };
            mockElement = {
                boundingBox: vi.fn().mockResolvedValue(mockBox)
            };
            mockLocator = {
                first: vi.fn().mockResolvedValue(mockElement)
            };

            // Mock window.innerHeight
            mockPage.evaluate.mockResolvedValue(800); // Viewport height 800, center 400
        });

        it('should scroll to element when it is far away', async () => {
            // Target Y center = 1000 + 50 = 1050
            // Viewport center = 400
            // Distance = 650

            await humanScroll.toElement(mockLocator);

            // Should verify that scrollRandom was called to close the gap
            expect(scrollHelper.scrollRandom).toHaveBeenCalled();
        });

        it('should micro-adjust when already close', async () => {
            // Target Y center = 450 (close to 400)
            mockBox.y = 400;

            await humanScroll.toElement(mockLocator);

            expect(scrollHelper.scrollRandom).toHaveBeenCalled();
        });

        it('should handle missing element gracefully', async () => {
            mockLocator.first.mockResolvedValue(null);

            await humanScroll.toElement(mockLocator);

            expect(scrollHelper.scrollRandom).not.toHaveBeenCalled();
        });

        it('should return when element has no bounding box', async () => {
            mockElement.boundingBox.mockResolvedValue(null);

            await humanScroll.toElement(mockLocator);

            expect(scrollHelper.scrollRandom).not.toHaveBeenCalled();
        });

        it('should fallback to direct scroll on error', async () => {
            mockLocator.first.mockRejectedValue(new Error('Locator error'));

            await humanScroll.toElement(mockLocator);

            // Should call scrollRandom as fallback
            expect(scrollHelper.scrollRandom).toHaveBeenCalledWith(mockPage, 200, 200);
        });
    });

    describe('microAdjustments', () => {
        it('should perform random small scrolls', async () => {
            mathUtils.randomInRange.mockReturnValue(2); // 2 adjustments

            await humanScroll.microAdjustments();

            expect(scrollHelper.scrollRandom).toHaveBeenCalledTimes(2);
            expect(mockPage.waitForTimeout).toHaveBeenCalledTimes(2);
        });
    });

    describe('quickCheck', () => {
        it('should execute light down scroll', async () => {
            const executeSpy = vi.spyOn(humanScroll, 'execute');

            await humanScroll.quickCheck();

            expect(executeSpy).toHaveBeenCalledWith('down', 'light');
        });
    });

    describe('scrollToTop', () => {
        it('should scroll up multiple times', async () => {
            await humanScroll.scrollToTop();

            // 3 quick jumps + 1 fine adjustment = 4 calls
            expect(scrollHelper.scrollRandom).toHaveBeenCalledTimes(4);
        });
    });

    describe('deepScroll', () => {
        it('should perform multiple scroll sessions', async () => {
            mathUtils.randomInRange.mockReturnValue(3);
            mathUtils.roll.mockReturnValue(true);

            await humanScroll.deepScroll();

            expect(scrollHelper.scrollRandom).toHaveBeenCalled();
            expect(mockPage.waitForTimeout).toHaveBeenCalled();
        });
    });
});


import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ContentSkimmer } from '../../utils/humanization/content.js';
import { mathUtils } from '../../utils/mathUtils.js';
import { entropy } from '../../utils/entropyController.js';
import * as scrollHelper from '../../utils/scroll-helper.js';

// Mock dependencies
vi.mock('../../utils/mathUtils.js', () => ({
    mathUtils: {
        randomInRange: vi.fn(),
        gaussian: vi.fn(),
        roll: vi.fn()
    }
}));

vi.mock('../../utils/entropyController.js', () => ({
    entropy: {
        reactionTime: vi.fn()
    }
}));

vi.mock('../../utils/scroll-helper.js', () => ({
    scrollRandom: vi.fn(),
    scrollDown: vi.fn(),
    scrollUp: vi.fn()
}));

describe('ContentSkimmer', () => {
    let contentSkimmer;
    let mockPage;
    let mockLogger;

    beforeEach(() => {
        vi.clearAllMocks();

        mockPage = {
            waitForTimeout: vi.fn().mockResolvedValue(undefined),
            mouse: {
                move: vi.fn().mockResolvedValue(undefined)
            }
        };

        mockLogger = {
            log: vi.fn()
        };

        // Default mock behaviors
        mathUtils.randomInRange.mockImplementation((min, max) => min);
        mathUtils.roll.mockReturnValue(false);

        contentSkimmer = new ContentSkimmer(mockPage, mockLogger);
    });

    describe('skipping', () => {
        it('should skim tweet by default', async () => {
            const spy = vi.spyOn(contentSkimmer, '_skimTweet');
            
            await contentSkimmer.skipping();
            
            expect(spy).toHaveBeenCalled();
        });

        it('should skim thread when type is thread', async () => {
            const spy = vi.spyOn(contentSkimmer, '_skimThread');
            
            await contentSkimmer.skipping('thread');
            
            expect(spy).toHaveBeenCalled();
        });

        it('should skim media when type is media', async () => {
            const spy = vi.spyOn(contentSkimmer, '_skimMedia');
            
            await contentSkimmer.skipping('media');
            
            expect(spy).toHaveBeenCalled();
        });

        it('should skim profile when type is profile', async () => {
            const spy = vi.spyOn(contentSkimmer, '_skimProfile');
            
            await contentSkimmer.skipping('profile');
            
            expect(spy).toHaveBeenCalled();
        });

        it('should use specified duration config', async () => {
            // Mock _skimTweet to check arguments
            const spy = vi.spyOn(contentSkimmer, '_skimTweet');
            
            // duration 'deep' has higher values
            await contentSkimmer.skipping('tweet', 'deep');
            
            // Verify config passed to _skimTweet matches 'deep' config
            // deep: { read: 10000, scroll: 200, pause: 2500 }
            expect(spy).toHaveBeenCalledWith(expect.objectContaining({
                read: 10000,
                scroll: 200,
                pause: 2500
            }));
        });
    });

    describe('reading', () => {
        it('should wait for random read time', async () => {
            mathUtils.randomInRange.mockReturnValue(3000);
            
            await contentSkimmer.reading('normal');
            
            expect(mockPage.waitForTimeout).toHaveBeenCalledWith(3000);
        });

        it('should log if agent is set', async () => {
            const mockAgent = { log: vi.fn() };
            contentSkimmer.setAgent(mockAgent);
            
            await contentSkimmer.reading();
            
            expect(mockAgent.log).toHaveBeenCalled();
        });
    });

    describe('_skimTweet', () => {
        it('should wait, potentially scroll, and micro-adjust', async () => {
            // Enable scroll branch
            mathUtils.roll.mockReturnValue(true);
            
            const config = { read: 100, scroll: 50, pause: 50 };
            
            await contentSkimmer._skimTweet(config);
            
            expect(mockPage.waitForTimeout).toHaveBeenCalled();
            expect(scrollHelper.scrollRandom).toHaveBeenCalled();
            // _microAdjustments calls mouse.move
            expect(mockPage.mouse.move).toHaveBeenCalled();
        });
    });

    describe('skimFeed', () => {
        it('should cycle through feed items', async () => {
            mathUtils.randomInRange.mockReturnValue(2); // 2 cycles
            
            await contentSkimmer.skimFeed();
            
            expect(scrollHelper.scrollRandom).toHaveBeenCalledTimes(2);
            expect(mockPage.waitForTimeout).toHaveBeenCalled();
        });
    });

    describe('deepRead', () => {
        it('should wait for reading period', async () => {
             mathUtils.randomInRange.mockReturnValue(5000);
             
             await contentSkimmer.deepRead();
             
             // Initial wait + reading wait
             expect(mockPage.waitForTimeout).toHaveBeenCalledTimes(2);
        });
    });

    describe('quickGlance', () => {
        it('should wait briefly and move mouse', async () => {
            mathUtils.randomInRange.mockReturnValue(500);
            
            await contentSkimmer.quickGlance();
            
            expect(mockPage.waitForTimeout).toHaveBeenCalled();
            expect(mockPage.mouse.move).toHaveBeenCalled();
        });
    });
});

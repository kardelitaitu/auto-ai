import { describe, it, expect, vi, beforeEach } from 'vitest';
import { scrollHumanizer } from '../../utils/scroll-humanizer.js';
import { humanTiming } from '../../utils/human-timing.js';

vi.mock('../../utils/human-timing.js', () => ({
  humanTiming: {
    randomInRange: vi.fn().mockImplementation((min, max) => (max + min) / 2),
    getScrollPause: vi.fn().mockReturnValue(500),
    humanDelay: vi.fn().mockResolvedValue(undefined)
  }
}));

describe('scroll-humanizer.js', () => {
  let mockPage;
  let mockElement;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockElement = {
      boundingBox: vi.fn().mockResolvedValue({ x: 0, y: 500, width: 100, height: 100 })
    };

    mockPage = {
      evaluate: vi.fn().mockResolvedValue(undefined),
      $: vi.fn().mockResolvedValue(mockElement)
    };
  });

  describe('scrollHumanizer', () => {
    describe('defaults', () => {
      it('should have correct default values', () => {
        expect(scrollHumanizer.defaults.distanceMin).toBe(300);
        expect(scrollHumanizer.defaults.distanceMax).toBe(600);
        expect(scrollHumanizer.defaults.durationMin).toBe(200);
        expect(scrollHumanizer.defaults.durationMax).toBe(500);
        expect(scrollHumanizer.defaults.pauseMin).toBe(1000);
        expect(scrollHumanizer.defaults.pauseMax).toBe(3000);
      });
    });

    describe('getScrollDistance', () => {
      it('should return value within default range', () => {
        const distance = scrollHumanizer.getScrollDistance();
        expect(distance).toBeGreaterThanOrEqual(300);
        expect(distance).toBeLessThanOrEqual(600);
        expect(humanTiming.randomInRange).toHaveBeenCalledWith(300, 600);
      });

      it('should return value within custom range', () => {
        const distance = scrollHumanizer.getScrollDistance({ min: 100, max: 200 });
        expect(distance).toBeGreaterThanOrEqual(100);
        expect(distance).toBeLessThanOrEqual(200);
        expect(humanTiming.randomInRange).toHaveBeenCalledWith(100, 200);
      });
    });

    describe('getScrollDuration', () => {
      it('should return value within default range', () => {
        const duration = scrollHumanizer.getScrollDuration();
        expect(duration).toBeGreaterThanOrEqual(200);
        expect(duration).toBeLessThanOrEqual(500);
        expect(humanTiming.randomInRange).toHaveBeenCalledWith(200, 500);
      });

      it('should return value within custom range', () => {
        const duration = scrollHumanizer.getScrollDuration({ min: 100, max: 300 });
        expect(duration).toBeGreaterThanOrEqual(100);
        expect(duration).toBeLessThanOrEqual(300);
        expect(humanTiming.randomInRange).toHaveBeenCalledWith(100, 300);
      });
    });

    describe('getPauseDuration', () => {
      it('should return value within default range', () => {
        const pause = scrollHumanizer.getPauseDuration();
        expect(pause).toBeDefined();
        expect(humanTiming.getScrollPause).toHaveBeenCalledWith({ min: 1000, max: 3000 });
      });
    });

    describe('naturalScroll', () => {
      it('should scroll down by default (positive deltaY)', async () => {
        await scrollHumanizer.naturalScroll(mockPage);
        expect(mockPage.evaluate).toHaveBeenCalled();
        const args = mockPage.evaluate.mock.calls[0];
        // args[1] is scrollAmount
        expect(args[1]).toBeGreaterThan(0);
      });

      it('should scroll up when direction is up (negative deltaY)', async () => {
        await scrollHumanizer.naturalScroll(mockPage, { direction: 'up' });
        expect(mockPage.evaluate).toHaveBeenCalled();
        const args = mockPage.evaluate.mock.calls[0];
        expect(args[1]).toBeLessThan(0);
      });

      it('should pass duration when smooth is true', async () => {
        await scrollHumanizer.naturalScroll(mockPage, { smooth: true });
        const args = mockPage.evaluate.mock.calls[0];
        expect(args.length).toBe(3); // fn, deltaY, duration
      });

      it('should NOT pass duration when smooth is false', async () => {
        await scrollHumanizer.naturalScroll(mockPage, { smooth: false });
        const args = mockPage.evaluate.mock.calls[0];
        expect(args.length).toBe(2); // fn, deltaY
      });
    });

    describe('scrollWithPause', () => {
      it('should perform scroll with pause', async () => {
        const pause = await scrollHumanizer.scrollWithPause(mockPage);
        expect(pause).toBeDefined();
        expect(mockPage.evaluate).toHaveBeenCalled();
        expect(humanTiming.humanDelay).toHaveBeenCalled();
      });
    });

    describe('scrollMultiple', () => {
      it('should scroll multiple times and pause between them', async () => {
        const count = 3;
        await scrollHumanizer.scrollMultiple(mockPage, count);
        
        // Should call naturalScroll (via scrollWithPause) 'count' times
        expect(mockPage.evaluate).toHaveBeenCalledTimes(count);
        
        // Should call humanDelay for pause after each scroll (inside scrollWithPause)
        // PLUS humanDelay between scrolls (count - 1 times)
        // Total humanDelay calls = count + (count - 1) = 2*count - 1
        expect(humanTiming.humanDelay).toHaveBeenCalledTimes(2 * count - 1);
      });
    });

    describe('scrollToElement', () => {
      it('should scroll to element if found', async () => {
        const result = await scrollHumanizer.scrollToElement(mockPage, '#target');
        expect(mockPage.$).toHaveBeenCalledWith('#target');
        expect(mockElement.boundingBox).toHaveBeenCalled();
        expect(mockPage.evaluate).toHaveBeenCalled(); // The scroll action
        expect(result).toBe(true);
      });

      it('should return false if element not found', async () => {
        mockPage.$ = vi.fn().mockResolvedValue(null);
        // Pass a small timeout to avoid long waits
        const result = await scrollHumanizer.scrollToElement(mockPage, '#target', { timeout: 100 });
        expect(result).toBe(false);
      });

      it('should retry if element not found initially', async () => {
        mockPage.$ = vi.fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(mockElement);
          
        const result = await scrollHumanizer.scrollToElement(mockPage, '#target', { timeout: 1000 });
        expect(mockPage.$).toHaveBeenCalledTimes(2);
        expect(result).toBe(true);
      });
    });

    describe('scrollToTop', () => {
      it('should scroll to top of page', async () => {
        await scrollHumanizer.scrollToTop(mockPage);
        expect(mockPage.evaluate).toHaveBeenCalled();
      });
    });

    describe('scrollToBottom', () => {
      it('should scroll to bottom of page', async () => {
        await scrollHumanizer.scrollToBottom(mockPage);
        expect(mockPage.evaluate).toHaveBeenCalled();
      });
    });

    describe('getScrollPosition', () => {
      it('should return scroll position object', async () => {
        mockPage.evaluate = vi.fn().mockResolvedValue({
          y: 100,
          x: 0,
          height: 800,
          scrollHeight: 2000,
          percent: 10
        });
        
        const position = await scrollHumanizer.getScrollPosition(mockPage);
        expect(position.y).toBe(100);
        expect(position.x).toBe(0);
        expect(position.height).toBe(800);
        expect(position.scrollHeight).toBe(2000);
        expect(position.percent).toBe(10);
      });
    });

    describe('scrollUntil', () => {
      it('should stop scrolling when condition is met', async () => {
        // Sequence of calls:
        // 1. getScrollPosition -> { y: 0 }
        // 2. scrollWithPause -> naturalScroll -> page.evaluate(...) -> undefined
        // 3. getScrollPosition -> { y: 100 }
        // 4. scrollWithPause -> naturalScroll -> page.evaluate(...) -> undefined
        // 5. getScrollPosition -> { y: 200 } -> Condition Met
        
        mockPage.evaluate = vi.fn()
          .mockResolvedValueOnce({ y: 0 })
          .mockResolvedValueOnce(undefined)
          .mockResolvedValueOnce({ y: 100 })
          .mockResolvedValueOnce(undefined)
          .mockResolvedValueOnce({ y: 200 });

        const conditionFn = vi.fn().mockImplementation(pos => pos.y >= 200);
        
        const result = await scrollHumanizer.scrollUntil(mockPage, conditionFn);
        
        expect(result.success).toBe(true);
        expect(result.scrolls).toBe(2);
        expect(result.position.y).toBe(200);
      });

      it('should return failure if maxScrolls reached', async () => {
         mockPage.evaluate = vi.fn().mockResolvedValue({ y: 0 }); // Always 0, will handle both calls effectively as they are compatible with this return (naturalScroll ignores return)
         // Actually naturalScroll returns undefined usually, but if we return object it doesn't hurt as long as code doesn't crash.
         // But wait, naturalScroll implementation:
         /*
            await page.evaluate(...)
         */
         // It doesn't use the return value of evaluate.
         
         // getScrollPosition implementation:
         /*
            return await page.evaluate(...)
         */
         // It uses the return value.
         
         // So if we mock mockResolvedValue({ y: 0 }), naturalScroll will receive that too but ignore it.
         // getScrollPosition will receive it and work.
         // So this single mock is fine for this loop.
         
         const conditionFn = () => false;
         const result = await scrollHumanizer.scrollUntil(mockPage, conditionFn, { maxScrolls: 2 });
         
         expect(result.success).toBe(false);
         expect(result.scrolls).toBe(2);
      });
    });

    describe('calculateScrollProgress', () => {
      it('should return 100 when scroll height is less than viewport', () => {
        const progress = scrollHumanizer.calculateScrollProgress({
          scrollHeight: 500,
          height: 800,
          percent: 0
        });
        expect(progress).toBe(100);
      });

      it('should calculate percentage correctly', () => {
        const progress = scrollHumanizer.calculateScrollProgress({
          scrollHeight: 2000,
          height: 800,
          percent: 50
        });
        expect(progress).toBe(50);
      });

      it('should clamp to 0-100 range', () => {
        const progress = scrollHumanizer.calculateScrollProgress({
          scrollHeight: 2000,
          height: 800,
          percent: 150
        });
        expect(progress).toBe(100);
      });
    });
  });
});

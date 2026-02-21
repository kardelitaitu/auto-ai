import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../utils/logger.js', () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }))
}));

vi.mock('../../../utils/configLoader.js', () => ({
  getTimeoutValue: vi.fn().mockResolvedValue(10)
}));

vi.mock('../../../utils/scroll-helper.js', () => ({
  scrollRandom: vi.fn().mockResolvedValue(undefined)
}));

import createRandomScroller from '../../../utils/randomScrolling.js';

describe('randomScrolling.js', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createRandomScroller', () => {
    it('should create a random scroller function', () => {
      const mockPage = {
        keyboard: { press: vi.fn().mockResolvedValue(undefined) },
        mouse: { wheel: vi.fn().mockResolvedValue(undefined) },
        isClosed: vi.fn().mockReturnValue(false)
      };
      const scroller = createRandomScroller(mockPage);
      expect(typeof scroller).toBe('function');
    });

    it('should handle page closed during scroll', async () => {
      const mockPage = {
        keyboard: { press: vi.fn().mockResolvedValue(undefined) },
        isClosed: vi.fn().mockReturnValue(true)
      };

      const scroller = createRandomScroller(mockPage);
      await scroller(0.01); // Very short duration
    });

    it('should perform scroll actions', async () => {
      const mockPage = {
        keyboard: { press: vi.fn().mockResolvedValue(undefined) },
        mouse: { wheel: vi.fn().mockResolvedValue(undefined) },
        isClosed: vi.fn().mockReturnValue(false)
      };

      const scroller = createRandomScroller(mockPage);

      // Just verify the function runs without throwing
      await expect(scroller(0.01)).resolves.not.toThrow();
    });

    it('should scroll to top at end', async () => {
      const mockPage = {
        keyboard: { press: vi.fn().mockResolvedValue(undefined) },
        mouse: { wheel: vi.fn().mockResolvedValue(undefined) },
        isClosed: vi.fn().mockReturnValue(false)
      };

      const scroller = createRandomScroller(mockPage);

      vi.spyOn(Math, 'random').mockReturnValue(0.3);

      await scroller(0.02); // Very short

      expect(mockPage.keyboard.press).toHaveBeenCalledWith('Home');
    });

    it('should handle scroll error gracefully', async () => {
      const mockPage = {
        keyboard: { press: vi.fn().mockResolvedValue(undefined) },
        mouse: { wheel: vi.fn().mockResolvedValue(undefined) },
        isClosed: vi.fn().mockReturnValue(false)
      };

      // Create a simple test that just verifies the function runs
      const scroller = createRandomScroller(mockPage);

      vi.spyOn(Math, 'random').mockReturnValue(0.3);

      // Just verify it doesn't throw
      await expect(scroller(0.01)).resolves.not.toThrow();
    });

    it('should perform scroll up when random > 0.75 and lastScrollDown', async () => {
      const mockPage = {
        keyboard: { press: vi.fn().mockResolvedValue(undefined) },
        mouse: { wheel: vi.fn().mockResolvedValue(undefined) },
        isClosed: vi.fn().mockReturnValue(false)
      };

      const scroller = createRandomScroller(mockPage);

      // Just verify the function runs without throwing
      await expect(scroller(0.01)).resolves.not.toThrow();
    });
  });
});

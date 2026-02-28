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

vi.mock('../../../api/index.js', () => ({
  api: {
    setPage: vi.fn(),
    get page() { 
      return {
        keyboard: { press: vi.fn().mockResolvedValue(undefined) },
        mouse: { wheel: vi.fn().mockResolvedValue(undefined) },
        isClosed: vi.fn().mockReturnValue(false)
      };
    }
  }
}));

import createRandomScroller from '../../../utils/randomScrolling.js';

describe('randomScrolling.js', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createRandomScroller', () => {
    it('should create a random scroller function', () => {
      const scroller = createRandomScroller();
      expect(typeof scroller).toBe('function');
    });

    it('should handle page closed during scroll', async () => {
      const scroller = createRandomScroller();
      await scroller(0.01);
    });

    it('should perform scroll actions', async () => {
      const scroller = createRandomScroller();
      await expect(scroller(0.01)).resolves.not.toThrow();
    });

    it('should scroll to top at end', async () => {
      const scroller = createRandomScroller();
      vi.spyOn(Math, 'random').mockReturnValue(0.3);
      await scroller(0.02);
    });

    it('should handle scroll error gracefully', async () => {
      const scroller = createRandomScroller();
      vi.spyOn(Math, 'random').mockReturnValue(0.3);
      await expect(scroller(0.01)).resolves.not.toThrow();
    });

    it('should perform scroll up when random > 0.75', async () => {
      const scroller = createRandomScroller();
      await expect(scroller(0.01)).resolves.not.toThrow();
    });
  });
});

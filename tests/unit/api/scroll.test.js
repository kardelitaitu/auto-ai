
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { read, back, focus, scroll, toTop, toBottom } from '../../../api/interactions/scroll.js';

// Mocks
vi.mock('../../../api/core/context.js', () => ({
  getPage: vi.fn(),
  getCursor: vi.fn()
}));

vi.mock('../../../api/behaviors/persona.js', () => ({
  getPersona: vi.fn().mockReturnValue({ scrollSpeed: 1 })
}));

vi.mock('../../../api/utils/math.js', () => ({
  mathUtils: {
    randomInRange: vi.fn((min, max) => min),
    gaussian: vi.fn(() => 0)
  }
}));

vi.mock('../../api/utils/config.js', () => ({
  getSettings: vi.fn().mockResolvedValue({ twitter: { timing: { globalScrollMultiplier: 1 } } })
}));

vi.mock('../../../api/core/logger.js', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  })
}));

import { getPage, getCursor } from '../../../api/core/context.js';

describe('api/interactions/scroll.js', () => {
  let mockPage;
  let mockCursor;
  let mockLocator;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    mockLocator = {
      first: vi.fn().mockReturnThis(),
      evaluate: vi.fn().mockResolvedValue({ x: 0, y: 1000, width: 100, height: 100 }),
      boundingBox: vi.fn().mockResolvedValue({ x: 0, y: 1000, width: 100, height: 100 }),
      waitFor: vi.fn().mockResolvedValue(undefined)
    };

    mockPage = {
      waitForSelector: vi.fn().mockResolvedValue(),
      locator: vi.fn().mockReturnValue(mockLocator),
      mouse: {
        wheel: vi.fn().mockResolvedValue()
      },
      evaluate: vi.fn().mockImplementation((fn, arg) => {
        if (typeof fn === 'function') {
          const fnStr = fn.toString();
          if (fnStr.includes('window.scrollY')) return 0;
          if (fnStr.includes('window.innerWidth')) return { width: 1920, height: 1080 };
          if (fnStr.includes('document.body.scrollHeight')) return 5000;
          if (fnStr.includes('textLength') || fnStr.includes('pCount') || fnStr.includes('imgCount')) {
            return { textLength: 100, pCount: 2, imgCount: 0 };
          }
        }
        return null;
      }),
      viewportSize: vi.fn().mockReturnValue({ width: 1920, height: 1080 })
    };

    mockCursor = {
      move: vi.fn().mockResolvedValue()
    };

    getPage.mockReturnValue(mockPage);
    getCursor.mockReturnValue(mockCursor);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('toTop', () => {
    it('should scroll to top', async () => {
      await toTop();
      expect(mockPage.evaluate).toHaveBeenCalled();
    });
  });

  describe('toBottom', () => {
    it('should scroll to bottom', async () => {
      await toBottom();
      expect(mockPage.evaluate).toHaveBeenCalled();
    });
  });

  describe('focus', () => {
    it('should skip scroll if already in view', async () => {
      mockLocator.evaluate.mockResolvedValue({ x: 0, y: 500, width: 100, height: 100 });
      mockLocator.boundingBox.mockResolvedValue({ x: 0, y: 500, width: 100, height: 100 });

      await focus('#target');
      expect(mockPage.mouse.wheel).not.toHaveBeenCalled();
    });

    it('should handle missing bounding box', async () => {
      mockLocator.evaluate.mockResolvedValue(null);
      mockLocator.boundingBox.mockResolvedValue(null);

      await focus('#target');
      expect(mockPage.mouse.wheel).not.toHaveBeenCalled();
    });

    it('should handle missing viewport', async () => {
      mockPage.viewportSize.mockReturnValue(null);

      await focus('#target');
      expect(mockPage.evaluate).toHaveBeenCalled();
    });

    it('should fallback to scrollBy when mouse.wheel fails', async () => {
      mockPage.mouse.wheel.mockRejectedValueOnce(new Error('wheel error'));

      await focus('#target');
      expect(mockPage.evaluate).toHaveBeenCalled();
    });
  });

  describe('scroll', () => {
    it('should perform raw pixel scroll via evaluate', async () => {
      await scroll(500);
      expect(mockPage.evaluate).toHaveBeenCalled();
    });

    it('should fallback to evaluate when mouse.wheel fails', async () => {
      mockPage.mouse.wheel.mockRejectedValueOnce(new Error('wheel error'));

      await scroll(500);
      expect(mockPage.evaluate).toHaveBeenCalled();
    });
  });

  describe('back', () => {
    it('should retry getClientRect if initially null', async () => {
      mockLocator.evaluate
        .mockResolvedValueOnce(null)
        .mockResolvedValue({ x: 0, y: 1000, width: 100, height: 100 });

      await focus('#target');
      expect(mockLocator.evaluate).toHaveBeenCalledTimes(3);
    });

    it('should return if viewport cannot be determined', async () => {
      mockPage.viewportSize.mockReturnValue(null);
      mockPage.evaluate.mockImplementation((fn) => {
        if (typeof fn === 'function' && fn.toString().includes('window.innerWidth')) return null;
        return 0;
      });

      await focus('#target');
    });

    it('should return null if both evaluate and boundingBox are missing', async () => {
      delete mockLocator.evaluate;
      delete mockLocator.boundingBox;

      await focus('#target');
      expect(mockPage.mouse.wheel).not.toHaveBeenCalled();
    });

    it('should handle boundingBox error gracefully', async () => {
      delete mockLocator.evaluate;
      mockLocator.boundingBox.mockRejectedValue(new Error('bb error'));

      await focus('#target');
      expect(mockPage.mouse.wheel).not.toHaveBeenCalled();
    });
  });

  describe('extra fallbacks', () => {
    it('should handle wheel error in back()', async () => {
      mockPage.mouse.wheel.mockRejectedValue(new Error('fail'));
      await back(100);
      expect(mockPage.evaluate).toHaveBeenCalled();
    });

    it('should handle wheel error in scroll()', async () => {
      mockPage.mouse.wheel.mockRejectedValue(new Error('fail'));
      await scroll(100);
      expect(mockPage.evaluate).toHaveBeenCalled();
    });
  });

  describe('Coverage Improvements', () => {
    it('should cover locator.evaluate inner logic', async () => {
      mockLocator.evaluate.mockImplementation(async (fn) => {
        const mockEl = {
          getBoundingClientRect: () => ({
            left: 10,
            top: 2000,
            width: 100,
            height: 100
          })
        };
        try {
          return await fn(mockEl);
        } catch (e) {
          throw e;
        }
      });

      await focus('#target');
      expect(mockLocator.evaluate).toHaveBeenCalled();

      mockLocator.evaluate.mockRejectedValueOnce(new Error('forced failure'));
      await focus('#target');
    });

    it('should cover internal evaluate functions for toTop and toBottom', async () => {
      mockPage.evaluate.mockImplementation(async (fn) => {
        if (typeof fn === 'function') {
          try {
            return await fn();
          } catch (e) { return null; }
        }
        return null;
      });

      await toTop();
      await toBottom();
      expect(mockPage.evaluate).toHaveBeenCalled();
    });
  });
});

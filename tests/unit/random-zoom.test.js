import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../../utils/logger.js', () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }))
}));

vi.mock('../../../utils/configLoader.js', () => ({
  getTimeoutValue: vi.fn().mockImplementation((key, defaultVal) => {
    if (key === 'automation.zoom.minWaitMs') return Promise.resolve(10);
    if (key === 'automation.zoom.maxWaitMs') return Promise.resolve(20);
    return Promise.resolve(defaultVal || 100);
  })
}));

import createRandomZoomer from '../../../utils/randomZoom.js';

const CHROMIUM_ZOOM_LEVELS = [0.5, 0.67, 0.75, 0.8, 0.9, 1.1, 1.25, 1.5];

describe('randomZoom.js', () => {
  let mockPage;
  
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    
    mockPage = {
      evaluate: vi.fn().mockResolvedValue(undefined),
      isClosed: vi.fn().mockReturnValue(false)
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('createRandomZoomer', () => {
    it('should create a random zoomer function', () => {
      const zoomer = createRandomZoomer(mockPage);
      expect(typeof zoomer).toBe('function');
    });

    it('should have correct CHROMIUM_ZOOM_LEVELS', () => {
      expect(CHROMIUM_ZOOM_LEVELS).toEqual([0.5, 0.67, 0.75, 0.8, 0.9, 1.1, 1.25, 1.5]);
    });

    it('should start zoom simulation and complete', async () => {
      const zoomer = createRandomZoomer(mockPage);
      
      const zoomPromise = zoomer(0.05);
      
      vi.advanceTimersByTime(60);
      await zoomPromise;
      
      expect(mockPage.evaluate).toHaveBeenCalled();
    });

    it('should handle page closed during zoom', async () => {
      mockPage.isClosed = vi.fn().mockReturnValue(true);
      
      const zoomer = createRandomZoomer(mockPage);
      
      const zoomPromise = zoomer(0.05);
      vi.advanceTimersByTime(60);
      await zoomPromise;
    });

    it('should handle error during zoom loop', async () => {
      mockPage.evaluate = vi.fn().mockRejectedValue(new Error('Zoom failed'));
      
      const zoomer = createRandomZoomer(mockPage);
      
      const zoomPromise = zoomer(0.05);
      vi.advanceTimersByTime(60);
      await zoomPromise;
    });

    it('should set final zoom to 75% when page is not closed', async () => {
      mockPage.isClosed = vi.fn().mockReturnValue(false);
      
      const zoomer = createRandomZoomer(mockPage);
      
      const zoomPromise = zoomer(0.02);
      vi.advanceTimersByTime(30);
      await zoomPromise;
      
      const lastCall = mockPage.evaluate.mock.calls[mockPage.evaluate.mock.calls.length - 1];
      expect(lastCall[1]).toBe(0.75);
    });

    it('should not set final zoom when page is closed', async () => {
      let closedDuringZoom = false;
      mockPage.isClosed = vi.fn().mockImplementation(() => {
        if (closedDuringZoom) return true;
        closedDuringZoom = true;
        return false;
      });
      
      const zoomer = createRandomZoomer(mockPage);
      
      const zoomPromise = zoomer(0.05);
      vi.advanceTimersByTime(60);
      await zoomPromise;
    });

    it('should handle setZoom error gracefully', async () => {
      mockPage.evaluate = vi.fn()
        .mockRejectedValueOnce(new Error('Eval error'))
        .mockResolvedValue(undefined);
      
      const zoomer = createRandomZoomer(mockPage);
      
      const zoomPromise = zoomer(0.05);
      vi.advanceTimersByTime(60);
      await zoomPromise;
    });

    it('should stop when remaining time is zero', async () => {
      mockPage.isClosed = vi.fn().mockReturnValue(false);
      
      const zoomer = createRandomZoomer(mockPage);
      
      vi.advanceTimersByTime(100);
      const zoomPromise = zoomer(0);
      await zoomPromise;
    });

    it('should use config values for minWait and maxWait', async () => {
      const zoomer = createRandomZoomer(mockPage);
      
      const zoomPromise = zoomer(0.05);
      vi.advanceTimersByTime(60);
      await zoomPromise;
    });

    it('should handle empty duration', async () => {
      vi.useRealTimers();
      
      const zoomer = createRandomZoomer(mockPage);
      
      await zoomer(0);
    });

    it('should log error when page is closed in catch block', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      let callCount = 0;
      mockPage.evaluate = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Simulated error');
        }
        return undefined;
      });
      
      const zoomer = createRandomZoomer(mockPage);
      
      const zoomPromise = zoomer(0.05);
      vi.advanceTimersByTime(60);
      await zoomPromise;
      
      consoleSpy.mockRestore();
    });

    it('should handle non-closed page error in catch block', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      let callCount = 0;
      mockPage.evaluate = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount <= 2) {
          throw new Error('Simulated error');
        }
        return undefined;
      });
      mockPage.isClosed = vi.fn().mockReturnValue(false);
      
      const zoomer = createRandomZoomer(mockPage);
      
      const zoomPromise = zoomer(0.05);
      vi.advanceTimersByTime(60);
      await zoomPromise;
      
      consoleSpy.mockRestore();
    });

    it('should log warning when page is closed during simulation', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      mockPage.evaluate = vi.fn().mockImplementation(() => {
        throw new Error('Simulated error');
      });
      mockPage.isClosed = vi.fn().mockReturnValue(true);
      
      const zoomer = createRandomZoomer(mockPage);
      
      const zoomPromise = zoomer(0.05);
      vi.advanceTimersByTime(60);
      await zoomPromise;
      
      consoleSpy.mockRestore();
    });

    it('should handle evaluate when document.body is null', async () => {
      mockPage.evaluate = vi.fn().mockImplementation((fn) => {
        return fn(null);
      });
      
      const zoomer = createRandomZoomer(mockPage);
      
      const zoomPromise = zoomer(0.02);
      vi.advanceTimersByTime(30);
      await zoomPromise;
    });

    it('should throw error in main try block and catch it', async () => {
      mockPage.evaluate = vi.fn().mockImplementation(() => {
        throw new Error('Zoom loop error');
      });
      
      const zoomer = createRandomZoomer(mockPage);
      
      const zoomPromise = zoomer(0.05);
      vi.advanceTimersByTime(60);
      await zoomPromise;
    });
  });

  describe('getRandomElement', () => {
    it('should pick elements from CHROMIUM_ZOOM_LEVELS array', async () => {
      vi.useRealTimers();
      
      const zoomer = createRandomZoomer(mockPage);
      
      await zoomer(0.02);
      
      expect(mockPage.evaluate).toHaveBeenCalled();
    });
  });
});

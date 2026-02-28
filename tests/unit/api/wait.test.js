
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  wait, 
  waitFor, 
  waitVisible, 
  waitHidden, 
  waitForLoadState, 
  waitForURL 
} from '../../../api/interactions/wait.js';

// Mocks
vi.mock('../../../api/core/context.js', () => ({
  getPage: vi.fn(),
  getCursor: vi.fn(),
  checkSession: vi.fn()
}));

vi.mock('../../../api/utils/locator.js', () => ({
  getLocator: vi.fn((selector) => ({
    waitFor: vi.fn().mockResolvedValue(undefined),
    isVisible: vi.fn().mockResolvedValue(true)
  }))
}));

import { getPage, getCursor, checkSession } from '../../../api/core/context.js';
import { getLocator } from '../../../api/utils/locator.js';

describe('api/interactions/wait.js', () => {
  let mockPage;

  beforeEach(() => {
    vi.clearAllMocks();

    const mockLocator = {
      waitFor: vi.fn().mockResolvedValue(undefined),
      isVisible: vi.fn().mockResolvedValue(true)
    };

    mockPage = {
      waitForSelector: vi.fn().mockResolvedValue(),
      waitForLoadState: vi.fn().mockResolvedValue(),
      waitForURL: vi.fn().mockResolvedValue(),
      locator: vi.fn().mockReturnValue(mockLocator),
      url: vi.fn().mockReturnValue('http://test.com')
    };

    getPage.mockReturnValue(mockPage);
    getCursor.mockReturnValue({});
    checkSession.mockReturnValue(undefined);
  });

  describe('wait', () => {
    it('should wait for specified duration with jitter', async () => {
      vi.useFakeTimers();
      const promise = wait(100);
      
      // Should not resolve immediately
      await Promise.resolve();
      
      // Fast forward time
      vi.advanceTimersByTime(150); // 100 + max jitter 15 = 115
      
      await promise;
      vi.useRealTimers();
    });
  });

  describe('waitFor', () => {
    let mockLocator;

    beforeEach(() => {
      mockLocator = {
        waitFor: vi.fn().mockResolvedValue(undefined),
        isVisible: vi.fn().mockResolvedValue(true)
      };
      getLocator.mockReturnValue(mockLocator);
    });

    it('should wait for attached selector', async () => {
      await waitFor('#selector', { timeout: 5000 });
      expect(mockLocator.waitFor).toHaveBeenCalledWith({ 
        state: 'attached', 
        timeout: 5000 
      });
    });

    it('should use default timeout', async () => {
      await waitFor('#selector');
      expect(mockLocator.waitFor).toHaveBeenCalledWith({ 
        state: 'attached', 
        timeout: 10000 
      });
    });

    it('should wait with timeout option', async () => {
      await waitFor('#selector', { timeout: 3000 });
      expect(mockLocator.waitFor).toHaveBeenCalledWith({ 
        state: 'attached', 
        timeout: 3000 
      });
    });

    it('should waitFor with state visible', async () => {
      await waitFor('#selector', { timeout: 5000, state: 'visible' });
      expect(mockLocator.waitFor).toHaveBeenCalledWith({ 
        state: 'visible', 
        timeout: 5000 
      });
    });

    it('should waitFor with state hidden', async () => {
      await waitFor('#selector', { timeout: 5000, state: 'hidden' });
      expect(mockLocator.waitFor).toHaveBeenCalledWith({ 
        state: 'hidden', 
        timeout: 5000 
      });
    });

    it('should waitFor with immediate return when element already in desired state', async () => {
      mockLocator.waitFor.mockResolvedValueOnce(undefined);
      await waitFor('#selector', { timeout: 5000, state: 'attached' });
      expect(mockLocator.waitFor).toHaveBeenCalledWith({ 
        state: 'attached', 
        timeout: 5000 
      });
    });

    it('should throw on waitFor timeout', async () => {
      mockLocator.waitFor.mockRejectedValueOnce(new Error('Timeout'));
      await expect(waitFor('#selector', { timeout: 100 })).rejects.toThrow();
    });
  });

  describe('waitVisible', () => {
    let mockLocator;

    beforeEach(() => {
      mockLocator = {
        waitFor: vi.fn().mockResolvedValue(undefined),
        isVisible: vi.fn().mockResolvedValue(true)
      };
      getLocator.mockReturnValue(mockLocator);
    });

    it('should wait for visible selector', async () => {
      await waitVisible('#selector');
      expect(mockLocator.waitFor).toHaveBeenCalledWith({ 
        state: 'visible', 
        timeout: 10000 
      });
    });

    it('should use custom timeout for waitVisible', async () => {
      await waitVisible('#selector', { timeout: 5000 });
      expect(mockLocator.waitFor).toHaveBeenCalledWith({ 
        state: 'visible', 
        timeout: 5000 
      });
    });
  });

  describe('waitHidden', () => {
    let mockLocator;

    beforeEach(() => {
      mockLocator = {
        waitFor: vi.fn().mockResolvedValue(undefined),
        isVisible: vi.fn().mockResolvedValue(true)
      };
      getLocator.mockReturnValue(mockLocator);
    });

    it('should wait for hidden selector', async () => {
      await waitHidden('#selector');
      expect(mockLocator.waitFor).toHaveBeenCalledWith({ 
        state: 'hidden', 
        timeout: 10000 
      });
    });

    it('should use custom timeout for waitHidden', async () => {
      await waitHidden('#selector', { timeout: 5000 });
      expect(mockLocator.waitFor).toHaveBeenCalledWith({ 
        state: 'hidden', 
        timeout: 5000 
      });
    });
  });

  describe('waitForLoadState', () => {
    it('should wait for load state', async () => {
      await waitForLoadState('networkidle');
      expect(mockPage.waitForLoadState).toHaveBeenCalledWith('networkidle', { timeout: 10000 });
    });
  });

  describe('waitForURL', () => {
    it('should wait for URL', async () => {
      await waitForURL('http://example.com');
      expect(mockPage.waitForURL).toHaveBeenCalledWith('http://example.com', { 
        timeout: 10000,
        waitUntil: undefined
      });
    });

    it('should wait for URL with waitUntil option', async () => {
      await waitForURL('http://example.com', { waitUntil: 'networkidle' });
      expect(mockPage.waitForURL).toHaveBeenCalledWith('http://example.com', { 
        timeout: 10000,
        waitUntil: 'networkidle'
      });
    });

    it('should wait for URL with custom timeout', async () => {
      await waitForURL('http://example.com', { timeout: 5000 });
      expect(mockPage.waitForURL).toHaveBeenCalledWith('http://example.com', { 
        timeout: 5000,
        waitUntil: undefined
      });
    });

    it('should throw on waitForURL timeout', async () => {
      mockPage.waitForURL.mockRejectedValueOnce(new Error('URL timeout'));
      await expect(waitForURL('http://example.com')).rejects.toThrow();
    });
  });

  describe('waitForLoadState', () => {
    it('should wait for load state', async () => {
      await waitForLoadState('networkidle');
      expect(mockPage.waitForLoadState).toHaveBeenCalledWith('networkidle', { timeout: 10000 });
    });

    it('should wait for load state with custom timeout', async () => {
      await waitForLoadState('domcontentloaded', { timeout: 5000 });
      expect(mockPage.waitForLoadState).toHaveBeenCalledWith('domcontentloaded', { timeout: 5000 });
    });

    it('should throw on load state error', async () => {
      mockPage.waitForLoadState.mockRejectedValueOnce(new Error('Load failed'));
      await expect(waitForLoadState('networkidle')).rejects.toThrow();
    });
  });
});

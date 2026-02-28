
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  withPage,
  isSessionActive,
  checkSession,
  getPage,
  getCursor,
  getEvents,
  getPlugins,
  evalPage,
  clearContext
} from '../../../api/core/context.js';
import { loggerContext } from '../../../api/core/logger.js';

vi.mock('../../../api/core/logger.js', () => ({
  loggerContext: {
    getStore: vi.fn(),
    run: vi.fn((ctx, fn) => fn())
  }
}));

vi.mock('../../../api/utils/ghostCursor.js', () => ({
  GhostCursor: vi.fn()
}));

vi.mock('../../../api/core/context-state.js', () => ({
  getDefaultState: vi.fn().mockReturnValue({}),
  setContextStore: vi.fn()
}));

vi.mock('../../../api/core/events.js', () => ({
  APIEvents: vi.fn()
}));

vi.mock('../../../api/core/plugins/manager.js', () => ({
  PluginManager: vi.fn()
}));

describe('api/core/context.js', () => {
  let mockPage;

  beforeEach(() => {
    vi.clearAllMocks();
    clearContext();

    mockPage = {
      isClosed: vi.fn().mockReturnValue(false),
      context: vi.fn().mockReturnValue({
        browser: vi.fn().mockReturnValue({
          isConnected: vi.fn().mockReturnValue(true)
        })
      }),
      evaluate: vi.fn().mockResolvedValue('result')
    };
  });

  describe('withPage / getPage', () => {
    it('should set and get page via withPage', async () => {
      await withPage(mockPage, async () => {
        expect(getPage()).toBe(mockPage);
      });
    });

    it('should throw if page is invalid', async () => {
      await expect(withPage(null, async () => {})).rejects.toThrow('withPage requires a valid Playwright page instance');
    });

    it('should throw if page is closed', async () => {
      mockPage.isClosed.mockReturnValue(true);
      await expect(
        withPage(mockPage, async () => {
          getPage();
        })
      ).rejects.toThrow();
    });
  });

  describe('isSessionActive', () => {
    it('should return true if session is active', async () => {
      await withPage(mockPage, async () => {
        expect(isSessionActive()).toBe(true);
      });
    });

    it('should return false if no page', async () => {
      clearContext();
      expect(isSessionActive()).toBe(false);
    });

    it('should return false if page closed', async () => {
      mockPage.isClosed.mockReturnValue(true);
      await withPage(mockPage, async () => {
        expect(isSessionActive()).toBe(false);
      });
    });

    it('should return false when browser is disconnected', async () => {
      await withPage(mockPage, async () => {
        mockPage.context.mockReturnValue({
          browser: vi.fn().mockReturnValue({
            isConnected: vi.fn().mockReturnValue(false)
          })
        });
        expect(isSessionActive()).toBe(false);
      });
    });
  });

  describe('checkSession', () => {
    it('should throw if no context', () => {
      clearContext();
      expect(() => checkSession()).toThrow('API context not initialized');
    });

    it('should throw when page is closed', async () => {
      mockPage.isClosed.mockReturnValue(true);
      await withPage(mockPage, async () => {
        expect(() => checkSession()).toThrow('Page has been closed');
      });
    });

    it('should throw when browser connection is lost', async () => {
      await withPage(mockPage, async () => {
        mockPage.context.mockReturnValue({
          browser: vi.fn().mockReturnValue({
            isConnected: vi.fn().mockReturnValue(false)
          })
        });
        expect(() => checkSession()).toThrow('Session has been disconnected');
      });
    });
  });

  describe('withPage', () => {
    it('should execute function in context', async () => {
      const result = await withPage(mockPage, async () => {
        expect(getPage()).toBe(mockPage);
        return 'success';
      });
      expect(result).toBe('success');
    });

    it('should pass through sessionId from existing logger context', async () => {
      const getStoreSpy = vi.spyOn(loggerContext, 'getStore');
      const runSpy = vi.spyOn(loggerContext, 'run').mockImplementation(async (ctx, fn) => {
        getStoreSpy.mockReturnValue(ctx);
        return fn();
      });

      getStoreSpy.mockReturnValue({
        sessionId: 'existing-session-123',
        traceId: 'existing-trace-456'
      });

      const result = await withPage(mockPage, async () => {
        const ctx = loggerContext.getStore();
        return ctx.sessionId;
      });
      expect(result).toBe('existing-session-123');

      getStoreSpy.mockRestore();
      runSpy.mockRestore();
    });

    it('should generate new sessionId when no logger context exists', async () => {
      const getStoreSpy = vi.spyOn(loggerContext, 'getStore');
      const runSpy = vi.spyOn(loggerContext, 'run').mockImplementation(async (ctx, fn) => {
        getStoreSpy.mockReturnValue(ctx);
        return fn();
      });

      getStoreSpy.mockReturnValue(null);

      let capturedSessionId;
      const result = await withPage(mockPage, async () => {
        capturedSessionId = loggerContext.getStore()?.sessionId;
        return capturedSessionId;
      });
      expect(capturedSessionId).toMatch(/^session-[a-f0-9]+$/);

      getStoreSpy.mockRestore();
      runSpy.mockRestore();
    });

    it('should handle errors thrown inside the callback', async () => {
      const getStoreSpy = vi.spyOn(loggerContext, 'getStore');
      const runSpy = vi.spyOn(loggerContext, 'run').mockImplementation(async (ctx, fn) => fn());

      getStoreSpy.mockReturnValue(null);

      await expect(withPage(mockPage, async () => {
        throw new Error('Test error');
      })).rejects.toThrow('Test error');

      getStoreSpy.mockRestore();
      runSpy.mockRestore();
    });

    it('should throw if page is invalid', async () => {
      await expect(withPage(null, async () => { })).rejects.toThrow('withPage requires a valid Playwright page instance');
    });
  });

  describe('clearContext', () => {
    it('should clear the context', async () => {
      await withPage(mockPage, async () => {
        expect(getPage()).toBe(mockPage);
        clearContext();
        expect(isSessionActive()).toBe(false);
      });
    });
  });

  describe('getPage', () => {
    it('should throw with proper message when no context', () => {
      clearContext();
      expect(() => getPage()).toThrow('API context not initialized');
    });
  });

  describe('getCursor', () => {
    it('should return cursor', async () => {
      await withPage(mockPage, async () => {
        const cursor = getCursor();
        expect(cursor).toBeDefined();
      });
    });
  });

  describe('getEvents', () => {
    it('should return events', async () => {
      await withPage(mockPage, async () => {
        const events = getEvents();
        expect(events).toBeDefined();
      });
    });
  });

  describe('getPlugins', () => {
    it('should return plugin manager', async () => {
      await withPage(mockPage, async () => {
        const plugins = getPlugins();
        expect(plugins).toBeDefined();
      });
    });
  });

  describe('evalPage', () => {
    it('should evaluate on page', async () => {
      await withPage(mockPage, async () => {
        const result = await evalPage(() => 'test');
        expect(result).toBe('result');
        expect(mockPage.evaluate).toHaveBeenCalled();
      });
    });
  });
});

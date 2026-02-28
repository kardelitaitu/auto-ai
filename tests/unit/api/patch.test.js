
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apply, check, stripCDPMarkers } from '../../../api/utils/patch.js';

// Mocks
vi.mock('../../../utils/logger.js', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  })
}));

vi.mock('../../../api/core/context.js', () => ({
  getPage: vi.fn(),
  getEvents: vi.fn(() => ({ emitSafe: vi.fn() }))
}));

import { getPage } from '../../../api/core/context.js';

describe('api/utils/patch.js', () => {
  let mockContext;
  let mockPage;

  beforeEach(() => {
    vi.clearAllMocks();

    mockContext = {
      addInitScript: vi.fn().mockResolvedValue()
    };

    mockPage = {
      context: vi.fn().mockReturnValue(mockContext),
      addInitScript: vi.fn().mockImplementation(async (fn, data) => {
        if (typeof fn === 'function') {
          // Mock browser environment for coverage of the injected script
          const mockNav = { webdriver: true, languages: ['en'] };
          const mockWin = { 
            navigator: mockNav,
            document: {},
            chrome: null,
            PluginArray: function() {},
            Plugin: function() {}
          };
          
          // Partial mock of Object.getPrototypeOf to return our mockNav
          const originalGetPrototypeOf = Object.getPrototypeOf;
          Object.getPrototypeOf = vi.fn().mockImplementation((obj) => {
            if (obj === mockNav) return {};
            return originalGetPrototypeOf(obj);
          });

          // Redirect globals for the duration of the call
          const originalNavigator = global.navigator;
          const originalWindow = global.window;
          const originalDocument = global.document;
          
          global.navigator = mockNav;
          global.window = mockWin;
          global.document = mockWin.document;
          
          try {
            await fn(data);
          } catch (e) {
            // ignore
          } finally {
            global.navigator = originalNavigator;
            global.window = originalWindow;
            global.document = originalDocument;
            Object.getPrototypeOf = originalGetPrototypeOf;
          }
        }
      }),
      evaluate: vi.fn().mockImplementation(async (fn) => {
        if (typeof fn === 'function') {
          global.window = { cdc_adoQjvpsHSjkbJjLPRbPQ: null, $cdc_asdjflasutopfhvcZLmcfl_: null };
          global.navigator = { webdriver: false };
          try {
            return await fn();
          } catch (e) {
            return { webdriver: false, cdcMarkers: false, passed: true };
          } finally {
            delete global.window;
            delete global.navigator;
          }
        }
        return { webdriver: false, cdcMarkers: false, passed: true };
      })
    };
    
    getPage.mockReturnValue(mockPage);
  });

  describe('apply', () => {
    it('should add init script to page', async () => {
      await apply();
      expect(mockPage.addInitScript).toHaveBeenCalled();
      expect(mockPage.addInitScript.mock.calls[0][0]).toBeDefined();
    });

    it('should use provided fingerprint data', async () => {
      const customFingerprint = {
        languages: ['es-ES', 'es'],
        deviceMemory: 16,
        hardwareConcurrency: 12,
        maxTouchPoints: 5
      };
      await apply(customFingerprint);
      expect(mockPage.addInitScript).toHaveBeenCalled();
      const call = mockPage.addInitScript.mock.calls[0][1];
      expect(call.languages).toEqual(['es-ES', 'es']);
      expect(call.deviceMemory).toBe(16);
      expect(call.hardwareConcurrency).toBe(12);
      expect(call.maxTouchPoints).toBe(5);
    });

    it('should use default spoof data when none provided', async () => {
      await apply();
      const call = mockPage.addInitScript.mock.calls[0][1];
      expect(call.languages).toEqual(['en-US', 'en']);
      expect(call.deviceMemory).toBe(8);
      expect(call.hardwareConcurrency).toBe(8);
      expect(call.maxTouchPoints).toBe(0);
    });

    it('should call addInitScript with null fingerprint', async () => {
      await apply(null);
      expect(mockPage.addInitScript).toHaveBeenCalled();
    });
  });

  describe('stripCDPMarkers', () => {
    it('should handle undefined window', () => {
      const originalWindow = global.window;
      global.window = undefined;
      
      expect(() => stripCDPMarkers()).not.toThrow();
      
      global.window = originalWindow;
    });

    it('should handle window without CDP markers', () => {
      global.window = {};
      expect(() => stripCDPMarkers()).not.toThrow();
      delete global.window;
    });

    it('should handle window with CDP markers', () => {
      global.window = {
        cdc_adoQjvpsHSjkbJjLPRbPQ: 'test',
        $cdc_asdjflasutopfhvcZLmcfl_: 'test'
      };
      expect(() => stripCDPMarkers()).not.toThrow();
      expect(global.window.cdc_adoQjvpsHSjkbJjLPRbPQ).toBeUndefined();
      expect(global.window.$cdc_asdjflasutopfhvcZLmcfl_).toBeUndefined();
      delete global.window;
    });

    it('should handle window with read-only CDP markers', () => {
      Object.defineProperty(global, 'window', {
        value: {
          cdc_adoQjvpsHSjkbJjLPRbPQ: 'test'
        },
        writable: true,
        configurable: true
      });
      expect(() => stripCDPMarkers()).not.toThrow();
      delete global.window;
    });
  });

  describe('check', () => {
    it('should return check results', async () => {
      const result = await check();
      expect(result).toEqual({ webdriver: false, cdcMarkers: false, passed: true });
      expect(mockPage.evaluate).toHaveBeenCalled();
    });

    it('should return false when webdriver is detected', async () => {
      mockPage.evaluate.mockResolvedValue({ webdriver: true, cdcMarkers: false, passed: false });
      const result = await check();
      expect(result.passed).toBe(false);
      expect(result.webdriver).toBe(true);
    });

    it('should return false when CDC markers are detected', async () => {
      mockPage.evaluate.mockResolvedValue({ webdriver: false, cdcMarkers: true, passed: false });
      const result = await check();
      expect(result.passed).toBe(false);
      expect(result.cdcMarkers).toBe(true);
    });

    it('should return full results object', async () => {
      mockPage.evaluate.mockResolvedValue({ webdriver: false, cdcMarkers: false, passed: true });
      const result = await check();
      expect(result).toHaveProperty('webdriver');
      expect(result).toHaveProperty('cdcMarkers');
      expect(result).toHaveProperty('passed');
    });
    
    it('should propagate evaluation error', async () => {
        mockPage.evaluate.mockRejectedValue(new Error('Eval error'));
        await expect(check()).rejects.toThrow('Eval error');
    });
  });
});

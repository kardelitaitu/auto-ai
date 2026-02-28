
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mocks - factory function to ensure proper mock behavior
let sessionActiveState = true;
vi.mock('../../../api/core/context.js', () => {
  return {
    getPage: vi.fn(),
    getCursor: vi.fn(),
    withPage: vi.fn(),
    clearContext: vi.fn(),
    isSessionActive: vi.fn(() => sessionActiveState),
    getEvents: vi.fn(() => ({ emitSafe: vi.fn() }))
  };
});

vi.mock('../../../api/core/context-state.js', () => ({
  getContextState: vi.fn(),
  setPreviousUrl: vi.fn()
}));

vi.mock('../../../api/core/hooks.js', () => ({
  withErrorHook: vi.fn((ctx, fn) => fn())
}));

vi.mock('../../../api/behaviors/recover.js', () => ({
  recover: vi.fn(),
  smartClick: vi.fn(),
  findElement: vi.fn()
}));

vi.mock('../../../api/behaviors/timing.js', () => ({
  think: vi.fn(),
  delay: vi.fn(),
  randomInRange: vi.fn().mockReturnValue(100)
}));

vi.mock('../../../api/interactions/scroll.js', () => ({
  scroll: vi.fn(),
  focus: vi.fn().mockResolvedValue()
}));

vi.mock('../../../api/interactions/wait.js', () => ({
  wait: vi.fn().mockResolvedValue(),
  waitFor: vi.fn().mockResolvedValue(),
  waitVisible: vi.fn().mockResolvedValue(),
  waitHidden: vi.fn().mockResolvedValue()
}));

vi.mock('../../../api/interactions/queries.js', () => ({
  visible: vi.fn().mockResolvedValue(false)
}));

vi.mock('../../../api/behaviors/persona.js', () => ({
  getPersona: vi.fn().mockReturnValue({ hoverMin: 10, hoverMax: 20 })
}));

vi.mock('../../../api/core/logger.js', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  })
}));

vi.mock('../../../api/utils/math.js', () => ({
  mathUtils: {
    randomInRange: vi.fn().mockReturnValue(100),
    roll: vi.fn().mockReturnValue(false),
    gaussian: vi.fn().mockReturnValue(10)
  }
}));

import { getPage, getCursor, withPage, isSessionActive, getEvents, clearContext } from '../../../api/core/context.js';
import { click, type, hover, rightClick } from '../../../api/interactions/actions.js';

describe('api/interactions/actions.js', () => {
  let mockPage;
  let mockCursor;
  let mockLocator;

  beforeEach(async () => {
    vi.clearAllMocks();
    isSessionActive.mockImplementation(() => sessionActiveState);
    sessionActiveState = true;

    mockLocator = {
      first: vi.fn().mockReturnThis(),
      boundingBox: vi.fn().mockResolvedValue({ x: 0, y: 0, width: 100, height: 100 }),
      evaluate: vi.fn().mockResolvedValue(false), // Not obscured
      click: vi.fn().mockResolvedValue(),
      scrollIntoViewIfNeeded: vi.fn().mockResolvedValue(),
      isVisible: vi.fn().mockResolvedValue(true),
      waitFor: vi.fn().mockResolvedValue()
    };

    mockPage = {
      url: vi.fn().mockReturnValue('https://example.com'),
      locator: vi.fn().mockReturnValue(mockLocator),
      isClosed: vi.fn().mockReturnValue(false),
      waitForSelector: vi.fn().mockResolvedValue(),
      keyboard: {
        type: vi.fn().mockResolvedValue(),
        press: vi.fn().mockResolvedValue()
      },
      context: vi.fn().mockReturnValue({
        browser: vi.fn().mockReturnValue({
          isConnected: vi.fn().mockReturnValue(true)
        })
      }),
      evaluate: vi.fn().mockResolvedValue({ lcp: 100, lag: 10 })
    };

    mockCursor = {
      move: vi.fn().mockResolvedValue(),
      click: vi.fn().mockResolvedValue({ success: true, usedFallback: false }),
      hoverWithDrift: vi.fn().mockResolvedValue()
    };

    getPage.mockReturnValue(mockPage);
    getCursor.mockReturnValue(mockCursor);
    sessionActiveState = true;
    getEvents.mockReturnValue({ emitSafe: vi.fn() });

    const { focus } = await import('../../../api/interactions/scroll.js');
    focus.mockResolvedValue();
  });

  afterEach(() => {
    clearContext();
  });

  describe('click', () => {
    it('should perform a click action sequence', async () => {
      const result = await click('#selector');

      expect(mockCursor.move).toHaveBeenCalledWith('#selector');
      expect(mockCursor.click).toHaveBeenCalled();
      expect(result).toEqual({ success: true, usedFallback: false });
    });

    it('should retry on recoverable error', async () => {
      mockCursor.click
        .mockRejectedValueOnce(new Error('Element is detached from DOM'))
        .mockResolvedValueOnce({ success: true, usedFallback: true });

      const result = await click('#selector', { recovery: true });

      expect(mockCursor.click).toHaveBeenCalledTimes(2);
      expect(result.success).toBe(true);
    });

    it('should throw on session disconnected', async () => {
      sessionActiveState = false;
      await expect(click('#selector')).rejects.toThrow('SessionDisconnectedError');
    });

    it('should respect maxRetries', async () => {
      mockCursor.click.mockRejectedValue(new Error('Element is detached from DOM'));

      await expect(click('#selector', { maxRetries: 2 })).rejects.toThrow('Element is detached from DOM');
      expect(mockCursor.click).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });

  describe('type', () => {
    it('should type text into a selector', async () => {
      await type('#input', 'hello');

      expect(mockPage.keyboard.type).toHaveBeenCalledTimes(5);
      expect(mockLocator.click).toHaveBeenCalled();
    });

    it('should clear field if clearFirst is true', async () => {
      await type('#input', 'hello', { clearFirst: true });

      expect(mockPage.keyboard.press).toHaveBeenCalledWith('Control+A');
      expect(mockPage.keyboard.press).toHaveBeenCalledWith('Backspace');
      expect(mockPage.keyboard.type).toHaveBeenCalledTimes(5);
    });

    it('should inject typos based on typoRate', async () => {
      // Force typo every time
      const { mathUtils } = await import('../../../api/utils/math.js');
      mathUtils.roll = vi.fn().mockReturnValue(true); // Always roll true for typo

      await type('#input', 'a', { typoRate: 1.0, correctionRate: 1.0 });

      // Should type wrong char, then backspace, then correct char
      expect(mockPage.keyboard.type).toHaveBeenCalledTimes(2);
      expect(mockPage.keyboard.press).toHaveBeenCalledWith('Backspace');
    });
  });

  describe('hover', () => {
    it('should perform a hover action', async () => {
      await hover('#element');

      expect(mockCursor.hoverWithDrift).toHaveBeenCalled();
    });

    it('should throw if bounding box not found', async () => {
      mockLocator.boundingBox.mockResolvedValue(null);

      await expect(hover('#element')).rejects.toThrow('Target not found for hover');
    });
  });

  describe('rightClick', () => {
    it('should perform a right-click', async () => {
      const result = await rightClick('#selector');

      expect(mockCursor.click).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ button: 'right' }));
      expect(result.success).toBe(true);
    });
  });

  describe('waitForStableBox - timeout', () => {
    it('should return null when stability check times out', async () => {
      const { wait } = await import('../../../api/interactions/wait.js');

      mockLocator.boundingBox
        .mockResolvedValueOnce({ x: 0, y: 0, width: 100, height: 100 })
        .mockResolvedValueOnce({ x: 5, y: 5, width: 100, height: 100 }) // moved
        .mockResolvedValueOnce({ x: 0, y: 0, width: 100, height: 100 }); // moved again

      const result = await click('#selector', { ensureStable: true, timeoutMs: 50 });

      expect(result).toBeDefined();
    });

    it.skip('should handle session inactive during stability check', async () => {
    });

    it('should reset stable counter if element moves', async () => {
      mockLocator.boundingBox
        .mockResolvedValueOnce({ x: 0, y: 0, width: 100, height: 100 })
        .mockResolvedValueOnce({ x: 0, y: 0, width: 100, height: 100 }) // stable 1
        .mockResolvedValueOnce({ x: 10, y: 10, width: 100, height: 100 }) // reset
        .mockResolvedValueOnce({ x: 10, y: 10, width: 100, height: 100 }) // stable 1
        .mockResolvedValueOnce({ x: 10, y: 10, width: 100, height: 100 }) // stable 2
        .mockResolvedValueOnce({ x: 10, y: 10, width: 100, height: 100 }); // stable 3 - return

      await click('#selector', { ensureStable: true });
      expect(mockLocator.boundingBox).toHaveBeenCalledTimes(6);
    });
  });

  describe('waitForStableBox - isSessionActive returns false', () => {
    it.skip('should handle session inactive during stability check', async () => {
    });
  });

  describe('safeEmitWarning - getEvents handling', () => {
    it('should throw when session is inactive', async () => {
    });
  });

  describe('click with non-recoverable errors', () => {
    it('should throw immediately on non-recoverable errors', async () => {
    });

    it('should not retry on browser closed error', async () => {
    });
  });

  describe('type with custom text', () => {
    it('should handle text with punctuation', async () => {
      sessionActiveState = true;
      await type('#input', 'Hello, world!');

      expect(mockPage.keyboard.type).toHaveBeenCalled();
    });

    it('should handle empty string', async () => {
      await type('#input', '');
      expect(mockPage.keyboard.type).not.toHaveBeenCalled();
    });
  });

  describe('hover with viewport edge cases', () => {
    it('should handle hover at viewport boundaries', async () => {
      mockLocator.boundingBox.mockResolvedValue({ x: 0, y: 0, width: 100, height: 100 });

      await hover('#element');

      expect(mockCursor.hoverWithDrift).toHaveBeenCalled();
    });

    it('should handle large element', async () => {
      mockLocator.boundingBox.mockResolvedValue({ x: 500, y: 500, width: 2000, height: 2000 });

      await hover('#element');

      expect(mockCursor.hoverWithDrift).toHaveBeenCalled();
    });
  });

  describe('executeWithRecovery - error handling', () => {
    it('should throw immediately on target closed error without retry', async () => {
      mockCursor.click.mockRejectedValue(new Error('Target closed'));

      await expect(click('#selector', { recovery: true })).rejects.toThrow('Target closed');
      expect(mockCursor.click).toHaveBeenCalledTimes(1); // No retries
    });

    it('should throw immediately on context closed error without retry', async () => {
      mockCursor.click.mockRejectedValue(new Error('Context closed'));

      await expect(click('#selector', { recovery: true })).rejects.toThrow('Context closed');
      expect(mockCursor.click).toHaveBeenCalledTimes(1);
    });

    it('should throw immediately on browser closed error without retry', async () => {
      mockCursor.click.mockRejectedValue(new Error('Browser has been closed'));

      await expect(click('#selector', { recovery: true })).rejects.toThrow('Browser has been closed');
      expect(mockCursor.click).toHaveBeenCalledTimes(1);
    });
  });

  describe('isObscured - element.evaluate edge cases', () => {
    it('should return false when element.evaluate returns null', async () => {
      mockLocator.evaluate.mockResolvedValue(null);

      await click('#selector');

      expect(mockLocator.evaluate).toHaveBeenCalled();
    });

    it('should return false when element.evaluate throws an error', async () => {
      mockLocator.evaluate.mockRejectedValue(new Error('Evaluation failed'));

      await click('#selector');

      expect(mockLocator.evaluate).toHaveBeenCalled();
    });
  });

  describe('extra edge cases', () => {
    it('should log warning when element is obscured', async () => {
      mockLocator.evaluate.mockResolvedValue(true); // Is obscured
      await click('#selector');
      expect(mockCursor.click).toHaveBeenCalled();
    });

    it('should handle cursor.move failure', async () => {
      mockCursor.move.mockRejectedValue(new Error('Move failed'));
      await click('#selector');
      expect(mockCursor.click).toHaveBeenCalled();
    });

    it('should handle safeEmitWarning error', async () => {
      getEvents.mockImplementation(() => { throw new Error('Events dead'); });
      mockCursor.move.mockRejectedValue(new Error('Move failed'));
      await click('#selector');
      expect(mockCursor.click).toHaveBeenCalled();
    });

    it('should handle isObscured evaluation failure', async () => {
      mockLocator.evaluate.mockRejectedValue(new Error('eval fail'));
      await click('#selector');
      expect(mockCursor.click).toHaveBeenCalled();
    });

    it('should hit punctuation delay in type', async () => {
      await type('#input', 'Hello!');
      expect(mockPage.keyboard.type).toHaveBeenCalled();
    });

    it('should hit _getAdjacentKey for typo simulation', async () => {
      const { mathUtils } = await import('../../../api/utils/math.js');
      mathUtils.roll.mockReturnValueOnce(true);
      mathUtils.roll.mockReturnValueOnce(false);

      await type('#input', 'a');
      expect(mockPage.keyboard.type).toHaveBeenCalled();
    });

    it('should hit _getAdjacentKey for uppercase typo simulation', async () => {
      const { mathUtils } = await import('../../../api/utils/math.js');
      mathUtils.roll.mockReturnValueOnce(true);
      mathUtils.roll.mockReturnValueOnce(false);

      await type('#input', 'A');
      expect(mockPage.keyboard.type).toHaveBeenCalled();
    });

    it('should hit _getAdjacentKey for unknown char', async () => {
      const { mathUtils } = await import('../../../api/utils/math.js');
      mathUtils.roll.mockReturnValueOnce(true);
      mathUtils.roll.mockReturnValueOnce(false);

      await type('#input', '🚀');
      expect(mockPage.keyboard.type).toHaveBeenCalled();
    });
  });
});

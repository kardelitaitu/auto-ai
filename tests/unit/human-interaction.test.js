/**
 * @fileoverview Unit tests for Human Interaction utilities
 * @module tests/unit/human-interaction.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HumanInteraction } from '../../utils/human-interaction.js';

describe('HumanInteraction', () => {
  let human;

  beforeEach(() => {
    human = new HumanInteraction();
  });

  describe('Initialization', () => {
    it('should initialize with default values', () => {
      expect(human.debugMode).toBe(false);
      expect(human.page).toBe(null);
      expect(human.ghost).toBe(null);
    });

    it('should accept page parameter', () => {
      const mockPage = { mouse: { move: vi.fn() } };
      human = new HumanInteraction(mockPage);
      expect(human.page).toBe(mockPage);
      expect(human.ghost).not.toBe(null);
    });
  });

  describe('hesitation', () => {
    it('should return a delay value', async () => {
      const delay = await human.hesitation(100, 200);
      expect(typeof delay).toBe('number');
      expect(delay).toBeGreaterThanOrEqual(100);
      expect(delay).toBeLessThanOrEqual(200);
    });

    it('should use default range when not specified', async () => {
      const delay = await human.hesitation();
      expect(typeof delay).toBe('number');
      expect(delay).toBeGreaterThanOrEqual(300);
      expect(delay).toBeLessThanOrEqual(1500);
    });
  });

  describe('readingTime', () => {
    it('should return a time value within range', async () => {
      const time = await human.readingTime(1000, 2000);
      expect(typeof time).toBe('number');
      expect(time).toBeGreaterThanOrEqual(1000);
      expect(time).toBeLessThanOrEqual(2000);
    });
  });

  describe('fixation', () => {
    it('should return a time value within range', async () => {
      const time = await human.fixation(100, 500);
      expect(typeof time).toBe('number');
      expect(time).toBeGreaterThanOrEqual(100);
      expect(time).toBeLessThanOrEqual(500);
    });
  });

  describe('selectMethod', () => {
    it('should select a method based on weights', () => {
      const methods = [
        { name: 'method1', weight: 50 },
        { name: 'method2', weight: 50 }
      ];

      const selected = human.selectMethod(methods);
      expect(methods.map(m => m.name)).toContain(selected.name);
    });

    it('should return first method if roll exceeds all weights', () => {
      const methods = [
        { name: 'method1', weight: 30 },
        { name: 'method2', weight: 30 }
      ];

      vi.spyOn(Math, 'random').mockReturnValue(0.99);
      const selected = human.selectMethod(methods);
      expect(selected).toBe(methods[0]);

      vi.restoreAllMocks();
    });
  });

  describe('maybeScroll', () => {
    it('should return false when random roll does not trigger scroll', async () => {
      const mockPage = { evaluate: vi.fn() };
      vi.spyOn(Math, 'random').mockReturnValue(0.5);

      const result = await human.maybeScroll(mockPage, 100, 300);
      expect(result).toBe(false);
      expect(mockPage.evaluate).not.toHaveBeenCalled();

      vi.restoreAllMocks();
    });

    it('should call scroll when random roll triggers it', async () => {
      const mockPage = { evaluate: vi.fn() };
      vi.spyOn(Math, 'random').mockReturnValue(0.1);

      const result = await human.maybeScroll(mockPage, 100, 300);
      expect(result).toBe(true);
      expect(mockPage.evaluate).toHaveBeenCalled();

      vi.restoreAllMocks();
    });
  });

  describe('microMove', () => {
    it('should call page.mouse.move', async () => {
      const mockPage = { mouse: { move: vi.fn() } };
      human.page = mockPage;

      await human.microMove(mockPage, 20);
      expect(mockPage.mouse.move).toHaveBeenCalled();
    });
  });

  describe('findElement', () => {
    it('should return null element when no selectors match', async () => {
      const mockPage = {
        locator: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue([])
        })
      };

      const result = await human.findElement(mockPage, ['.selector1', '.selector2']);

      expect(result.element).toBe(null);
      expect(result.selector).toBe(null);
      expect(result.index).toBe(-1);
    });

    it('should return first visible element when found', async () => {
      const mockElement = { isVisible: vi.fn().mockResolvedValue(true) };
      const mockPage = {
        locator: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue([mockElement])
        })
      };

      const result = await human.findElement(mockPage, ['.selector1']);

      expect(result.element).toBe(mockElement);
      expect(result.selector).toBe('.selector1');
      expect(result.index).toBe(0);
    });
  });

  describe('verifyComposerOpen', () => {
    it('should return open: false when composer not visible', async () => {
      const mockPage = {
        locator: vi.fn().mockReturnValue({
          first: vi.fn().mockReturnValue({
            count: vi.fn().mockResolvedValue(0),
            isVisible: vi.fn().mockResolvedValue(false)
          })
        })
      };

      const result = await human.verifyComposerOpen(mockPage);

      expect(result.open).toBe(false);
      expect(result.selector).toBe(null);
    });
  });

  describe('verifyPostSent', () => {
    it('should return sent: false when no confirmation found', async () => {
      const mockElementBuilder = (count, visible) => ({
        count: vi.fn().mockResolvedValue(count),
        innerText: vi.fn().mockResolvedValue(''),
        isVisible: vi.fn().mockResolvedValue(visible)
      });

      const mockPage = {
        locator: vi.fn().mockImplementation((selector) => {
          if (selector === '[data-testid="tweetTextarea_0"]') {
            return mockElementBuilder(1, true);
          }
          return mockElementBuilder(0, false);
        }),
        url: vi.fn().mockReturnValue('https://x.com/compose/tweet')
      };

      const result = await human.verifyPostSent(mockPage);

      expect(result.sent).toBe(false);
    });
  });

  describe('logDebug', () => {
    it('should not log when debugMode is false', () => {
      const originalLog = console.log;
      console.log = vi.fn();

      human.logDebug('test message');

      expect(console.log).not.toHaveBeenCalled();
      console.log = originalLog;
    });

    it('should log when debugMode is true', () => {
      human.debugMode = true;
      const originalLog = console.log;
      console.log = vi.fn();

      human.logDebug('test message');

      expect(console.log).toHaveBeenCalled();
      console.log = originalLog;
    });
  });

  describe('logStep', () => {
    it('should call logDebug', () => {
      human.debugMode = true;
      const originalLog = console.log;
      console.log = vi.fn();

      human.logStep('TestStep', 'details');

      expect(console.log).toHaveBeenCalled();
      console.log = originalLog;
    });
  });
});

describe('HumanInteraction with GhostCursor', () => {
  let human;
  let mockPage;
  let mockElement;

  beforeEach(() => {
    mockPage = {
      mouse: { move: vi.fn(), click: vi.fn() },
      evaluate: vi.fn(),
      waitForTimeout: vi.fn().mockImplementation(ms => Promise.resolve())
    };

    mockElement = {
      boundingBox: vi.fn().mockResolvedValue({ x: 100, y: 200, width: 50, height: 50 }),
      click: vi.fn().mockResolvedValue(undefined),
      evaluate: vi.fn().mockResolvedValue(undefined),
      scrollIntoView: vi.fn().mockResolvedValue(undefined)
    };

    human = new HumanInteraction(mockPage);
  });

  describe('humanClick', () => {
    it('should scroll element into view before clicking', async () => {
      await human.humanClick(mockElement, 'Test Element');

      expect(mockElement.evaluate).toHaveBeenCalled();
    });

    it('should get bounding box before clicking', async () => {
      await human.humanClick(mockElement, 'Test Element');

      expect(mockElement.boundingBox).toHaveBeenCalled();
    });

    it('should call fallback when element has no bounding box', async () => {
      mockElement.boundingBox.mockResolvedValue(null);
      mockElement.click = vi.fn().mockResolvedValue(undefined);

      await human.humanClick(mockElement, 'Test Element');

      expect(mockElement.click).toHaveBeenCalled();
    });

    it('should fallback to native click when ghost click fails', async () => {
      mockElement.click.mockResolvedValue(undefined);

      await human.humanClick(mockElement, 'Test Element');

      expect(mockElement.click).toHaveBeenCalled();
    });
  });

  describe('safeHumanClick', () => {
    it('should return true on successful click', async () => {
      const result = await human.safeHumanClick(mockElement, 'Test Element', 3);

      expect(result).toBe(true);
    });
  });
});

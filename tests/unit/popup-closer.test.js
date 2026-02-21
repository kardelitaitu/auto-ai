import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import PopupCloser from '../../utils/popup-closer.js';

const createMockPage = () => {
  const button = {
    count: vi.fn().mockResolvedValue(0),
    isVisible: vi.fn().mockResolvedValue(false),
    scrollIntoViewIfNeeded: vi.fn().mockResolvedValue(undefined),
    click: vi.fn().mockResolvedValue(undefined)
  };

  const locator = {
    first: vi.fn().mockReturnValue(button),
    count: vi.fn().mockResolvedValue(0),
    isVisible: vi.fn().mockResolvedValue(false),
    scrollIntoViewIfNeeded: vi.fn().mockResolvedValue(undefined),
    click: vi.fn().mockResolvedValue(undefined)
  };

  return {
    isClosed: vi.fn().mockReturnValue(false),
    getByRole: vi.fn().mockReturnValue({ first: vi.fn().mockReturnValue(button) }),
    locator: vi.fn().mockReturnValue(locator)
  };
};

describe('PopupCloser', () => {
  let page;
  let mockLogger;

  beforeEach(() => {
    page = createMockPage();
    mockLogger = {
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('skips execution when aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const closer = new PopupCloser(page, null, { signal: controller.signal });

    await closer.runOnce();

    expect(page.getByRole).not.toHaveBeenCalled();
  });

  it('uses lock when provided', async () => {
    const lock = vi.fn(async (task) => await task());
    const closer = new PopupCloser(page, null, { lock });

    await closer.runOnce();

    expect(lock).toHaveBeenCalledTimes(1);
  });

  it('skips when shouldSkip returns true', async () => {
    const shouldSkip = vi.fn().mockReturnValue(true);
    const closer = new PopupCloser(page, null, { shouldSkip });

    await closer.runOnce();

    expect(page.getByRole).not.toHaveBeenCalled();
  });

  it('skips when already running', async () => {
    const closer = new PopupCloser(page, mockLogger);
    closer.running = true;

    await closer.runOnce();

    expect(page.getByRole).not.toHaveBeenCalled();
  });

  it('skips when page is closed', async () => {
    page.isClosed = vi.fn().mockReturnValue(true);
    const closer = new PopupCloser(page, mockLogger);

    await closer.runOnce();

    expect(page.getByRole).not.toHaveBeenCalled();
  });

  it('closes popup using getByRole button', async () => {
    // The code uses: btn.first() to get the locator, then calls count() and isVisible()
    // We need to make sure count returns > 0 and isVisible returns true
    const mockBtnFirst = vi.fn().mockReturnValue({
      count: vi.fn().mockResolvedValue(1),
      isVisible: vi.fn().mockResolvedValue(true),
      scrollIntoViewIfNeeded: vi.fn().mockResolvedValue(undefined),
      click: vi.fn().mockResolvedValue(undefined)
    });
    
    page.getByRole = vi.fn().mockReturnValue({
      first: mockBtnFirst
    });
    
    const closer = new PopupCloser(page, mockLogger);
    const result = await closer.runOnce();

    expect(result).toBe(true);
    expect(mockLogger.info).toHaveBeenCalled();
  });

  it('closes popup using alternative locator', async () => {
    // First locator returns count 0
    const firstButton = {
      count: vi.fn().mockResolvedValue(0),
      isVisible: vi.fn().mockResolvedValue(false),
      first: vi.fn().mockReturnValue({
        count: vi.fn().mockResolvedValue(0),
        isVisible: vi.fn().mockResolvedValue(false)
      })
    };
    page.getByRole = vi.fn().mockReturnValue(firstButton);

    // Second locator returns count > 0 and visible
    const altButton = {
      count: vi.fn().mockResolvedValue(1),
      isVisible: vi.fn().mockResolvedValue(true),
      scrollIntoViewIfNeeded: vi.fn().mockResolvedValue(undefined),
      click: vi.fn().mockResolvedValue(undefined),
      first: vi.fn().mockReturnValue({
        count: vi.fn().mockResolvedValue(1),
        isVisible: vi.fn().mockResolvedValue(true),
        scrollIntoViewIfNeeded: vi.fn().mockResolvedValue(undefined),
        click: vi.fn().mockResolvedValue(undefined)
      })
    };
    page.locator = vi.fn().mockReturnValue(altButton);

    const closer = new PopupCloser(page, mockLogger);
    const result = await closer.runOnce();

    expect(result).toBe(true);
    expect(mockLogger.info).toHaveBeenCalled();
  });

  it('returns false when no popup found', async () => {
    const closer = new PopupCloser(page, mockLogger);
    const result = await closer.runOnce();

    expect(result).toBe(false);
  });

  it('handles errors gracefully', async () => {
    page.getByRole = vi.fn().mockReturnValue({
      first: vi.fn().mockRejectedValue(new Error('Test error'))
    });

    const closer = new PopupCloser(page, mockLogger);
    const result = await closer.runOnce();

    expect(result).toBe(false);
    expect(mockLogger.debug).toHaveBeenCalled();
  });

  it('updates lastClosedAt and nextNotifyMinutes', async () => {
    const button = {
      count: vi.fn().mockResolvedValue(1),
      isVisible: vi.fn().mockResolvedValue(true),
      scrollIntoViewIfNeeded: vi.fn().mockResolvedValue(undefined),
      click: vi.fn().mockResolvedValue(undefined),
      first: vi.fn().mockReturnValue({
        count: vi.fn().mockResolvedValue(1),
        isVisible: vi.fn().mockResolvedValue(true),
        scrollIntoViewIfNeeded: vi.fn().mockResolvedValue(undefined),
        click: vi.fn().mockResolvedValue(undefined)
      })
    };
    page.getByRole = vi.fn().mockReturnValue(button);

    const closer = new PopupCloser(page, mockLogger);
    const beforeTime = Date.now();
    await closer.runOnce();
    const afterTime = Date.now();

    expect(closer.lastClosedAt).toBeGreaterThanOrEqual(beforeTime);
    expect(closer.lastClosedAt).toBeLessThanOrEqual(afterTime);
    expect(closer.nextNotifyMinutes).toBe(2);
  });

  it('starts interval timer', () => {
    const closer = new PopupCloser(page, mockLogger);
    closer.start();

    expect(closer.timer).not.toBeNull();

    closer.stop();
  });

  it('stops interval timer', () => {
    const closer = new PopupCloser(page, mockLogger);
    closer.start();
    closer.stop();

    expect(closer.timer).toBeNull();
  });

  it('does nothing when stop called without timer', () => {
    const closer = new PopupCloser(page, mockLogger);
    closer.timer = null;
    closer.stop();
    expect(closer.timer).toBeNull();
  });

  it('does not start if timer already exists', () => {
    const closer = new PopupCloser(page, mockLogger);
    closer.timer = 'existing';
    closer.start();

    expect(closer.timer).toBe('existing');
  });

  it('handles internal run with closed page', async () => {
    page.isClosed = vi.fn().mockReturnValue(true);
    const closer = new PopupCloser(page, mockLogger);

    const result = await closer._runOnceInternal();

    expect(result).toBeUndefined();
  });

  it('handles internal run with aborted signal', async () => {
    const controller = new AbortController();
    controller.abort();
    const closer = new PopupCloser(page, mockLogger, { signal: controller.signal });

    const result = await closer._runOnceInternal();

    expect(result).toBeUndefined();
  });

  it('executes runOnce on interval', async () => {
    vi.useFakeTimers();
    const closer = new PopupCloser(page, mockLogger);
    const runOnceSpy = vi.spyOn(closer, 'runOnce').mockResolvedValue(undefined);
    
    closer.start();
    
    await vi.advanceTimersByTimeAsync(120000);
    
    expect(runOnceSpy).toHaveBeenCalled();
    
    closer.stop();
    vi.useRealTimers();
  });

  it('handles error in interval execution', async () => {
    vi.useFakeTimers();
    const closer = new PopupCloser(page, mockLogger);
    const runOnceSpy = vi.spyOn(closer, 'runOnce').mockRejectedValue(new Error('Interval error'));
    
    closer.start();
    
    // Should not throw
    await vi.advanceTimersByTimeAsync(120000);
    
    expect(runOnceSpy).toHaveBeenCalled();
    
    closer.stop();
    vi.useRealTimers();
  });

  it('handles isVisible error for first button', async () => {
    const button = {
      count: vi.fn().mockResolvedValue(1),
      isVisible: vi.fn().mockRejectedValue(new Error('Visibility check failed')),
      first: vi.fn().mockReturnValue({
          count: vi.fn().mockResolvedValue(1),
          isVisible: vi.fn().mockRejectedValue(new Error('Visibility check failed')),
      })
    };
    page.getByRole = vi.fn().mockReturnValue(button);
    
    // Mock locator to return empty so it doesn't try the second path successfully
    page.locator = vi.fn().mockReturnValue({
        first: vi.fn().mockReturnValue({
            count: vi.fn().mockResolvedValue(0)
        })
    });
    
    const closer = new PopupCloser(page, mockLogger);
    const result = await closer._runOnceInternal();
    
    expect(result).toBe(false);
  });

  it('handles isVisible error for alternative button', async () => {
    // First button not found
    page.getByRole = vi.fn().mockReturnValue({
        first: vi.fn().mockReturnValue({
            count: vi.fn().mockResolvedValue(0)
        })
    });

    // Alt button found but visibility check fails
    const altButton = {
      count: vi.fn().mockResolvedValue(1),
      isVisible: vi.fn().mockRejectedValue(new Error('Visibility check failed')),
      first: vi.fn().mockReturnValue({
          count: vi.fn().mockResolvedValue(1),
          isVisible: vi.fn().mockRejectedValue(new Error('Visibility check failed')),
      })
    };
    page.locator = vi.fn().mockReturnValue(altButton);
    
    const closer = new PopupCloser(page, mockLogger);
    const result = await closer._runOnceInternal();
    
    expect(result).toBe(false);
  });
});

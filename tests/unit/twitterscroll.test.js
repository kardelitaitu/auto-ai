import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import twitterscroll from '../../tasks/twitterscroll.js';
import { createRandomScroller, createLogger } from '../../utils/utils.js';
import { applyHumanizationPatch } from '../../utils/browserPatch.js';

vi.mock('../../utils/utils.js', () => ({
  createRandomScroller: vi.fn(),
  createLogger: vi.fn()
}));

vi.mock('../../utils/browserPatch.js', () => ({
  applyHumanizationPatch: vi.fn()
}));

describe('twitterscroll task', () => {
  let mockLogger;
  let randomScroller;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn()
    };
    randomScroller = vi.fn().mockResolvedValue(undefined);
    createLogger.mockReturnValue(mockLogger);
    createRandomScroller.mockReturnValue(randomScroller);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('runs the task successfully and closes the page', async () => {
    const page = {
      goto: vi.fn().mockResolvedValue(undefined),
      isClosed: vi.fn().mockReturnValue(false),
      close: vi.fn().mockResolvedValue(undefined)
    };
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const promise = twitterscroll(page, { browserInfo: 'profile-1' });
    await vi.advanceTimersByTimeAsync(5000);
    await promise;

    expect(createLogger).toHaveBeenCalledWith('twitterscroll.js [profile-1]');
    expect(applyHumanizationPatch).toHaveBeenCalledWith(page, mockLogger);
    expect(page.goto).toHaveBeenCalledWith('https://x.com/home', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
    expect(randomScroller).toHaveBeenCalledWith(10);
    expect(page.close).toHaveBeenCalled();
  });

  it('warns on closed-page interruption and skips closing when already closed', async () => {
    const page = {
      goto: vi.fn().mockRejectedValue(new Error('Target page, context or browser has been closed')),
      isClosed: vi.fn().mockReturnValue(true),
      close: vi.fn().mockResolvedValue(undefined)
    };

    await twitterscroll(page, {});

    expect(createLogger).toHaveBeenCalledWith('twitterscroll.js [unknown_profile]');
    expect(mockLogger.warn).toHaveBeenCalledWith(
      '[TwitterScroll] Task interrupted: Browser/Page closed (likely Ctrl+C).'
    );
    expect(mockLogger.debug).toHaveBeenCalledWith('Page was already closed or not created.');
  });

  it('logs critical errors and reports close failures', async () => {
    const page = {
      goto: vi.fn().mockRejectedValue(new Error('Boom')),
      isClosed: vi.fn().mockReturnValue(false),
      close: vi.fn().mockRejectedValue(new Error('Close failed'))
    };

    await twitterscroll(page, { browserInfo: 'profile-2' });

    expect(mockLogger.error).toHaveBeenCalledWith(
      '[TwitterScroll] ### CRITICAL ERROR:',
      expect.any(Error)
    );
    expect(mockLogger.error).toHaveBeenCalledWith(
      '### CRITICAL ERROR trying to close page:',
      expect.any(Error)
    );
  });
});

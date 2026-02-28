import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../api/index.js', () => {
    const api = {
        setPage: vi.fn(),
        getPage: vi.fn(),
        wait: vi.fn().mockResolvedValue(undefined),
        think: vi.fn().mockResolvedValue(undefined),
        getPersona: vi.fn().mockReturnValue({ microMoveChance: 0.1, fidgetChance: 0.05 }),
        scroll: Object.assign(vi.fn().mockResolvedValue(undefined), {
            toTop: vi.fn().mockResolvedValue(undefined),
            back: vi.fn().mockResolvedValue(undefined),
            read: vi.fn().mockResolvedValue(undefined),
            focus: vi.fn().mockResolvedValue(undefined)
        }),
        visible: vi.fn().mockImplementation(async (el) => {
            if (el && typeof el.isVisible === 'function') return await el.isVisible();
            if (el && typeof el.count === 'function') return (await el.count()) > 0;
            return true;
        }),
        exists: vi.fn().mockImplementation(async (el) => {
            if (el && typeof el.count === 'function') return (await el.count()) > 0;
            return el !== null;
        }),
        getCurrentUrl: vi.fn().mockResolvedValue('https://x.com/home'),
        goto: vi.fn().mockImplementation(() => {
            console.log('[DEBUG] api.goto mock called');
            return Promise.resolve();
        }),
        reload: vi.fn().mockResolvedValue(undefined),
        eval: vi.fn().mockResolvedValue('mock result'),
        text: vi.fn().mockResolvedValue('mock text'),
        click: vi.fn().mockResolvedValue(undefined),
        type: vi.fn().mockResolvedValue(undefined)
    };
    return { api, default: api };
});
import { api } from '../../api/index.js';

import {
  replyMethods,
  quoteMethods,
  executeReplyMethod,
  executeQuoteMethod
} from '../../utils/twitter-interaction-methods.js';

describe('twitter-interaction-methods', () => {
  let mockPage;
  let mockHuman;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    };

    mockHuman = {
      click: vi.fn().mockResolvedValue(undefined),
      safeHumanClick: vi.fn().mockResolvedValue(undefined),
      typeText: vi.fn().mockResolvedValue(undefined),
      postTweet: vi.fn().mockResolvedValue({ success: true }),
      verifyComposerOpen: vi.fn().mockResolvedValue({ open: true, selector: '[data-testid="tweetTextarea_0"]', locator: null }),
      findElement: vi.fn().mockResolvedValue({ element: null, selector: '' }),
      fixation: vi.fn().mockResolvedValue(undefined),
      microMove: vi.fn().mockResolvedValue(undefined),
      verifyPostSent: vi.fn().mockResolvedValue({ sent: true, method: 'direct' })
    };

    const mockLocator = {
      first: vi.fn().mockReturnThis(),
      count: vi.fn().mockResolvedValue(1),
      isVisible: vi.fn().mockResolvedValue(true),
      boundingBox: vi.fn().mockResolvedValue({ x: 0, y: 0, width: 100, height: 100 }),
      click: vi.fn().mockResolvedValue(undefined),
      textContent: vi.fn().mockResolvedValue('mock text'),
      getAttribute: vi.fn().mockResolvedValue('mock attr'),
      all: vi.fn().mockResolvedValue([])
    };

    mockPage = {
      locator: vi.fn().mockReturnValue(mockLocator),
      keyboard: {
        press: vi.fn().mockResolvedValue(undefined),
        type: vi.fn().mockResolvedValue(undefined)
      },
      mouse: {
        wheel: vi.fn().mockResolvedValue(undefined)
      },
      isClosed: vi.fn().mockReturnValue(false),
      context: vi.fn().mockReturnValue({ browser: vi.fn().mockReturnValue({ isConnected: vi.fn().mockReturnValue(true) }) }),
      url: vi.fn().mockReturnValue('https://x.com/home'),
      evaluate: vi.fn().mockResolvedValue(undefined)
    };

    api.getPage.mockReturnValue(mockPage);
    api.setPage.mockReturnValue(undefined);
  });

  it('replyMethods.replyA should succeed', async () => {
    const result = await replyMethods.replyA(mockPage, 'test', mockHuman, mockLogger);
    expect(result.success).toBe(true);
  });

  it('quoteMethods.quoteC should call api.goto', async () => {
    await quoteMethods.quoteC(mockPage, 'test', mockHuman, mockLogger);
    expect(api.goto).toHaveBeenCalled();
  });
});

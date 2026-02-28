import { vi, describe, it, expect, beforeEach } from 'vitest';

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
        goto: vi.fn().mockResolvedValue(undefined),
        reload: vi.fn().mockResolvedValue(undefined),
        eval: vi.fn().mockResolvedValue([]),
        text: vi.fn().mockResolvedValue('mock text'),
        click: vi.fn().mockResolvedValue(undefined),
        type: vi.fn().mockResolvedValue(undefined),
        keyboardPress: vi.fn().mockResolvedValue(undefined),
        emulateMedia: vi.fn().mockResolvedValue(undefined),
        setExtraHTTPHeaders: vi.fn().mockResolvedValue(undefined),
        clearContext: vi.fn(),
        checkSession: vi.fn().mockResolvedValue(true),
        isSessionActive: vi.fn().mockReturnValue(true),
        waitVisible: vi.fn().mockResolvedValue(undefined),
        count: vi.fn().mockResolvedValue(1),
        waitForLoadState: vi.fn().mockResolvedValue(undefined)
    };
    return { api, default: api };
});

vi.mock('../../utils/ai-reply-engine.js', () => {
  const engine = {
    generateReply: vi.fn().mockResolvedValue('test reply'),
    executeReply: vi.fn().mockResolvedValue({ success: true, method: 'test' }),
    shouldReply: vi.fn().mockResolvedValue({ decision: 'proceed' })
  };
  return { 
    AIReplyEngine: vi.fn().mockImplementation(function() { return engine; }),
    replyEngine: engine
  };
});

vi.mock('../../utils/ai-context-engine.js', () => {
  const engine = {
    extractEnhancedContext: vi.fn().mockResolvedValue({
      url: 'https://x.com/test',
      text: 'test tweet',
      author: 'testuser',
      replies: [{ text: 'reply 1', author: 'user1' }]
    }),
    extractRepliesSmart: vi.fn().mockResolvedValue([{ text: 'reply 1', author: 'user1' }])
  };
  return { 
    AIContextEngine: vi.fn().mockImplementation(function() { return engine; }),
    contextEngine: engine
  };
});

vi.mock('../../utils/ai-quote-engine.js', () => {
  const engine = {
    generateQuote: vi.fn().mockResolvedValue('test quote'),
    executeQuote: vi.fn().mockResolvedValue({ success: true, method: 'test' })
  };
  return {
    AIQuoteEngine: vi.fn().mockImplementation(function() { return engine; }),
    quoteEngine: engine
  };
});

import { api } from '../../api/index.js';
import task from '../../tasks/testHumanMethods.js';
import { applyHumanizationPatch } from '../../utils/browserPatch.js';

vi.mock('../../utils/browserPatch.js', () => ({
  applyHumanizationPatch: vi.fn()
}));

vi.mock('../../utils/config-service.js', () => ({
  config: {
    init: vi.fn()
  }
}));

vi.mock('../../core/agent-connector.js', () => ({
  default: vi.fn()
}));

describe('testHumanMethods task', () => {
  let page;
  let mockLogger;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn()
    };
    
    page = {
      goto: vi.fn().mockResolvedValue(undefined),
      url: vi.fn().mockReturnValue('https://x.com/home'),
      isClosed: vi.fn().mockReturnValue(false),
      context: vi.fn().mockReturnValue({ browser: vi.fn().mockReturnValue({ isConnected: vi.fn().mockReturnValue(true) }) }),
      $$: vi.fn().mockImplementation(async (sel) => {
        if (sel.includes('tweetText')) {
          return [{ innerText: vi.fn().mockResolvedValue('test tweet text content') }];
        }
        return [];
      }),
      reload: vi.fn().mockResolvedValue(undefined),
      waitForTimeout: vi.fn().mockResolvedValue(undefined),
      keyboard: { press: vi.fn().mockResolvedValue(undefined) }
    };

    api.getPage.mockReturnValue(page);
    api.setPage.mockReturnValue(undefined);
  });

  it('handles extractOnly mode with extracted replies', async () => {
    await task(page, { method: 'extractOnly', targetUrl: 'https://x.com/test/status/1' });

    expect(applyHumanizationPatch).toHaveBeenCalled();
  });

  it('runs reply flow in safe mode without posting', async () => {
    const result = await task(page, { method: 'reply', targetUrl: 'https://x.com/test/status/1', safeMode: true });
    expect(result.success).toBe(true);
  });

  it('runs quote flow in safe mode without posting', async () => {
    const result = await task(page, { method: 'quote', targetUrl: 'https://x.com/test/status/1', safeMode: true });
    expect(result.success).toBe(true);
  });
});

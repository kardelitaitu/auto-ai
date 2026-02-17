import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { createLogger } from '../../utils/logger.js';
import { getSettings } from '../../utils/configLoader.js';
import { AIReplyEngine } from '../../utils/ai-reply-engine.js';
import { AIQuoteEngine } from '../../utils/ai-quote-engine.js';
import { AIContextEngine } from '../../utils/ai-context-engine.js';
import { HumanInteraction } from '../../utils/human-interaction.js';
import { applyHumanizationPatch } from '../../utils/browserPatch.js';
import { config } from '../../utils/config-service.js';
import { FreeOpenRouterHelper } from '../../utils/free-openrouter-helper.js';

vi.mock('../../utils/logger.js', () => ({
  createLogger: vi.fn()
}));

vi.mock('../../utils/configLoader.js', () => ({
  getSettings: vi.fn()
}));

vi.mock('../../utils/ai-reply-engine.js', () => ({
  AIReplyEngine: vi.fn()
}));

vi.mock('../../utils/ai-quote-engine.js', () => ({
  AIQuoteEngine: vi.fn()
}));

vi.mock('../../utils/ai-context-engine.js', () => ({
  AIContextEngine: vi.fn()
}));

vi.mock('../../utils/human-interaction.js', () => ({
  HumanInteraction: vi.fn()
}));

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

vi.mock('../../utils/free-openrouter-helper.js', () => ({
  FreeOpenRouterHelper: {
    getInstance: vi.fn()
  }
}));

vi.mock('../../utils/twitter-interaction-methods.js', () => ({
  replyMethods: {},
  quoteMethods: {},
  executeReplyMethod: vi.fn(),
  executeQuoteMethod: vi.fn()
}));

describe('testHumanMethods task', () => {
  let mockLogger;
  let replyEngine;
  let quoteEngine;
  let contextEngine;
  let human;
  let page;

  const loadTask = async () => {
    const module = await import('../../tasks/testHumanMethods.js');
    return module.default;
  };

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn()
    };

    replyEngine = {
      shouldReply: vi.fn(),
      generateReply: vi.fn()
    };

    quoteEngine = {
      generateQuote: vi.fn()
    };

    contextEngine = {
      extractRepliesSmart: vi.fn()
    };

    human = {
      verifyComposerOpen: vi.fn(),
      typeText: vi.fn(),
      postTweet: vi.fn(),
      findElement: vi.fn(),
      fixation: vi.fn(),
      microMove: vi.fn(),
      debugMode: false
    };

    page = {
      goto: vi.fn().mockResolvedValue(undefined),
      emulateMedia: vi.fn().mockResolvedValue(undefined),
      waitForTimeout: vi.fn().mockResolvedValue(undefined),
      reload: vi.fn().mockResolvedValue(undefined),
      isClosed: vi.fn().mockReturnValue(false),
      close: vi.fn().mockResolvedValue(undefined),
      keyboard: { press: vi.fn().mockResolvedValue(undefined) },
      $$: vi.fn(),
      locator: vi.fn(),
      evaluate: vi.fn().mockResolvedValue({})
    };

    createLogger.mockReturnValue(mockLogger);
    getSettings.mockResolvedValue({ twitter: {} });
    config.init.mockResolvedValue(undefined);
    AIReplyEngine.mockImplementation(function () {
      return replyEngine;
    });
    AIQuoteEngine.mockImplementation(function () {
      return quoteEngine;
    });
    AIContextEngine.mockImplementation(function () {
      return contextEngine;
    });
    HumanInteraction.mockImplementation(function () {
      return human;
    });
    applyHumanizationPatch.mockResolvedValue(undefined);
    FreeOpenRouterHelper.getInstance.mockReturnValue({
      isTesting: vi.fn().mockReturnValue(false),
      getResults: vi.fn().mockReturnValue({ working: [] }),
      waitForTests: vi.fn().mockResolvedValue(undefined)
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('handles extractOnly mode with extracted replies', async () => {
    page.$$.mockResolvedValue([
      { innerText: vi.fn().mockResolvedValue('This is a sample tweet text content') }
    ]);
    contextEngine.extractRepliesSmart.mockResolvedValue([
      { author: 'user1', text: 'reply one' }
    ]);
    replyEngine.generateReply.mockResolvedValue({ reply: 'Generated reply' });

    const task = await loadTask();
    await task(page, { method: 'extractOnly', targetUrl: 'https://x.com/test/status/1' });

    expect(applyHumanizationPatch).toHaveBeenCalledWith(page, mockLogger);
    expect(contextEngine.extractRepliesSmart).toHaveBeenCalled();
    expect(replyEngine.generateReply).toHaveBeenCalled();
    expect(page.close).toHaveBeenCalled();
  });

  it('runs reply flow in safe mode without posting', async () => {
    page.$$.mockResolvedValue([
      { innerText: vi.fn().mockResolvedValue('This is a sample tweet text content') }
    ]);
    contextEngine.extractRepliesSmart.mockResolvedValue([]);
    replyEngine.shouldReply.mockResolvedValue({ decision: 'proceed' });
    replyEngine.generateReply.mockResolvedValue({ reply: 'Generated reply for safe mode' });
    human.verifyComposerOpen.mockResolvedValue({ open: true, selector: '.composer' });

    const task = await loadTask();
    await task(page, { method: 'replyA', mode: 'safe' });

    expect(replyEngine.shouldReply).toHaveBeenCalled();
    expect(human.verifyComposerOpen).toHaveBeenCalledWith(page);
    expect(page.keyboard.press).toHaveBeenCalledWith('Escape');
    expect(page.close).toHaveBeenCalled();
  });

  it('runs quote flow in safe mode without posting', async () => {
    page.$$.mockResolvedValue([
      { innerText: vi.fn().mockResolvedValue('This is a sample tweet text content') }
    ]);
    contextEngine.extractRepliesSmart.mockResolvedValue([]);
    quoteEngine.generateQuote.mockResolvedValue({ quote: 'Generated quote' });
    human.verifyComposerOpen.mockResolvedValue({ open: true, selector: '.composer' });

    const task = await loadTask();
    await task(page, { method: 'quoteA', mode: 'safe' });

    expect(quoteEngine.generateQuote).toHaveBeenCalled();
    expect(human.verifyComposerOpen).toHaveBeenCalledWith(page);
    expect(page.keyboard.press).toHaveBeenCalledWith('Escape');
    expect(page.close).toHaveBeenCalled();
  });
});

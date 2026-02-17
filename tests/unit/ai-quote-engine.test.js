import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../utils/logger.js', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }))
}));
vi.mock('../../utils/mathUtils.js', () => ({
  mathUtils: {
    roll: vi.fn()
  }
}));
vi.mock('../../utils/sentiment-service.js', () => ({
  sentimentService: {
    analyze: vi.fn(),
    analyzeForReplySelection: vi.fn()
  }
}));
vi.mock('../../utils/config-service.js', () => ({ config: {} }));
vi.mock('../../utils/scroll-helper.js', () => ({
  scrollRandom: vi.fn()
}));
let selectMethodImpl;

vi.mock('../../utils/human-interaction.js', () => ({
  HumanInteraction: class {
    constructor() {
      this.debugMode = false;
    }
    selectMethod(methods) {
      return selectMethodImpl ? selectMethodImpl(methods) : methods[0];
    }
    logStep() {}
    verifyComposerOpen() {
      return { open: true, selector: '[data-testid="tweetTextarea_0"]' };
    }
    typeText() {
      return Promise.resolve();
    }
    postTweet() {
      return Promise.resolve({ success: true, reason: 'posted' });
    }
    safeHumanClick() {
      return Promise.resolve(true);
    }
    findElement() {
      return Promise.resolve({
        selector: '[data-testid="retweet"]',
        element: {
          boundingBox: () => Promise.resolve({ y: 100 }),
          scrollIntoViewIfNeeded: () => Promise.resolve(),
          click: () => Promise.resolve()
        }
      });
    }
    hesitation() {
      return Promise.resolve();
    }
    fixation() {
      return Promise.resolve();
    }
    microMove() {
      return Promise.resolve();
    }
  }
}));
vi.mock('../../utils/twitter-reply-prompt.js', () => ({
  getStrategyInstruction: vi.fn(() => 'strategy')
}));

describe('ai-quote-engine', () => {
  let AIQuoteEngine;
  let mathUtils;
  let sentimentService;
  let engine;

  const baseSentiment = {
    isNegative: false,
    score: 0,
    dimensions: {
      valence: { valence: 0 },
      sarcasm: { sarcasm: 0 },
      toxicity: { toxicity: 0 }
    },
    composite: {
      riskLevel: 'low',
      engagementStyle: 'neutral',
      conversationType: 'general'
    }
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    ({ AIQuoteEngine } = await import('../../utils/ai-quote-engine.js'));
    ({ mathUtils } = await import('../../utils/mathUtils.js'));
    ({ sentimentService } = await import('../../utils/sentiment-service.js'));
    engine = new AIQuoteEngine({ processRequest: vi.fn(), sessionId: 'test' }, { quoteProbability: 0.5, maxRetries: 1 });
  });

  const createPageMock = (options = {}) => {
    const locator = {
      count: vi.fn().mockResolvedValue(1),
      click: vi.fn().mockResolvedValue(),
      first: function () {
        return this;
      },
      textContent: vi.fn().mockResolvedValue('https://x.com/status/1'),
      isVisible: vi.fn().mockResolvedValue(true),
      getAttribute: vi.fn().mockResolvedValue('Post'),
      scrollIntoViewIfNeeded: vi.fn().mockResolvedValue()
    };
    locator.all = vi.fn().mockResolvedValue([locator]);
    const page = {
      _document: options.document,
      _window: options.window,
      _navigator: options.navigator,
      evaluate: vi.fn((fn, arg) => {
        if (typeof fn !== 'function') return fn;
        const prevDocument = global.document;
        const prevWindow = global.window;
        const prevNavigator = global.navigator;
        global.document = page._document || { querySelector: () => ({ innerHTML: '' }) };
        global.window = page._window || { scrollTo: vi.fn(), innerHeight: 800 };
        global.navigator = page._navigator || { clipboard: { writeText: vi.fn() } };
        let result;
        try {
          result = fn(arg);
        } finally {
          global.document = prevDocument;
          global.window = prevWindow;
          global.navigator = prevNavigator;
        }
        return result;
      }),
      keyboard: { press: vi.fn().mockResolvedValue() },
      mouse: { click: vi.fn().mockResolvedValue(), move: vi.fn().mockResolvedValue() },
      locator: vi.fn(() => locator),
      waitForSelector: vi.fn().mockResolvedValue(),
      waitForTimeout: vi.fn().mockResolvedValue(),
      url: vi.fn().mockReturnValue('https://x.com/status/1')
    };
    return page;
  };

  it('skips when probability roll fails', async () => {
    mathUtils.roll.mockReturnValue(false);
    const result = await engine.shouldQuote('hello world', 'user');
    expect(result.decision).toBe('skip');
    expect(result.reason).toBe('probability');
  });

  it('proceeds when probability roll passes', async () => {
    mathUtils.roll.mockReturnValue(true);
    const result = await engine.shouldQuote('hello world', 'user');
    expect(result.decision).toBe('proceed');
    expect(result.reason).toBe('eligible');
  });

  it('rejects negative sentiment content', async () => {
    sentimentService.analyze.mockReturnValue({ ...baseSentiment, isNegative: true, score: 0.6 });
    const result = await engine.generateQuote('bad content', 'user', {});
    expect(result.success).toBe(false);
    expect(result.reason).toBe('negative_content');
  });

  it('rejects high risk conversations', async () => {
    sentimentService.analyze.mockReturnValue({ ...baseSentiment, composite: { ...baseSentiment.composite, riskLevel: 'high' } });
    const result = await engine.generateQuote('risky content', 'user', {});
    expect(result.success).toBe(false);
    expect(result.reason).toBe('high_risk_conversation');
  });

  it('extracts and cleans quotes', () => {
    const raw = 'Great insight here.';
    const extracted = engine.extractReplyFromResponse(raw);
    expect(extracted).toBe('Great insight here.');
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValueOnce(0.7).mockReturnValueOnce(0.7);
    const cleaned = engine.cleanQuote('"Great insight here."');
    randomSpy.mockRestore();
    expect(cleaned).toBe('Great insight here');
  });

  it('validates generic responses as invalid', () => {
    const result = engine.validateQuote('so true for me today');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('generic_response');
  });

  it('updates configuration and detects languages', () => {
    engine.updateConfig({ quoteProbability: 0.9, maxRetries: 3 });
    const lang = engine.detectLanguage('hola esto es una prueba');
    const replyLang = engine.detectReplyLanguage([{ text: 'bonjour le monde' }]);
    expect(engine.config.QUOTE_PROBABILITY).toBe(0.9);
    expect(engine.config.MAX_RETRIES).toBe(3);
    expect(lang).toBe('Spanish');
    expect(replyLang).toBe('French');
  });

  it('returns guidance and stats', () => {
    expect(engine.getToneGuidance('humorous')).toContain('witty');
    expect(engine.getToneGuidance('unknown')).toContain('question');
    expect(engine.getEngagementGuidance('high')).toContain('1-2');
    expect(engine.getEngagementGuidance('unknown')).toContain('short sentence');
    const sarcasticSentiment = {
      ...baseSentiment,
      composite: { ...baseSentiment.composite, engagementStyle: 'sarcastic' },
      dimensions: { ...baseSentiment.dimensions, sarcasm: { sarcasm: 0.8 } }
    };
    expect(engine.getSentimentGuidance(sarcasticSentiment)).toContain('ironic');
    engine.stats.attempts = 2;
    engine.stats.successes = 1;
    expect(engine.getStats().successRate).toBe('50.0%');
  });

  it('provides length and style guidance', () => {
    const length = engine.getLengthGuidance('question', 0.7);
    const style = engine.getStyleGuidance('humorous', 0.1);
    expect(length).toContain('Be more expressive');
    expect(style).toContain('Witty');
  });

  it('builds enhanced prompt with guidance and replies', () => {
    const prompt = engine.buildEnhancedPrompt(
      'tweet text',
      'author',
      [{ author: 'a', text: 'A longer reply that should be included' }],
      'https://x.com/status/1',
      baseSentiment,
      true,
      'high'
    );
    expect(prompt.text).toContain('TONE GUIDANCE');
    expect(prompt.text).toContain('STRATEGY INSTRUCTION');
    expect(prompt.text).toContain('A longer reply');
  });

  it('generates a quote successfully', async () => {
    sentimentService.analyze.mockReturnValue(baseSentiment);
    sentimentService.analyzeForReplySelection.mockReturnValue({
      strategy: 'mixed',
      distribution: { positive: 1, negative: 0, sarcastic: 0 },
      recommendations: {
        manualSelection: null,
        filter: () => true,
        sort: () => 0,
        max: 1
      },
      analyzed: [{ author: 'a', text: 'nice' }]
    });
    const agent = { processRequest: vi.fn().mockResolvedValue({ success: true, data: { content: 'Great take here.' } }), sessionId: 'test' };
    engine = new AIQuoteEngine(agent, { quoteProbability: 1, maxRetries: 1 });
    const result = await engine.generateQuote('tweet text', 'user', { replies: [{ author: 'a', text: 'nice' }] });
    expect(result.success).toBe(true);
    expect(result.quote.toLowerCase()).toContain('great');
  });

  it('handles empty LLM content', async () => {
    sentimentService.analyze.mockReturnValue(baseSentiment);
    sentimentService.analyzeForReplySelection.mockReturnValue({
      strategy: 'mixed',
      distribution: { positive: 0, negative: 0, sarcastic: 0 },
      recommendations: { manualSelection: null, filter: () => true, sort: () => 0, max: 1 },
      analyzed: []
    });
    const agent = { processRequest: vi.fn().mockResolvedValue({ success: true, data: { content: '' } }), sessionId: 'test' };
    engine = new AIQuoteEngine(agent, { quoteProbability: 1, maxRetries: 1 });
    const result = await engine.generateQuote('tweet text', 'user', {});
    expect(result.success).toBe(false);
    expect(result.reason).toContain('llm_empty_content');
  });

  it('returns failure when LLM result is null', async () => {
    sentimentService.analyze.mockReturnValue(baseSentiment);
    sentimentService.analyzeForReplySelection.mockReturnValue({
      strategy: 'mixed',
      distribution: { positive: 0, negative: 0, sarcastic: 0 },
      recommendations: { manualSelection: null, filter: () => true, sort: () => 0, max: 1 },
      analyzed: []
    });
    const agent = { processRequest: vi.fn().mockResolvedValue(null), sessionId: null };
    engine = new AIQuoteEngine(agent, { quoteProbability: 1, maxRetries: 1 });
    const result = await engine.generateQuote('tweet text', 'user', {});
    expect(result.success).toBe(false);
    expect(result.reason).toContain('all_attempts_failed');
  });

  it('returns failure when LLM request fails', async () => {
    sentimentService.analyze.mockReturnValue(baseSentiment);
    sentimentService.analyzeForReplySelection.mockReturnValue({
      strategy: 'mixed',
      distribution: { positive: 0, negative: 0, sarcastic: 0 },
      recommendations: { manualSelection: null, filter: () => true, sort: () => 0, max: 1 },
      analyzed: []
    });
    const agent = { processRequest: vi.fn().mockResolvedValue({ success: false, error: 'bad_request' }), sessionId: 'test' };
    engine = new AIQuoteEngine(agent, { quoteProbability: 1, maxRetries: 1 });
    const result = await engine.generateQuote('tweet text', 'user', {});
    expect(result.success).toBe(false);
    expect(result.reason).toContain('all_attempts_failed');
  });

  it('uses raw content fallback when reply extraction fails', async () => {
    sentimentService.analyze.mockReturnValue(baseSentiment);
    sentimentService.analyzeForReplySelection.mockReturnValue({
      strategy: 'mixed',
      distribution: { positive: 0, negative: 0, sarcastic: 0 },
      recommendations: { manualSelection: null, filter: () => true, sort: () => 0, max: 1 },
      analyzed: []
    });
    const agent = { processRequest: vi.fn().mockResolvedValue({ success: true, content: 'Fallback content that is long enough.' }), sessionId: 'test' };
    engine = new AIQuoteEngine(agent, { quoteProbability: 1, maxRetries: 1 });
    vi.spyOn(engine, 'extractReplyFromResponse').mockReturnValue(null);
    const result = await engine.generateQuote('tweet text', 'user', {});
    expect(result.success).toBe(true);
    expect(result.note).toBe('fallback_content_used');
  });

  it('returns failure when cleaned quote is too short', async () => {
    sentimentService.analyze.mockReturnValue(baseSentiment);
    sentimentService.analyzeForReplySelection.mockReturnValue({
      strategy: 'mixed',
      distribution: { positive: 0, negative: 0, sarcastic: 0 },
      recommendations: { manualSelection: null, filter: () => true, sort: () => 0, max: 1 },
      analyzed: []
    });
    const agent = { processRequest: vi.fn().mockResolvedValue({ success: true, content: 'short' }), sessionId: 'test' };
    engine = new AIQuoteEngine(agent, { quoteProbability: 1, maxRetries: 1 });
    vi.spyOn(engine, 'extractReplyFromResponse').mockReturnValue('short');
    const result = await engine.generateQuote('tweet text', 'user', {});
    expect(result.success).toBe(false);
    expect(result.reason).toContain('quote_too_short');
  });

  it('returns failure when validation fails', async () => {
    sentimentService.analyze.mockReturnValue(baseSentiment);
    sentimentService.analyzeForReplySelection.mockReturnValue({
      strategy: 'mixed',
      distribution: { positive: 0, negative: 0, sarcastic: 0 },
      recommendations: { manualSelection: null, filter: () => true, sort: () => 0, max: 1 },
      analyzed: []
    });
    const agent = { processRequest: vi.fn().mockResolvedValue({ success: true, content: 'politics are bad today' }), sessionId: 'test' };
    engine = new AIQuoteEngine(agent, { quoteProbability: 1, maxRetries: 1 });
    vi.spyOn(engine, 'extractReplyFromResponse').mockReturnValue('politics are bad today');
    const result = await engine.generateQuote('tweet text', 'user', {});
    expect(result.success).toBe(false);
    expect(result.reason).toContain('validation_failed');
  });

  it('executes quote methods and fallback', async () => {
    const timeoutSpy = vi.spyOn(global, 'setTimeout').mockImplementation((cb) => {
      cb();
      return 0;
    });
    const page = createPageMock({
      document: { querySelector: () => ({ innerHTML: '' }) },
      navigator: { clipboard: { writeText: vi.fn() } }
    });
    const direct = await engine.quoteMethodA_Keyboard(page, 'Test quote', { logStep: vi.fn(), verifyComposerOpen: () => ({ open: true, selector: '[data-testid="tweetTextarea_0"]' }), typeText: vi.fn(), postTweet: vi.fn().mockResolvedValue({ success: true }), safeHumanClick: vi.fn(), fixation: vi.fn(), microMove: vi.fn(), hesitation: vi.fn(), findElement: vi.fn().mockResolvedValue({ element: { boundingBox: () => Promise.resolve({ y: 100 }), scrollIntoViewIfNeeded: () => Promise.resolve(), click: () => Promise.resolve() }, selector: '[data-testid="retweet"]' }) });
    expect(direct.success).toBe(true);
    const retweet = await engine.quoteMethodB_Retweet(page, 'Test quote', { logStep: vi.fn(), verifyComposerOpen: () => ({ open: true, selector: '[data-testid="tweetTextarea_0"]' }), typeText: vi.fn(), postTweet: vi.fn().mockResolvedValue({ success: true }), safeHumanClick: vi.fn(), fixation: vi.fn(), microMove: vi.fn(), hesitation: vi.fn(), findElement: vi.fn().mockResolvedValue({ element: { boundingBox: () => Promise.resolve({ y: 100 }), scrollIntoViewIfNeeded: () => Promise.resolve(), click: () => Promise.resolve() }, selector: '[data-testid="retweet"]' }) });
    expect(retweet.success).toBe(true);
    const url = await engine.quoteMethodC_Url(page, 'Test quote', { logStep: vi.fn(), verifyComposerOpen: () => ({ open: true, selector: '[data-testid="tweetTextarea_0"]' }), typeText: vi.fn(), postTweet: vi.fn().mockResolvedValue({ success: true }), safeHumanClick: vi.fn(), fixation: vi.fn(), microMove: vi.fn(), hesitation: vi.fn(), findElement: vi.fn().mockResolvedValue({ element: { boundingBox: () => Promise.resolve({ y: 100 }), scrollIntoViewIfNeeded: () => Promise.resolve(), click: () => Promise.resolve() }, selector: '[data-testid="retweet"]' }) });
    expect(url.success).toBe(true);
    selectMethodImpl = () => ({ name: 'broken', fn: () => Promise.reject(new Error('fail')) });
    const fallback = await engine.executeQuote(page, 'Fallback quote');
    selectMethodImpl = null;
    timeoutSpy.mockRestore();
    expect(fallback.success).toBe(true);
  });

  it('falls back to retweet method when selected method throws', async () => {
    const timeoutSpy = vi.spyOn(global, 'setTimeout').mockImplementation((cb) => {
      cb();
      return 0;
    });
    selectMethodImpl = (methods) => methods[0];
    const page = createPageMock({
      document: { querySelector: () => ({ innerHTML: '' }) },
      navigator: { clipboard: { writeText: vi.fn() } }
    });
    vi.spyOn(engine, 'quoteMethodA_Keyboard').mockRejectedValue(new Error('fail'));
    vi.spyOn(engine, 'quoteMethodB_Retweet').mockResolvedValue({ success: true, method: 'retweet_menu' });
    const result = await engine.executeQuote(page, 'Test quote');
    selectMethodImpl = null;
    timeoutSpy.mockRestore();
    expect(result.success).toBe(true);
    expect(engine.quoteMethodB_Retweet).toHaveBeenCalled();
  });

  it('cleans quotes with random tweaks', () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValueOnce(0.2).mockReturnValueOnce(0.2);
    const cleaned = engine.cleanQuote('Hello World.');
    randomSpy.mockRestore();
    expect(cleaned.endsWith('.')).toBe(false);
  });
});

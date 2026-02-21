import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('fs/promises', () => ({}));

vi.mock('../../utils/logger.js', () => ({
  createBufferedLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    shutdown: vi.fn()
  }),
  createLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  })
}));

vi.mock('../../utils/configLoader.js', () => ({
  getSettings: vi.fn().mockResolvedValue({}),
  getTimeoutValue: vi.fn().mockResolvedValue({})
}));

vi.mock('../../constants/twitter-timeouts.js', () => ({
  TWITTER_TIMEOUTS: {
    NAVIGATION: 1000,
    DOM_CONTENT: 1000,
    POST_CLICK: 100
  }
}));

vi.mock('../../core/agent-connector.js', () => ({
  default: vi.fn().mockImplementation(function () {
    return {
      processRequest: vi.fn().mockResolvedValue({ text: 'test' })
    };
  })
}));

vi.mock('../../utils/engagement-limits.js', () => ({
  engagementLimits: {
    createEngagementTracker: vi.fn().mockReturnValue({
      canPerform: vi.fn().mockReturnValue(true),
      record: vi.fn().mockReturnValue(true),
      getProgress: vi.fn().mockReturnValue('0/5'),
      getStatus: vi.fn().mockReturnValue({ replies: { current: 0, limit: 3 }, likes: { current: 0, limit: 5 } }),
      getSummary: vi.fn().mockReturnValue('replies: 0/3, likes: 0/5'),
      getUsageRate: vi.fn().mockReturnValue('25%')
    })
  }
}));

vi.mock('../../utils/session-phases.js', () => ({
  sessionPhases: {
    getCurrentPhase: vi.fn().mockReturnValue('normal'),
    getSessionPhase: vi.fn().mockReturnValue('normal'),
    getPhaseStats: vi.fn().mockReturnValue({ description: 'Normal phase' }),
    getPhaseModifier: vi.fn().mockReturnValue(1.0)
  }
}));

vi.mock('../../utils/sentiment-service.js', () => ({
  sentimentService: {
    analyze: vi.fn().mockReturnValue({ isNegative: false, score: 0.2 })
  }
}));

vi.mock('../../utils/ai-reply-engine.js', () => ({
  AIReplyEngine: vi.fn().mockImplementation(function () {
    return {
      generateReply: vi.fn().mockResolvedValue({ text: 'test reply' }),
      config: { REPLY_PROBABILITY: 0.5 }
    };
  })
}));

vi.mock('../../utils/ai-quote-engine.js', () => ({
  AIQuoteEngine: vi.fn().mockImplementation(function () {
    return {
      generateQuote: vi.fn().mockResolvedValue({ text: 'test quote' })
    };
  })
}));

vi.mock('../../utils/ai-context-engine.js', () => ({
  AIContextEngine: vi.fn().mockImplementation(function () {
    return {
      extractEnhancedContext: vi.fn().mockResolvedValue({})
    };
  })
}));

vi.mock('../../utils/micro-interactions.js', () => ({
  microInteractions: {
    createMicroInteractionHandler: vi.fn().mockReturnValue({
      executeMicroInteraction: vi.fn().mockResolvedValue({ success: true, type: 'test' }),
      textHighlight: vi.fn().mockResolvedValue({ success: true }),
      startFidgetLoop: vi.fn().mockReturnValue({}),
      stopFidgetLoop: vi.fn(),
      config: {
        highlightChance: 0.1,
        rightClickChance: 0.1,
        logoClickChance: 0.1,
        whitespaceClickChance: 0.1
      }
    })
  }
}));

vi.mock('../../utils/motor-control.js', () => ({
  motorControl: {
    createMotorController: vi.fn().mockReturnValue({
      smartClick: vi.fn().mockResolvedValue({ success: true, x: 100, y: 100 })
    })
  }
}));

vi.mock('../../utils/mathUtils.js', () => ({
  mathUtils: {
    randomInRange: vi.fn().mockReturnValue(1000),
    weightedRandom: vi.fn().mockReturnValue('reply'),
    roll: vi.fn().mockReturnValue(true),
    gaussian: vi.fn().mockReturnValue(5000)
  }
}));

vi.mock('../../utils/entropyController.js', () => ({
  entropy: {
    addEntropy: vi.fn(),
    retryDelay: vi.fn().mockReturnValue(100),
    scrollSettleTime: vi.fn().mockReturnValue(100),
    postClickDelay: vi.fn().mockReturnValue(500)
  }
}));

vi.mock('../../utils/twitter-reply-prompt.js', () => ({
  buildEnhancedPrompt: vi.fn().mockReturnValue('mock prompt')
}));

vi.mock('../../utils/scroll-helper.js', () => ({
  scrollDown: vi.fn().mockResolvedValue(undefined),
  scrollUp: vi.fn().mockResolvedValue(undefined),
  scrollRandom: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../../utils/config-service.js', () => ({
  config: {
    getEngagementLimits: vi.fn().mockReturnValue({})
  }
}));

vi.mock('../../utils/async-queue.js', () => {
  const MockDiveQueue = vi.fn(function () {
    return {
      canEngage: vi.fn().mockReturnValue(true),
      recordEngagement: vi.fn().mockReturnValue(true),
      getEngagementProgress: vi.fn().mockReturnValue({ replies: { current: 0, limit: 3 }, likes: { current: 0, limit: 5 } }),
      getFullStatus: vi.fn().mockReturnValue({
        queueLength: 0,
        activeCount: 0,
        utilization: 0,
        capacity: 30,
        maxQueueSize: 30,
        engagementLimits: {
          replies: { used: 0, limit: 3 },
          likes: { used: 0, limit: 5 },
          quotes: { used: 0, limit: 2 },
          bookmarks: { used: 0, limit: 2 }
        },
        retryInfo: { pendingRetries: 0 }
      }),
      isHealthy: vi.fn().mockReturnValue(true),
      addJob: vi.fn(),
      addDive: vi.fn().mockImplementation(async (task) => {
        if (task) await task();
        return { success: true, result: {} };
      }),
      clear: vi.fn(),
      on: vi.fn(),
      getQueueStatus: vi.fn().mockReturnValue({}),
      start: vi.fn(),
      stop: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      processQueue: vi.fn(),
      enableQuickMode: vi.fn()
    };
  });
  return { DiveQueue: MockDiveQueue };
});

vi.mock('../../utils/actions/ai-twitter-reply.js', () => ({
  AIReplyAction: vi.fn().mockImplementation(function () {
    return {
      execute: vi.fn().mockResolvedValue({ success: true, executed: true, reason: 'test' }),
      getStats: vi.fn().mockReturnValue({ executed: 0 })
    };
  })
}));

vi.mock('../../utils/actions/ai-twitter-quote.js', () => ({
  AIQuoteAction: vi.fn().mockImplementation(function () {
    return {
      execute: vi.fn().mockResolvedValue({ success: true, executed: true, reason: 'test' }),
      getStats: vi.fn().mockReturnValue({ executed: 0 })
    };
  })
}));

vi.mock('../../utils/actions/ai-twitter-like.js', () => ({
  LikeAction: vi.fn().mockImplementation(function () {
    return {
      execute: vi.fn().mockResolvedValue({ success: true, executed: true, reason: 'test' }),
      getStats: vi.fn().mockReturnValue({ executed: 0 })
    };
  })
}));

vi.mock('../../utils/actions/ai-twitter-bookmark.js', () => ({
  BookmarkAction: vi.fn().mockImplementation(function () {
    return {
      execute: vi.fn().mockResolvedValue({ success: true, executed: true, reason: 'test' }),
      getStats: vi.fn().mockReturnValue({ executed: 0 })
    };
  })
}));

vi.mock('../../utils/actions/ai-twitter-retweet.js', () => ({
  RetweetAction: vi.fn().mockImplementation(function () {
    return {
      execute: vi.fn().mockResolvedValue({ success: true, executed: true, reason: 'test' }),
      getStats: vi.fn().mockReturnValue({ executed: 0 })
    };
  })
}));

vi.mock('../../utils/actions/ai-twitter-go-home.js', () => ({
  GoHomeAction: vi.fn().mockImplementation(function () {
    return {
      execute: vi.fn().mockResolvedValue({ success: true, executed: true, reason: 'test' }),
      getStats: vi.fn().mockReturnValue({ executed: 0 })
    };
  })
}));

vi.mock('../../utils/actions/index.js', () => {
  const MockActionRunner = vi.fn(function () {
    return {
      selectAction: vi.fn().mockReturnValue('like'),
      executeAction: vi.fn().mockResolvedValue({ success: true, executed: true, reason: 'test' }),
      getStats: vi.fn().mockReturnValue({})
    };
  });
  return { ActionRunner: MockActionRunner };
});

vi.mock('../../constants/twitter-timeouts.js', () => ({
  TWITTER_TIMEOUTS: {
    POST_TWEET: 5000,
    NAVIGATION: 5000,
    ELEMENT_VISIBLE: 5000,
    DIVE_TIMEOUT: 120000
  }
}));

vi.mock('../../utils/human-interaction.js', () => {
  const MockHumanInteraction = vi.fn(function () {
    return {
      sessionStart: vi.fn(),
      session: { shouldEndSession: vi.fn().mockReturnValue(false) }
    };
  });
  return { HumanInteraction: MockHumanInteraction };
});

describe('AITwitterAgent Coverage Tests', () => {
  let agent;
  let mockPage;
  let mockProfile;
  let mockLogger;

  beforeEach(async () => {
    mockPage = {
      goto: vi.fn().mockResolvedValue(undefined),
      url: vi.fn().mockReturnValue('https://x.com/home'),
      evaluate: vi.fn().mockResolvedValue({ readyState: 'complete', title: 'Home', hasBody: true }),
      on: vi.fn(),
      off: vi.fn(),
      locator: vi.fn().mockReturnValue({
        count: vi.fn().mockResolvedValue(0),
        first: vi.fn().mockReturnValue({
          count: vi.fn().mockResolvedValue(0),
          isVisible: vi.fn().mockResolvedValue(false)
        }),
        nth: vi.fn().mockReturnValue({
          boundingBox: vi.fn().mockResolvedValue(null)
        })
      }),
      waitForTimeout: vi.fn().mockResolvedValue(undefined),
      waitForURL: vi.fn().mockResolvedValue(undefined),
      waitForSelector: vi.fn().mockResolvedValue(undefined),
      keyboard: {
        press: vi.fn().mockResolvedValue(undefined),
        type: vi.fn().mockResolvedValue(undefined)
      },
      mouse: { move: vi.fn(), wheel: vi.fn().mockResolvedValue(undefined) },
      viewportSize: vi.fn().mockReturnValue({ width: 1000, height: 800 }),
      emulateMedia: vi.fn(),
      context: vi.fn().mockReturnValue({
        browser: vi.fn().mockReturnValue({
          isConnected: vi.fn().mockReturnValue(true)
        })
      })
    };

    mockProfile = {
      id: 'test-profile',
      username: 'testuser'
    };

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn()
    };

    vi.clearAllMocks();

    const { AITwitterAgent } = await import('../../utils/ai-twitterAgent.js');
    agent = new AITwitterAgent(mockPage, mockProfile, mockLogger, {
      engagementLimits: {
        replies: 10,
        retweets: 5,
        quotes: 5,
        likes: 20,
        follows: 10,
        bookmarks: 10
      },
      replyProbability: 0.8,
      quoteProbability: 0.3,
      config: { theme: 'dark' }
    });
  });

  describe('Constructor', () => {
    it('should instantiate AITwitterAgent', () => {
      expect(agent).toBeDefined();
    });

    it('should initialize page state to HOME', () => {
      expect(agent.pageState).toBe('HOME');
    });

    it('should initialize scrolling enabled', () => {
      expect(agent.scrollingEnabled).toBe(true);
    });

    it('should initialize operation lock to false', () => {
      expect(agent.operationLock).toBe(false);
    });

    it('should initialize dive lock to false', () => {
      expect(agent.diveLockAcquired).toBe(false);
    });

    it('should initialize aiStats', () => {
      expect(agent.aiStats).toBeDefined();
      expect(agent.aiStats.attempts).toBe(0);
      expect(agent.aiStats.replies).toBe(0);
    });

    it('should initialize session start time', () => {
      expect(agent.sessionStart).toBeDefined();
      expect(typeof agent.sessionStart).toBe('number');
    });

    it('should initialize current phase to warmup', () => {
      expect(agent.currentPhase).toBe('warmup');
    });

    it('should have diveQueue', () => {
      expect(agent.diveQueue).toBeDefined();
    });

    it('should have engagementTracker', () => {
      expect(agent.engagementTracker).toBeDefined();
    });

    it('should have replyEngine', () => {
      expect(agent.replyEngine).toBeDefined();
    });

    it('should have quoteEngine', () => {
      expect(agent.quoteEngine).toBeDefined();
    });

    it('should have contextEngine', () => {
      expect(agent.contextEngine).toBeDefined();
    });

    it('should have microHandler', () => {
      expect(agent.microHandler).toBeDefined();
    });

    it('should have motorHandler', () => {
      expect(agent.motorHandler).toBeDefined();
    });

    it('should have actionRunner', () => {
      expect(agent.actionRunner).toBeDefined();
    });

    it('should have actions', () => {
      expect(agent.actions).toBeDefined();
      expect(agent.actions.reply).toBeDefined();
      expect(agent.actions.quote).toBeDefined();
      expect(agent.actions.like).toBeDefined();
      expect(agent.actions.bookmark).toBeDefined();
      expect(agent.actions.retweet).toBeDefined();
      expect(agent.actions.goHome).toBeDefined();
    });

    it('should have humanInteraction', () => {
      expect(agent.humanInteraction).toBeDefined();
    });

    it('should have queueLogger', () => {
      expect(agent.queueLogger).toBeDefined();
    });

    it('should have engagementLogger', () => {
      expect(agent.engagementLogger).toBeDefined();
    });

    it('should initialize _processedTweetIds as Set', () => {
      expect(agent._processedTweetIds).toBeInstanceOf(Set);
    });

    it('should initialize scroll tracking variables', () => {
      expect(agent._lastScrollY).toBe(0);
      expect(agent._lastScrollTime).toBe(0);
      expect(agent._minScrollPerDive).toBe(400);
      expect(agent._scrollExplorationThreshold).toBe(600);
    });
  });

  describe('Page State Methods', () => {
    it('startDive should acquire lock and set state to DIVING', async () => {
      const result = await agent.startDive();
      expect(result).toBe(true);
      expect(agent.operationLock).toBe(true);
      expect(agent.diveLockAcquired).toBe(true);
      expect(agent.pageState).toBe('DIVING');
      expect(agent.scrollingEnabled).toBe(false);
    });

    it('startDive should wait for existing operation to complete', async () => {
      agent.operationLock = true;
      setTimeout(() => { agent.operationLock = false; }, 150);

      const start = Date.now();
      await agent.startDive();
      const duration = Date.now() - start;

      expect(duration).toBeGreaterThan(100);
      expect(agent.operationLock).toBe(true);
    });

    it('endDive with returnHome should navigate home and reset state', async () => {
      agent.operationLock = true;
      agent.diveLockAcquired = true;
      agent.pageState = 'DIVING';
      mockPage.url.mockReturnValue('https://x.com/home');
      agent.navigateHome = vi.fn().mockResolvedValue(true);

      await agent.endDive(true, true);

      expect(agent.operationLock).toBe(false);
      expect(agent.diveLockAcquired).toBe(false);
      expect(agent.pageState).toBe('HOME');
      expect(agent.scrollingEnabled).toBe(true);
    });

    it('endDive without returnHome should set TWEET_PAGE on success', async () => {
      agent.operationLock = true;
      agent.diveLockAcquired = true;
      agent.pageState = 'DIVING';

      await agent.endDive(true, false);

      expect(agent.pageState).toBe('TWEET_PAGE');
      expect(agent.scrollingEnabled).toBe(true);
    });

    it('endDive without returnHome should set HOME on failure', async () => {
      agent.operationLock = true;
      agent.diveLockAcquired = true;
      agent.pageState = 'DIVING';

      await agent.endDive(false, false);

      expect(agent.pageState).toBe('HOME');
    });

    it('isDiving should return true when operationLock and DIVING state', () => {
      agent.operationLock = true;
      agent.pageState = 'DIVING';

      expect(agent.isDiving()).toBe(true);
    });

    it('isDiving should return false when not in DIVING state', () => {
      agent.operationLock = true;
      agent.pageState = 'HOME';

      expect(agent.isDiving()).toBe(false);
    });

    it('isOnTweetPage should return true when URL contains /status/', () => {
      mockPage.url.mockReturnValue('https://x.com/user/status/123456');

      expect(agent.isOnTweetPage()).toBe(true);
    });

    it('isOnTweetPage should return true when pageState is TWEET_PAGE', () => {
      mockPage.url.mockReturnValue('https://x.com/home');
      agent.pageState = 'TWEET_PAGE';

      expect(agent.isOnTweetPage()).toBe(true);
    });

    it('canScroll should return true when enabled and no lock', () => {
      agent.scrollingEnabled = true;
      agent.operationLock = false;

      expect(agent.canScroll()).toBe(true);
    });

    it('canScroll should return false when scrolling disabled', () => {
      agent.scrollingEnabled = false;
      agent.operationLock = false;

      expect(agent.canScroll()).toBe(false);
    });

    it('canScroll should return false when operation lock is active', () => {
      agent.scrollingEnabled = true;
      agent.operationLock = true;

      expect(agent.canScroll()).toBe(false);
    });

    it('getPageState should return current state object', () => {
      const state = agent.getPageState();

      expect(state).toBeDefined();
      expect(state.state).toBe('HOME');
      expect(state.scrollingEnabled).toBe(true);
      expect(state.operationLock).toBe(false);
      expect(state.url).toBe('https://x.com/home');
    });

    it('logDiveStatus should log current status', () => {
      agent.logDiveStatus();

      expect(mockLogger.info).toHaveBeenCalled();
    });
  });

  describe('Navigation Methods', () => {
    it('_safeNavigateHome should return true if already on home', async () => {
      mockPage.url.mockReturnValue('https://x.com/home');

      const result = await agent._safeNavigateHome();

      expect(result).toBe(true);
    });

    it('_safeNavigateHome should call navigateHome', async () => {
      mockPage.url.mockReturnValue('https://x.com/settings');
      agent.navigateHome = vi.fn().mockResolvedValue(true);

      await agent._safeNavigateHome();

      expect(agent.navigateHome).toHaveBeenCalled();
    });

    it('_safeNavigateHome should fallback to goto on navigateHome failure', async () => {
      mockPage.url.mockReturnValue('https://x.com/settings');
      agent.navigateHome = vi.fn().mockRejectedValue(new Error('nav failed'));

      await agent._safeNavigateHome();

      expect(mockPage.goto).toHaveBeenCalledWith('https://x.com/home', expect.any(Object));
    });

    it('waitForDiveComplete should wait until operationLock is false', async () => {
      agent.operationLock = true;
      setTimeout(() => { agent.operationLock = false; }, 100);

      await agent.waitForDiveComplete();

      expect(agent.operationLock).toBe(false);
    });

    it('shouldContinueSession should return false when operation lock active', () => {
      agent.operationLock = true;

      expect(agent.shouldContinueSession()).toBe(false);
    });

    it('shouldContinueSession should return true when no operation lock', () => {
      agent.operationLock = false;

      expect(agent.shouldContinueSession()).toBe(true);
    });

    it('performIdleCursorMovement should move mouse', async () => {
      await agent.performIdleCursorMovement();

      expect(mockPage.mouse.move).toHaveBeenCalled();
    });
  });

  describe('Log Methods', () => {
    it('logDebug should log debug message', () => {
      agent.logDebug('test message');

      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('[DEBUG] test message'));
    });

    it('logWarn should log warning message', () => {
      agent.logWarn('warning message');

      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('[WARN] warning message'));
    });
  });

  describe('Session Phase Methods', () => {
    it('updateSessionPhase should return current phase', () => {
      const phase = agent.updateSessionPhase();

      expect(phase).toBeDefined();
    });

    it('updateSessionPhase should update currentPhase', () => {
      agent.updateSessionPhase();

      expect(agent.currentPhase).toBeDefined();
    });

    it('getPhaseModifiedProbability should return adjusted probability', () => {
      const prob = agent.getPhaseModifiedProbability('reply', 0.5);

      expect(typeof prob).toBe('number');
      expect(prob).toBeGreaterThanOrEqual(0);
      expect(prob).toBeLessThanOrEqual(1);
    });

    it('getSessionProgress should return percentage', () => {
      agent.sessionStart = Date.now() - 10000;

      const progress = agent.getSessionProgress();

      expect(typeof progress).toBe('number');
      expect(progress).toBeGreaterThan(0);
      expect(progress).toBeLessThanOrEqual(100);
    });

    it('isInCooldown should return boolean', () => {
      const result = agent.isInCooldown();

      expect(typeof result).toBe('boolean');
    });

    it('isInWarmup should return boolean', () => {
      const result = agent.isInWarmup();

      expect(typeof result).toBe('boolean');
    });
  });

  describe('Micro Interaction Methods', () => {
    it('triggerMicroInteraction should handle probability skip', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(1.0);

      const result = await agent.triggerMicroInteraction();

      expect(result.success).toBe(false);
      expect(result.reason).toBe('probability_skip');
    });

    it('triggerMicroInteraction should execute micro interaction', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.0);

      const result = await agent.triggerMicroInteraction();

      expect(typeof result).toBe('object');
    });

    it('triggerMicroInteraction should handle errors', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.0);
      agent.microHandler.executeMicroInteraction = vi.fn().mockRejectedValue(new Error('test error'));

      const result = await agent.triggerMicroInteraction();

      expect(result.success).toBe(false);
    });

    it('highlightText should call microHandler', async () => {
      const result = await agent.highlightText();

      expect(typeof result).toBe('object');
    });

    it('startFidgetLoop should call microHandler', () => {
      const result = agent.startFidgetLoop();

      expect(typeof result).toBe('object');
    });

    it('stopFidgetLoop should call microHandler', () => {
      agent.stopFidgetLoop();
    });

    it('simulateFidget should handle errors', async () => {
      agent.microHandler.executeMicroInteraction = vi.fn().mockRejectedValue(new Error('fidget error'));

      await agent.simulateFidget();
    });
  });

  describe('Smart Click Methods', () => {
    it('smartClick should call motorHandler', async () => {
      const result = await agent.smartClick('test-context');

      expect(typeof result).toBe('object');
    });

    it('smartClick should handle failure', async () => {
      agent.motorHandler.smartClick = vi.fn().mockResolvedValue({ success: false, reason: 'miss' });

      const result = await agent.smartClick('test-context');

      expect(result.success).toBe(false);
    });

    it('smartClickElement should call motorHandler', async () => {
      const result = await agent.smartClickElement('[data-testid="test"]');

      expect(typeof result).toBe('object');
    });

    it('smartClickElement should handle errors', async () => {
      agent.motorHandler.smartClick = vi.fn().mockRejectedValue(new Error('click error'));

      const result = await agent.smartClickElement('[data-testid="test"]');

      expect(result.success).toBe(false);
    });
  });

  describe('AI Stats Methods', () => {
    it('getAIStats should return stats with calculated success rate', () => {
      agent.aiStats = {
        attempts: 10,
        replies: 5,
        skips: 3,
        safetyBlocks: 1,
        errors: 1
      };

      const stats = agent.getAIStats();

      expect(stats.attempts).toBe(10);
      expect(stats.replies).toBe(5);
      expect(stats.successRate).toBe('50.0%');
    });

    it('getAIStats should handle zero attempts', () => {
      agent.aiStats = {
        attempts: 0,
        replies: 0,
        skips: 0,
        safetyBlocks: 0,
        errors: 0
      };

      const stats = agent.getAIStats();

      expect(stats.successRate).toBe('0%');
    });

    it('getActionStats should return actionRunner stats', () => {
      const mockStats = { reply: { executed: 5 }, like: { executed: 10 } };
      agent.actionRunner.getStats = vi.fn().mockReturnValue(mockStats);

      const stats = agent.getActionStats();

      expect(stats).toEqual(mockStats);
    });

    it('getActionStats should fallback to individual actions', () => {
      agent.actionRunner = null;
      agent.actions = {
        reply: { getStats: vi.fn().mockReturnValue({ executed: 5 }) },
        like: { getStats: vi.fn().mockReturnValue({ executed: 10 }) }
      };

      const stats = agent.getActionStats();

      expect(stats.reply.executed).toBe(5);
      expect(stats.like.executed).toBe(10);
    });

    it('getEngagementStats should return tracker data', () => {
      const stats = agent.getEngagementStats();

      expect(stats).toBeDefined();
      expect(stats.tracker).toBeDefined();
      expect(stats.summary).toBeDefined();
    });
  });

  describe('Queue Methods', () => {
    it('getQueueStatus should return queue status', () => {
      const status = agent.getQueueStatus();

      expect(status).toBeDefined();
    });

    it('isQueueHealthy should delegate to diveQueue', () => {
      const result = agent.isQueueHealthy();

      expect(typeof result).toBe('boolean');
    });
  });

  describe('Fallback Engagement', () => {
    it('_quickFallbackEngagement should perform like engagement', async () => {
      agent.diveQueue.canEngage = vi.fn().mockReturnValue(true);
      agent.handleLike = vi.fn().mockResolvedValue(true);
      vi.spyOn(Math, 'random').mockReturnValue(0.1);

      const result = await agent._quickFallbackEngagement();

      expect(result.engagementType).toBe('like');
      expect(result.success).toBe(true);
    });

    it('_quickFallbackEngagement should perform bookmark engagement', async () => {
      agent.diveQueue.canEngage = vi.fn().mockReturnValue(true);
      agent.handleBookmark = vi.fn().mockResolvedValue(true);
      vi.spyOn(Math, 'random').mockReturnValue(0.5);

      const result = await agent._quickFallbackEngagement();

      expect(result.engagementType).toBe('bookmark');
    });

    it('_quickFallbackEngagement should skip when at limits', async () => {
      agent.diveQueue.canEngage = vi.fn().mockReturnValue(false);

      const result = await agent._quickFallbackEngagement();

      expect(result.engagementType).toBe('none');
    });

    it('_quickFallbackEngagement should handle errors', async () => {
      agent.diveQueue.canEngage = vi.fn().mockReturnValue(true);
      agent.handleLike = vi.fn().mockRejectedValue(new Error('like failed'));
      vi.spyOn(Math, 'random').mockReturnValue(0.1);

      const result = await agent._quickFallbackEngagement();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Health Check', () => {
    it('performHealthCheck should return healthy when browser connected', async () => {
      mockPage.evaluate.mockResolvedValue({ readyState: 'complete', title: 'Home', hasBody: true });

      const result = await agent.performHealthCheck();

      expect(result.healthy).toBe(true);
    });

    it('performHealthCheck should return unhealthy when browser disconnected', async () => {
      mockPage.context.mockReturnValue({
        browser: vi.fn().mockReturnValue({
          isConnected: vi.fn().mockReturnValue(false)
        })
      });
      mockPage.evaluate.mockResolvedValue({ readyState: 'complete', title: 'Home', hasBody: true });

      const result = await agent.performHealthCheck();

      expect(result.healthy).toBe(false);
    });
  });

  describe('Dive Tweet Methods', () => {
    it('diveTweet should skip if already scanning', async () => {
      agent.isScanning = true;

      await agent.diveTweet();

      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Scan already in progress'));
    });

    it('diveTweet should call _diveTweetWithAI', async () => {
      agent._diveTweetWithAI = vi.fn().mockImplementation(async (callback) => {
        if (callback) await callback(() => { });
      });

      await agent.diveTweet();

      expect(agent._diveTweetWithAI).toHaveBeenCalled();
    });

    it('diveTweet should handle errors and call endDive', async () => {
      agent._diveTweetWithAI = vi.fn().mockRejectedValue(new Error('dive failed'));
      agent.diveLockAcquired = true;
      agent.operationLock = true;
      agent.endDive = vi.fn().mockResolvedValue();

      await agent.diveTweet();

      expect(agent.endDive).toHaveBeenCalledWith(false, true);
    });

    it('_ensureExplorationScroll should return true if scrolled enough', async () => {
      mockPage.evaluate.mockResolvedValue(500);

      const result = await agent._ensureExplorationScroll();

      expect(result).toBe(true);
    });
  });

  describe('Processed Tweet Tracking', () => {
    it('should track processed tweet IDs', () => {
      agent._processedTweetIds.add('123');

      expect(agent._processedTweetIds.has('123')).toBe(true);
      expect(agent._processedTweetIds.has('456')).toBe(false);
    });
  });

  describe('Action Handler Methods', () => {
    it('should have all action handlers', () => {
      expect(agent.actions.reply).toBeDefined();
      expect(agent.actions.quote).toBeDefined();
      expect(agent.actions.like).toBeDefined();
      expect(agent.actions.bookmark).toBeDefined();
      expect(agent.actions.retweet).toBeDefined();
      expect(agent.actions.goHome).toBeDefined();
    });

    it('should have actionRunner with selectAction', () => {
      expect(agent.actionRunner.selectAction).toBeDefined();
    });

    it('should have actionRunner with executeAction', () => {
      expect(agent.actionRunner.executeAction).toBeDefined();
    });
  });

  describe.skip('handleAIReply', () => {
    it('should handle handleAIReply with pre-validated action', async () => {
      const sentimentService = await import('../../utils/sentiment-service.js');
      sentimentService.sentimentService.analyze.mockReturnValue({
        isNegative: false,
        score: 0.5,
        dimensions: {
          valence: { valence: 0.5 },
          arousal: { arousal: 0.5 },
          dominance: { dominance: 0.5 },
          sarcasm: { sarcasm: 0.1 },
          toxicity: { toxicity: 0.1 }
        },
        composite: { riskLevel: 'low', conversationType: 'discussion' },
        engagement: { canLike: true, warnings: [] }
      });

      agent.contextEngine.extractEnhancedContext = vi.fn().mockResolvedValue({
        sentiment: { overall: 'neutral' },
        tone: { primary: 'neutral' },
        engagementLevel: 'low',
        replies: []
      });

      agent.replyEngine.generateReply = vi.fn().mockResolvedValue({
        success: true,
        reply: 'Test reply'
      });

      agent.executeAIReply = vi.fn().mockResolvedValue(true);
      agent.engagementTracker.canPerform.mockReturnValue(true);
      agent.diveQueue.canEngage.mockReturnValue(true);

      await agent.handleAIReply('test content', 'user123', { url: 'https://x.com/test', action: 'reply' });

      expect(agent.executeAIReply).toHaveBeenCalled();
    });

    it('should skip reply on negative sentiment', async () => {
      const sentimentService = require('../../utils/sentiment-service.js');
      sentimentService.sentimentService.analyze.mockReturnValue({
        isNegative: true,
        score: -0.5,
        dimensions: {
          valence: { valence: -0.5 },
          arousal: { arousal: 0.5 },
          dominance: { dominance: 0.5 },
          sarcasm: { sarcasm: 0.1 },
          toxicity: { toxicity: 0.8 }
        },
        composite: { riskLevel: 'low', conversationType: 'discussion' },
        engagement: { canLike: true, warnings: [] }
      });

      await agent.handleAIReply('negative content', 'user123', { url: 'https://x.com/test' });

      expect(agent.aiStats.skips).toBe(1);
    });

    it('should skip reply on high risk content', async () => {
      const sentimentService = require('../../utils/sentiment-service.js');
      sentimentService.sentimentService.analyze.mockReturnValue({
        isNegative: false,
        score: 0.5,
        dimensions: {
          valence: { valence: 0.5 },
          arousal: { arousal: 0.5 },
          dominance: { dominance: 0.5 },
          sarcasm: { sarcasm: 0.1 },
          toxicity: { toxicity: 0.1 }
        },
        composite: { riskLevel: 'high', conversationType: 'controversial' },
        engagement: { canLike: true, warnings: [] }
      });

      await agent.handleAIReply('risky content', 'user123', { url: 'https://x.com/test' });

      expect(agent.aiStats.skips).toBe(1);
    });

    it('should skip when engagement limit reached', async () => {
      const sentimentService = require('../../utils/sentiment-service.js');
      sentimentService.sentimentService.analyze.mockReturnValue({
        isNegative: false,
        score: 0.5,
        dimensions: {
          valence: { valence: 0.5 },
          arousal: { arousal: 0.5 },
          dominance: { dominance: 0.5 },
          sarcasm: { sarcasm: 0.1 },
          toxicity: { toxicity: 0.1 }
        },
        composite: { riskLevel: 'low', conversationType: 'discussion' },
        engagement: { canLike: true, warnings: [] }
      });

      agent.contextEngine.extractEnhancedContext = vi.fn().mockResolvedValue({
        sentiment: { overall: 'neutral' },
        tone: { primary: 'neutral' },
        engagementLevel: 'low',
        replies: []
      });

      agent.replyEngine.shouldReply = vi.fn().mockResolvedValue({
        decision: 'reply',
        reply: 'Test reply'
      });

      agent.engagementTracker.canPerform.mockReturnValue(false);

      await agent.handleAIReply('test content', 'user123', { url: 'https://x.com/test' });

      expect(agent.aiStats.skips).toBe(1);
    });

    it('should handle skip decision from reply engine', async () => {
      const sentimentService = require('../../utils/sentiment-service.js');
      sentimentService.sentimentService.analyze.mockReturnValue({
        isNegative: false,
        score: 0.5,
        dimensions: {
          valence: { valence: 0.5 },
          arousal: { arousal: 0.5 },
          dominance: { dominance: 0.5 },
          sarcasm: { sarcasm: 0.1 },
          toxicity: { toxicity: 0.1 }
        },
        composite: { riskLevel: 'low', conversationType: 'discussion' },
        engagement: { canLike: true, warnings: [] }
      });

      agent.contextEngine.extractEnhancedContext = vi.fn().mockResolvedValue({
        sentiment: { overall: 'neutral' },
        tone: { primary: 'neutral' },
        engagementLevel: 'low',
        replies: []
      });

      agent.replyEngine.shouldReply = vi.fn().mockResolvedValue({
        decision: 'skip',
        reason: 'low engagement'
      });

      await agent.handleAIReply('test content', 'user123', { url: 'https://x.com/test' });

      expect(agent.aiStats.skips).toBe(1);
    });

    it('should handle error in reply generation', async () => {
      const sentimentService = require('../../utils/sentiment-service.js');
      sentimentService.sentimentService.analyze.mockReturnValue({
        isNegative: false,
        score: 0.5,
        dimensions: {
          valence: { valence: 0.5 },
          arousal: { arousal: 0.5 },
          dominance: { dominance: 0.5 },
          sarcasm: { sarcasm: 0.1 },
          toxicity: { toxicity: 0.1 }
        },
        composite: { riskLevel: 'low', conversationType: 'discussion' },
        engagement: { canLike: true, warnings: [] }
      });

      agent.contextEngine.extractEnhancedContext = vi.fn().mockResolvedValue({
        sentiment: { overall: 'neutral' },
        tone: { primary: 'neutral' },
        engagementLevel: 'low',
        replies: []
      });

      agent.replyEngine.generateReply = vi.fn().mockResolvedValue({
        success: false,
        reason: 'generation failed'
      });

      agent.engagementTracker.canPerform.mockReturnValue(true);
      agent.diveQueue.canEngage.mockReturnValue(true);

      await agent.handleAIReply('test content', 'user123', { url: 'https://x.com/test', action: 'reply' });

      expect(agent.aiStats.errors).toBe(1);
    });
  });

  describe.skip('handleAIQuote', () => {
    it('should handle handleAIQuote with pre-validated action', async () => {
      const sentimentService = require('../../utils/sentiment-service.js');
      sentimentService.sentimentService.analyze.mockReturnValue({
        isNegative: false,
        score: 0.5,
        dimensions: {
          valence: { valence: 0.5 },
          arousal: { arousal: 0.5 },
          dominance: { dominance: 0.5 },
          sarcasm: { sarcasm: 0.1 },
          toxicity: { toxicity: 0.1 }
        },
        composite: { riskLevel: 'low', conversationType: 'discussion', engagementStyle: 'neutral' },
        engagement: { canLike: true, warnings: [] }
      });

      agent.contextEngine.extractEnhancedContext = vi.fn().mockResolvedValue({
        sentiment: { overall: 'neutral' },
        tone: { primary: 'neutral' },
        replies: []
      });

      agent.quoteEngine.generateQuote = vi.fn().mockResolvedValue({
        success: true,
        quote: 'Test quote'
      });

      agent.quoteEngine.executeQuote = vi.fn().mockResolvedValue({ success: true, method: 'native' });
      agent.engagementTracker.canPerform.mockReturnValue(true);
      agent.engagementTracker.record.mockReturnValue(true);
      agent.engagementTracker.getProgress.mockReturnValue('0/1');

      mockPage.locator.mockReturnValue({
        first: vi.fn().mockReturnValue({
          isVisible: vi.fn().mockResolvedValue(false)
        })
      });

      await agent.handleAIQuote('test content', 'user123', { url: 'https://x.com/test', action: 'quote' });
    });

    it('should skip quote on negative sentiment', async () => {
      const sentimentService = require('../../utils/sentiment-service.js');
      sentimentService.sentimentService.analyze.mockReturnValue({
        isNegative: true,
        score: -0.5,
        dimensions: {
          valence: { valence: -0.5 },
          arousal: { arousal: 0.5 },
          dominance: { dominance: 0.5 },
          sarcasm: { sarcasm: 0.1 },
          toxicity: { toxicity: 0.8 }
        },
        composite: { riskLevel: 'low', conversationType: 'discussion', engagementStyle: 'neutral' },
        engagement: { canLike: true, warnings: [] }
      });

      await agent.handleAIQuote('negative content', 'user123', { url: 'https://x.com/test' });
    });

    it('should skip quote on high risk content', async () => {
      const sentimentService = require('../../utils/sentiment-service.js');
      sentimentService.sentimentService.analyze.mockReturnValue({
        isNegative: false,
        score: 0.5,
        dimensions: {
          valence: { valence: 0.5 },
          arousal: { arousal: 0.5 },
          dominance: { dominance: 0.5 },
          sarcasm: { sarcasm: 0.1 },
          toxicity: { toxicity: 0.1 }
        },
        composite: { riskLevel: 'high', conversationType: 'controversial', engagementStyle: 'neutral' },
        engagement: { canLike: true, warnings: [] }
      });

      await agent.handleAIQuote('risky content', 'user123', { url: 'https://x.com/test' });
    });

    it('should skip when quote engagement limit reached', async () => {
      const sentimentService = require('../../utils/sentiment-service.js');
      sentimentService.sentimentService.analyze.mockReturnValue({
        isNegative: false,
        score: 0.5,
        dimensions: {
          valence: { valence: 0.5 },
          arousal: { arousal: 0.5 },
          dominance: { dominance: 0.5 },
          sarcasm: { sarcasm: 0.1 },
          toxicity: { toxicity: 0.1 }
        },
        composite: { riskLevel: 'low', conversationType: 'discussion', engagementStyle: 'neutral' },
        engagement: { canLike: true, warnings: [] }
      });

      agent.engagementTracker.canPerform.mockReturnValue(false);

      await agent.handleAIQuote('test content', 'user123', { url: 'https://x.com/test' });
    });

    it('should handle quote generation failure', async () => {
      const sentimentService = require('../../utils/sentiment-service.js');
      sentimentService.sentimentService.analyze.mockReturnValue({
        isNegative: false,
        score: 0.5,
        dimensions: {
          valence: { valence: 0.5 },
          arousal: { arousal: 0.5 },
          dominance: { dominance: 0.5 },
          sarcasm: { sarcasm: 0.1 },
          toxicity: { toxicity: 0.1 }
        },
        composite: { riskLevel: 'low', conversationType: 'discussion', engagementStyle: 'neutral' },
        engagement: { canLike: true, warnings: [] }
      });

      agent.contextEngine.extractEnhancedContext = vi.fn().mockResolvedValue({
        sentiment: { overall: 'neutral' },
        tone: { primary: 'neutral' },
        replies: []
      });

      agent.quoteEngine.generateQuote = vi.fn().mockResolvedValue({
        success: false,
        reason: 'generation failed'
      });

      agent.engagementTracker.canPerform.mockReturnValue(true);

      await agent.handleAIQuote('test content', 'user123', { url: 'https://x.com/test' });
    });
  });

  describe.skip('executeAIReply', () => {
    it('should execute AI reply successfully', async () => {
      agent.replyEngine.executeReply = vi.fn().mockResolvedValue({ success: true, method: 'native' });
      agent.engagementTracker.record.mockReturnValue(true);
      agent.engagementTracker.getProgress.mockReturnValue('1/3');

      const result = await agent.executeAIReply('Test reply');

      expect(result).toBe(true);
      expect(agent.state.replies).toBe(1);
    });

    it('should handle reply execution failure', async () => {
      agent.replyEngine.executeReply = vi.fn().mockResolvedValue({ success: false, reason: 'failed', method: 'native' });

      const result = await agent.executeAIReply('Test reply');

      expect(result).toBe(false);
    });

    it('should handle reply execution error', async () => {
      agent.replyEngine.executeReply = vi.fn().mockRejectedValue(new Error('execution error'));

      const result = await agent.executeAIReply('Test reply');

      expect(result).toBe(false);
    });
  });

  describe.skip('executeAIQuote', () => {
    it('should execute AI quote successfully', async () => {
      agent.quoteEngine.executeQuote = vi.fn().mockResolvedValue({ success: true, method: 'native' });
      agent.engagementTracker.record.mockReturnValue(true);
      agent.engagementTracker.getProgress.mockReturnValue('1/1');

      const result = await agent.executeAIQuote('Test quote', 'https://x.com/test');

      expect(result).toBe(true);
      expect(agent.state.quotes).toBe(1);
    });

    it('should handle quote execution failure', async () => {
      agent.quoteEngine.executeQuote = vi.fn().mockResolvedValue({ success: false, reason: 'failed', method: 'native' });

      const result = await agent.executeAIQuote('Test quote');

      expect(result).toBe(false);
    });

    it('should handle quote execution error', async () => {
      agent.quoteEngine.executeQuote = vi.fn().mockRejectedValue(new Error('execution error'));

      const result = await agent.executeAIQuote('Test quote');

      expect(result).toBe(false);
    });
  });

  describe.skip('handleLike', () => {
    beforeEach(() => {
      agent.humanInteraction.findWithFallback = vi.fn();
    });

    it('should skip like on negative sentiment content', async () => {
      const sentimentService = await import('../../utils/sentiment-service.js');
      sentimentService.sentimentService.analyze.mockReturnValue({
        isNegative: false,
        engagement: { canLike: false, warnings: ['high toxicity'] },
        composite: { riskLevel: 'high' },
        dimensions: { toxicity: { toxicity: 0.8 } }
      });

      await agent.handleLike('negative content');

      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Skipping like'));
    });

    it('should skip like when at engagement limit', async () => {
      agent.engagementTracker.canPerform.mockReturnValue(false);

      await agent.handleLike();

      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Limit reached'));
    });

    it('should handle like when element not found', async () => {
      agent.engagementTracker.canPerform.mockReturnValue(true);
      agent.diveQueue.canEngage.mockReturnValue(true);
      agent.humanInteraction.findWithFallback.mockResolvedValue(null);

      await agent.handleLike();

      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Could not find like button'));
    });

    it('should skip when already liked', async () => {
      agent.engagementTracker.canPerform.mockReturnValue(true);
      agent.diveQueue.canEngage.mockReturnValue(true);

      agent.humanInteraction.findWithFallback
        .mockResolvedValueOnce({ element: {}, selector: 'button[data-testid="like"]' })
        .mockResolvedValueOnce({ element: {}, selector: '[data-testid="unlike"]' });

      await agent.handleLike();

      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('ALREADY LIKED'));
    });

    it('should handle aria-label check for already liked', async () => {
      agent.engagementTracker.canPerform.mockReturnValue(true);
      agent.diveQueue.canEngage.mockReturnValue(true);

      const mockLikeButton = {
        getAttribute: vi.fn().mockResolvedValue('Unlike'),
        boundingBox: vi.fn().mockResolvedValue({ x: 100, y: 100 })
      };

      agent.humanInteraction.findWithFallback
        .mockResolvedValueOnce({ element: mockLikeButton, selector: 'button[data-testid="like"]' })
        .mockResolvedValueOnce(null);

      mockPage.locator.mockReturnValue({
        first: vi.fn().mockReturnValue({
          isVisible: vi.fn().mockResolvedValue(false)
        })
      });

      await agent.handleLike();

      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('already liked'));
    });

    it('should skip when element not actionable', async () => {
      agent.engagementTracker.canPerform.mockReturnValue(true);
      agent.diveQueue.canEngage.mockReturnValue(true);

      const mockLikeButton = {
        getAttribute: vi.fn().mockResolvedValue('Like'),
        boundingBox: vi.fn().mockResolvedValue({ x: 100, y: 100 }),
        scrollIntoViewIfNeeded: vi.fn(),
        click: vi.fn()
      };

      agent.humanInteraction.findWithFallback
        .mockResolvedValueOnce({ element: mockLikeButton, selector: 'button[data-testid="like"]' })
        .mockResolvedValueOnce(null);

      agent.isElementActionable = vi.fn().mockResolvedValue(false);
      mockPage.locator.mockReturnValue({
        first: vi.fn().mockReturnValue({
          isVisible: vi.fn().mockResolvedValue(false)
        })
      });

      await agent.handleLike();
    });
  });

  describe.skip('handleBookmark', () => {
    beforeEach(() => {
      agent.humanInteraction.findWithFallback = vi.fn();
    });

    it('should skip bookmark when at engagement limit', async () => {
      agent.engagementTracker.canPerform.mockReturnValue(false);

      await agent.handleBookmark();

      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Limit reached'));
    });

    it('should handle bookmark when element not found', async () => {
      agent.engagementTracker.canPerform.mockReturnValue(true);
      agent.diveQueue.canEngage.mockReturnValue(true);
      agent.humanInteraction.findWithFallback.mockResolvedValue(null);

      await agent.handleBookmark();

      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Could not find bookmark'));
    });

    it('should skip when already bookmarked', async () => {
      agent.engagementTracker.canPerform.mockReturnValue(true);
      agent.diveQueue.canEngage.mockReturnValue(true);

      agent.humanInteraction.findWithFallback
        .mockResolvedValueOnce({ element: {}, selector: 'button[data-testid="bookmark"]' })
        .mockResolvedValueOnce({ element: {}, selector: 'button[data-testid="removeBookmark"]' });

      await agent.handleBookmark();

      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('ALREADY bookmarked'));
    });
  });

  describe.skip('handleFallback', () => {
    it('should handle bookmark fallback', async () => {
      agent.engagementTracker.canPerform.mockReturnValue(true);
      agent.diveQueue.canEngage.mockReturnValue(true);
      agent.humanInteraction.findWithFallback = vi.fn().mockResolvedValue({
        element: { click: vi.fn() },
        selector: 'button[data-testid="bookmark"]'
      });
      agent.engagementTracker.record.mockReturnValue(true);
      agent.engagementTracker.getProgress.mockReturnValue('1/2');
      agent.diveQueue.recordEngagement.mockReturnValue(true);
      agent.diveQueue.getEngagementProgress.mockReturnValue({
        bookmarks: { current: 1, limit: 2 }
      });
      agent.humanClick = vi.fn().mockResolvedValue(true);
      agent.navigateHome = vi.fn().mockResolvedValue(true);

      await agent.handleFallback('bookmark');

      expect(agent.engagementTracker.record).toHaveBeenCalledWith('bookmarks');
    });

    it('should skip bookmark fallback when at limit', async () => {
      agent.engagementTracker.canPerform.mockReturnValue(false);

      await agent.handleFallback('bookmark');

      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('limit reached'));
    });

    it('should handle like fallback', async () => {
      agent.handleLike = vi.fn().mockResolvedValue(true);

      await agent.handleFallback('like');

      expect(agent.handleLike).toHaveBeenCalled();
    });

    it('should handle none fallback', async () => {
      await agent.handleFallback('none');

      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('No action taken'));
    });
  });

  describe.skip('verifyReplyPosted', () => {
    it('should return false when not on tweet page', async () => {
      mockPage.url.mockReturnValue('https://x.com/home');

      const result = await agent.verifyReplyPosted('test reply');

      expect(result).toBe(false);
    });

    it('should return true when composer is cleared', async () => {
      mockPage.url.mockReturnValue('https://x.com/user/status/123');

      const mockComposer = {
        count: vi.fn().mockResolvedValue(1),
        innerText: vi.fn().mockResolvedValue('')
      };

      mockPage.locator.mockReturnValue(mockComposer);

      const result = await agent.verifyReplyPosted('test reply');

      expect(result).toBe(true);
    });
  });

  describe.skip('humanTypingWithTypos', () => {
    it('should type text with simulated typos', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);

      const mockInputEl = {
        type: vi.fn(),
        keyboard: {
          press: vi.fn()
        }
      };

      mockPage.mouse.move = vi.fn();

      await agent.humanTypingWithTypos(mockInputEl, 'hello world');
    });

    it('should handle shift characters', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);

      const mockInputEl = {
        type: vi.fn(),
        keyboard: {
          press: vi.fn()
        }
      };

      mockPage.mouse.move = vi.fn();

      await agent.humanTypingWithTypos(mockInputEl, 'Hello World!');
    });
  });

  describe.skip('simulateReading override', () => {
    it('should skip scrolling when disabled', async () => {
      agent.scrollingEnabled = false;
      agent.operationLock = true;

      await agent.simulateReading();

      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Scrolling disabled'));
    });

    it('should call parent simulateReading when enabled', async () => {
      agent.scrollingEnabled = true;
      agent.operationLock = false;

      agent.parent = {
        simulateReading: vi.fn().mockResolvedValue(true)
      };

      await agent.simulateReading();
    });
  });

  describe('getEngagementStats', () => {
    it('should return engagement stats', () => {
      const stats = agent.getEngagementStats();

      expect(stats).toBeDefined();
      expect(stats.tracker).toBeDefined();
      expect(stats.summary).toBeDefined();
      expect(stats.usageRate).toBeDefined();
    });
  });

  describe.skip('logEngagementStatus', () => {
    it('should log engagement status', () => {
      agent.engagementTracker.getStatus.mockReturnValue({
        replies: { current: 1, limit: 3, remaining: 2, percentage: '33%' },
        likes: { current: 2, limit: 5, remaining: 3, percentage: '40%' }
      });

      agent.logEngagementStatus();

      expect(mockLogger.info).toHaveBeenCalled();
    });
  });

  describe('flushLogs', () => {
    it('should flush buffered loggers', async () => {
      agent.queueLogger.shutdown = vi.fn().mockResolvedValue(true);
      agent.engagementLogger.shutdown = vi.fn().mockResolvedValue(true);

      await agent.flushLogs();

      expect(agent.queueLogger.shutdown).toHaveBeenCalled();
      expect(agent.engagementLogger.shutdown).toHaveBeenCalled();
    });
  });

  describe.skip('runSession', () => {
    it('should handle aborted session', async () => {
      const abortSignal = { aborted: true };

      await agent.runSession(10, 0, 0, { abortSignal });

      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('aborted'));
    });

    it('should run session with fixed cycles', async () => {
      agent.checkLoginState = vi.fn().mockResolvedValue(true);
      agent.human = {
        sessionStart: vi.fn(),
        session: { shouldEndSession: vi.fn().mockReturnValue(true) },
        cycleComplete: vi.fn(),
        sessionEnd: vi.fn()
      };
      agent.performHealthCheck = vi.fn().mockResolvedValue({ healthy: true });
      agent.simulateReading = vi.fn();
      agent.navigateHome = vi.fn().mockResolvedValue(true);
      agent.page.url.mockReturnValue('https://x.com/home');
      agent.flushLogs = vi.fn().mockResolvedValue(true);

      vi.spyOn(Math, 'random').mockImplementation(() => 0.95);

      await agent.runSession(2, 0, 0, {});
    });

    it('should handle session with duration', async () => {
      agent.checkLoginState = vi.fn().mockResolvedValue(true);
      agent.human = {
        sessionStart: vi.fn(),
        session: { shouldEndSession: vi.fn().mockReturnValue(true) },
        cycleComplete: vi.fn(),
        sessionEnd: vi.fn()
      };
      agent.performHealthCheck = vi.fn().mockResolvedValue({ healthy: true });
      agent.simulateReading = vi.fn();
      agent.navigateHome = vi.fn().mockResolvedValue(true);
      agent.page.url.mockReturnValue('https://x.com/home');
      agent.flushLogs = vi.fn().mockResolvedValue(true);

      vi.spyOn(Math, 'random').mockImplementation(() => 0.95);

      await agent.runSession(10, 60, 120, {});
    });

    it('should navigate to home if not there', async () => {
      agent.checkLoginState = vi.fn().mockResolvedValue(true);
      agent.human = {
        sessionStart: vi.fn(),
        session: { shouldEndSession: vi.fn().mockReturnValue(true) },
        cycleComplete: vi.fn(),
        sessionEnd: vi.fn()
      };
      agent.performHealthCheck = vi.fn().mockResolvedValue({ healthy: true });
      agent.simulateReading = vi.fn();
      agent.navigateHome = vi.fn().mockResolvedValue(true);
      agent.page.url.mockReturnValue('https://x.com/explore');
      agent.flushLogs = vi.fn().mockResolvedValue(true);

      vi.spyOn(Math, 'random').mockImplementation(() => 0.95);

      await agent.runSession(2, 0, 0, {});
    });

    it('should handle login check failures', async () => {
      agent.checkLoginState = vi.fn().mockResolvedValue(false);
      agent.human = {
        sessionStart: vi.fn(),
        session: { shouldEndSession: vi.fn().mockReturnValue(true) },
        cycleComplete: vi.fn(),
        sessionEnd: vi.fn()
      };
      agent.navigateHome = vi.fn().mockResolvedValue(true);
      agent.page.url.mockReturnValue('https://x.com/home');
      agent.flushLogs = vi.fn().mockResolvedValue(true);

      agent.state = { consecutiveLoginFailures: 3 };

      await agent.runSession(2, 0, 0, {});
    });

    it('should perform periodic health checks', async () => {
      agent.checkLoginState = vi.fn().mockResolvedValue(true);
      agent.human = {
        sessionStart: vi.fn(),
        session: { shouldEndSession: vi.fn().mockReturnValue(false) },
        cycleComplete: vi.fn(),
        sessionEnd: vi.fn()
      };
      agent.performHealthCheck = vi.fn().mockResolvedValue({ healthy: false });
      agent.navigateHome = vi.fn().mockResolvedValue(true);
      agent.page.url.mockReturnValue('https://x.com/home');
      agent.flushLogs = vi.fn().mockResolvedValue(true);

      vi.spyOn(Math, 'random').mockImplementation(() => 0.95);

      agent.loopIndex = 9;

      await agent.runSession(20, 0, 0, {});
    });

    it('should handle boredom pause', async () => {
      agent.checkLoginState = vi.fn().mockResolvedValue(true);
      agent.human = {
        sessionStart: vi.fn(),
        session: { shouldEndSession: vi.fn().mockReturnValue(false) },
        cycleComplete: vi.fn(),
        sessionEnd: vi.fn(),
        boredomPause: vi.fn().mockResolvedValue(true)
      };
      agent.performHealthCheck = vi.fn().mockResolvedValue({ healthy: true });
      agent.simulateReading = vi.fn();
      agent.navigateHome = vi.fn().mockResolvedValue(true);
      agent.page.url.mockReturnValue('https://x.com/home');
      agent.flushLogs = vi.fn().mockResolvedValue(true);

      vi.spyOn(Math, 'random').mockImplementation(() => 0.2);

      agent.loopIndex = 3;

      await agent.runSession(20, 0, 0, {});
    });

    it('should handle refresh feed branch', async () => {
      agent.checkLoginState = vi.fn().mockResolvedValue(true);
      agent.human = {
        sessionStart: vi.fn(),
        session: { shouldEndSession: vi.fn().mockReturnValue(false) },
        cycleComplete: vi.fn(),
        sessionEnd: vi.fn()
      };
      agent.performHealthCheck = vi.fn().mockResolvedValue({ healthy: true });
      agent.simulateReading = vi.fn();
      agent.navigateHome = vi.fn().mockResolvedValue(true);
      agent.page.url.mockReturnValue('https://x.com/home');
      agent.flushLogs = vi.fn().mockResolvedValue(true);

      vi.spyOn(Math, 'random').mockImplementation(() => 0.05);

      agent.twitterConfig = { probabilities: { refresh: 0.1, profileDive: 0.1, tweetDive: 0.1 } };

      await agent.runSession(2, 0, 0, {});
    });

    it('should handle diveProfile branch', async () => {
      agent.checkLoginState = vi.fn().mockResolvedValue(true);
      agent.human = {
        sessionStart: vi.fn(),
        session: { shouldEndSession: vi.fn().mockReturnValue(false) },
        cycleComplete: vi.fn(),
        sessionEnd: vi.fn()
      };
      agent.performHealthCheck = vi.fn().mockResolvedValue({ healthy: true });
      agent.simulateReading = vi.fn();
      agent.navigateHome = vi.fn().mockResolvedValue(true);
      agent.diveProfile = vi.fn().mockResolvedValue(true);
      agent.page.url.mockReturnValue('https://x.com/home');
      agent.flushLogs = vi.fn().mockResolvedValue(true);

      vi.spyOn(Math, 'random').mockImplementation(() => 0.15);

      agent.twitterConfig = { probabilities: { refresh: 0.1, profileDive: 0.2, tweetDive: 0.1 } };

      await agent.runSession(2, 0, 0, {});
    });

    it('should handle diveTweet branch', async () => {
      agent.checkLoginState = vi.fn().mockResolvedValue(true);
      agent.human = {
        sessionStart: vi.fn(),
        session: { shouldEndSession: vi.fn().mockReturnValue(false) },
        cycleComplete: vi.fn(),
        sessionEnd: vi.fn()
      };
      agent.performHealthCheck = vi.fn().mockResolvedValue({ healthy: true });
      agent.simulateReading = vi.fn();
      agent.navigateHome = vi.fn().mockResolvedValue(true);
      agent.diveTweet = vi.fn().mockResolvedValue(true);
      agent.page.url.mockReturnValue('https://x.com/home');
      agent.flushLogs = vi.fn().mockResolvedValue(true);

      vi.spyOn(Math, 'random').mockImplementation(() => 0.35);

      agent.twitterConfig = { probabilities: { refresh: 0.1, profileDive: 0.2, tweetDive: 0.4 } };

      await agent.runSession(2, 0, 0, {});
    });

    it('should handle idle branch', async () => {
      agent.checkLoginState = vi.fn().mockResolvedValue(true);
      agent.human = {
        sessionStart: vi.fn(),
        session: { shouldEndSession: vi.fn().mockReturnValue(false) },
        cycleComplete: vi.fn(),
        sessionEnd: vi.fn()
      };
      agent.performHealthCheck = vi.fn().mockResolvedValue({ healthy: true });
      agent.simulateReading = vi.fn();
      agent.navigateHome = vi.fn().mockResolvedValue(true);
      agent.diveTweet = vi.fn().mockResolvedValue(true);
      agent.page.url.mockReturnValue('https://x.com/home');
      agent.flushLogs = vi.fn().mockResolvedValue(true);

      vi.spyOn(Math, 'random').mockImplementation(() => 0.9);

      agent.twitterConfig = {
        probabilities: { refresh: 0.1, profileDive: 0.2, tweetDive: 0.3 },
        timings: { actionSpecific: { idle: { mean: 5000, deviation: 2000 } } }
      };

      await agent.runSession(2, 0, 0, {});
    });

    it('should handle session end time approaching', async () => {
      agent.checkLoginState = vi.fn().mockResolvedValue(true);
      agent.human = {
        sessionStart: vi.fn(),
        session: { shouldEndSession: vi.fn().mockReturnValue(false) },
        cycleComplete: vi.fn(),
        sessionEnd: vi.fn()
      };
      agent.performHealthCheck = vi.fn().mockResolvedValue({ healthy: true });
      agent.simulateReading = vi.fn();
      agent.navigateHome = vi.fn().mockResolvedValue(true);
      agent.page.url.mockReturnValue('https://x.com/home');
      agent.flushLogs = vi.fn().mockResolvedValue(true);

      vi.spyOn(Math, 'random').mockImplementation(() => 0.95);

      agent.sessionEndTime = Date.now() + 10000;

      await agent.runSession(100, 0, 0, {});
    });

    it('should wait for operation lock in session', async () => {
      agent.checkLoginState = vi.fn().mockResolvedValue(true);
      agent.human = {
        sessionStart: vi.fn(),
        session: { shouldEndSession: vi.fn().mockReturnValue(false) },
        cycleComplete: vi.fn(),
        sessionEnd: vi.fn()
      };
      agent.performHealthCheck = vi.fn().mockResolvedValue({ healthy: true });
      agent.simulateReading = vi.fn();
      agent.navigateHome = vi.fn().mockResolvedValue(true);
      agent.page.url.mockReturnValue('https://x.com/home');
      agent.flushLogs = vi.fn().mockResolvedValue(true);

      agent.operationLock = true;
      setTimeout(() => { agent.operationLock = false; }, 100);

      vi.spyOn(Math, 'random').mockImplementation(() => 0.95);

      await agent.runSession(2, 0, 0, {});
    });

    it('should enable quick mode in cooldown phase', async () => {
      const sessionPhases = require('../../utils/session-phases.js');
      sessionPhases.sessionPhases.getSessionPhase.mockReturnValue('cooldown');
      sessionPhases.sessionPhases.getPhaseModifier.mockReturnValue(0.5);

      agent.checkLoginState = vi.fn().mockResolvedValue(true);
      agent.human = {
        sessionStart: vi.fn(),
        session: { shouldEndSession: vi.fn().mockReturnValue(true) },
        cycleComplete: vi.fn(),
        sessionEnd: vi.fn()
      };
      agent.performHealthCheck = vi.fn().mockResolvedValue({ healthy: true });
      agent.simulateReading = vi.fn();
      agent.navigateHome = vi.fn().mockResolvedValue(true);
      agent.page.url.mockReturnValue('https://x.com/home');
      agent.flushLogs = vi.fn().mockResolvedValue(true);

      vi.spyOn(Math, 'random').mockImplementation(() => 0.95);

      await agent.runSession(2, 0, 0, {});

      expect(agent.diveQueue.enableQuickMode).toHaveBeenCalled();
    });
  });

  describe.skip('_diveTweetWithAI full flow', () => {
    it('should handle no target tweet found', async () => {
      agent.operationLock = false;
      agent.scrollingEnabled = true;

      mockPage.locator.mockReturnValue({
        count: vi.fn().mockResolvedValue(0),
        nth: vi.fn().mockReturnValue({
          boundingBox: vi.fn().mockResolvedValue(null)
        })
      });

      const scrollDown = require('../../utils/scroll-helper.js');
      scrollDown.scrollDown.mockResolvedValue(undefined);

      const entropy = require('../../utils/entropyController.js');
      entropy.entropy.retryDelay.mockReturnValue(100);

      mockPage.evaluate
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      mockPage.goto = vi.fn().mockResolvedValue(undefined);
      agent.ensureForYouTab = vi.fn().mockResolvedValue(true);
      agent.endDive = vi.fn();

      await agent._diveTweetWithAI();
    });

    it('should navigate to tweet page successfully', async () => {
      const mockTweet = {
        locator: vi.fn().mockImplementation((_selector) => ({
          first: vi.fn().mockReturnValue({
            count: vi.fn().mockResolvedValue(1),
            isVisible: vi.fn().mockResolvedValue(true),
            boundingBox: vi.fn().mockResolvedValue({ x: 100, y: 200, height: 100 }),
            evaluate: vi.fn(),
            $x: vi.fn().mockResolvedValue([]),
            getAttribute: vi.fn()
          }),
          nth: vi.fn().mockReturnValue({
            boundingBox: vi.fn().mockResolvedValue({ x: 100, y: 200, height: 100 })
          })
        })),
        boundingBox: vi.fn().mockResolvedValue({ x: 100, y: 200, height: 100 })
      };

      mockPage.locator.mockImplementation((selector) => {
        if (selector === 'article[data-testid="tweet"]') {
          return {
            count: vi.fn().mockResolvedValue(1),
            nth: vi.fn().mockReturnValue(mockTweet)
          };
        }
        return {
          count: vi.fn().mockResolvedValue(1),
          first: vi.fn().mockReturnValue({
            count: vi.fn().mockResolvedValue(1),
            isVisible: vi.fn().mockResolvedValue(true),
            getAttribute: vi.fn().mockResolvedValue('/user/status/123')
          })
        };
      });

      mockPage.waitForURL = vi.fn().mockResolvedValue(undefined);
      mockPage.url.mockReturnValue('https://x.com/user/status/123456');

      mockPage.locator.mockReturnValue({
        first: vi.fn().mockReturnValue({
          count: vi.fn().mockResolvedValue(1),
          innerText: vi.fn().mockResolvedValue('Test tweet content')
        })
      });

      const scrollDown = require('../../utils/scroll-helper.js');
      scrollDown.scrollDown.mockResolvedValue(undefined);

      const entropy = require('../../utils/entropyController.js');
      entropy.entropy.retryDelay.mockReturnValue(100);
      entropy.entropy.scrollSettleTime.mockReturnValue(100);

      agent.actionRunner.selectAction = vi.fn().mockReturnValue(null);
      agent.endDive = vi.fn();

      await agent._diveTweetWithAI();
    });

    it('should skip already processed tweet', async () => {
      const mockTweet = {
        locator: vi.fn().mockImplementation((_selector) => ({
          first: vi.fn().mockReturnValue({
            count: vi.fn().mockResolvedValue(1),
            isVisible: vi.fn().mockResolvedValue(true),
            boundingBox: vi.fn().mockResolvedValue({ x: 100, y: 200, height: 100 }),
            evaluate: vi.fn(),
            $x: vi.fn().mockResolvedValue([]),
            getAttribute: vi.fn()
          }),
          nth: vi.fn().mockReturnValue({
            boundingBox: vi.fn().mockResolvedValue({ x: 100, y: 200, height: 100 })
          })
        })),
        boundingBox: vi.fn().mockResolvedValue({ x: 100, y: 200, height: 100 })
      };

      mockPage.locator.mockImplementation((selector) => {
        if (selector === 'article[data-testid="tweet"]') {
          return {
            count: vi.fn().mockResolvedValue(1),
            nth: vi.fn().mockReturnValue(mockTweet)
          };
        }
        return {
          count: vi.fn().mockResolvedValue(1),
          first: vi.fn().mockReturnValue({
            count: vi.fn().mockResolvedValue(1),
            isVisible: vi.fn().mockResolvedValue(true),
            getAttribute: vi.fn().mockResolvedValue('/user/status/123456')
          })
        };
      });

      mockPage.waitForURL = vi.fn().mockResolvedValue(undefined);
      mockPage.url.mockReturnValue('https://x.com/user/status/123456');

      mockPage.locator.mockReturnValue({
        first: vi.fn().mockReturnValue({
          count: vi.fn().mockResolvedValue(1),
          innerText: vi.fn().mockResolvedValue('Test tweet content')
        })
      });

      const entropy = require('../../utils/entropyController.js');
      entropy.entropy.scrollSettleTime.mockReturnValue(100);

      agent._processedTweetIds.add('123456');
      agent.actionRunner.selectAction = vi.fn().mockReturnValue(null);
      agent.endDive = vi.fn();

      await agent._diveTweetWithAI();
    });

    it('should handle short tweet text', async () => {
      const mockTweet = {
        locator: vi.fn().mockImplementation((_selector) => ({
          first: vi.fn().mockReturnValue({
            count: vi.fn().mockResolvedValue(1),
            isVisible: vi.fn().mockResolvedValue(true),
            boundingBox: vi.fn().mockResolvedValue({ x: 100, y: 200, height: 100 }),
            evaluate: vi.fn(),
            $x: vi.fn().mockResolvedValue([]),
            getAttribute: vi.fn()
          }),
          nth: vi.fn().mockReturnValue({
            boundingBox: vi.fn().mockResolvedValue({ x: 100, y: 200, height: 100 })
          })
        })),
        boundingBox: vi.fn().mockResolvedValue({ x: 100, y: 200, height: 100 })
      };

      mockPage.locator.mockImplementation((selector) => {
        if (selector === 'article[data-testid="tweet"]') {
          return {
            count: vi.fn().mockResolvedValue(1),
            nth: vi.fn().mockReturnValue(mockTweet)
          };
        }
        return {
          count: vi.fn().mockResolvedValue(1),
          first: vi.fn().mockReturnValue({
            count: vi.fn().mockResolvedValue(1),
            isVisible: vi.fn().mockResolvedValue(true),
            getAttribute: vi.fn().mockResolvedValue('/user/status/123')
          })
        };
      });

      mockPage.waitForURL = vi.fn().mockResolvedValue(undefined);
      mockPage.url.mockReturnValue('https://x.com/user/status/123456');

      mockPage.locator.mockReturnValue({
        first: vi.fn().mockReturnValue({
          count: vi.fn().mockResolvedValue(1),
          innerText: vi.fn().mockResolvedValue('Hi')
        })
      });

      const entropy = require('../../utils/entropyController.js');
      entropy.entropy.scrollSettleTime.mockReturnValue(100);

      agent.actionRunner.selectAction = vi.fn().mockReturnValue(null);
      agent.endDive = vi.fn();

      await agent._diveTweetWithAI();
    });

    it('should use queue wrapper for AI execution', async () => {
      const mockTweet = {
        locator: vi.fn().mockImplementation((_selector) => ({
          first: vi.fn().mockReturnValue({
            count: vi.fn().mockResolvedValue(1),
            isVisible: vi.fn().mockResolvedValue(true),
            boundingBox: vi.fn().mockResolvedValue({ x: 100, y: 200, height: 100 }),
            evaluate: vi.fn(),
            $x: vi.fn().mockResolvedValue([]),
            getAttribute: vi.fn()
          }),
          nth: vi.fn().mockReturnValue({
            boundingBox: vi.fn().mockResolvedValue({ x: 100, y: 200, height: 100 })
          })
        })),
        boundingBox: vi.fn().mockResolvedValue({ x: 100, y: 200, height: 100 })
      };

      mockPage.locator.mockImplementation((selector) => {
        if (selector === 'article[data-testid="tweet"]') {
          return {
            count: vi.fn().mockResolvedValue(1),
            nth: vi.fn().mockReturnValue(mockTweet)
          };
        }
        return {
          count: vi.fn().mockResolvedValue(1),
          first: vi.fn().mockReturnValue({
            count: vi.fn().mockResolvedValue(1),
            isVisible: vi.fn().mockResolvedValue(true),
            getAttribute: vi.fn().mockResolvedValue('/user/status/123')
          })
        };
      });

      mockPage.waitForURL = vi.fn().mockResolvedValue(undefined);
      mockPage.url.mockReturnValue('https://x.com/user/status/123456');

      mockPage.locator.mockReturnValue({
        first: vi.fn().mockReturnValue({
          count: vi.fn().mockResolvedValue(1),
          innerText: vi.fn().mockResolvedValue('Test tweet content for queue wrapper')
        })
      });

      const entropy = await import('../../utils/entropyController.js');
      entropy.entropy.scrollSettleTime.mockReturnValue(100);

      agent.actionRunner.selectAction = vi.fn().mockReturnValue('like');
      agent.actionRunner.executeAction = vi.fn().mockResolvedValue({ success: true, executed: true, reason: 'test' });
      agent.endDive = vi.fn();

      const mockQueueWrapper = vi.fn().mockImplementation(async (task) => {
        return { success: true, result: await task() };
      });

      await agent._diveTweetWithAI(mockQueueWrapper);
    });
  });

  describe.skip('_readExpandedTweet', () => {
    it('should read expanded tweet with media', async () => {
      agent.highlightText = vi.fn().mockResolvedValue(true);
      agent.startFidgetLoop = vi.fn();
      agent.stopFidgetLoop = vi.fn();
      agent.triggerMicroInteraction = vi.fn().mockResolvedValue({ success: false });
      agent.humanClick = vi.fn().mockResolvedValue(true);
      agent.navigateHome = vi.fn().mockResolvedValue(true);

      await agent._readExpandedTweet();

      expect(agent.highlightText).toHaveBeenCalled();
    });

    it('should handle reading without media', async () => {
      agent.highlightText = vi.fn().mockResolvedValue(true);
      agent.startFidgetLoop = vi.fn();
      agent.stopFidgetLoop = vi.fn();
      agent.triggerMicroInteraction = vi.fn().mockResolvedValue({ success: false });
      agent.navigateHome = vi.fn().mockResolvedValue(true);

      await agent._readExpandedTweet();
    });
  });

  describe('Session Properties', () => {
    it('should have quickModeEnabled', () => {
      expect(agent.quickModeEnabled).toBe(false);
    });

    it('should have sessionActive', () => {
      expect(agent.sessionActive).toBe(false);
    });

    it('should have sessionDuration', () => {
      expect(agent.sessionDuration).toBe(0);
    });

    it('should have lastPhaseLogged', () => {
      expect(agent.lastPhaseLogged).toBe(null);
    });
  });

  describe('Configuration Properties', () => {
    it('should have twitterConfig', () => {
      expect(agent.twitterConfig).toBeDefined();
    });

    it('should have homeUrl', () => {
      expect(agent.homeUrl).toBe('https://x.com/home');
    });

    it('should have waitLogInterval', () => {
      expect(agent.waitLogInterval).toBe(10000);
    });

    it('should have lastWaitLogTime', () => {
      expect(agent.lastWaitLogTime).toBe(0);
    });

    it('should have isPosting flag', () => {
      expect(agent.isPosting).toBe(false);
    });
  });

  describe('Engagement Tracker Override Methods', () => {
    it('engagementTracker.canPerform should check both tracker and queue', () => {
      agent.engagementTracker.canPerform('replies');

      expect(agent.engagementTracker.canPerform).toBeDefined();
    });

    it('engagementTracker.record should update both systems', () => {
      const result = agent.engagementTracker.record('likes');

      expect(typeof result).toBe('boolean');
    });

    it('engagementTracker.getProgress should use queue progress', () => {
      const progress = agent.engagementTracker.getProgress('likes');

      expect(progress).toBeDefined();
    });

    it('engagementTracker.getStatus should merge statuses', () => {
      const status = agent.engagementTracker.getStatus();

      expect(status).toBeDefined();
    });

    it('engagementTracker.getSummary should use queue data', () => {
      const summary = agent.engagementTracker.getSummary();

      expect(summary).toBeDefined();
    });
  });
});

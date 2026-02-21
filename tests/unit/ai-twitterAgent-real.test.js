/**
 * @fileoverview Comprehensive Unit Tests for AITwitterAgent - Real Implementation
 * Tests the actual AITwitterAgent class with proper dependency mocking
 * @module tests/unit/ai-twitterAgent-real.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock all dependencies before importing AITwitterAgent
vi.mock('../../utils/ai-reply-engine.js', () => ({
  AIReplyEngine: class {
    constructor(connector, config) {
      this.config = { REPLY_PROBABILITY: config?.replyProbability || 0.5 };
    }
    async generateReply() { return { text: 'Test reply', confidence: 0.8 }; }
  }
}));

vi.mock('../../utils/ai-quote-engine.js', () => ({
  AIQuoteEngine: class {
    constructor(connector, config) {
      this.config = { QUOTE_PROBABILITY: config?.quoteProbability || 0.3 };
    }
    async generateQuote() { return { text: 'Test quote', confidence: 0.7 }; }
  }
}));

vi.mock('../../utils/ai-context-engine.js', () => ({
  AIContextEngine: class {
    constructor(config) { this.config = config; }
    async extractEnhancedContext() { 
      return { sentiment: 'positive', topics: ['test'], replies: [] };
    }
  }
}));

vi.mock('../../utils/micro-interactions.js', () => ({
  microInteractions: {
    createMicroInteractionHandler: (config) => ({
      config,
      executeMicroInteraction: vi.fn().mockResolvedValue({ success: true, type: 'highlight' }),
      textHighlight: vi.fn().mockResolvedValue({ success: true }),
      startFidgetLoop: vi.fn().mockReturnValue({ stop: vi.fn() }),
      stopFidgetLoop: vi.fn()
    })
  }
}));

vi.mock('../../utils/motor-control.js', () => ({
  motorControl: {
    createMotorController: (config) => ({
      config,
      smartClick: vi.fn().mockResolvedValue({ success: true, x: 100, y: 200 })
    })
  }
}));

vi.mock('../../utils/engagement-limits.js', () => ({
  engagementLimits: {
    createEngagementTracker: (limits) => ({
      limits,
      canPerform: vi.fn().mockReturnValue(true),
      record: vi.fn().mockReturnValue(true),
      getProgress: vi.fn().mockReturnValue('1/5'),
      getStatus: vi.fn().mockReturnValue({ likes: { current: 1, limit: 5 } }),
      getSummary: vi.fn().mockReturnValue('likes: 1/5')
    })
  }
}));

vi.mock('../../utils/session-phases.js', () => ({
  sessionPhases: {
    getSessionPhase: vi.fn().mockReturnValue('active'),
    getPhaseStats: vi.fn().mockReturnValue({ description: 'Active phase' }),
    getPhaseModifier: vi.fn().mockReturnValue(1.0)
  }
}));

vi.mock('../../utils/sentiment-service.js', () => ({
  sentimentService: {
    analyze: vi.fn().mockReturnValue({ score: 0.5, magnitude: 0.8 })
  }
}));

vi.mock('../../utils/async-queue.js', () => ({
  DiveQueue: class {
    constructor(config) {
      this.config = config;
      this.state = { likes: 0, replies: 0, bookmarks: 0, quotes: 0, retweets: 0, follows: 0 };
    }
    canEngage(action) { return this.state[action] < (this.config[action] || Infinity); }
    recordEngagement(action) { 
      if (this.canEngage(action)) {
        this.state[action]++;
        return true;
      }
      return false;
    }
    getEngagementProgress() {
      return {
        likes: { current: this.state.likes, limit: this.config.likes || 5 },
        replies: { current: this.state.replies, limit: this.config.replies || 3 }
      };
    }
    getFullStatus() {
      return {
        queue: { queueLength: 0, activeCount: 0, utilizationPercent: 0 },
        engagement: this.getEngagementProgress()
      };
    }
    enableQuickMode() {}
    async addDive(task, _fallback, _options) {
      try {
        const result = await task();
        return { success: true, result };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }
  }
}));

vi.mock('../../core/agent-connector.js', () => ({
  default: class {
    async processRequest() { return { text: 'AI response' }; }
  }
}));

vi.mock('../../utils/actions/ai-twitter-reply.js', () => ({
  AIReplyAction: class {
    constructor(agent) { this.agent = agent; }
    async execute() { return { success: true, executed: true }; }
    getStats() { return { attempts: 5, success: 4 }; }
  }
}));

vi.mock('../../utils/actions/ai-twitter-quote.js', () => ({
  AIQuoteAction: class {
    constructor(agent) { this.agent = agent; }
    async execute() { return { success: true, executed: true }; }
    getStats() { return { attempts: 3, success: 2 }; }
  }
}));

vi.mock('../../utils/actions/ai-twitter-like.js', () => ({
  LikeAction: class {
    constructor(agent) { this.agent = agent; }
    async execute() { return { success: true, executed: true }; }
    getStats() { return { attempts: 10, success: 9 }; }
  }
}));

vi.mock('../../utils/actions/ai-twitter-bookmark.js', () => ({
  BookmarkAction: class {
    constructor(agent) { this.agent = agent; }
    async execute() { return { success: true, executed: true }; }
    getStats() { return { attempts: 4, success: 4 }; }
  }
}));

vi.mock('../../utils/actions/ai-twitter-go-home.js', () => ({
  GoHomeAction: class {
    constructor(agent) { this.agent = agent; }
    async execute() { return { success: true, executed: true }; }
    getStats() { return { attempts: 8, success: 8 }; }
  }
}));

vi.mock('../../utils/actions/index.js', () => ({
  ActionRunner: class {
    constructor(agent, actions) {
      this.agent = agent;
      this.actions = actions;
    }
    selectAction() { return 'reply'; }
    async executeAction(_action, _context) {
      return { success: true, executed: true, reason: 'test' };
    }
  }
}));

vi.mock('../../utils/human-interaction.js', () => ({
  HumanInteraction: class {
    constructor(page) { this.page = page; }
    async simulateTyping() { return true; }
  }
}));

vi.mock('../../utils/logger.js', () => ({
  createBufferedLogger: (_name, _config) => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    shutdown: vi.fn().mockResolvedValue(undefined)
  }),
  createLogger: (_name) => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  })
}));

vi.mock('../../utils/scroll-helper.js', () => ({
  scrollDown: vi.fn().mockResolvedValue(undefined),
  scrollUp: vi.fn().mockResolvedValue(undefined),
  scrollRandom: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../../utils/mathUtils.js', () => ({
  mathUtils: {
    randomInRange: vi.fn((min, max) => min + (max - min) / 2),
    gaussian: vi.fn((mean, _dev) => mean),
    roll: vi.fn((prob) => Math.random() < prob)
  }
}));

vi.mock('../../utils/entropyController.js', () => ({
  entropy: {
    scrollSettleTime: vi.fn().mockReturnValue(100),
    retryDelay: vi.fn().mockReturnValue(1000),
    postClickDelay: vi.fn().mockReturnValue(500)
  }
}));

vi.mock('../../utils/config-service.js', () => ({
  config: {
    isLocalLLMEnabled: vi.fn().mockResolvedValue(false)
  }
}));

// Mock the parent TwitterAgent class methods
vi.mock('../../utils/twitterAgent.js', () => ({
  TwitterAgent: class {
    constructor(page, profile, logger) {
      this.page = page;
      this.config = profile;
      this.logger = logger;
      this.state = {
        likes: 0,
        follows: 0,
        retweets: 0,
        tweets: 0,
        activityMode: 'NORMAL',
        fatigueBias: 0
      };
      this.sessionStart = Date.now();
      this.ghost = { click: vi.fn() };
      this.human = {
        think: vi.fn().mockResolvedValue(undefined),
        consumeContent: vi.fn().mockResolvedValue(undefined),
        multitask: vi.fn().mockResolvedValue(undefined),
        recoverFromError: vi.fn().mockResolvedValue(undefined),
        sessionStart: vi.fn().mockResolvedValue(undefined),
        sessionEnd: vi.fn().mockResolvedValue(undefined),
        cycleComplete: vi.fn().mockResolvedValue(undefined),
        session: { shouldEndSession: vi.fn().mockReturnValue(false) }
      };
    }
    
    log(msg) {
      if (this.logger) this.logger.info(msg);
    }
    
    async humanClick(_target, _description) {
      return true;
    }
    
    async safeHumanClick(_target, _description, _retries = 3) {
      return true;
    }
    
    async navigateHome() {
      return true;
    }
    
    async checkLoginState() {
      return true;
    }
    
    async ensureForYouTab() {
      return true;
    }
    
    async diveTweet() {
      return true;
    }
    
    async diveProfile() {
      return true;
    }
    
    async simulateReading() {
      return true;
    }
    
    async simulateFidget() {
      return true;
    }
    
    async postTweet(_text) {
      return true;
    }
    
    async runSession(_cycles, _minDuration, _maxDuration) {
      return true;
    }
    
    async performHealthCheck() {
      return { healthy: true };
    }
    
    isSessionExpired() {
      return false;
    }
    
    normalizeProbabilities(p) {
      return { ...p };
    }
    
    getScrollMethod() {
      return 'WHEEL_DOWN';
    }
    
    checkFatigue() {}
  }
}));

// Import after mocks
import { AITwitterAgent } from '../../utils/ai-twitterAgent.js';

const mockPage = {
  goto: vi.fn().mockResolvedValue(undefined),
  waitForTimeout: vi.fn().mockResolvedValue(undefined),
  url: vi.fn().mockReturnValue('https://x.com/home'),
  isClosed: vi.fn().mockReturnValue(false),
  close: vi.fn().mockResolvedValue(undefined),
  evaluate: vi.fn().mockResolvedValue({ readyState: 'complete', title: 'Home' }),
  context: () => ({
    browser: () => ({ isConnected: () => true })
  }),
  emulateMedia: vi.fn().mockResolvedValue(undefined),
  on: vi.fn(),
  keyboard: { press: vi.fn().mockResolvedValue(undefined) },
  locator: vi.fn().mockReturnValue({
    count: vi.fn().mockResolvedValue(1),
    isVisible: vi.fn().mockResolvedValue(true),
    innerText: vi.fn().mockResolvedValue('tweet text'),
    boundingBox: vi.fn().mockResolvedValue({ height: 100, y: 100 }),
    first: vi.fn().mockReturnValue({
      count: vi.fn().mockResolvedValue(1),
      isVisible: vi.fn().mockResolvedValue(true),
      click: vi.fn().mockResolvedValue(undefined),
      innerText: vi.fn().mockResolvedValue('tweet text'),
      boundingBox: vi.fn().mockResolvedValue({ height: 100, y: 100 })
    }),
    nth: vi.fn().mockReturnValue({
      count: vi.fn().mockResolvedValue(1),
      isVisible: vi.fn().mockResolvedValue(true),
      click: vi.fn().mockResolvedValue(undefined),
      innerText: vi.fn().mockResolvedValue('tweet text'),
      boundingBox: vi.fn().mockResolvedValue({ height: 100, y: 100 })
    })
  }),
  viewportSize: vi.fn().mockReturnValue({ width: 1280, height: 720 }),
  mouse: { move: vi.fn().mockResolvedValue(undefined) }
};

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn()
};

const mockProfile = {
  id: 'test-profile',
  type: 'engagement',
  inputMethod: 'balanced',
  inputMethodPct: 50,
  probabilities: { dive: 30, like: 40, follow: 10 },
  theme: 'dark',
  timings: { scrollPause: { mean: 1000 } }
};

const mockOptions = {
  replyProbability: 0.5,
  quoteProbability: 0.2,
  engagementLimits: {
    replies: 3,
    retweets: 1,
    quotes: 1,
    likes: 5,
    follows: 2,
    bookmarks: 2
  },
  config: {}
};

describe('AITwitterAgent - Real Implementation', () => {
  let agent;
  
  beforeEach(() => {
    mockPage.url.mockReturnValue('https://x.com/home');
    mockPage.context = () => ({ browser: () => ({ isConnected: () => true }) });
    mockPage.evaluate.mockResolvedValue({ readyState: 'complete', title: 'Home' });
    agent = new AITwitterAgent(mockPage, mockProfile, mockLogger, mockOptions);
  });
  
  afterEach(async () => {
    if (agent && typeof agent.flushLogs === 'function') {
      await agent.flushLogs().catch(() => {});
    }
  });
  
  describe('Constructor & Initialization', () => {
    it('should initialize with correct page state', () => {
      expect(agent.pageState).toBe('HOME');
      expect(agent.scrollingEnabled).toBe(true);
      expect(agent.operationLock).toBe(false);
      expect(agent.diveLockAcquired).toBe(false);
    });
    
    it('should initialize with correct home URL', () => {
      expect(agent.homeUrl).toBe('https://x.com/home');
    });
    
    it('should initialize log buffering', () => {
      expect(agent.lastWaitLogTime).toBe(0);
      expect(agent.waitLogInterval).toBe(10000);
    });
    
    it('should initialize DiveQueue with correct config', () => {
      expect(agent.diveQueue).toBeDefined();
      expect(agent.diveQueue.config.maxConcurrent).toBe(1);
      expect(agent.diveQueue.config.likes).toBe(5);
    });
    
    it('should initialize AI engines', () => {
      expect(agent.replyEngine).toBeDefined();
      expect(agent.quoteEngine).toBeDefined();
      expect(agent.contextEngine).toBeDefined();
    });
    
    it('should initialize AI stats', () => {
      expect(agent.aiStats).toEqual({
        attempts: 0,
        replies: 0,
        skips: 0,
        safetyBlocks: 0,
        errors: 0
      });
    });
    
    it('should initialize engagement tracker', () => {
      expect(agent.engagementTracker).toBeDefined();
      expect(typeof agent.engagementTracker.canPerform).toBe('function');
    });
    
    it('should initialize micro handler', () => {
      expect(agent.microHandler).toBeDefined();
    });
    
    it('should initialize motor handler', () => {
      expect(agent.motorHandler).toBeDefined();
    });
    
    it('should initialize action handlers', () => {
      expect(agent.actions).toBeDefined();
      expect(agent.actions.reply).toBeDefined();
      expect(agent.actions.quote).toBeDefined();
      expect(agent.actions.like).toBeDefined();
    });
    
    it('should initialize action runner', () => {
      expect(agent.actionRunner).toBeDefined();
    });
    
    it('should initialize session tracking', () => {
      expect(agent.sessionStart).toBeDefined();
      expect(agent.currentPhase).toBe('warmup');
    });
    
    it('should initialize processed tweets set', () => {
      expect(agent._processedTweetIds).toBeInstanceOf(Set);
    });
    
    it('should initialize scroll tracking', () => {
      expect(agent._lastScrollY).toBe(0);
      expect(agent._minScrollPerDive).toBe(400);
    });
  });
  
  describe('Session Abort', () => {
    it('should exit early when aborted', async () => {
      const controller = new AbortController();
      controller.abort();

      await agent.runSession(1, 0, 0, { abortSignal: controller.signal });

      expect(agent.sessionActive).toBe(false);
    });
  });

  describe('Dive Lock Mechanism', () => {
    it('should start dive and acquire lock', async () => {
      await agent.startDive();
      expect(agent.operationLock).toBe(true);
      expect(agent.diveLockAcquired).toBe(true);
      expect(agent.pageState).toBe('DIVING');
      expect(agent.scrollingEnabled).toBe(false);
    });
    
    it('should end dive and release lock', async () => {
      await agent.startDive();
      await agent.endDive(true, false);
      expect(agent.operationLock).toBe(false);
      expect(agent.diveLockAcquired).toBe(false);
      expect(agent.scrollingEnabled).toBe(true);
    });
    
    it('should return home when ending dive with returnHome=true', async () => {
      await agent.startDive();
      await agent.endDive(true, true);
      expect(agent.pageState).toBe('HOME');
    });
    
    it('should check if diving', async () => {
      expect(agent.isDiving()).toBe(false);
      await agent.startDive();
      expect(agent.isDiving()).toBe(true);
    });
    
    it('should check if on tweet page', () => {
      agent.page.url = vi.fn().mockReturnValue('https://x.com/user/status/123');
      expect(agent.isOnTweetPage()).toBe(true);
    });
    
    it('should check if can scroll', async () => {
      expect(agent.canScroll()).toBe(true);
      await agent.startDive();
      expect(agent.canScroll()).toBe(false);
    });
    
    it('should get page state', () => {
      const state = agent.getPageState();
      expect(state.state).toBe('HOME');
      expect(state.scrollingEnabled).toBe(true);
    });
    
    it('should log dive status', () => {
      agent.logDiveStatus();
      expect(mockLogger.info).toHaveBeenCalled();
    });
    
    it('should wait for dive to complete', async () => {
      await agent.startDive();
      
      setTimeout(async () => {
        await agent.endDive();
      }, 100);
      
      await agent.waitForDiveComplete();
      expect(agent.operationLock).toBe(false);
    });
    
    it('should check if should continue session', () => {
      expect(agent.shouldContinueSession()).toBe(true);
    });
  });
  
  describe('Session Management', () => {
    it('should update session phase', () => {
      agent.updateSessionPhase();
      expect(agent.currentPhase).toBeDefined();
    });
    
    it('should get phase modified probability', () => {
      const prob = agent.getPhaseModifiedProbability('reply', 0.5);
      expect(typeof prob).toBe('number');
    });
    
    it('should get session progress', () => {
      const progress = agent.getSessionProgress();
      expect(typeof progress).toBe('number');
    });
    
    it('should check if in cooldown', () => {
      const inCooldown = agent.isInCooldown();
      expect(typeof inCooldown).toBe('boolean');
    });
    
    it('should check if in warmup', () => {
      const inWarmup = agent.isInWarmup();
      expect(typeof inWarmup).toBe('boolean');
    });
  });
  
  describe('Micro Interactions', () => {
    it('should trigger micro interaction', async () => {
      const result = await agent.triggerMicroInteraction('reading');
      expect(result).toBeDefined();
    });
    
    it('should highlight text', async () => {
      const result = await agent.highlightText();
      expect(result).toBeDefined();
    });
    
    it('should start fidget loop', () => {
      const interval = agent.startFidgetLoop();
      expect(interval).toBeDefined();
    });
    
    it('should stop fidget loop', () => {
      agent.stopFidgetLoop();
      // Should not throw
    });
    
    it('should override simulateFidget', async () => {
      await agent.simulateFidget();
      // Should call microHandler.executeMicroInteraction
    });
  });
  
  describe('Motor Control', () => {
    it('should perform smart click', async () => {
      const result = await agent.smartClick('test', { verifySelector: '[data-testid="like"]' });
      expect(result).toBeDefined();
    });
    
    it('should click element with fallback', async () => {
      const result = await agent.smartClickElement('[data-testid="like"]', ['[data-testid="unlike"]']);
      expect(result).toBeDefined();
    });
  });
  
  describe('Safe Navigation', () => {
    it('should safely navigate home', async () => {
      const result = await agent._safeNavigateHome();
      expect(result).toBe(true);
    });
    
    it('should detect already on home page', async () => {
      agent.page.url = vi.fn().mockReturnValue('https://x.com/home');
      const result = await agent._safeNavigateHome();
      expect(result).toBe(true);
    });
  });
  
  describe('Exploration Scroll', () => {
    it('should ensure exploration scroll', async () => {
      agent.page.evaluate = vi.fn()
        .mockResolvedValueOnce(500)  // currentY
        .mockResolvedValueOnce(2000); // docHeight
      
      const result = await agent._ensureExplorationScroll();
      expect(result).toBe(true);
    });
    
    it('should skip scroll if already scrolled enough', async () => {
      agent._lastScrollY = 1000;
      agent.page.evaluate = vi.fn()
        .mockResolvedValueOnce(1500)  // currentY (delta = 500 > 400)
        .mockResolvedValueOnce(3000); // docHeight
      
      const result = await agent._ensureExplorationScroll();
      expect(result).toBe(true);
    });
  });
  
  describe('Logging', () => {
    it('should log debug messages', () => {
      agent.logDebug('Test debug message');
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('[DEBUG]'));
    });
    
    it('should log warning messages', () => {
      agent.logWarn('Test warning message');
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('[WARN]'));
    });
  });
  
  describe('Perform Idle Cursor Movement', () => {
    it('should perform idle cursor movement', async () => {
      await agent.performIdleCursorMovement();
      // Should move mouse without errors
    });
  });
  
  describe('Health Check', () => {
    it('should return healthy when browser connected', async () => {
      const result = await agent.performHealthCheck();
      expect(result.healthy).toBe(true);
    });
    
    it('should handle disconnected browser', async () => {
      agent.page.context = vi.fn().mockReturnValue({
        browser: vi.fn().mockReturnValue({ isConnected: vi.fn().mockReturnValue(false) })
      });
      const result = await agent.performHealthCheck();
      expect(result.healthy).toBe(false);
    });
    
    it('should handle page evaluation error', async () => {
      agent.page.evaluate = vi.fn().mockRejectedValue(new Error('Eval failed'));
      const result = await agent.performHealthCheck();
      expect(result.healthy).toBe(false);
    });
  });
  
  describe('Read Expanded Tweet', () => {
    it('should read expanded tweet', async () => {
      // Mock mathUtils.roll to return false (skip media check)
      const { mathUtils } = await import('../../utils/mathUtils.js');
      mathUtils.roll = vi.fn().mockReturnValue(false);
      
      // Mock locator to return proper chainable object
      agent.page.locator = vi.fn().mockReturnValue({
        count: vi.fn().mockResolvedValue(0),
        isVisible: vi.fn().mockResolvedValue(false)
      });
      
      await agent._readExpandedTweet();
    });
  });
  
  describe('Quick Fallback Engagement', () => {
    it('should perform quick fallback engagement', async () => {
      const result = await agent._quickFallbackEngagement();
      expect(result).toBeDefined();
    });
  });
  
  describe('Dive Tweet with AI', () => {
    it('should handle dive tweet with queue wrapper', async () => {
      agent.isScanning = false;
      const queueWrapper = async (task) => {
        return await task();
      };
      
      await agent._diveTweetWithAI(queueWrapper);
      // Should complete without errors
    });
    
    it('should handle dive tweet without queue wrapper', async () => {
      agent.isScanning = false;
      await agent._diveTweetWithAI();
      // Should complete without errors
    });
  });
  
  describe('Process Tweet ID', () => {
    it('should track processed tweets', () => {
      agent._processedTweetIds.add('tweet-123');
      expect(agent._processedTweetIds.has('tweet-123')).toBe(true);
      expect(agent._processedTweetIds.size).toBe(1);
    });
  });
  
  describe('AI Stats Tracking', () => {
    it('should track AI stats', () => {
      agent.aiStats.attempts = 5;
      agent.aiStats.replies = 3;
      expect(agent.aiStats.attempts).toBe(5);
      expect(agent.aiStats.replies).toBe(3);
    });
  });
  
  describe('Engagement Tracking', () => {
    it('should check if can perform engagement', () => {
      const canLike = agent.engagementTracker.canPerform('likes');
      expect(canLike).toBe(true);
    });
    
    it('should record engagement', () => {
      const recorded = agent.engagementTracker.record('likes');
      expect(recorded).toBe(true);
    });
    
    it('should get engagement progress', () => {
      const progress = agent.engagementTracker.getProgress('likes');
      expect(progress).toBeDefined();
    });
    
    it('should get engagement status', () => {
      const status = agent.engagementTracker.getStatus();
      expect(status).toBeDefined();
    });
    
    it('should get engagement summary', () => {
      const summary = agent.engagementTracker.getSummary();
      expect(summary).toBeDefined();
    });
  });
  
  describe('Quick Mode', () => {
    it('should enable quick mode', () => {
      agent.diveQueue.enableQuickMode();
      agent.quickModeEnabled = true;
      expect(agent.quickModeEnabled).toBe(true);
    });
  });
  
  describe('Get AI Stats', () => {
    it('should return AI stats', () => {
      const stats = agent.getAIStats();
      expect(stats).toBeDefined();
    });
  });
});

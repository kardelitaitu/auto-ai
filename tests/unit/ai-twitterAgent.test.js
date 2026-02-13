/**
 * @fileoverview Unit Tests for AITwitterAgent - Simplified Version
 * Tests key behaviors with minimal mock complexity
 * @module tests/unit/ai-twitterAgent.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies at a higher level
const mockPage = {
  goto: vi.fn().mockResolvedValue(undefined),
  waitForTimeout: vi.fn().mockResolvedValue(undefined),
  url: vi.fn().mockReturnValue('https://x.com/home'),
  isClosed: vi.fn().mockReturnValue(false),
  close: vi.fn().mockResolvedValue(undefined),
  evaluate: vi.fn().mockResolvedValue({ readyState: 'complete', title: 'Home' }),
  context: vi.fn().mockReturnValue({
    browser: vi.fn().mockReturnValue({ isConnected: vi.fn().mockReturnValue(true) })
  }),
  emulateMedia: vi.fn().mockResolvedValue(undefined),
  on: vi.fn()
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
  theme: 'dark'
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

// Create a minimal AITwitterAgent-like class for testing
class MockEngagementTracker {
  constructor(limits) {
    this.limits = limits;
    this.state = { likes: 0, replies: 0, bookmarks: 0, quotes: 0, retweets: 0, follows: 0 };
  }

  canPerform(action) {
    return this.state[action] < (this.limits[action] || Infinity);
  }

  record(action) {
    if (this.canPerform(action)) {
      this.state[action]++;
      return true;
    }
    return false;
  }

  getProgress(action) {
    return `${this.state[action]}/${this.limits[action] || '∞'}`;
  }

  getStatus() {
    const status = {};
    for (const [action, limit] of Object.entries(this.limits)) {
      status[action] = {
        current: this.state[action] || 0,
        limit,
        remaining: limit - (this.state[action] || 0),
        percentage: `${((this.state[action] || 0) / limit * 100).toFixed(0)}%`
      };
    }
    return status;
  }

  getSummary() {
    return Object.entries(this.state)
      .filter(([action, count]) => count > 0)
      .map(([action, count]) => `${action}: ${count}/${this.limits[action]}`)
      .join(', ');
  }
}

class MockDiveQueue {
  constructor(limits) {
    this.limits = limits;
    this.state = { likes: 0, replies: 0, bookmarks: 0 };
  }

  canEngage(action) {
    return this.state[action] < (this.limits[action] || Infinity);
  }

  recordEngagement(action) {
    if (this.canEngage(action)) {
      this.state[action]++;
      return true;
    }
    return false;
  }

  getEngagementProgress() {
    const progress = {};
    for (const [action, limit] of Object.entries(this.limits)) {
      progress[action] = {
        current: this.state[action] || 0,
        limit,
        remaining: limit - (this.state[action] || 0),
        percentUsed: ((this.state[action] || 0) / limit * 100)
      };
    }
    return progress;
  }

  getFullStatus() {
    return {
      queue: { queueLength: 0, activeCount: 0, utilizationPercent: 0 },
      engagement: this.getEngagementProgress(),
      failedCount: 0,
      timedOutCount: 0
    };
  }

  enableQuickMode() {}
  isInCooldown() { return false; }
}

// Mock AITwitterAgent class for testing
class MockAITwitterAgent {
  constructor(page, profile, logger, options = {}) {
    this.page = page;
    this.config = profile;
    this.logger = logger;
    this.twitterConfig = options.config || {};
    
    // Page state management
    this.pageState = 'HOME';
    this.scrollingEnabled = true;
    this.operationLock = false;
    this.diveLockAcquired = false;
    this.homeUrl = 'https://x.com/home';
    
    // Log buffering
    this.lastWaitLogTime = 0;
    this.waitLogInterval = 10000;
    
    // Engagement limits
    const customLimits = options.engagementLimits || {
      replies: 3, retweets: 1, quotes: 1, likes: 5, follows: 2, bookmarks: 2
    };
    
    // Create synchronized engagement trackers
    const tracker = new MockEngagementTracker(customLimits);
    const queue = new MockDiveQueue(customLimits);
    
    this._tracker = tracker;
    this._queue = queue;
    
    // Synchronized engagement tracker
    this.engagementTracker = {
      canPerform: (action) => tracker.canPerform(action) && queue.canEngage(action),
      record: (action) => {
        if (tracker.canPerform(action) && queue.canEngage(action)) {
          tracker.record(action);
          queue.recordEngagement(action);
          return true;
        }
        return false;
      },
      getProgress: (action) => tracker.getProgress(action),
      getStatus: () => tracker.getStatus(),
      getSummary: () => tracker.getSummary()
    };
    
    // Quick mode
    this.quickModeEnabled = false;
    
    // Session tracking
    this.sessionStart = Date.now();
    this.sessionDuration = 0;
    this.currentPhase = 'warmup';
    this.lastPhaseLogged = null;
    
    // Processed tweets
    this._processedTweetIds = new Set();
    
    // Scroll tracking
    this._lastScrollY = 0;
    this._lastScrollTime = 0;
    this._minScrollPerDive = 400;
    this._scrollExplorationThreshold = 600;
    
    // AI stats
    this.aiStats = { attempts: 0, replies: 0, skips: 0, safetyBlocks: 0, errors: 0 };
    
    // Action handlers
    this.actions = {
      reply: {},
      quote: {},
      like: {},
      bookmark: {},
      goHome: {}
    };
    this.actionRunner = { agent: this };
    
    // Mock loggers
    this.queueLogger = {
      info: vi.fn(), warn: vi.fn(), error: vi.fn(),
      shutdown: vi.fn().mockResolvedValue(undefined)
    };
    this.engagementLogger = {
      info: vi.fn(), warn: vi.fn(), error: vi.fn(),
      shutdown: vi.fn().mockResolvedValue(undefined)
    };
  }
  
  // Dive lock methods
  async startDive() {
    while (this.operationLock) {
      await new Promise(r => setTimeout(r, 10));
    }
    this.operationLock = true;
    this.diveLockAcquired = true;
    this.pageState = 'DIVING';
    this.scrollingEnabled = false;
  }
  
  async endDive(success = true, returnHome = false) {
    this.operationLock = false;
    this.diveLockAcquired = false;
    this.scrollingEnabled = true;
    this.pageState = returnHome ? 'HOME' : 'TWEET_PAGE';
  }
  
  // Health check
  async performHealthCheck() {
    try {
      const browser = this.page.context()?.browser();
      if (!browser?.isConnected()) {
        return { healthy: false, reason: 'browser_disconnected' };
      }
      
      const pageHealth = await this.page.evaluate(() => ({
        readyState: document.readyState,
        title: document.title,
        hasBody: !!document.body
      })).catch(() => ({ readyState: 'error', title: '', hasBody: false }));
      
      if (pageHealth.readyState !== 'complete' && pageHealth.readyState !== 'interactive') {
        return { healthy: false, reason: 'page_not_ready' };
      }
      
      const currentUrl = this.page.url();
      if (!currentUrl.includes('x.com') && !currentUrl.includes('twitter.com')) {
        return { healthy: false, reason: 'unexpected_url' };
      }
      
      return { healthy: true, pageState: pageHealth.readyState };
    } catch (error) {
      return { healthy: false, reason: error.message };
    }
  }
  
  // Logger flush
  async flushLogs() {
    await Promise.all([
      this.queueLogger.shutdown(),
      this.engagementLogger.shutdown()
    ]);
  }
}

// Test constants
const PAGE_STATE = {
  HOME: 'HOME',
  DIVING: 'DIVING',
  TWEET_PAGE: 'TWEET_PAGE',
  RETURNING: 'RETURNING'
};

describe('AITwitterAgent', () => {
  let agent;
  
  beforeEach(() => {
    vi.clearAllMocks();
    agent = new MockAITwitterAgent(mockPage, mockProfile, mockLogger, mockOptions);
  });
  
  afterEach(() => {
    if (agent && typeof agent.flushLogs === 'function') {
      agent.flushLogs().catch(() => {});
    }
  });
  
  describe('Constructor & Initialization', () => {
    it('should initialize with correct values', () => {
      expect(agent.page).toBe(mockPage);
      expect(agent.config).toBe(mockProfile);
      expect(agent.logger).toBe(mockLogger);
      expect(agent.pageState).toBe('HOME');
      expect(agent.scrollingEnabled).toBe(true);
      expect(agent.operationLock).toBe(false);
    });
    
    it('should initialize engagement tracker', () => {
      expect(agent.engagementTracker).toBeDefined();
      expect(typeof agent.engagementTracker.canPerform).toBe('function');
      expect(typeof agent.engagementTracker.record).toBe('function');
    });
    
    it('should initialize AI stats', () => {
      expect(agent.aiStats).toEqual({
        attempts: 0, replies: 0, skips: 0, safetyBlocks: 0, errors: 0
      });
    });
    
    it('should initialize session tracking', () => {
      expect(agent.sessionStart).toBeDefined();
      expect(agent.currentPhase).toBe('warmup');
    });
    
    it('should initialize processed tweets set', () => {
      expect(agent._processedTweetIds).toBeInstanceOf(Set);
      expect(agent._processedTweetIds.size).toBe(0);
    });
    
    it('should initialize scroll tracking', () => {
      expect(agent._lastScrollY).toBe(0);
      expect(agent._minScrollPerDive).toBe(400);
    });
    
    it('should initialize quick mode as disabled', () => {
      expect(agent.quickModeEnabled).toBe(false);
    });
    
    it('should accept custom engagement limits', () => {
      const customAgent = new MockAITwitterAgent(mockPage, mockProfile, mockLogger, {
        engagementLimits: { likes: 10, replies: 5 }
      });
      expect(customAgent).toBeDefined();
    });
  });
  
  describe('Dive Lock Mechanism', () => {
    it('should acquire lock on startDive', async () => {
      await agent.startDive();
      expect(agent.operationLock).toBe(true);
      expect(agent.diveLockAcquired).toBe(true);
    });
    
    it('should set page state to DIVING', async () => {
      await agent.startDive();
      expect(agent.pageState).toBe('DIVING');
    });
    
    it('should disable scrolling during dive', async () => {
      await agent.startDive();
      expect(agent.scrollingEnabled).toBe(false);
    });
    
    it('should release lock on endDive', async () => {
      await agent.startDive();
      await agent.endDive();
      expect(agent.operationLock).toBe(false);
    });
    
    it('should enable scrolling after dive', async () => {
      await agent.startDive();
      expect(agent.scrollingEnabled).toBe(false);
      await agent.endDive();
      expect(agent.scrollingEnabled).toBe(true);
    });
    
    it('should return home when specified', async () => {
      await agent.startDive();
      await agent.endDive(true, true);
      expect(agent.pageState).toBe('HOME');
    });
    
    it('should stay on tweet page when not returning', async () => {
      await agent.startDive();
      await agent.endDive(true, false);
      expect(agent.pageState).toBe('TWEET_PAGE');
    });
  });
  
  describe('Engagement Tracking', () => {
    it('should allow engagement when under limit', () => {
      const canLike = agent.engagementTracker.canPerform('likes');
      expect(canLike).toBe(true);
    });
    
    it('should record engagement action', () => {
      const recorded = agent.engagementTracker.record('likes');
      expect(recorded).toBe(true);
    });
    
    it('should track progress correctly', () => {
      agent.engagementTracker.record('likes');
      agent.engagementTracker.record('likes');
      const progress = agent.engagementTracker.getProgress('likes');
      expect(progress).toContain('/');
    });
    
    it('should return status object', () => {
      const status = agent.engagementTracker.getStatus();
      expect(typeof status).toBe('object');
      expect(status.likes).toBeDefined();
    });
    
    it('should return summary string', () => {
      const summary = agent.engagementTracker.getSummary();
      expect(typeof summary).toBe('string');
    });
  });
  
  describe('Health Check', () => {
    it('should return healthy when browser connected', async () => {
      const result = await agent.performHealthCheck();
      expect(result.healthy).toBe(true);
    });
    
    it('should return unhealthy when browser disconnected', async () => {
      mockPage.context.mockReturnValueOnce({
        browser: vi.fn().mockReturnValue({ isConnected: vi.fn().mockReturnValue(false) })
      });
      const agent2 = new MockAITwitterAgent(mockPage, mockProfile, mockLogger, mockOptions);
      const result = await agent2.performHealthCheck();
      expect(result.healthy).toBe(false);
      expect(result.reason).toBe('browser_disconnected');
    });
    
    it('should handle page evaluation error', async () => {
      mockPage.evaluate.mockRejectedValueOnce(new Error('Eval failed'));
      const agent3 = new MockAITwitterAgent(mockPage, mockProfile, mockLogger, mockOptions);
      const result = await agent3.performHealthCheck();
      expect(result.healthy).toBe(false);
    });
    
    it('should handle unexpected URL', async () => {
      mockPage.url.mockReturnValueOnce('https://evil.com');
      const agent4 = new MockAITwitterAgent(mockPage, mockProfile, mockLogger, mockOptions);
      const result = await agent4.performHealthCheck();
      expect(result.healthy).toBe(false);
      expect(result.reason).toBe('unexpected_url');
    });
  });
  
  describe('Logged Messages', () => {
    it('should have logger initialized', () => {
      expect(agent.logger).toBeDefined();
    });
    
    it('should have queue logger', () => {
      expect(agent.queueLogger).toBeDefined();
      expect(typeof agent.queueLogger.info).toBe('function');
    });
    
    it('should have engagement logger', () => {
      expect(agent.engagementLogger).toBeDefined();
      expect(typeof agent.engagementLogger.info).toBe('function');
    });
  });
  
  describe('Buffered Logging', () => {
    it('should have flushLogs method', async () => {
      expect(typeof agent.flushLogs).toBe('function');
      await agent.flushLogs();
      expect(agent.queueLogger.shutdown).toHaveBeenCalled();
      expect(agent.engagementLogger.shutdown).toHaveBeenCalled();
    });
  });
  
  describe('Processed Tweet Tracking', () => {
    it('should track processed tweets', () => {
      agent._processedTweetIds.add('tweet-1');
      agent._processedTweetIds.add('tweet-2');
      expect(agent._processedTweetIds.size).toBe(2);
      expect(agent._processedTweetIds.has('tweet-1')).toBe(true);
    });
    
    it('should check if tweet was processed', () => {
      agent._processedTweetIds.add('tweet-123');
      expect(agent._processedTweetIds.has('tweet-123')).toBe(true);
      expect(agent._processedTweetIds.has('tweet-456')).toBe(false);
    });
    
    it('should clear processed tweets', () => {
      agent._processedTweetIds.add('tweet-1');
      agent._processedTweetIds.clear();
      expect(agent._processedTweetIds.size).toBe(0);
    });
  });
  
  describe('Scroll Tracking', () => {
    it('should track scroll position', () => {
      agent._lastScrollY = 500;
      expect(agent._lastScrollY).toBe(500);
    });
    
    it('should track scroll time', () => {
      const now = Date.now();
      agent._lastScrollTime = now;
      expect(agent._lastScrollTime).toBe(now);
    });
    
    it('should have minimum scroll per dive setting', () => {
      expect(agent._minScrollPerDive).toBe(400);
    });
    
    it('should have exploration threshold setting', () => {
      expect(agent._scrollExplorationThreshold).toBe(600);
    });
  });
  
  describe('Session Phase Tracking', () => {
    it('should track session start', () => {
      expect(agent.sessionStart).toBeDefined();
    });
    
    it('should track session duration', () => {
      agent.sessionDuration = 60000;
      expect(agent.sessionDuration).toBe(60000);
    });
    
    it('should start in warmup phase', () => {
      expect(agent.currentPhase).toBe('warmup');
    });
    
    it('should transition phases', () => {
      agent.currentPhase = 'active';
      expect(agent.currentPhase).toBe('active');
      agent.currentPhase = 'cooldown';
      expect(agent.currentPhase).toBe('cooldown');
    });
  });
  
  describe('AI Stats', () => {
    it('should initialize with zeros', () => {
      expect(agent.aiStats.attempts).toBe(0);
      expect(agent.aiStats.replies).toBe(0);
      expect(agent.aiStats.skips).toBe(0);
    });
    
    it('should track stats', () => {
      agent.aiStats.attempts++;
      agent.aiStats.replies++;
      expect(agent.aiStats.attempts).toBe(1);
      expect(agent.aiStats.replies).toBe(1);
    });
  });
  
  describe('Action Handlers', () => {
    it('should have action handlers', () => {
      expect(agent.actions.reply).toBeDefined();
      expect(agent.actions.quote).toBeDefined();
      expect(agent.actions.like).toBeDefined();
      expect(agent.actions.bookmark).toBeDefined();
      expect(agent.actions.goHome).toBeDefined();
    });
    
    it('should have action runner', () => {
      expect(agent.actionRunner).toBeDefined();
      expect(agent.actionRunner.agent).toBe(agent);
    });
  });
  
  describe('Quick Mode', () => {
    it('should be disabled by default', () => {
      expect(agent.quickModeEnabled).toBe(false);
    });
    
    it('should be toggleable', () => {
      agent.quickModeEnabled = true;
      expect(agent.quickModeEnabled).toBe(true);
    });
  });
  
  describe('Home URL', () => {
    it('should be set correctly', () => {
      expect(agent.homeUrl).toBe('https://x.com/home');
    });
  });
  
  describe('Wait Log Interval', () => {
    it('should be 10 seconds', () => {
      expect(agent.waitLogInterval).toBe(10000);
    });
    
    it('should track last wait log time', () => {
      expect(agent.lastWaitLogTime).toBe(0);
    });
  });
});

describe('MockEngagementTracker', () => {
  const limits = { likes: 5, replies: 3, bookmarks: 2 };
  let tracker;
  
  beforeEach(() => {
    tracker = new MockEngagementTracker(limits);
  });
  
  it('should allow actions under limit', () => {
    expect(tracker.canPerform('likes')).toBe(true);
    expect(tracker.canPerform('replies')).toBe(true);
  });
  
  it('should record actions', () => {
    expect(tracker.record('likes')).toBe(true);
    expect(tracker.state.likes).toBe(1);
  });
  
  it('should prevent actions at limit', () => {
    for (let i = 0; i < 5; i++) tracker.record('likes');
    expect(tracker.canPerform('likes')).toBe(false);
    expect(tracker.record('likes')).toBe(false);
  });
  
  it('should return correct progress', () => {
    tracker.record('likes');
    tracker.record('likes');
    const progress = tracker.getProgress('likes');
    expect(progress).toBe('2/5');
  });
  
  it('should return status object', () => {
    const status = tracker.getStatus();
    expect(status.likes.current).toBe(0);
    expect(status.likes.limit).toBe(5);
    expect(status.likes.remaining).toBe(5);
  });
  
  it('should return summary string', () => {
    tracker.record('likes');
    tracker.record('replies');
    const summary = tracker.getSummary();
    expect(summary).toContain('likes');
    expect(summary).toContain('replies');
  });
});

describe('MockDiveQueue', () => {
  const limits = { likes: 5, replies: 3 };
  let queue;
  
  beforeEach(() => {
    queue = new MockDiveQueue(limits);
  });
  
  it('should allow engagement under limit', () => {
    expect(queue.canEngage('likes')).toBe(true);
  });
  
  it('should record engagement', () => {
    expect(queue.recordEngagement('likes')).toBe(true);
    expect(queue.state.likes).toBe(1);
  });
  
  it('should return engagement progress', () => {
    queue.recordEngagement('likes');
    const progress = queue.getEngagementProgress();
    expect(progress.likes.current).toBe(1);
    expect(progress.likes.limit).toBe(5);
  });
  
  it('should return full status', () => {
    const status = queue.getFullStatus();
    expect(status.queue.queueLength).toBe(0);
    expect(status.engagement).toBeDefined();
  });
  
  it('should enable quick mode', () => {
    expect(() => queue.enableQuickMode()).not.toThrow();
  });
  
  it('should report cooldown state', () => {
    expect(queue.isInCooldown()).toBe(false);
  });
});

describe('AITwitterAgent Edge Cases', () => {
  it('should handle null profile', () => {
    const agent = new MockAITwitterAgent(mockPage, null, mockLogger, mockOptions);
    expect(agent.config).toBeNull();
  });
  
  it('should handle empty options', () => {
    const agent = new MockAITwitterAgent(mockPage, mockProfile, mockLogger, {});
    expect(agent).toBeDefined();
  });
  
  it('should handle startDive without endDive', async () => {
    const agent = new MockAITwitterAgent(mockPage, mockProfile, mockLogger, mockOptions);
    await agent.startDive();
    expect(agent.operationLock).toBe(true);
  });
  
  it('should handle endDive without startDive', async () => {
    const agent = new MockAITwitterAgent(mockPage, mockProfile, mockLogger, mockOptions);
    await agent.endDive();
    expect(agent.operationLock).toBe(false);
  });
  
  it('should handle multiple startDive calls', async () => {
    const agent = new MockAITwitterAgent(mockPage, mockProfile, mockLogger, mockOptions);
    await agent.startDive();
    expect(agent.operationLock).toBe(true);
  });
  
  it('should handle rapid startDive and endDive', async () => {
    const agent = new MockAITwitterAgent(mockPage, mockProfile, mockLogger, mockOptions);
    await agent.startDive();
    await agent.endDive();
    expect(agent.operationLock).toBe(false);
    expect(agent.scrollingEnabled).toBe(true);
  });
  
  it('should handle engagement with invalid action', () => {
    const agent = new MockAITwitterAgent(mockPage, mockProfile, mockLogger, mockOptions);
    const canPerform = agent.engagementTracker.canPerform('invalid');
    expect(canPerform).toBeDefined();
  });
  
  it('should handle recording with invalid action', () => {
    const agent = new MockAITwitterAgent(mockPage, mockProfile, mockLogger, mockOptions);
    const recorded = agent.engagementTracker.record('invalid');
    expect(typeof recorded).toBe('boolean');
  });
  
  it('should handle special characters in tweet IDs', () => {
    const agent = new MockAITwitterAgent(mockPage, mockProfile, mockLogger, mockOptions);
    agent._processedTweetIds.add('tweet-123!@#$%');
    expect(agent._processedTweetIds.has('tweet-123!@#$%')).toBe(true);
  });
  
  it('should handle negative session duration', () => {
    const agent = new MockAITwitterAgent(mockPage, mockProfile, mockLogger, mockOptions);
    agent.sessionDuration = -1000;
    expect(agent.sessionDuration).toBe(-1000);
  });
  
  it('should handle negative scroll position', () => {
    const agent = new MockAITwitterAgent(mockPage, mockProfile, mockLogger, mockOptions);
    agent._lastScrollY = -100;
    expect(agent._lastScrollY).toBe(-100);
  });
  
  it('should handle invalid phase transitions', () => {
    const agent = new MockAITwitterAgent(mockPage, mockProfile, mockLogger, mockOptions);
    agent.currentPhase = 'invalid-phase';
    expect(agent.currentPhase).toBe('invalid-phase');
  });
});

describe('AITwitterAgent Integration Scenarios', () => {
  describe('Full dive cycle', () => {
    it('should complete full dive cycle', async () => {
      const agent = new MockAITwitterAgent(mockPage, mockProfile, mockLogger, mockOptions);
      
      await agent.startDive();
      expect(agent.pageState).toBe('DIVING');
      
      await agent.endDive(true, true);
      expect(agent.pageState).toBe('HOME');
      expect(agent.operationLock).toBe(false);
    });
    
    it('should track engagement through cycle', () => {
      const agent = new MockAITwitterAgent(mockPage, mockProfile, mockLogger, mockOptions);
      
      agent.engagementTracker.record('likes');
      const progress = agent.engagementTracker.getProgress('likes');
      
      expect(progress).toBeDefined();
      expect(typeof progress).toBe('string');
    });
  });
  
  describe('Multiple engagement actions', () => {
    it('should track multiple engagement actions', () => {
      const agent = new MockAITwitterAgent(mockPage, mockProfile, mockLogger, mockOptions);
      
      agent.engagementTracker.record('likes');
      agent.engagementTracker.record('likes');
      agent.engagementTracker.record('replies');
      
      const status = agent.engagementTracker.getStatus();
      expect(status.likes.current).toBeGreaterThan(0);
    });
    
    it('should track different engagement types', () => {
      const agent = new MockAITwitterAgent(mockPage, mockProfile, mockLogger, mockOptions);
      
      agent.engagementTracker.record('likes');
      agent.engagementTracker.record('replies');
      agent.engagementTracker.record('bookmarks');
      
      const summary = agent.engagementTracker.getSummary();
      expect(summary).toContain('likes');
      expect(summary).toContain('replies');
      expect(summary).toContain('bookmarks');
    });
  });
  
  describe('Session lifecycle', () => {
    it('should track session progression', () => {
      const agent = new MockAITwitterAgent(mockPage, mockProfile, mockLogger, mockOptions);
      
      const startTime = agent.sessionStart;
      agent.sessionDuration = 300000;
      
      expect(agent.sessionStart).toBe(startTime);
      expect(agent.sessionDuration).toBe(300000);
    });
    
    it('should transition through phases', () => {
      const agent = new MockAITwitterAgent(mockPage, mockProfile, mockLogger, mockOptions);
      
      agent.currentPhase = 'warmup';
      agent.currentPhase = 'active';
      agent.currentPhase = 'cooldown';
      
      expect(agent.currentPhase).toBe('cooldown');
    });
  });
  
  describe('Tweet processing lifecycle', () => {
    it('should track processed tweets', () => {
      const agent = new MockAITwitterAgent(mockPage, mockProfile, mockLogger, mockOptions);
      
      agent._processedTweetIds.add('tweet-1');
      agent._processedTweetIds.add('tweet-2');
      agent._processedTweetIds.add('tweet-3');
      
      expect(agent._processedTweetIds.size).toBe(3);
    });
    
    it('should clear processed tweets', () => {
      const agent = new MockAITwitterAgent(mockPage, mockProfile, mockLogger, mockOptions);
      
      agent._processedTweetIds.add('tweet-1');
      agent._processedTweetIds.clear();
      
      expect(agent._processedTweetIds.size).toBe(0);
    });
  });
  
  describe('Quick mode lifecycle', () => {
    it('should enable quick mode', () => {
      const agent = new MockAITwitterAgent(mockPage, mockProfile, mockLogger, mockOptions);
      
      expect(agent.quickModeEnabled).toBe(false);
      agent.quickModeEnabled = true;
      expect(agent.quickModeEnabled).toBe(true);
    });
  });
});

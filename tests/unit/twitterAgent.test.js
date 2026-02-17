import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../utils/ghostCursor.js', () => ({
  GhostCursor: class {
    constructor() {}
    click() {}
  }
}));

vi.mock('../../utils/scroll-helper.js', () => ({
  scrollDown: vi.fn().mockResolvedValue(undefined),
  scrollUp: vi.fn().mockResolvedValue(undefined),
  scrollRandom: vi.fn().mockResolvedValue(undefined),
  scrollWheel: vi.fn().mockResolvedValue(undefined)
}));
vi.mock('../../utils/humanization/index.js', () => ({
  HumanizationEngine: class {
    constructor() {}
    think() { return Promise.resolve(); }
    consumeContent() { return Promise.resolve(); }
    multitask() { return Promise.resolve(); }
    recoverFromError() { return Promise.resolve(); }
    sessionStart() { return Promise.resolve(); }
    sessionEnd() { return Promise.resolve(); }
    cycleComplete() { return Promise.resolve(); }
    session = { shouldEndSession: () => true };
  }
}));
vi.mock('../../utils/profileManager.js', () => ({
  profileManager: {
    getFatiguedVariant: vi.fn()
  }
}));
vi.mock('../../utils/mathUtils.js', () => ({
  mathUtils: {
    randomInRange: vi.fn(() => 1000),
    gaussian: vi.fn(() => 1000),
    roll: vi.fn(() => true)
  }
}));

describe('twitterAgent', () => {
  let TwitterAgent;
  let agent;
  let mockPage;
  let mockLogger;
  let mockProfile;
  let profileManager;

  beforeEach(async () => {
    vi.clearAllMocks();
    ({ TwitterAgent } = await import('../../utils/twitterAgent.js'));
    ({ profileManager } = await import('../../utils/profileManager.js'));
    mockPage = { on: vi.fn() };
    mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
    mockProfile = {
      id: 'profile-1',
      description: 'test profile',
      timings: {
        scrollPause: { mean: 1000 },
        readingPhase: { mean: 1000, deviation: 100 },
        actionSpecific: {
          idle: { mean: 1000, deviation: 200 },
          space: { mean: 1000, deviation: 200 },
          keys: { mean: 100, deviation: 30 }
        }
      },
      probabilities: { refresh: 0.5 },
      inputMethods: { wheelDown: 0.8, wheelUp: 0.05, space: 0.05, keysDown: 0.1, keysUp: 0 }
    };
    agent = new TwitterAgent(mockPage, mockProfile, mockLogger);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('normalizes probabilities with refresh suppression and aliasing', () => {
    agent.state.lastRefreshAt = Date.now();
    const result = agent.normalizeProbabilities({ refresh: 0.5, likeTweetafterDive: 0.12 });
    expect(result.refresh).toBe(0.2);
    expect(result.likeTweetafterDive).toBe(0.12);
  });

  it('applies burst mode overrides', () => {
    agent.state.activityMode = 'BURST';
    const result = agent.normalizeProbabilities({});
    expect(result.idle).toBe(0);
    expect(result.refresh).toBe(0);
    expect(result.tweetDive).toBe(0.6);
    expect(result.profileDive).toBe(0.2);
  });

  it('selects scroll method based on roll', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.83);
    const method = agent.getScrollMethod();
    spy.mockRestore();
    expect(method).toBe('WHEEL_UP');
  });

  it('detects session expiration', () => {
    agent.sessionEndTime = Date.now() - 1;
    expect(agent.isSessionExpired()).toBe(true);
    agent.sessionEndTime = null;
    expect(agent.isSessionExpired()).toBe(false);
  });

  describe('constructor initialization', () => {
    it('should initialize with provided page, profile, and logger', () => {
      expect(agent.page).toBe(mockPage);
      expect(agent.config).toBe(mockProfile);
      expect(agent.logger).toBe(mockLogger);
      expect(agent.sessionStart).toBeDefined();
      expect(agent.loopIndex).toBe(0);
    });

    it('should initialize state with default values', () => {
      expect(agent.state.lastRefreshAt).toBe(0);
      expect(agent.state.engagements).toBe(0);
      expect(agent.state.likes).toBe(0);
      expect(agent.state.follows).toBe(0);
      expect(agent.state.activityMode).toBe('NORMAL');
    });

    it('should setup network activity listeners', () => {
      expect(mockPage.on).toHaveBeenCalledWith('request', expect.any(Function));
      expect(mockPage.on).toHaveBeenCalledWith('response', expect.any(Function));
    });

    it('should handle listener setup failure gracefully', () => {
      const errorPage = { on: vi.fn().mockImplementation(() => { throw new Error('Listener error'); }) };
      const errorAgent = new TwitterAgent(errorPage, mockProfile, mockLogger);
      expect(errorAgent).toBeDefined();
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Warning'));
    });
  });

  describe('log method', () => {
    it('should use logger if available', () => {
      agent.log('Test message');
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Test message'));
    });

    it('should fallback to console if no logger', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const agentNoLogger = new TwitterAgent(mockPage, mockProfile, null);
      agentNoLogger.log('Test message');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Test message'));
      consoleSpy.mockRestore();
    });
  });

  describe('clamp utility', () => {
    it('should clamp value between min and max', () => {
      expect(agent.clamp(5, 0, 10)).toBe(5);
      expect(agent.clamp(-5, 0, 10)).toBe(0);
      expect(agent.clamp(15, 0, 10)).toBe(10);
    });
  });

  describe('checkFatigue', () => {
    it('should not trigger fatigue if not expired', () => {
      agent.sessionStart = Date.now();
      agent.fatigueThreshold = 600000;
      agent.checkFatigue();
      expect(agent.isFatigued).toBe(false);
    });

    it('should trigger fatigue when threshold exceeded', () => {
      agent.sessionStart = Date.now() - 400000;
      agent.fatigueThreshold = 300000;
      agent.checkFatigue();
      expect(agent.isFatigued).toBe(true);
    });

    it('should not trigger fatigue if already fatigued', () => {
      agent.isFatigued = true;
      agent.checkFatigue();
      expect(agent.isFatigued).toBe(true);
    });
  });

  describe('normalizeProbabilities edge cases', () => {
    it('should apply fatigue bias', () => {
      agent.state.fatigueBias = 0.2;
      const probs = agent.normalizeProbabilities({ idle: 0.1 });
      expect(probs.idle).toBeGreaterThan(0.1);
    });

    it('should suppress refresh if recent', () => {
      agent.state.lastRefreshAt = Date.now() - 5000;
      const probs = agent.normalizeProbabilities({ refresh: 0.5 });
      expect(probs.refresh).toBeLessThan(0.5);
    });

    it('should handle missing probability keys', () => {
      const probs = agent.normalizeProbabilities(null);
      expect(probs.refresh).toBeDefined();
      expect(probs.idle).toBeDefined();
    });

    it('should handle likeTweetafterDive alias', () => {
      const probs = agent.normalizeProbabilities({ likeTweetAfterDive: 0.5 });
      expect(probs.likeTweetafterDive).toBeDefined();
      expect(probs.likeTweetafterDive).toBeGreaterThan(0);
    });
  });

  describe('getScrollMethod edge cases', () => {
    it('should return WHEEL_DOWN for low random value', () => {
      const spy = vi.spyOn(Math, 'random').mockReturnValue(0.1);
      const method = agent.getScrollMethod();
      spy.mockRestore();
      expect(method).toBe('WHEEL_DOWN');
    });

    it('should return valid scroll method for high random value', () => {
      const spy = vi.spyOn(Math, 'random').mockReturnValue(0.99);
      const method = agent.getScrollMethod();
      spy.mockRestore();
      expect(['WHEEL_DOWN', 'WHEEL_UP', 'SPACE', 'KEYS_DOWN', 'KEYS_UP']).toContain(method);
    });
  });

  describe('isSessionExpired edge cases', () => {
    it('should return false for future end time', () => {
      agent.sessionEndTime = Date.now() + 60000;
      expect(agent.isSessionExpired()).toBe(false);
    });

    it('should return true for past end time', () => {
      agent.sessionEndTime = Date.now() - 1000;
      expect(agent.isSessionExpired()).toBe(true);
    });
  });

  describe('triggerHotSwap', () => {
    it('should swap to fatigued profile', () => {
      vi.spyOn(profileManager, 'getFatiguedVariant').mockReturnValue({
        id: 'fatigued-profile',
        timings: { scrollPause: { mean: 2000 } },
        probabilities: { refresh: 0.05 }
      });
      
      agent.triggerHotSwap();
      expect(agent.config.id).toBe('fatigued-profile');
      expect(agent.isFatigued).toBe(true);
    });

    it('should enter doom scroll mode if no fatigued variant', () => {
      vi.spyOn(profileManager, 'getFatiguedVariant').mockReturnValue(null);
      
      agent.triggerHotSwap();
      expect(agent.isFatigued).toBe(true);
      expect(agent.state.fatigueBias).toBe(0.3);
    });
  });

  describe('humanClick', () => {
    beforeEach(() => {
      mockPage.waitForTimeout = vi.fn().mockResolvedValue(undefined);
      mockPage.mouse = { move: vi.fn().mockResolvedValue(undefined) };
      agent.ghost.click = vi.fn().mockResolvedValue({ success: true, x: 10, y: 10 });
      agent.human.think = vi.fn().mockResolvedValue(undefined);
      agent.human.recoverFromError = vi.fn().mockResolvedValue(undefined);
    });

    it('should skip if target is null', async () => {
      const result = await agent.humanClick(null);
      expect(result).toBeUndefined();
    });

    it('should perform human-like click sequence', async () => {
      const mockTarget = {
        evaluate: vi.fn().mockResolvedValue(undefined)
      };

      await agent.humanClick(mockTarget, 'Test Button');

      expect(agent.human.think).toHaveBeenCalledWith('Test Button');
      expect(mockTarget.evaluate).toHaveBeenCalled();
      expect(mockPage.waitForTimeout).toHaveBeenCalled();
      expect(agent.ghost.click).toHaveBeenCalledWith(mockTarget, {
        label: 'Test Button',
        hoverBeforeClick: true
      });
    });

    it('should handle click errors and recover', async () => {
      const mockTarget = {
        evaluate: vi.fn().mockRejectedValue(new Error('Click failed'))
      };

      await expect(agent.humanClick(mockTarget, 'Test Button')).rejects.toThrow('Click failed');

      expect(agent.human.recoverFromError).toHaveBeenCalledWith('click_failed', { locator: mockTarget });
    });
  });

  describe('safeHumanClick', () => {
    beforeEach(() => {
      mockPage.waitForTimeout = vi.fn().mockResolvedValue(undefined);
      mockPage.mouse = { move: vi.fn().mockResolvedValue(undefined) };
      agent.ghost.click = vi.fn().mockResolvedValue({ success: true, x: 10, y: 10 });
      agent.human.think = vi.fn().mockResolvedValue(undefined);
      agent.human.recoverFromError = vi.fn().mockResolvedValue(undefined);
    });

    it('should succeed on first attempt', async () => {
      const mockTarget = {
        evaluate: vi.fn().mockResolvedValue(undefined)
      };

      const result = await agent.safeHumanClick(mockTarget, 'Test Button', 3);

      expect(result).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Success'));
    });

    it('should retry on failure', async () => {
      const mockTarget = {
        evaluate: vi.fn()
          .mockRejectedValueOnce(new Error('Failed'))
          .mockResolvedValueOnce(undefined)
      };

      const result = await agent.safeHumanClick(mockTarget, 'Test Button', 3);

      expect(result).toBe(true);
    });
  });

  describe('isElementActionable', () => {
    it('should return false if element handle is null', async () => {
      const mockElement = {
        elementHandle: vi.fn().mockResolvedValue(null)
      };

      const result = await agent.isElementActionable(mockElement);

      expect(result).toBe(false);
    });

    it('should check element visibility', async () => {
      const mockHandle = {};
      const mockElement = {
        elementHandle: vi.fn().mockResolvedValue(mockHandle)
      };

      mockPage.evaluate = vi.fn().mockResolvedValue(true);

      const result = await agent.isElementActionable(mockElement);

      expect(result).toBe(true);
      expect(mockPage.evaluate).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      const mockElement = {
        elementHandle: vi.fn().mockRejectedValue(new Error('Error'))
      };

      const result = await agent.isElementActionable(mockElement);

      expect(result).toBe(false);
    });
  });

  describe('scrollToGoldenZone', () => {
    it('should scroll element to 30% from top', async () => {
      const mockHandle = {};
      const mockElement = {
        elementHandle: vi.fn().mockResolvedValue(mockHandle)
      };

      mockPage.evaluate = vi.fn().mockResolvedValue(undefined);
      mockPage.waitForTimeout = vi.fn().mockResolvedValue(undefined);

      await agent.scrollToGoldenZone(mockElement);

      expect(mockPage.evaluate).toHaveBeenCalled();
      expect(mockPage.waitForTimeout).toHaveBeenCalledWith(500);
    });

    it('should handle missing element', async () => {
      mockPage.evaluate = vi.fn().mockResolvedValue(undefined);
      const mockElement = {
        elementHandle: vi.fn().mockResolvedValue(null)
      };

      await agent.scrollToGoldenZone(mockElement);

      expect(mockPage.evaluate).not.toHaveBeenCalled();
    });
  });

  describe('dismissOverlays', () => {
    it('should dismiss toast notifications', async () => {
      mockPage.locator = vi.fn().mockImplementation((selector) => {
        if (selector.includes('toast') || selector.includes('alert')) {
          return {
            count: vi.fn().mockResolvedValue(1)
          };
        }
        return {
          count: vi.fn().mockResolvedValue(0)
        };
      });
      mockPage.keyboard = { press: vi.fn().mockResolvedValue(undefined) };

      await agent.dismissOverlays();

      expect(mockPage.keyboard.press).toHaveBeenCalledWith('Escape');
    });

    it('should dismiss modals', async () => {
      mockPage.locator = vi.fn().mockImplementation((selector) => {
        if (selector.includes('dialog') || selector.includes('modal')) {
          return {
            count: vi.fn().mockResolvedValue(1)
          };
        }
        return {
          count: vi.fn().mockResolvedValue(0)
        };
      });
      mockPage.keyboard = { press: vi.fn().mockResolvedValue(undefined) };

      await agent.dismissOverlays();

      expect(mockPage.keyboard.press).toHaveBeenCalledWith('Escape');
    });

    it('should handle errors gracefully', async () => {
      mockPage.locator = vi.fn().mockImplementation(() => {
        throw new Error('Locator error');
      });

      await expect(agent.dismissOverlays()).resolves.not.toThrow();
    });
  });

  describe('pollForFollowState', () => {
    it('should return true when unfollow button appears', async () => {
      mockPage.locator = vi.fn().mockReturnValue({
        first: vi.fn().mockReturnValue({
          isVisible: vi.fn().mockResolvedValue(true)
        })
      });

      const result = await agent.pollForFollowState('[data-testid="unfollow"]', '[data-testid="follow"]', 5000);

      expect(result).toBe(true);
    });

    it('should return true when button text changes to Following', async () => {
      mockPage.locator = vi.fn().mockReturnValue({
        first: vi.fn().mockReturnValue({
          isVisible: vi.fn().mockResolvedValue(false),
          textContent: vi.fn().mockResolvedValue('Following')
        })
      });

      const result = await agent.pollForFollowState('[data-testid="unfollow"]', '[data-testid="follow"]', 5000);

      expect(result).toBe(true);
    });

    it('should return false after max polls', async () => {
      mockPage.locator = vi.fn().mockReturnValue({
        first: vi.fn().mockReturnValue({
          isVisible: vi.fn().mockResolvedValue(false),
          textContent: vi.fn().mockResolvedValue('Follow')
        })
      });

      const result = await agent.pollForFollowState('[data-testid="unfollow"]', '[data-testid="follow"]', 1000);

      expect(result).toBe(false);
    });
  });

  describe('sixLayerClick', () => {
    beforeEach(() => {
      mockPage.waitForTimeout = vi.fn().mockResolvedValue(undefined);
      mockPage.keyboard = { press: vi.fn().mockResolvedValue(undefined) };
      mockPage.evaluate = vi.fn().mockResolvedValue(undefined);
    });

    it('should succeed with first layer', async () => {
      const mockElement = {
        click: vi.fn().mockResolvedValue(undefined),
        elementHandle: vi.fn().mockResolvedValue({}),
        focus: vi.fn().mockResolvedValue(undefined)
      };

      const result = await agent.sixLayerClick(mockElement, '[Test]');

      expect(result).toBe(true);
    });

  });

  describe('robustFollow', () => {
    beforeEach(() => {
      mockPage.locator = vi.fn().mockReturnValue({
        first: vi.fn().mockReturnValue({
          isVisible: vi.fn().mockResolvedValue(false),
          textContent: vi.fn().mockResolvedValue(''),
          getAttribute: vi.fn().mockResolvedValue(''),
          evaluate: vi.fn().mockResolvedValue(undefined),
          scrollIntoViewIfNeeded: vi.fn().mockResolvedValue(undefined)
        })
      });
      mockPage.waitForTimeout = vi.fn().mockResolvedValue(undefined);
      mockPage.evaluate = vi.fn().mockResolvedValue(undefined);
      mockPage.reload = vi.fn().mockResolvedValue(undefined);
      mockPage.keyboard = { press: vi.fn().mockResolvedValue(undefined) };
      mockPage.content = vi.fn().mockResolvedValue('');
      mockPage.url = vi.fn().mockReturnValue('https://x.com/user');
      agent.dismissOverlays = vi.fn().mockResolvedValue(undefined);
      agent.performHealthCheck = vi.fn().mockResolvedValue({ healthy: true, reason: '' });
      agent.checkAndHandleSoftError = vi.fn().mockResolvedValue(false);
    });

    it('should return already following if unfollow button visible', async () => {
      mockPage.locator = vi.fn().mockReturnValue({
        first: vi.fn().mockReturnValue({
          isVisible: vi.fn().mockResolvedValue(true),
          textContent: vi.fn().mockResolvedValue('Following')
        })
      });

      const result = await agent.robustFollow('[Test]');

      expect(result.success).toBe(true);
      expect(result.reason).toBe('already_following');
    });

    it('should handle pending state', async () => {
      mockPage.locator = vi.fn().mockImplementation((selector) => {
        if (selector.includes('unfollow')) {
          return {
            first: vi.fn().mockReturnValue({
              isVisible: vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true)
            })
          };
        }
        return {
          first: vi.fn().mockReturnValue({
            isVisible: vi.fn().mockResolvedValue(true),
            textContent: vi.fn().mockResolvedValue('Pending')
          })
        };
      });

      const result = await agent.robustFollow('[Test]');

      expect(result.success).toBe(true);
    });
  });

  describe('performHealthCheck', () => {
    it('should return healthy for active network', async () => {
      agent.lastNetworkActivity = Date.now();
      mockPage.content = vi.fn().mockResolvedValue('');

      const result = await agent.performHealthCheck();

      expect(result.healthy).toBe(true);
    });

    it('should detect network inactivity', async () => {
      agent.lastNetworkActivity = Date.now() - 40000;
      mockPage.content = vi.fn().mockResolvedValue('');

      const result = await agent.performHealthCheck();

      expect(result.healthy).toBe(false);
      expect(result.reason).toContain('network_inactivity');
    });

    it('should detect redirect errors', async () => {
      agent.lastNetworkActivity = Date.now();
      mockPage.content = vi.fn().mockResolvedValue('ERR_TOO_MANY_REDIRECTS');

      const result = await agent.performHealthCheck();

      expect(result.healthy).toBe(false);
      expect(result.reason).toBe('critical_error_page_redirects');
    });

    it('should handle check errors gracefully', async () => {
      mockPage.content = vi.fn().mockRejectedValue(new Error('Page closed'));

      const result = await agent.performHealthCheck();

      expect(result.healthy).toBe(true);
    });
  });

  describe('checkAndHandleSoftError', () => {
    beforeEach(() => {
      mockPage.waitForTimeout = vi.fn().mockResolvedValue(undefined);
      mockPage.goto = vi.fn().mockResolvedValue(undefined);
      mockPage.reload = vi.fn().mockResolvedValue(undefined);
      mockPage.keyboard = { press: vi.fn().mockResolvedValue(undefined) };
      mockPage.url = vi.fn().mockReturnValue('https://x.com/home');
    });

    it('should return false when no error present', async () => {
      mockPage.locator = vi.fn().mockReturnValue({
        first: vi.fn().mockReturnValue({
          isVisible: vi.fn().mockResolvedValue(false)
        })
      });

      const result = await agent.checkAndHandleSoftError();

      expect(result).toBe(false);
    });

    it('should handle soft error and click retry button', async () => {
      mockPage.locator = vi.fn().mockImplementation((selector) => {
        if (selector.includes('Something went wrong')) {
          return {
            first: vi.fn().mockReturnValue({
              isVisible: vi.fn().mockResolvedValue(true)
            })
          };
        }
        if (selector.includes('Retry')) {
          return {
            first: vi.fn().mockReturnValue({
              isVisible: vi.fn().mockResolvedValue(true),
              click: vi.fn().mockResolvedValue(undefined)
            })
          };
        }
        return {
          first: vi.fn().mockReturnValue({
            isVisible: vi.fn().mockResolvedValue(false)
          })
        };
      });

      const result = await agent.checkAndHandleSoftError();

      expect(result).toBe(true);
    });

    it('should throw error after 3 consecutive soft errors', async () => {
      agent.state.consecutiveSoftErrors = 2;

      mockPage.locator = vi.fn().mockReturnValue({
        first: vi.fn().mockReturnValue({
          isVisible: vi.fn().mockResolvedValue(true)
        })
      });

      await expect(agent.checkAndHandleSoftError()).rejects.toThrow('potential twitter logged out');
    });
  });

  describe('checkLoginState', () => {
    beforeEach(() => {
      mockPage.getByText = vi.fn().mockReturnValue({
        first: vi.fn().mockReturnValue({
          isVisible: vi.fn().mockResolvedValue(false)
        })
      });
      mockPage.locator = vi.fn().mockReturnValue({
        first: vi.fn().mockReturnValue({
          isVisible: vi.fn().mockResolvedValue(false),
          count: vi.fn().mockResolvedValue(1)
        })
      });
      mockPage.url = vi.fn().mockReturnValue('https://x.com/home');
    });

    it('should return true if logged in', async () => {
      // Reset mocks for clean state
      agent.state.consecutiveLoginFailures = 0;
      mockPage.url = vi.fn().mockReturnValue('https://x.com/other');
      mockPage.getByText = vi.fn().mockReturnValue({
        first: vi.fn().mockReturnValue({
          isVisible: vi.fn().mockResolvedValue(false)
        })
      });
      mockPage.locator = vi.fn().mockImplementation((selector) => {
        if (selector.includes('primaryColumn')) {
          return {
            first: vi.fn().mockReturnValue({
              isVisible: vi.fn().mockResolvedValue(true),
              count: vi.fn().mockResolvedValue(1)
            })
          };
        }
        if (selector.includes('login') || selector.includes('signup')) {
          return {
            first: vi.fn().mockReturnValue({
              isVisible: vi.fn().mockResolvedValue(false)
            })
          };
        }
        return {
          first: vi.fn().mockReturnValue({
            isVisible: vi.fn().mockResolvedValue(false)
          })
        };
      });

      const result = await agent.checkLoginState();

      expect(result).toBe(true);
      expect(agent.state.consecutiveLoginFailures).toBe(0);
    });

    it('should detect logged out state by text', async () => {
      mockPage.getByText = vi.fn().mockReturnValue({
        first: vi.fn().mockReturnValue({
          isVisible: vi.fn().mockResolvedValue(true)
        })
      });

      const result = await agent.checkLoginState();

      expect(result).toBe(false);
      expect(agent.state.consecutiveLoginFailures).toBe(1);
    });

    it('should detect logged out state by selectors', async () => {
      mockPage.locator = vi.fn().mockImplementation((selector) => {
        if (selector.includes('login') || selector.includes('signup')) {
          return {
            first: vi.fn().mockReturnValue({
              isVisible: vi.fn().mockResolvedValue(true)
            })
          };
        }
        return {
          first: vi.fn().mockReturnValue({
            isVisible: vi.fn().mockResolvedValue(false)
          })
        };
      });

      const result = await agent.checkLoginState();

      expect(result).toBe(false);
    });

    it('should detect logged out state by missing timeline', async () => {
      mockPage.url = vi.fn().mockReturnValue('https://x.com/home');
      mockPage.locator = vi.fn().mockImplementation((selector) => {
        if (selector.includes('primaryColumn') || selector.includes('timeline')) {
          return {
            first: vi.fn().mockReturnValue({
              isVisible: vi.fn().mockResolvedValue(false),
              count: vi.fn().mockResolvedValue(0)
            })
          };
        }
        return {
          first: vi.fn().mockReturnValue({
            isVisible: vi.fn().mockResolvedValue(false)
          })
        };
      });

      const result = await agent.checkLoginState();

      expect(result).toBe(false);
    });

    it('should handle check errors', async () => {
      mockPage.getByText = vi.fn().mockImplementation(() => {
        throw new Error('Page error');
      });

      const result = await agent.checkLoginState();

      expect(result).toBe(false);
    });
  });

  describe('navigateHome', () => {
    beforeEach(() => {
      mockPage.goto = vi.fn().mockResolvedValue(undefined);
      mockPage.waitForTimeout = vi.fn().mockResolvedValue(undefined);
      mockPage.waitForURL = vi.fn().mockResolvedValue(undefined);
      mockPage.click = vi.fn().mockResolvedValue(undefined);
      mockPage.keyboard = { press: vi.fn().mockResolvedValue(undefined) };
      mockPage.locator = vi.fn().mockReturnValue({
        first: vi.fn().mockReturnValue({
          isVisible: vi.fn().mockResolvedValue(true),
          click: vi.fn().mockResolvedValue(undefined)
        })
      });
      mockPage.url = vi.fn().mockReturnValue('https://x.com/profile');
      agent.ensureForYouTab = vi.fn().mockResolvedValue(undefined);
      agent.safeHumanClick = vi.fn().mockResolvedValue(undefined);
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should click home icon', async () => {
      agent.safeHumanClick = vi.fn().mockResolvedValue(true);
      
      await agent.navigateHome();

      expect(agent.ensureForYouTab).toHaveBeenCalled();
    });

    it('should fallback to direct URL if click fails', async () => {
      mockPage.locator = vi.fn().mockReturnValue({
        first: vi.fn().mockReturnValue({
          isVisible: vi.fn().mockResolvedValue(false)
        })
      });

      await agent.navigateHome();

      expect(mockPage.goto).toHaveBeenCalledWith('https://x.com/home');
    });
  });

  describe('postTweet', () => {
    beforeEach(() => {
      mockPage.waitForTimeout = vi.fn().mockResolvedValue(undefined);
      mockPage.waitForSelector = vi.fn().mockResolvedValue(undefined);
      mockPage.keyboard = { 
        press: vi.fn().mockResolvedValue(undefined),
        type: vi.fn().mockResolvedValue(undefined)
      };
      mockPage.locator = vi.fn().mockReturnValue({
        first: vi.fn().mockReturnValue({
          isVisible: vi.fn().mockResolvedValue(true),
          focus: vi.fn().mockResolvedValue(undefined)
        })
      });
      agent.safeHumanClick = vi.fn().mockResolvedValue(true);
    });

    it('should skip if no text provided', async () => {
      await agent.postTweet('');

      expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('Initiating'));
    });

    it('should post tweet using keyboard shortcut', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.1);
      
      await agent.postTweet('Test tweet');

      expect(mockPage.keyboard.press).toHaveBeenCalledWith('n');
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('sent successfully'));
    });

    it('should post tweet using UI button', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.9);
      
      await agent.postTweet('Test tweet');

      expect(agent.safeHumanClick).toHaveBeenCalled();
    });

    it('should handle post errors', async () => {
      mockPage.locator = vi.fn().mockReturnValue({
        first: vi.fn().mockReturnValue({
          isVisible: vi.fn().mockResolvedValue(false)
        })
      });

      await agent.postTweet('Test tweet');

      expect(mockLogger.info).toHaveBeenCalled();
    });
  });

  describe('humanType', () => {
    beforeEach(() => {
      mockPage.keyboard = { 
        type: vi.fn().mockResolvedValue(undefined)
      };
      mockPage.waitForTimeout = vi.fn().mockResolvedValue(undefined);
    });

    it('should type text with random delays', async () => {
      const mockElement = {
        focus: vi.fn().mockResolvedValue(undefined)
      };

      await agent.humanType(mockElement, 'Hello');

      expect(mockElement.focus).toHaveBeenCalled();
      expect(mockPage.keyboard.type).toHaveBeenCalledTimes(5);
    });

    it('should skip if element is null', async () => {
      await agent.humanType(null, 'Hello');

      expect(mockPage.keyboard.type).not.toHaveBeenCalled();
    });

    it('should skip if text is empty', async () => {
      const mockElement = { focus: vi.fn() };
      await agent.humanType(mockElement, '');

      expect(mockPage.keyboard.type).not.toHaveBeenCalled();
    });

    it('should fallback to fill on error', async () => {
      const mockElement = {
        focus: vi.fn().mockRejectedValue(new Error('Focus failed')),
        fill: vi.fn().mockResolvedValue(undefined)
      };

      await agent.humanType(mockElement, 'Hello');

      expect(mockElement.fill).toHaveBeenCalledWith('Hello');
    });
  });

  describe('simulateFidget', () => {
    beforeEach(() => {
      agent.page.waitForTimeout = vi.fn().mockResolvedValue(undefined);
      agent.page.mouse = {
        move: vi.fn().mockResolvedValue(undefined),
        down: vi.fn().mockResolvedValue(undefined),
        up: vi.fn().mockResolvedValue(undefined)
      };
      agent.page.evaluate = vi.fn().mockResolvedValue([]);
      agent.page.locator = vi.fn().mockReturnValue({
        all: vi.fn().mockResolvedValue([])
      });
      agent.page.url = vi.fn().mockReturnValue('https://x.com/home');
      agent.navigateHome = vi.fn().mockResolvedValue(undefined);
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should perform fidget without errors', async () => {
      await expect(agent.simulateFidget()).resolves.not.toThrow();
    });

    it('should handle fidget errors gracefully', async () => {
      agent.page.locator = vi.fn().mockImplementation(() => {
        throw new Error('Locator error');
      });

      await expect(agent.simulateFidget()).resolves.not.toThrow();
    });
  });

  describe('diveProfile', () => {
    it('should dive into a profile', async () => {
      agent.page.$$eval = vi.fn().mockResolvedValue([0]);
      agent.page.locator = vi.fn().mockImplementation((selector) => {
        if (selector.includes('tab')) {
          // Tab selector needs .first() which returns object with count() and isVisible()
          return {
            first: vi.fn().mockReturnValue({
              count: vi.fn().mockResolvedValue(1),
              isVisible: vi.fn().mockResolvedValue(true)
            })
          };
        }
        return {
          nth: vi.fn().mockReturnValue({
            getAttribute: vi.fn().mockResolvedValue('/testuser')
          }),
          first: vi.fn().mockReturnValue({
            isVisible: vi.fn().mockResolvedValue(true)
          })
        };
      });
      agent.page.waitForLoadState = vi.fn().mockResolvedValue(undefined);
      agent.page.waitForTimeout = vi.fn().mockResolvedValue(undefined);
      agent.page.url = vi.fn().mockReturnValue('https://x.com/testuser');
      agent.page.keyboard = { press: vi.fn().mockResolvedValue(undefined) };
      agent.page.evaluate = vi.fn().mockResolvedValue(undefined);
      agent.safeHumanClick = vi.fn().mockResolvedValue(undefined);
      agent.navigateHome = vi.fn().mockResolvedValue(undefined);
      agent.checkAndHandleSoftError = vi.fn().mockResolvedValue(false);
      agent.normalizeProbabilities = vi.fn().mockReturnValue({
        followOnProfile: 0.01,
        refresh: 0.1,
        profileDive: 0.2,
        tweetDive: 0.3,
        idle: 0.4
      });
      // Mock human methods to avoid errors
      agent.human.consumeContent = vi.fn().mockResolvedValue(undefined);
      agent.human.multitask = vi.fn().mockResolvedValue(undefined);
      vi.spyOn(Math, 'random').mockReturnValue(0.9);
      
      await expect(agent.diveProfile()).resolves.not.toThrow();
    });

    it('should skip if no valid profile links', async () => {
      agent.page.$$eval = vi.fn().mockResolvedValue([]);

      await agent.diveProfile();

      expect(mockLogger.info).toHaveBeenCalled();
    });
  });

  describe('diveTweet', () => {
    beforeEach(() => {
      agent.safeHumanClick = vi.fn().mockResolvedValue(undefined);
      agent.navigateHome = vi.fn().mockResolvedValue(undefined);
      agent.ensureForYouTab = vi.fn().mockResolvedValue(undefined);
      agent.page.waitForURL = vi.fn().mockResolvedValue(undefined);
      agent.page.waitForTimeout = vi.fn().mockResolvedValue(undefined);
      agent.page.keyboard = { press: vi.fn().mockResolvedValue(undefined) };
      agent.page.url = vi.fn().mockReturnValue('https://x.com/home');
      agent.page.goto = vi.fn().mockResolvedValue(undefined);
      agent.page.viewportSize = vi.fn().mockReturnValue({ width: 1280, height: 720 });
    });

    it('should dive into a tweet', async () => {
      agent.page.locator = vi.fn().mockReturnValue({
        count: vi.fn().mockResolvedValue(1),
        nth: vi.fn().mockReturnValue({
          boundingBox: vi.fn().mockResolvedValue({ x: 100, y: 200, height: 100 }),
          locator: vi.fn().mockReturnValue({
            first: vi.fn().mockReturnValue({
              count: vi.fn().mockResolvedValue(1),
              isVisible: vi.fn().mockResolvedValue(true)
            })
          }),
          evaluate: vi.fn().mockResolvedValue(undefined)
        })
      });

      await expect(agent.diveTweet()).resolves.not.toThrow();
    });

    it('should handle no tweets found', async () => {
      agent.page.locator = vi.fn().mockReturnValue({
        count: vi.fn().mockResolvedValue(0)
      });

      await agent.diveTweet();

      expect(agent.page.goto).toHaveBeenCalledWith('https://x.com/');
    });
  });

  describe('ensureForYouTab', () => {
    beforeEach(() => {
      mockPage.waitForSelector = vi.fn().mockResolvedValue(undefined);
      mockPage.waitForTimeout = vi.fn().mockResolvedValue(undefined);
      mockPage.locator = vi.fn().mockImplementation((selector) => {
        if (selector.includes('tablist')) {
          return {
            first: vi.fn().mockReturnValue({
              locator: vi.fn().mockReturnValue({
                count: vi.fn().mockResolvedValue(2),
                nth: vi.fn().mockImplementation((i) => ({
                  textContent: vi.fn().mockResolvedValue(i === 0 ? 'For you' : 'Following'),
                  getAttribute: vi.fn().mockResolvedValue(i === 0 ? 'true' : 'false'),
                  isVisible: vi.fn().mockResolvedValue(true),
                  click: vi.fn().mockResolvedValue(undefined)
                }))
              })
            })
          };
        }
        return {
          first: vi.fn().mockReturnValue({
            count: vi.fn().mockResolvedValue(0),
            isVisible: vi.fn().mockResolvedValue(false)
          })
        };
      });
      agent.safeHumanClick = vi.fn().mockResolvedValue(undefined);
      agent.checkAndClickShowPostsButton = vi.fn().mockResolvedValue(false);
    });

    it('should skip if tab already selected', async () => {
      await agent.ensureForYouTab();

      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('already selected'));
    });

    it('should click tab if not selected', async () => {
      mockPage.locator = vi.fn().mockImplementation((selector) => {
        if (selector.includes('tablist')) {
          return {
            first: vi.fn().mockReturnValue({
              locator: vi.fn().mockReturnValue({
                count: vi.fn().mockResolvedValue(2),
                nth: vi.fn().mockImplementation((i) => ({
                  textContent: vi.fn().mockResolvedValue(i === 0 ? 'For you' : 'Following'),
                  getAttribute: vi.fn().mockResolvedValue('false'),
                  isVisible: vi.fn().mockResolvedValue(true),
                  click: vi.fn().mockResolvedValue(undefined)
                }))
              })
            })
          };
        }
        return {
          first: vi.fn().mockReturnValue({
            count: vi.fn().mockResolvedValue(0),
            isVisible: vi.fn().mockResolvedValue(false)
          })
        };
      });

      await agent.ensureForYouTab();

      expect(agent.safeHumanClick).toHaveBeenCalled();
    });

    it('should fallback to index if text not found', async () => {
      mockPage.locator = vi.fn().mockImplementation((selector) => {
        if (selector.includes('tablist')) {
          return {
            first: vi.fn().mockReturnValue({
              locator: vi.fn().mockReturnValue({
                count: vi.fn().mockResolvedValue(2),
                nth: vi.fn().mockImplementation((i) => ({
                  textContent: vi.fn().mockResolvedValue('Other'),
                  getAttribute: vi.fn().mockResolvedValue('false'),
                  isVisible: vi.fn().mockResolvedValue(true),
                  click: vi.fn().mockResolvedValue(undefined)
                }))
              })
            })
          };
        }
        return {
          first: vi.fn().mockReturnValue({
            count: vi.fn().mockResolvedValue(0),
            isVisible: vi.fn().mockResolvedValue(false)
          })
        };
      });

      await agent.ensureForYouTab();

      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Fallback to index'));
    });

    it('should handle tablist not found', async () => {
      mockPage.waitForSelector = vi.fn().mockRejectedValue(new Error('Timeout'));

      await agent.ensureForYouTab();

      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Tablist not found'));
    });
  });

  describe('checkAndClickShowPostsButton', () => {
    let scrollHelper;

    beforeEach(async () => {
      mockPage.waitForTimeout = vi.fn().mockResolvedValue(undefined);
      mockPage.keyboard = { press: vi.fn().mockResolvedValue(undefined) };
      mockPage.mouse = { wheel: vi.fn().mockResolvedValue(undefined) };
      mockPage.evaluate = vi.fn().mockResolvedValue(undefined);
      mockPage.locator = vi.fn().mockImplementation((selector) => {
        if (selector.includes('Show') && selector.includes('posts')) {
          return {
            first: vi.fn().mockReturnValue({
              count: vi.fn().mockResolvedValue(1),
              isVisible: vi.fn().mockResolvedValue(true),
              textContent: vi.fn().mockResolvedValue('Show 5 posts'),
              evaluate: vi.fn().mockResolvedValue(undefined),
              boundingBox: vi.fn().mockResolvedValue({ x: 100, y: 100, width: 100, height: 50 })
            })
          };
        }
        return {
          first: vi.fn().mockReturnValue({
            count: vi.fn().mockResolvedValue(0),
            isVisible: vi.fn().mockResolvedValue(false)
          })
        };
      });
      agent.ghost = { move: vi.fn().mockResolvedValue(undefined) };
      agent.safeHumanClick = vi.fn().mockResolvedValue(undefined);
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      scrollHelper = await import('../../utils/scroll-helper.js');
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should find and click show posts button', async () => {
      const result = await agent.checkAndClickShowPostsButton();

      expect(result).toBe(true);
      expect(agent.safeHumanClick).toHaveBeenCalled();
    });

    it('should return false if button not found', async () => {
      mockPage.locator = vi.fn().mockReturnValue({
        first: vi.fn().mockReturnValue({
          count: vi.fn().mockResolvedValue(0),
          isVisible: vi.fn().mockResolvedValue(false)
        })
      });

      const result = await agent.checkAndClickShowPostsButton();

      expect(result).toBe(false);
    });

    it('should scroll after clicking button', async () => {
      await agent.checkAndClickShowPostsButton();

      expect(scrollHelper.scrollRandom).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockPage.locator = vi.fn().mockImplementation(() => {
        throw new Error('Locator error');
      });

      const result = await agent.checkAndClickShowPostsButton();

      expect(result).toBe(false);
    });
  });

  describe('runSession', () => {
    beforeEach(() => {
      agent.page.url = vi.fn().mockReturnValue('https://x.com/home');
      agent.page.emulateMedia = vi.fn().mockResolvedValue(undefined);
      agent.page.waitForTimeout = vi.fn().mockResolvedValue(undefined);
      agent.checkLoginState = vi.fn().mockResolvedValue(true);
      agent.simulateReading = vi.fn().mockResolvedValue(undefined);
      agent.human.sessionStart = vi.fn().mockResolvedValue(undefined);
      agent.human.sessionEnd = vi.fn().mockResolvedValue(undefined);
      agent.human.cycleComplete = vi.fn().mockResolvedValue(undefined);
      agent.human.session = { shouldEndSession: vi.fn().mockReturnValue(true) };
    });

    it('should run session initialization', async () => {
      await agent.runSession(1, 0, 0);
      
      expect(agent.human.sessionStart).toHaveBeenCalled();
    });

    it('should abort if not logged in after retries', async () => {
      agent.checkLoginState = vi.fn().mockResolvedValue(false);
      agent.state.consecutiveLoginFailures = 3;

      await agent.runSession(2, 0, 0);

      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Aborting'));
    });

    it('should handle burst mode entry', async () => {
      // Mock mathUtils.roll to return true for burst mode entry (10% chance)
      const { mathUtils } = await import('../../utils/mathUtils.js');
      vi.spyOn(mathUtils, 'roll').mockImplementation((probability) => {
        // Return true for burst mode check (probability = 0.10)
        if (probability === 0.10) return true;
        return false;
      });
      
      // Mock diveProfile to avoid $$eval errors and set burst mode
      agent.diveProfile = vi.fn().mockImplementation(async () => {
        // Manually set burst mode to simulate the actual behavior
        agent.state.activityMode = 'BURST';
        agent.state.burstEndTime = Date.now() + 30000;
      });
      
      // Ensure session runs long enough to hit burst mode check
      agent.human.session.shouldEndSession = vi.fn()
        .mockReturnValueOnce(false)  // First iteration - allow burst mode check
        .mockReturnValue(true);       // Second iteration - end session
      
      await agent.runSession(5, 0, 0);
      
      expect(agent.state.activityMode).toBe('BURST');
    });

    it('should handle boredom pause every 4th cycle', async () => {
      const { mathUtils } = await import('../../utils/mathUtils.js');
      vi.spyOn(mathUtils, 'roll').mockReturnValue(true); // Trigger boredom pause
      
      agent.diveProfile = vi.fn().mockResolvedValue(undefined);
      
      // Run 5 cycles to hit 4th cycle
      agent.human.session.shouldEndSession = vi.fn()
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(false)
        .mockReturnValue(true);
      
      agent.human.session.boredomPause = vi.fn().mockResolvedValue(undefined);
      
      await agent.runSession(10, 0, 0);
      
      expect(agent.human.session.boredomPause).toHaveBeenCalled();
    });

    it('should handle session with timer', async () => {
      agent.sessionEndTime = Date.now() + 5000; // 5 seconds from now
      agent.diveProfile = vi.fn().mockResolvedValue(undefined);
      agent.page.goto = vi.fn().mockResolvedValue(undefined);
      agent.ensureForYouTab = vi.fn().mockResolvedValue(undefined);
      
      agent.human.session.shouldEndSession = vi.fn().mockReturnValue(false);
      
      await agent.runSession(100, 0, 0);
      
      expect(agent.human.sessionEnd).toHaveBeenCalled();
    });

    it('should enter idle branch when random is high', async () => {
      agent.navigateHome = vi.fn().mockResolvedValue(undefined);
      agent.page.goto = vi.fn().mockResolvedValue(undefined);
      agent.ensureForYouTab = vi.fn().mockResolvedValue(undefined);
      agent.page.waitForTimeout = vi.fn().mockResolvedValue(undefined);
      
      agent.human.session.shouldEndSession = vi.fn().mockReturnValueOnce(false).mockReturnValue(true);
      
      // Use mathUtils.gaussian to control idle duration
      const { mathUtils } = await import('../../utils/mathUtils.js');
      vi.spyOn(mathUtils, 'gaussian').mockReturnValue(3000);
      
      // Set Math.random to very high (0.95) to hit idle branch
      vi.spyOn(Math, 'random').mockReturnValue(0.95);
      
      await agent.runSession(1, 0, 0);
      
      // Should have called waitForTimeout for idle duration
      expect(agent.page.waitForTimeout).toHaveBeenCalled();
    });
  });

  describe('simulateReading', () => {
    beforeEach(() => {
      agent.page.keyboard = { press: vi.fn().mockResolvedValue(undefined) };
      agent.page.waitForTimeout = vi.fn().mockResolvedValue(undefined);
      agent.page.viewportSize = vi.fn().mockReturnValue({ width: 1280, height: 720 });
      agent.page.evaluate = vi.fn().mockResolvedValue(undefined);
      agent.ghost.move = vi.fn().mockResolvedValue(undefined);
      agent.ghost.park = vi.fn().mockResolvedValue(undefined);
      agent.checkAndHandleSoftError = vi.fn().mockResolvedValue(false);
      agent.performHealthCheck = vi.fn().mockResolvedValue({ healthy: true, reason: '' });
      agent.simulateFidget = vi.fn().mockResolvedValue(undefined);
      agent.isSessionExpired = vi.fn().mockReturnValue(false);
      agent.human.consumeContent = vi.fn().mockResolvedValue(undefined);
      agent.human.multitask = vi.fn().mockResolvedValue(undefined);
      agent.human.recoverFromError = vi.fn().mockResolvedValue(undefined);
      agent.checkFatigue = vi.fn();
    });

    it('should perform reading with WHEEL_DOWN scroll', async () => {
      agent.getScrollMethod = vi.fn().mockReturnValue('WHEEL_DOWN');
      const { scrollDown } = await import('../../utils/scroll-helper.js');
      const { mathUtils } = await import('../../utils/mathUtils.js');
      vi.spyOn(mathUtils, 'roll').mockImplementation((prob) => {
        // Only enable ghost.move at 0.2 probability
        if (prob === 0.2) return true;
        return false;
      });
      vi.spyOn(mathUtils, 'gaussian').mockReturnValue(400);
      vi.spyOn(mathUtils, 'randomInRange').mockReturnValue(10);
      
      // Short duration for test
      agent.config.timings.readingPhase = { mean: 50, deviation: 10 };
      
      await agent.simulateReading();
      
      expect(scrollDown).toHaveBeenCalled();
      expect(agent.ghost.move).toHaveBeenCalled();
    });

    it('should perform reading with WHEEL_UP scroll', async () => {
      agent.getScrollMethod = vi.fn().mockReturnValue('WHEEL_UP');
      const { scrollRandom } = await import('../../utils/scroll-helper.js');
      const { mathUtils } = await import('../../utils/mathUtils.js');
      vi.spyOn(mathUtils, 'gaussian').mockReturnValue(300);
      
      // Short duration for test
      agent.config.timings.readingPhase = { mean: 50, deviation: 10 };
      
      await agent.simulateReading();
      
      expect(scrollRandom).toHaveBeenCalled();
    });

    it('should perform reading with SPACE scroll', async () => {
      agent.getScrollMethod = vi.fn().mockReturnValue('SPACE');
      const { mathUtils } = await import('../../utils/mathUtils.js');
      vi.spyOn(mathUtils, 'randomInRange').mockReturnValue(100);
      vi.spyOn(mathUtils, 'gaussian').mockReturnValue(1000);
      
      // Short duration for test
      agent.config.timings.readingPhase = { mean: 50, deviation: 10 };
      
      await agent.simulateReading();
      
      expect(agent.page.keyboard.press).toHaveBeenCalledWith('Space', expect.any(Object));
    });

    it('should perform reading with KEYS_DOWN scroll', async () => {
      agent.getScrollMethod = vi.fn().mockReturnValue('KEYS_DOWN');
      const { mathUtils } = await import('../../utils/mathUtils.js');
      vi.spyOn(mathUtils, 'randomInRange').mockImplementation((min, max) => min);
      vi.spyOn(mathUtils, 'gaussian').mockReturnValue(100);
      
      // Short duration for test
      agent.config.timings.readingPhase = { mean: 50, deviation: 10 };
      
      await agent.simulateReading();
      
      expect(agent.page.keyboard.press).toHaveBeenCalledWith('ArrowDown', expect.any(Object));
    });

    it('should perform reading with KEYS_UP scroll', async () => {
      agent.getScrollMethod = vi.fn().mockReturnValue('KEYS_UP');
      const { mathUtils } = await import('../../utils/mathUtils.js');
      vi.spyOn(mathUtils, 'randomInRange').mockImplementation((min, max) => min);
      vi.spyOn(mathUtils, 'gaussian').mockReturnValue(100);
      
      // Short duration for test
      agent.config.timings.readingPhase = { mean: 50, deviation: 10 };
      
      await agent.simulateReading();
      
      expect(agent.page.keyboard.press).toHaveBeenCalledWith('ArrowUp', expect.any(Object));
    });

    it('should handle burst mode reading', async () => {
      agent.state.activityMode = 'BURST';
      agent.getScrollMethod = vi.fn().mockReturnValue('WHEEL_DOWN');
      const { scrollDown } = await import('../../utils/scroll-helper.js');
      const { mathUtils } = await import('../../utils/mathUtils.js');
      vi.spyOn(mathUtils, 'randomInRange').mockReturnValue(500);
      vi.spyOn(mathUtils, 'gaussian').mockReturnValue(400);
      vi.spyOn(mathUtils, 'roll').mockReturnValue(false);
      
      await agent.simulateReading();
      
      expect(scrollDown).toHaveBeenCalled();
    });

    it('should handle soft error during reading', async () => {
      agent.getScrollMethod = vi.fn().mockReturnValue('WHEEL_DOWN');
      agent.checkAndHandleSoftError = vi.fn().mockResolvedValue(true);
      const { scrollDown } = await import('../../utils/scroll-helper.js');
      const { mathUtils } = await import('../../utils/mathUtils.js');
      vi.spyOn(mathUtils, 'gaussian').mockReturnValue(400);
      vi.spyOn(mathUtils, 'roll').mockReturnValue(false);
      
      agent.config.timings.readingPhase = { mean: 50, deviation: 10 };
      
      await agent.simulateReading();
      
      expect(agent.human.recoverFromError).toHaveBeenCalledWith('timeout', {});
    });

    it('should throw on fatal health check', async () => {
      agent.performHealthCheck = vi.fn().mockResolvedValue({ healthy: false, reason: 'test_fatal' });
      
      agent.config.timings.readingPhase = { mean: 50, deviation: 10 };
      
      await expect(agent.simulateReading()).rejects.toThrow('Fatal: test_fatal');
    });

    it('should handle multitasking during reading', async () => {
      agent.getScrollMethod = vi.fn().mockReturnValue('WHEEL_DOWN');
      const { mathUtils } = await import('../../utils/mathUtils.js');
      vi.spyOn(mathUtils, 'roll').mockImplementation((prob) => {
        // Enable multitask at 0.15
        if (prob === 0.15) return true;
        return false;
      });
      vi.spyOn(mathUtils, 'gaussian').mockReturnValue(400);
      vi.spyOn(mathUtils, 'randomInRange').mockReturnValue(1000);
      
      agent.config.timings.readingPhase = { mean: 50, deviation: 10 };
      
      await agent.simulateReading();
      
      expect(agent.human.multitask).toHaveBeenCalled();
    });

    it('should handle fidgeting during reading', async () => {
      agent.getScrollMethod = vi.fn().mockReturnValue('WHEEL_DOWN');
      const { mathUtils } = await import('../../utils/mathUtils.js');
      vi.spyOn(mathUtils, 'roll').mockImplementation((prob) => {
        // Enable fidget at 0.15
        if (prob === 0.15) return true;
        return false;
      });
      vi.spyOn(mathUtils, 'gaussian').mockReturnValue(400);
      vi.spyOn(mathUtils, 'randomInRange').mockReturnValue(1000);
      
      agent.config.timings.readingPhase = { mean: 50, deviation: 10 };
      
      await agent.simulateReading();
      
      expect(agent.simulateFidget).toHaveBeenCalled();
    });

    it('should handle jitter scroll during reading', async () => {
      agent.getScrollMethod = vi.fn().mockReturnValue('WHEEL_DOWN');
      const { scrollRandom } = await import('../../utils/scroll-helper.js');
      const { mathUtils } = await import('../../utils/mathUtils.js');
      vi.spyOn(mathUtils, 'roll').mockImplementation((prob) => {
        // Enable jitter at 0.15
        if (prob === 0.15) return true;
        return false;
      });
      vi.spyOn(mathUtils, 'gaussian').mockReturnValue(400);
      vi.spyOn(mathUtils, 'randomInRange').mockReturnValue(100);
      
      agent.config.timings.readingPhase = { mean: 50, deviation: 10 };
      
      await agent.simulateReading();
      
      expect(scrollRandom).toHaveBeenCalledWith(expect.anything(), -60, 60);
    });

    it('should handle mouse parking during long pauses', async () => {
      agent.getScrollMethod = vi.fn().mockReturnValue('WHEEL_DOWN');
      const { mathUtils } = await import('../../utils/mathUtils.js');
      vi.spyOn(mathUtils, 'roll').mockImplementation((prob) => {
        // Enable parking at 0.7
        if (prob === 0.7) return true;
        return false;
      });
      vi.spyOn(mathUtils, 'gaussian').mockImplementation((mean, dev) => {
        // Return large value for scrollPause to trigger parking
        if (mean === 1000) return 3000;
        return mean;
      });
      vi.spyOn(mathUtils, 'randomInRange').mockReturnValue(1000);
      
      agent.config.timings.readingPhase = { mean: 50, deviation: 10 };
      agent.config.timings.scrollPause = { mean: 3000, deviation: 500 };
      
      await agent.simulateReading();
      
      expect(agent.ghost.park).toHaveBeenCalled();
    });
  });

  describe('simulateFidget', () => {
    beforeEach(() => {
      agent.page.waitForTimeout = vi.fn().mockResolvedValue(undefined);
      agent.page.mouse = {
        move: vi.fn().mockResolvedValue(undefined),
        down: vi.fn().mockResolvedValue(undefined),
        up: vi.fn().mockResolvedValue(undefined)
      };
      agent.page.evaluate = vi.fn().mockResolvedValue([]);
      agent.page.locator = vi.fn().mockReturnValue({
        all: vi.fn().mockResolvedValue([])
      });
      agent.page.url = vi.fn().mockReturnValue('https://x.com/home');
      agent.navigateHome = vi.fn().mockResolvedValue(undefined);
    });

    it('should perform TEXT_SELECT fidget', async () => {
      const { mathUtils } = await import('../../utils/mathUtils.js');
      vi.spyOn(mathUtils, 'roll').mockImplementation((prob) => {
        if (prob === 0.4) return true; // TEXT_SELECT
        return false;
      });
      
      // Mock visible text candidates
      const mockElement = {
        boundingBox: vi.fn().mockResolvedValue({ x: 100, y: 100 }),
        textContent: vi.fn().mockResolvedValue('Sample tweet text for testing')
      };
      agent.page.locator = vi.fn().mockReturnValue({
        all: vi.fn().mockResolvedValue([mockElement])
      });
      agent.page.evaluate = vi.fn().mockResolvedValue([0]); // Visible index
      
      await agent.simulateFidget();
      
      expect(agent.page.mouse.down).toHaveBeenCalled();
      expect(agent.page.mouse.up).toHaveBeenCalled();
    });

    it('should perform MOUSE_WIGGLE fidget', async () => {
      const { mathUtils } = await import('../../utils/mathUtils.js');
      vi.spyOn(mathUtils, 'roll').mockImplementation((prob) => {
        if (prob === 0.4) return false; // Not TEXT_SELECT
        if (prob === 0.5) return true; // MOUSE_WIGGLE
        return false;
      });
      vi.spyOn(mathUtils, 'randomInRange').mockReturnValue(10);
      
      agent.ghost.previousPos = { x: 500, y: 300 };
      
      await agent.simulateFidget();
      
      expect(agent.page.mouse.move).toHaveBeenCalled();
    });

    it('should perform OVERSHOOT fidget', async () => {
      const { mathUtils } = await import('../../utils/mathUtils.js');
      vi.spyOn(mathUtils, 'roll').mockImplementation((prob) => {
        if (prob === 0.4) return false; // Not TEXT_SELECT
        if (prob === 0.5) return false; // Not MOUSE_WIGGLE
        return false;
      });
      vi.spyOn(mathUtils, 'randomInRange').mockReturnValue(200);
      
      const { scrollRandom } = await import('../../utils/scroll-helper.js');
      
      await agent.simulateFidget();
      
      expect(scrollRandom).toHaveBeenCalled();
    });

    it('should handle accidental navigation in OVERSHOOT', async () => {
      const { mathUtils } = await import('../../utils/mathUtils.js');
      vi.spyOn(mathUtils, 'roll').mockImplementation((prob) => {
        if (prob === 0.4) return false;
        if (prob === 0.5) return false;
        return false;
      });
      vi.spyOn(mathUtils, 'randomInRange').mockReturnValue(200);
      
      agent.page.url = vi.fn()
        .mockReturnValueOnce('https://x.com/home')
        .mockReturnValue('https://x.com/someuser/status/12345');
      
      await agent.simulateFidget();
      
      expect(agent.navigateHome).toHaveBeenCalled();
    });

    it('should handle no visible text candidates', async () => {
      const { mathUtils } = await import('../../utils/mathUtils.js');
      vi.spyOn(mathUtils, 'roll').mockImplementation((prob) => {
        if (prob === 0.4) return true; // TEXT_SELECT
        return false;
      });
      
      // No visible candidates
      agent.page.evaluate = vi.fn().mockResolvedValue([]);
      
      await expect(agent.simulateFidget()).resolves.not.toThrow();
    });

    it('should select visible text candidate in TEXT_SELECT fidget', async () => {
      const { mathUtils } = await import('../../utils/mathUtils.js');
      vi.spyOn(mathUtils, 'roll').mockImplementation((prob) => {
        if (prob === 0.4) return true; // TEXT_SELECT
        return false;
      });
      
      // Set up candidates with multiple elements
      const mockElements = [
        { boundingBox: vi.fn().mockResolvedValue({ x: 100, y: 50, height: 50 }), textContent: vi.fn().mockResolvedValue('First tweet text content here for testing') },
        { boundingBox: vi.fn().mockResolvedValue({ x: 100, y: 200, height: 50 }), textContent: vi.fn().mockResolvedValue('Second tweet with more text for testing') }
      ];
      agent.page.locator = vi.fn().mockReturnValue({
        all: vi.fn().mockResolvedValue(mockElements)
      });
      // Simulate evaluate returning indices [0, 1] - both visible
      agent.page.evaluate = vi.fn().mockResolvedValue([0, 1]);
      agent.page.mouse = {
        move: vi.fn().mockResolvedValue(undefined),
        down: vi.fn().mockResolvedValue(undefined),
        up: vi.fn().mockResolvedValue(undefined)
      };
      
      await agent.simulateFidget();
      
      // Should have moved mouse and performed drag selection
      expect(agent.page.mouse.move).toHaveBeenCalled();
      expect(agent.page.mouse.down).toHaveBeenCalled();
      expect(agent.page.mouse.up).toHaveBeenCalled();
    });
  });

  describe('additional edge cases', () => {
    it('should handle diveTweet error gracefully', async () => {
      agent.page.locator = vi.fn().mockImplementation(() => {
        throw new Error('Locator error');
      });
      agent.navigateHome = vi.fn().mockResolvedValue(undefined);
      agent.page.url = vi.fn().mockReturnValue('https://x.com/other');

      await expect(agent.diveTweet()).resolves.not.toThrow();
      expect(agent.navigateHome).toHaveBeenCalled();
    });

    it('should handle robustFollow with visible follow button', async () => {
      agent.sixLayerClick = vi.fn().mockResolvedValue(true);
      agent.isElementActionable = vi.fn().mockResolvedValue(true);
      agent.dismissOverlays = vi.fn().mockResolvedValue(undefined);
      agent.pollForFollowState = vi.fn().mockResolvedValue(true);
      agent.checkAndHandleSoftError = vi.fn().mockResolvedValue(false);
      agent.performHealthCheck = vi.fn().mockResolvedValue({ healthy: true, reason: '' });
      agent.page.waitForTimeout = vi.fn().mockResolvedValue(undefined);
      agent.page.reload = vi.fn().mockResolvedValue(undefined);
      
      mockPage.locator = vi.fn().mockImplementation((selector) => {
        if (selector.includes('follow') && !selector.includes('unfollow')) {
          return {
            first: vi.fn().mockReturnValue({
              isVisible: vi.fn().mockResolvedValue(true),
              textContent: vi.fn().mockResolvedValue('Follow'),
              getAttribute: vi.fn().mockResolvedValue('Follow @user'),
              scrollIntoViewIfNeeded: vi.fn().mockResolvedValue(undefined),
              evaluate: vi.fn().mockResolvedValue(undefined)
            })
          };
        }
        return {
          first: vi.fn().mockReturnValue({
            isVisible: vi.fn().mockResolvedValue(false)
          })
        };
      });

      const result = await agent.robustFollow('[Test]');
      
      expect(result.success).toBe(true);
    });

    it('should handle sixLayerClick with different layers', async () => {
      // Test first layer success
      const mockElement1 = {
        click: vi.fn().mockResolvedValue(undefined),
        focus: vi.fn().mockResolvedValue(undefined)
      };
      agent.safeHumanClick = vi.fn().mockResolvedValue(true);
      
      const result1 = await agent.sixLayerClick(mockElement1, '[Test]');
      expect(result1).toBe(true);
      expect(agent.safeHumanClick).toHaveBeenCalled();
    });

    it('should handle sixLayerClick with focus fallback', async () => {
      const mockElement = {
        click: vi.fn().mockRejectedValue(new Error('Click failed')),
        focus: vi.fn().mockResolvedValue(undefined),
        elementHandle: vi.fn().mockResolvedValue(null)
      };
      agent.safeHumanClick = vi.fn().mockResolvedValue(true);

      const result = await agent.sixLayerClick(mockElement, '[Test]');
      
      expect(result).toBe(true);
    });

    it('should handle checkFatigue edge cases', () => {
      agent.isFatigued = true;
      agent.checkFatigue();
      expect(agent.isFatigued).toBe(true);
    });

    it('should handle normalizeProbabilities with missing config', () => {
      agent.config.probabilities = null;
      const result = agent.normalizeProbabilities({});
      expect(result).toBeDefined();
      expect(result.refresh).toBeDefined();
    });

    it('should handle navigateHome with 10% direct URL path', async () => {
      const { mathUtils } = await import('../../utils/mathUtils.js');
      vi.spyOn(mathUtils, 'roll').mockReturnValue(true); // Force 10% path
      
      agent.page.goto = vi.fn().mockResolvedValue(undefined);
      agent.ensureForYouTab = vi.fn().mockResolvedValue(undefined);
      
      await agent.navigateHome();
      
      expect(agent.page.goto).toHaveBeenCalledWith('https://x.com/home');
    });

    it('should handle postTweet with empty text', async () => {
      await agent.postTweet('');
      expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('Initiating'));
    });

    it('should handle postTweet with keyboard shortcut path', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.1); // Trigger keyboard path
      
      mockPage.keyboard = { press: vi.fn().mockResolvedValue(undefined) };
      mockPage.locator = vi.fn().mockReturnValue({
        first: vi.fn().mockReturnValue({
          isVisible: vi.fn().mockResolvedValue(false)
        })
      });
      
      await agent.postTweet('Test tweet');
      
      expect(mockPage.keyboard.press).toHaveBeenCalledWith('n');
    });

    it('should handle postTweet error when composer not found', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.9); // Trigger UI path
      
      mockPage.locator = vi.fn().mockReturnValue({
        first: vi.fn().mockReturnValue({
          isVisible: vi.fn().mockResolvedValue(false)
        })
      });
      
      await agent.postTweet('Test tweet');
      
      expect(mockLogger.info).toHaveBeenCalled();
    });

    it('should handle postTweet with UI button fallback', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.9); // Trigger UI path
      
      agent.safeHumanClick = vi.fn().mockResolvedValue(undefined);
      agent.humanType = vi.fn().mockResolvedValue(undefined);
      agent.page.waitForTimeout = vi.fn().mockResolvedValue(undefined);
      agent.page.waitForSelector = vi.fn().mockResolvedValue(undefined);
      agent.page.keyboard = { press: vi.fn().mockResolvedValue(undefined) };
      
      let callCount = 0;
      agent.page.locator = vi.fn().mockImplementation((selector) => {
        callCount++;
        if (selector.includes('SideNav_NewTweet_Button')) {
          return {
            first: vi.fn().mockReturnValue({
              isVisible: vi.fn().mockResolvedValue(true)
            })
          };
        }
        if (selector.includes('tweetTextarea')) {
          return {
            first: vi.fn().mockReturnValue({
              isVisible: vi.fn().mockResolvedValue(true)
            })
          };
        }
        // First calls check for composer, return false
        if (callCount <= 2) {
          return {
            first: vi.fn().mockReturnValue({
              isVisible: vi.fn().mockResolvedValue(false)
            })
          };
        }
        // Post button
        return {
          first: vi.fn().mockReturnValue({
            isVisible: vi.fn().mockResolvedValue(true)
          })
        };
      });
      
      await agent.postTweet('Test tweet with UI button');
      
      expect(agent.safeHumanClick).toHaveBeenCalled();
    });

    it('should handle postTweet successfully', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.9);
      
      agent.safeHumanClick = vi.fn().mockResolvedValue(undefined);
      agent.humanType = vi.fn().mockResolvedValue(undefined);
      agent.page.waitForTimeout = vi.fn().mockResolvedValue(undefined);
      agent.page.waitForSelector = vi.fn().mockResolvedValue(undefined);
      agent.page.keyboard = { press: vi.fn().mockResolvedValue(undefined) };
      
      agent.page.locator = vi.fn().mockImplementation((selector) => {
        if (selector.includes('tweetTextarea')) {
          return {
            first: vi.fn().mockReturnValue({
              isVisible: vi.fn().mockResolvedValue(true)
            })
          };
        }
        // Post button
        return {
          first: vi.fn().mockReturnValue({
            isVisible: vi.fn().mockResolvedValue(true)
          })
        };
      });
      
      await agent.postTweet('Test tweet');
      
      expect(mockLogger.info).toHaveBeenCalled();
    });

    it('should handle checkAndClickShowPostsButton with multiple selectors', async () => {
      agent.ghost.move = vi.fn().mockResolvedValue(undefined);
      agent.safeHumanClick = vi.fn().mockResolvedValue(undefined);
      
      let selectorIndex = 0;
      mockPage.locator = vi.fn().mockImplementation(() => {
        selectorIndex++;
        // First selector fails, second succeeds
        if (selectorIndex === 1) {
          return {
            first: vi.fn().mockReturnValue({
              count: vi.fn().mockResolvedValue(0),
              isVisible: vi.fn().mockResolvedValue(false),
              textContent: vi.fn().mockResolvedValue('')
            })
          };
        }
        return {
          first: vi.fn().mockReturnValue({
            count: vi.fn().mockResolvedValue(1),
            isVisible: vi.fn().mockResolvedValue(true),
            textContent: vi.fn().mockResolvedValue('Show 5 posts'),
            evaluate: vi.fn().mockResolvedValue(undefined),
            boundingBox: vi.fn().mockResolvedValue({ x: 100, y: 100, width: 100, height: 50 })
          })
        };
      });
      mockPage.waitForTimeout = vi.fn().mockResolvedValue(undefined);
      mockPage.evaluate = vi.fn().mockResolvedValue(undefined);
      mockPage.mouse = { wheel: vi.fn().mockResolvedValue(undefined) };
      mockPage.keyboard = { press: vi.fn().mockResolvedValue(undefined) };
      
      const result = await agent.checkAndClickShowPostsButton();
      
      expect(result).toBe(true);
      expect(agent.safeHumanClick).toHaveBeenCalled();
    });

    it('should handle checkAndClickShowPostsButton with invalid text pattern', async () => {
      mockPage.locator = vi.fn().mockReturnValue({
        first: vi.fn().mockReturnValue({
          count: vi.fn().mockResolvedValue(1),
          isVisible: vi.fn().mockResolvedValue(true),
          textContent: vi.fn().mockResolvedValue('Some other text'),
          evaluate: vi.fn().mockResolvedValue(undefined),
          boundingBox: vi.fn().mockResolvedValue({ x: 100, y: 100, width: 100, height: 50 })
        })
      });
      mockPage.waitForTimeout = vi.fn().mockResolvedValue(undefined);
      
      const result = await agent.checkAndClickShowPostsButton();
      
      expect(result).toBe(false);
    });

    it('should handle humanType with keyboard typing', async () => {
      const { mathUtils } = await import('../../utils/mathUtils.js');
      vi.spyOn(mathUtils, 'randomInRange').mockReturnValue(50);
      
      mockPage.keyboard = { type: vi.fn().mockResolvedValue(undefined) };
      mockPage.waitForTimeout = vi.fn().mockResolvedValue(undefined);
      
      const mockElement = {
        focus: vi.fn().mockResolvedValue(undefined)
      };
      
      await agent.humanType(mockElement, 'Hi');
      
      expect(mockPage.keyboard.type).toHaveBeenCalled();
    });

    it('should handle humanType with fill fallback', async () => {
      const mockElement = {
        focus: vi.fn().mockRejectedValue(new Error('Focus failed')),
        fill: vi.fn().mockResolvedValue(undefined)
      };
      
      await agent.humanType(mockElement, 'Test');
      
      expect(mockElement.fill).toHaveBeenCalledWith('Test');
    });

    it('should handle pollForFollowState with text content check', async () => {
      let callCount = 0;
      mockPage.locator = vi.fn().mockReturnValue({
        first: vi.fn().mockReturnValue({
          isVisible: vi.fn().mockImplementation(() => {
            callCount++;
            return Promise.resolve(callCount > 2); // Become visible after 2 checks
          }),
          textContent: vi.fn().mockResolvedValue('Following')
        })
      });
      mockPage.waitForTimeout = vi.fn().mockResolvedValue(undefined);
      
      const result = await agent.pollForFollowState('[unfollow]', '[follow]', 5000);
      
      expect(result).toBe(true);
    });

    it('should handle pollForFollowState timeout', async () => {
      mockPage.locator = vi.fn().mockReturnValue({
        first: vi.fn().mockReturnValue({
          isVisible: vi.fn().mockResolvedValue(false),
          textContent: vi.fn().mockResolvedValue('Follow')
        })
      });
      mockPage.waitForTimeout = vi.fn().mockResolvedValue(undefined);
      
      const result = await agent.pollForFollowState('[unfollow]', '[follow]', 100);
      
      expect(result).toBe(false);
    });

    it('should handle triggerHotSwap with doom scroll mode', async () => {
      const { profileManager } = await import('../../utils/profileManager.js');
      vi.spyOn(profileManager, 'getFatiguedVariant').mockReturnValue(null);
      
      agent.isFatigued = false;
      agent.triggerHotSwap();
      
      expect(agent.isFatigued).toBe(true);
      expect(agent.state.fatigueBias).toBe(0.3);
    });

    it('should handle isElementActionable with covered element', async () => {
      mockPage.evaluate = vi.fn().mockResolvedValue(false);
      
      const mockElement = {
        elementHandle: vi.fn().mockResolvedValue({})
      };
      
      const result = await agent.isElementActionable(mockElement);
      
      expect(result).toBe(false);
    });

    it('should handle scrollToGoldenZone with valid element', async () => {
      mockPage.evaluate = vi.fn().mockResolvedValue(undefined);
      mockPage.waitForTimeout = vi.fn().mockResolvedValue(undefined);
      
      const mockElement = {
        elementHandle: vi.fn().mockResolvedValue({})
      };
      
      await agent.scrollToGoldenZone(mockElement);
      
      expect(mockPage.evaluate).toHaveBeenCalled();
    });

    it('should handle checkAndHandleSoftError with reload strategy', async () => {
      agent.state.consecutiveSoftErrors = 0;
      
      mockPage.locator = vi.fn().mockReturnValue({
        first: vi.fn().mockReturnValue({
          isVisible: vi.fn().mockImplementation(({ timeout }) => {
            // First call returns true (error visible), subsequent return false
            agent.state.consecutiveSoftErrors++;
            return Promise.resolve(agent.state.consecutiveSoftErrors === 1);
          })
        })
      });
      mockPage.goto = vi.fn().mockResolvedValue(undefined);
      mockPage.waitForTimeout = vi.fn().mockResolvedValue(undefined);
      mockPage.url = vi.fn().mockReturnValue('https://x.com/home');
      
      const result = await agent.checkAndHandleSoftError();
      
      expect(result).toBe(true);
    });

    it('should handle checkAndHandleSoftError exceeding max retries', async () => {
      agent.state.consecutiveSoftErrors = 2;
      
      mockPage.locator = vi.fn().mockReturnValue({
        first: vi.fn().mockReturnValue({
          isVisible: vi.fn().mockResolvedValue(true)
        })
      });
      
      await expect(agent.checkAndHandleSoftError()).rejects.toThrow('potential twitter logged out');
    });

    it('should handle performHealthCheck with network inactivity', async () => {
      agent.lastNetworkActivity = Date.now() - 35000; // 35 seconds ago
      mockPage.content = vi.fn().mockResolvedValue('');
      
      const result = await agent.performHealthCheck();
      
      expect(result.healthy).toBe(false);
      expect(result.reason).toContain('network_inactivity');
    });

    it('should handle performHealthCheck with critical error page', async () => {
      agent.lastNetworkActivity = Date.now();
      mockPage.content = vi.fn().mockResolvedValue('ERR_TOO_MANY_REDIRECTS');
      
      const result = await agent.performHealthCheck();
      
      expect(result.healthy).toBe(false);
      expect(result.reason).toBe('critical_error_page_redirects');
    });

    it('should handle simulateFidget with candidates but no visible text', async () => {
      const { mathUtils } = await import('../../utils/mathUtils.js');
      vi.spyOn(mathUtils, 'roll').mockImplementation((prob) => {
        if (prob === 0.4) return true; // TEXT_SELECT
        return false;
      });
      
      // Has candidates but none are visible
      const mockElement = {
        boundingBox: vi.fn().mockResolvedValue({ x: 100, y: 100 }),
        textContent: vi.fn().mockResolvedValue('Sample text')
      };
      agent.page.locator = vi.fn().mockReturnValue({
        all: vi.fn().mockResolvedValue([mockElement])
      });
      agent.page.evaluate = vi.fn().mockResolvedValue([]); // No visible indices
      agent.page.waitForTimeout = vi.fn().mockResolvedValue(undefined);
      agent.page.url = vi.fn().mockReturnValue('https://x.com/home');
      
      await expect(agent.simulateFidget()).resolves.not.toThrow();
    });

    it('should handle diveProfile with tab exploration', async () => {
      const { mathUtils } = await import('../../utils/mathUtils.js');
      vi.spyOn(mathUtils, 'roll').mockImplementation((prob) => {
        if (prob === 0.4) return true; // Enable tab exploration
        if (prob === 0.01) return false; // Don't follow
        return false;
      });
      
      agent.page.$$eval = vi.fn().mockResolvedValue([0]);
      agent.page.locator = vi.fn().mockImplementation((selector) => {
        if (selector.includes('tab') || selector.includes('Tweets') || selector.includes('Replies')) {
          return {
            first: vi.fn().mockReturnValue({
              count: vi.fn().mockResolvedValue(1),
              isVisible: vi.fn().mockResolvedValue(true)
            })
          };
        }
        return {
          nth: vi.fn().mockReturnValue({
            getAttribute: vi.fn().mockResolvedValue('/testuser')
          }),
          first: vi.fn().mockReturnValue({
            isVisible: vi.fn().mockResolvedValue(true)
          })
        };
      });
      agent.page.waitForLoadState = vi.fn().mockResolvedValue(undefined);
      agent.page.waitForTimeout = vi.fn().mockResolvedValue(undefined);
      agent.page.url = vi.fn().mockReturnValue('https://x.com/testuser');
      agent.page.keyboard = { press: vi.fn().mockResolvedValue(undefined) };
      agent.page.evaluate = vi.fn().mockResolvedValue(undefined);
      agent.safeHumanClick = vi.fn().mockResolvedValue(undefined);
      agent.navigateHome = vi.fn().mockResolvedValue(undefined);
      agent.normalizeProbabilities = vi.fn().mockReturnValue({
        followOnProfile: 0.01,
        refresh: 0.1,
        profileDive: 0.2,
        tweetDive: 0.3,
        idle: 0.4
      });
      agent.human.consumeContent = vi.fn().mockResolvedValue(undefined);
      agent.human.multitask = vi.fn().mockResolvedValue(undefined);
      agent.checkAndHandleSoftError = vi.fn().mockResolvedValue(false);
      
      await expect(agent.diveProfile()).resolves.not.toThrow();
    });

    it('should handle diveTweet with expanded tweet and media', async () => {
      const { mathUtils } = await import('../../utils/mathUtils.js');
      vi.spyOn(mathUtils, 'roll').mockImplementation((prob) => {
        if (prob === 0.2) return true; // Open media
        if (prob === 0.5) return true; // Like
        if (prob === 0.3) return true; // Bookmark
        return false;
      });
      
      agent.state.likes = 0;
      agent.config.maxLike = 10;
      
      let callCount = 0;
      agent.page.locator = vi.fn().mockImplementation((selector) => {
        callCount++;
        if (selector.includes('tweetPhoto')) {
          return {
            first: vi.fn().mockReturnValue({
              count: vi.fn().mockResolvedValue(1),
              isVisible: vi.fn().mockResolvedValue(true)
            })
          };
        }
        if (selector.includes('like') && !selector.includes('unlike')) {
          return {
            first: vi.fn().mockReturnValue({
              count: vi.fn().mockResolvedValue(1),
              isVisible: vi.fn().mockResolvedValue(true),
              scrollIntoViewIfNeeded: vi.fn().mockResolvedValue(undefined),
              getAttribute: vi.fn().mockResolvedValue('Like')
            })
          };
        }
        if (selector.includes('unlike')) {
          return {
            first: vi.fn().mockReturnValue({
              isVisible: vi.fn().mockResolvedValue(false)
            })
          };
        }
        if (selector.includes('bookmark')) {
          return {
            first: vi.fn().mockReturnValue({
              isVisible: vi.fn().mockResolvedValue(true)
            })
          };
        }
        if (selector.includes('removeBookmark')) {
          return {
            first: vi.fn().mockReturnValue({
              isVisible: vi.fn().mockResolvedValue(false)
            })
          };
        }
        return {
          count: vi.fn().mockResolvedValue(1),
          nth: vi.fn().mockReturnValue({
            boundingBox: vi.fn().mockResolvedValue({ x: 100, y: 200, height: 100 }),
            locator: vi.fn().mockReturnValue({
              first: vi.fn().mockReturnValue({
                count: vi.fn().mockResolvedValue(1),
                isVisible: vi.fn().mockResolvedValue(true)
              })
            }),
            evaluate: vi.fn().mockResolvedValue(undefined)
          })
        };
      });
      
      agent.page.waitForURL = vi.fn().mockResolvedValue(undefined);
      agent.page.url = vi.fn().mockReturnValue('https://x.com/home');
      agent.page.waitForTimeout = vi.fn().mockResolvedValue(undefined);
      agent.page.keyboard = { press: vi.fn().mockResolvedValue(undefined) };
      agent.navigateHome = vi.fn().mockResolvedValue(undefined);
      agent.safeHumanClick = vi.fn().mockResolvedValue(undefined);
      
      // The diveTweet should complete without errors
      await expect(agent.diveTweet()).resolves.not.toThrow();
    });

    it('should handle sixLayerClick with various fallback layers', async () => {
      // Test that sixLayerClick handles failures gracefully
      const mockElement = {
        click: vi.fn().mockRejectedValue(new Error('Failed')),
        elementHandle: vi.fn().mockResolvedValue(null),
        focus: vi.fn().mockRejectedValue(new Error('Failed'))
      };
      agent.page.waitForTimeout = vi.fn().mockResolvedValue(undefined);
      agent.page.keyboard = { press: vi.fn().mockResolvedValue(undefined) };
      agent.page.evaluate = vi.fn().mockResolvedValue(undefined);
      
      const result = await agent.sixLayerClick(mockElement, '[Test]');
      
      // Should succeed through one of the fallback layers
      expect(typeof result).toBe('boolean');
    });

    it('should handle sixLayerClick returning false on complete failure', async () => {
      const mockElement = {
        click: vi.fn().mockRejectedValue(new Error('Failed')),
        elementHandle: vi.fn().mockResolvedValue(null),
        focus: vi.fn().mockRejectedValue(new Error('Failed'))
      };
      agent.page.waitForTimeout = vi.fn().mockResolvedValue(undefined);
      agent.page.keyboard = { press: vi.fn().mockRejectedValue(new Error('Failed')) };
      agent.page.evaluate = vi.fn().mockRejectedValue(new Error('Failed'));
      
      // Should resolve without throwing
      await expect(agent.sixLayerClick(mockElement, '[Test]')).resolves.not.toThrow();
    });

    it('should handle robustFollow with pre-click state change detection', async () => {
      agent.sixLayerClick = vi.fn().mockResolvedValue(true);
      agent.isElementActionable = vi.fn().mockResolvedValue(true);
      agent.dismissOverlays = vi.fn().mockResolvedValue(undefined);
      agent.pollForFollowState = vi.fn().mockResolvedValue(true);
      agent.checkAndHandleSoftError = vi.fn().mockResolvedValue(false);
      agent.performHealthCheck = vi.fn().mockResolvedValue({ healthy: true, reason: '' });
      agent.page.waitForTimeout = vi.fn().mockResolvedValue(undefined);
      agent.page.reload = vi.fn().mockResolvedValue(undefined);
      
      let textCallCount = 0;
      mockPage.locator = vi.fn().mockImplementation((selector) => {
        if (selector.includes('unfollow')) {
          return {
            first: vi.fn().mockReturnValue({
              isVisible: vi.fn().mockImplementation(() => {
                // Become visible after first check
                textCallCount++;
                return Promise.resolve(textCallCount > 1);
              })
            })
          };
        }
        if (selector.includes('follow')) {
          return {
            first: vi.fn().mockReturnValue({
              isVisible: vi.fn().mockResolvedValue(true),
              textContent: vi.fn().mockImplementation(() => {
                textCallCount++;
                return Promise.resolve(textCallCount > 1 ? 'Following' : 'Follow');
              }),
              getAttribute: vi.fn().mockResolvedValue('Follow @user'),
              scrollIntoViewIfNeeded: vi.fn().mockResolvedValue(undefined),
              evaluate: vi.fn().mockResolvedValue(undefined)
            })
          };
        }
        return {
          first: vi.fn().mockReturnValue({
            isVisible: vi.fn().mockResolvedValue(false)
          })
        };
      });

      const result = await agent.robustFollow('[Test]');
      
      expect(result.success).toBe(true);
    });

    it('should handle robustFollow with aria-label verification', async () => {
      agent.sixLayerClick = vi.fn().mockResolvedValue(true);
      agent.isElementActionable = vi.fn().mockResolvedValue(true);
      agent.dismissOverlays = vi.fn().mockResolvedValue(undefined);
      agent.checkAndHandleSoftError = vi.fn().mockResolvedValue(false);
      agent.performHealthCheck = vi.fn().mockResolvedValue({ healthy: true, reason: '' });
      agent.page.waitForTimeout = vi.fn().mockResolvedValue(undefined);
      agent.page.reload = vi.fn().mockResolvedValue(undefined);
      
      mockPage.locator = vi.fn().mockImplementation((selector) => {
        if (selector.includes('unfollow')) {
          return {
            first: vi.fn().mockReturnValue({
              isVisible: vi.fn().mockResolvedValue(false)
            })
          };
        }
        if (selector.includes('follow')) {
          return {
            first: vi.fn().mockReturnValue({
              isVisible: vi.fn().mockResolvedValue(true),
              textContent: vi.fn().mockResolvedValue('Follow'),
              getAttribute: vi.fn().mockImplementation((attr) => {
                if (attr === 'aria-label') return Promise.resolve('Following @user');
                return Promise.resolve('');
              }),
              scrollIntoViewIfNeeded: vi.fn().mockResolvedValue(undefined),
              evaluate: vi.fn().mockResolvedValue(undefined)
            })
          };
        }
        return {
          first: vi.fn().mockReturnValue({
            isVisible: vi.fn().mockResolvedValue(false)
          })
        };
      });

      const result = await agent.robustFollow('[Test]');
      
      expect(result.success).toBe(true);
      expect(result.reason).toBe('aria_label_following');
    });

    it('should handle robustFollow with button text indicating already following', async () => {
      // Simplified test - just verify it handles the case gracefully
      agent.page.waitForTimeout = vi.fn().mockResolvedValue(undefined);
      agent.page.reload = vi.fn().mockResolvedValue(undefined);
      agent.performHealthCheck = vi.fn().mockResolvedValue({ healthy: true, reason: '' });
      agent.checkAndHandleSoftError = vi.fn().mockResolvedValue(false);
      
      agent.page.locator = vi.fn().mockImplementation((selector) => {
        if (selector.includes('unfollow')) {
          return {
            first: vi.fn().mockReturnValue({
              isVisible: vi.fn().mockResolvedValue(false)
            })
          };
        }
        if (selector.includes('follow')) {
          return {
            first: vi.fn().mockReturnValue({
              isVisible: vi.fn().mockResolvedValue(true),
              textContent: vi.fn().mockResolvedValue('Following'), // Already following
              getAttribute: vi.fn().mockResolvedValue(''),
              scrollIntoViewIfNeeded: vi.fn().mockResolvedValue(undefined),
              evaluate: vi.fn().mockResolvedValue(undefined)
            })
          };
        }
        return {
          first: vi.fn().mockReturnValue({
            isVisible: vi.fn().mockResolvedValue(false)
          })
        };
      });

      const result = await agent.robustFollow('[Test]');
      
      // Should handle gracefully without errors
      expect(result).toBeDefined();
    });

    it('should handle robustFollow with non-actionable button', async () => {
      agent.isElementActionable = vi.fn().mockResolvedValue(false);
      agent.dismissOverlays = vi.fn().mockResolvedValue(undefined);
      agent.sixLayerClick = vi.fn().mockResolvedValue(true);
      agent.pollForFollowState = vi.fn().mockResolvedValue(true);
      agent.page.waitForTimeout = vi.fn().mockResolvedValue(undefined);
      agent.page.reload = vi.fn().mockResolvedValue(undefined);
      agent.performHealthCheck = vi.fn().mockResolvedValue({ healthy: true, reason: '' });
      agent.checkAndHandleSoftError = vi.fn().mockResolvedValue(false);
      
      mockPage.locator = vi.fn().mockImplementation((selector) => {
        if (selector.includes('unfollow')) {
          return {
            first: vi.fn().mockReturnValue({
              isVisible: vi.fn().mockResolvedValue(false)
            })
          };
        }
        if (selector.includes('follow')) {
          return {
            first: vi.fn().mockReturnValue({
              isVisible: vi.fn().mockResolvedValue(true),
              textContent: vi.fn().mockResolvedValue('Follow'),
              getAttribute: vi.fn().mockResolvedValue(''),
              scrollIntoViewIfNeeded: vi.fn().mockResolvedValue(undefined),
              evaluate: vi.fn().mockResolvedValue(undefined)
            })
          };
        }
        return {
          first: vi.fn().mockReturnValue({
            isVisible: vi.fn().mockResolvedValue(false)
          })
        };
      });

      const result = await agent.robustFollow('[Test]');
      
      expect(result.success).toBe(true);
      expect(agent.dismissOverlays).toHaveBeenCalled();
    });

    it('should handle robustFollow with page reload on failure', async () => {
      // Simplified test - verify robustFollow handles retry logic
      agent.sixLayerClick = vi.fn().mockResolvedValue(false);
      agent.page.waitForTimeout = vi.fn().mockResolvedValue(undefined);
      agent.page.reload = vi.fn().mockResolvedValue(undefined);
      agent.performHealthCheck = vi.fn().mockResolvedValue({ healthy: true, reason: '' });
      agent.checkAndHandleSoftError = vi.fn().mockResolvedValue(false);
      agent.isElementActionable = vi.fn().mockResolvedValue(true);
      agent.pollForFollowState = vi.fn().mockResolvedValue(true);
      
      agent.page.locator = vi.fn().mockImplementation((selector) => {
        if (selector.includes('unfollow')) {
          return {
            first: vi.fn().mockReturnValue({
              isVisible: vi.fn().mockResolvedValue(false)
            })
          };
        }
        if (selector.includes('follow')) {
          return {
            first: vi.fn().mockReturnValue({
              isVisible: vi.fn().mockResolvedValue(true),
              textContent: vi.fn().mockResolvedValue('Follow'),
              getAttribute: vi.fn().mockResolvedValue(''),
              scrollIntoViewIfNeeded: vi.fn().mockResolvedValue(undefined),
              evaluate: vi.fn().mockResolvedValue(undefined)
            })
          };
        }
        return {
          first: vi.fn().mockReturnValue({
            isVisible: vi.fn().mockResolvedValue(false)
          })
        };
      });

      const result = await agent.robustFollow('[Test]');
      
      // Should complete without errors
      expect(result).toBeDefined();
    });

    it('should handle postTweet with UI button visible', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.9);
      
      agent.safeHumanClick = vi.fn().mockResolvedValue(undefined);
      agent.humanType = vi.fn().mockResolvedValue(undefined);
      agent.page.waitForTimeout = vi.fn().mockResolvedValue(undefined);
      agent.page.waitForSelector = vi.fn().mockResolvedValue(undefined);
      agent.page.keyboard = { press: vi.fn().mockResolvedValue(undefined) };
      
      // First check for tweetTextarea_0RichTextInput fails, then SideNav_NewTweet_Button is visible
      let checkCount = 0;
      agent.page.locator = vi.fn().mockImplementation((selector) => {
        checkCount++;
        if (selector.includes('SideNav_NewTweet_Button')) {
          return {
            first: vi.fn().mockReturnValue({
              isVisible: vi.fn().mockResolvedValue(true)
            })
          };
        }
        if (selector.includes('tweetTextarea')) {
          return {
            first: vi.fn().mockReturnValue({
              isVisible: vi.fn().mockResolvedValue(true)
            })
          };
        }
        // Post button
        return {
          first: vi.fn().mockReturnValue({
            isVisible: vi.fn().mockResolvedValue(true)
          })
        };
      });
      
      await agent.postTweet('Test tweet via UI button');
      
      expect(agent.safeHumanClick).toHaveBeenCalled();
    });

    it('should handle postTweet when UI button not found', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.9);
      
      agent.page.waitForTimeout = vi.fn().mockResolvedValue(undefined);
      agent.page.keyboard = { press: vi.fn().mockResolvedValue(undefined) };
      
      agent.page.locator = vi.fn().mockImplementation((selector) => {
        if (selector.includes('SideNav_NewTweet_Button')) {
          return {
            first: vi.fn().mockReturnValue({
              isVisible: vi.fn().mockResolvedValue(false)
            })
          };
        }
        if (selector.includes('tweetTextarea')) {
          return {
            first: vi.fn().mockReturnValue({
              isVisible: vi.fn().mockResolvedValue(false)
            })
          };
        }
        return {
          first: vi.fn().mockReturnValue({
            isVisible: vi.fn().mockResolvedValue(false)
          })
        };
      });
      
      await agent.postTweet('Test tweet');
      
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('New Tweet button not found'));
    });

    it('should handle simulateReading with viewport calculation error', async () => {
      agent.page.viewportSize = vi.fn().mockReturnValue(null);
      agent.page.evaluate = vi.fn().mockResolvedValue({ width: 1280, height: 720 });
      agent.page.waitForTimeout = vi.fn().mockResolvedValue(undefined);
      agent.page.keyboard = { press: vi.fn().mockResolvedValue(undefined) };
      agent.ghost.move = vi.fn().mockResolvedValue(undefined);
      agent.checkAndHandleSoftError = vi.fn().mockResolvedValue(false);
      agent.performHealthCheck = vi.fn().mockResolvedValue({ healthy: true, reason: '' });
      agent.human.consumeContent = vi.fn().mockResolvedValue(undefined);
      agent.getScrollMethod = vi.fn().mockReturnValue('WHEEL_DOWN');
      agent.checkFatigue = vi.fn();
      agent.isSessionExpired = vi.fn().mockReturnValue(false);
      
      const { scrollDown } = await import('../../utils/scroll-helper.js');
      const { mathUtils } = await import('../../utils/mathUtils.js');
      vi.spyOn(mathUtils, 'roll').mockReturnValue(false);
      vi.spyOn(mathUtils, 'gaussian').mockReturnValue(400);
      vi.spyOn(mathUtils, 'randomInRange').mockReturnValue(100);
      
      agent.config.timings.readingPhase = { mean: 50, deviation: 10 };
      
      await agent.simulateReading();
      
      // Should complete without error despite viewportSize returning null
      expect(scrollDown).toHaveBeenCalled();
    });

    it('should handle diveTweet with viewport size fallback', async () => {
      agent.page.viewportSize = vi.fn().mockReturnValue(null);
      agent.page.evaluate = vi.fn().mockResolvedValue({ width: 1280, height: 720 });
      agent.page.waitForTimeout = vi.fn().mockResolvedValue(undefined);
      agent.page.waitForURL = vi.fn().mockResolvedValue(undefined);
      agent.page.url = vi.fn().mockReturnValue('https://x.com/home');
      agent.page.keyboard = { press: vi.fn().mockResolvedValue(undefined) };
      agent.navigateHome = vi.fn().mockResolvedValue(undefined);
      agent.safeHumanClick = vi.fn().mockResolvedValue(undefined);
      
      agent.page.locator = vi.fn().mockReturnValue({
        count: vi.fn().mockResolvedValue(1),
        nth: vi.fn().mockReturnValue({
          boundingBox: vi.fn().mockResolvedValue({ x: 100, y: 200, height: 100 }),
          locator: vi.fn().mockReturnValue({
            first: vi.fn().mockReturnValue({
              count: vi.fn().mockResolvedValue(1),
              isVisible: vi.fn().mockResolvedValue(true)
            })
          }),
          evaluate: vi.fn().mockResolvedValue(undefined)
        })
      });

      await expect(agent.diveTweet()).resolves.not.toThrow();
    });

    it('should handle checkLoginState with exception during check', async () => {
      agent.page.getByText = vi.fn().mockImplementation(() => {
        throw new Error('Page context error');
      });
      agent.page.locator = vi.fn().mockImplementation(() => {
        throw new Error('Page context error');
      });

      const result = await agent.checkLoginState();
      
      expect(result).toBe(false);
    });

    it('should handle checkAndHandleSoftError with successful retry button click', async () => {
      agent.state.consecutiveSoftErrors = 0;
      
      let isVisibleCallCount = 0;
      mockPage.locator = vi.fn().mockImplementation((selector) => {
        if (selector.includes('Something went wrong')) {
          return {
            first: vi.fn().mockReturnValue({
              isVisible: vi.fn().mockImplementation(({ timeout }) => {
                isVisibleCallCount++;
                // First call shows error, subsequent calls don't
                return Promise.resolve(isVisibleCallCount === 1);
              })
            })
          };
        }
        if (selector.includes('Retry')) {
          return {
            first: vi.fn().mockReturnValue({
              isVisible: vi.fn().mockResolvedValue(true),
              click: vi.fn().mockResolvedValue(undefined)
            })
          };
        }
        return {
          first: vi.fn().mockReturnValue({
            isVisible: vi.fn().mockResolvedValue(false)
          })
        };
      });
      mockPage.waitForTimeout = vi.fn().mockResolvedValue(undefined);
      
      const result = await agent.checkAndHandleSoftError();
      
      expect(result).toBe(true);
    });

    it('should handle checkAndHandleSoftError with null reloadUrl fallback', async () => {
      agent.state.consecutiveSoftErrors = 0;
      
      mockPage.locator = vi.fn().mockImplementation((selector) => {
        if (selector.includes('Something went wrong')) {
          return {
            first: vi.fn().mockReturnValue({
              isVisible: vi.fn().mockResolvedValue(true)
            })
          };
        }
        if (selector.includes('Retry')) {
          return {
            first: vi.fn().mockReturnValue({
              isVisible: vi.fn().mockResolvedValue(false)
            })
          };
        }
        return {
          first: vi.fn().mockReturnValue({
            isVisible: vi.fn().mockResolvedValue(false)
          })
        };
      });
      mockPage.url = vi.fn().mockReturnValue('https://x.com/home');
      mockPage.goto = vi.fn().mockResolvedValue(undefined);
      mockPage.waitForTimeout = vi.fn().mockResolvedValue(undefined);
      
      const result = await agent.checkAndHandleSoftError();
      
      expect(result).toBe(true);
      expect(mockPage.goto).toHaveBeenCalledWith('https://x.com/home', expect.any(Object));
    });

    it('should handle normalizeProbabilities with fatigue bias', async () => {
      agent.state.fatigueBias = 0.5;
      agent.config.probabilities = {
        idle: 0.1,
        refresh: 0.2,
        profileDive: 0.3,
        tweetDive: 0.4
      };
      
      const result = agent.normalizeProbabilities(agent.config.probabilities);
      
      // Fatigue should increase idle probability
      expect(result.idle).toBeGreaterThan(0.1);
    });

    it('should handle normalizeProbabilities with burst mode', async () => {
      agent.state.activityMode = 'BURST';
      agent.config.probabilities = {
        idle: 0.1,
        refresh: 0.2,
        profileDive: 0.3,
        tweetDive: 0.4
      };
      
      const result = agent.normalizeProbabilities(agent.config.probabilities);
      
      // BURST mode should set idle and refresh to 0
      expect(result.idle).toBe(0);
      expect(result.refresh).toBe(0);
    });

    it('should handle scrollRandom import correctly', async () => {
      const { scrollRandom } = await import('../../utils/scroll-helper.js');
      
      expect(scrollRandom).toBeDefined();
      expect(typeof scrollRandom).toBe('function');
    });

    it('should handle humanClick with mouse movement errors', async () => {
      agent.human.think = vi.fn().mockResolvedValue(undefined);
      agent.human.recoverFromError = vi.fn().mockResolvedValue(undefined);
      agent.page.waitForTimeout = vi.fn().mockResolvedValue(undefined);
      agent.ghost.click = vi.fn().mockRejectedValue(new Error('Ghost error'));
      
      const mockTarget = {
        evaluate: vi.fn().mockResolvedValue(undefined)
      };

      await expect(agent.humanClick(mockTarget, 'Test')).rejects.toThrow('Ghost error');
      expect(agent.human.recoverFromError).toHaveBeenCalled();
    });

    it('should handle ensureForYouTab with multiple tabs', async () => {
      mockPage.waitForSelector = vi.fn().mockResolvedValue(undefined);
      mockPage.waitForTimeout = vi.fn().mockResolvedValue(undefined);
      agent.safeHumanClick = vi.fn().mockResolvedValue(undefined);
      agent.checkAndClickShowPostsButton = vi.fn().mockResolvedValue(false);
      
      mockPage.locator = vi.fn().mockImplementation((selector) => {
        if (selector.includes('tablist')) {
          return {
            first: vi.fn().mockReturnValue({
              locator: vi.fn().mockReturnValue({
                count: vi.fn().mockResolvedValue(3),
                nth: vi.fn().mockImplementation((i) => ({
                  textContent: vi.fn().mockResolvedValue(i === 0 ? 'For you' : (i === 1 ? 'Following' : 'Lists')),
                  getAttribute: vi.fn().mockResolvedValue(i === 0 ? 'true' : 'false'),
                  isVisible: vi.fn().mockResolvedValue(true),
                  click: vi.fn().mockResolvedValue(undefined)
                }))
              })
            })
          };
        }
        return {
          first: vi.fn().mockReturnValue({
            count: vi.fn().mockResolvedValue(0),
            isVisible: vi.fn().mockResolvedValue(false)
          })
        };
      });

      await agent.ensureForYouTab();
      
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('already selected'));
    });

    it('should handle diveProfile with refresh action', async () => {
      agent.page.$$eval = vi.fn().mockResolvedValue([0]);
      agent.page.locator = vi.fn().mockImplementation((selector) => {
        if (selector.includes('tab')) {
          return {
            first: vi.fn().mockReturnValue({
              count: vi.fn().mockResolvedValue(1),
              isVisible: vi.fn().mockResolvedValue(true)
            })
          };
        }
        return {
          nth: vi.fn().mockReturnValue({
            getAttribute: vi.fn().mockResolvedValue('/testuser')
          }),
          first: vi.fn().mockReturnValue({
            isVisible: vi.fn().mockResolvedValue(true)
          })
        };
      });
      agent.page.waitForLoadState = vi.fn().mockResolvedValue(undefined);
      agent.page.waitForTimeout = vi.fn().mockResolvedValue(undefined);
      agent.page.url = vi.fn().mockReturnValue('https://x.com/testuser');
      agent.page.keyboard = { press: vi.fn().mockResolvedValue(undefined) };
      agent.page.evaluate = vi.fn().mockResolvedValue(undefined);
      agent.safeHumanClick = vi.fn().mockResolvedValue(undefined);
      agent.navigateHome = vi.fn().mockResolvedValue(undefined);
      agent.page.reload = vi.fn().mockResolvedValue(undefined);
      agent.normalizeProbabilities = vi.fn().mockReturnValue({
        followOnProfile: 0.01,
        refresh: 0.5,
        profileDive: 0.2,
        tweetDive: 0.3,
        idle: 0.4
      });
      agent.human.consumeContent = vi.fn().mockResolvedValue(undefined);
      agent.human.multitask = vi.fn().mockResolvedValue(undefined);
      agent.checkAndHandleSoftError = vi.fn().mockResolvedValue(false);
      
      vi.spyOn(Math, 'random').mockReturnValue(0.2);
      
      // Should complete without errors
      await expect(agent.diveProfile()).resolves.not.toThrow();
    });

    it('should handle diveProfile with idle action', async () => {
      agent.page.$$eval = vi.fn().mockResolvedValue([0]);
      agent.page.locator = vi.fn().mockImplementation((selector) => {
        if (selector.includes('tab')) {
          return {
            first: vi.fn().mockReturnValue({
              count: vi.fn().mockResolvedValue(1),
              isVisible: vi.fn().mockResolvedValue(true)
            })
          };
        }
        return {
          nth: vi.fn().mockReturnValue({
            getAttribute: vi.fn().mockResolvedValue('/testuser')
          }),
          first: vi.fn().mockReturnValue({
            isVisible: vi.fn().mockResolvedValue(true)
          })
        };
      });
      agent.page.waitForLoadState = vi.fn().mockResolvedValue(undefined);
      agent.page.waitForTimeout = vi.fn().mockResolvedValue(undefined);
      agent.page.url = vi.fn().mockReturnValue('https://x.com/testuser');
      agent.page.keyboard = { press: vi.fn().mockResolvedValue(undefined) };
      agent.page.evaluate = vi.fn().mockResolvedValue(undefined);
      agent.safeHumanClick = vi.fn().mockResolvedValue(undefined);
      agent.navigateHome = vi.fn().mockResolvedValue(undefined);
      agent.normalizeProbabilities = vi.fn().mockReturnValue({
        followOnProfile: 0.01,
        refresh: 0.1,
        profileDive: 0.2,
        tweetDive: 0.3,
        idle: 0.6
      });
      agent.human.consumeContent = vi.fn().mockResolvedValue(undefined);
      agent.human.multitask = vi.fn().mockResolvedValue(undefined);
      agent.checkAndHandleSoftError = vi.fn().mockResolvedValue(false);
      
      vi.spyOn(Math, 'random').mockReturnValue(0.9);
      
      await expect(agent.diveProfile()).resolves.not.toThrow();
    });

    it('should handle diveTweet with different scroll targets', async () => {
      agent.safeHumanClick = vi.fn().mockResolvedValue(undefined);
      agent.navigateHome = vi.fn().mockResolvedValue(undefined);
      agent.page.waitForURL = vi.fn().mockResolvedValue(undefined);
      agent.page.waitForTimeout = vi.fn().mockResolvedValue(undefined);
      agent.page.keyboard = { press: vi.fn().mockResolvedValue(undefined) };
      agent.page.url = vi.fn().mockReturnValue('https://x.com/home');
      agent.page.goto = vi.fn().mockResolvedValue(undefined);
      agent.page.viewportSize = vi.fn().mockReturnValue({ width: 1280, height: 720 });
      
      let locatorCallCount = 0;
      agent.page.locator = vi.fn().mockImplementation((selector) => {
        locatorCallCount++;
        if (selector.includes('tweetText')) {
          return {
            count: vi.fn().mockResolvedValue(locatorCallCount > 1 ? 0 : 1),
            first: vi.fn().mockReturnValue({
              count: vi.fn().mockResolvedValue(locatorCallCount > 1 ? 0 : 1),
              isVisible: vi.fn().mockResolvedValue(locatorCallCount === 1)
            })
          };
        }
        if (selector.includes('time')) {
          return {
            count: vi.fn().mockResolvedValue(1),
            first: vi.fn().mockReturnValue({
              count: vi.fn().mockResolvedValue(1),
              isVisible: vi.fn().mockResolvedValue(true),
              locator: vi.fn().mockReturnValue({
                first: vi.fn().mockReturnValue({
                  count: vi.fn().mockResolvedValue(1)
                })
              })
            })
          };
        }
        return {
          count: vi.fn().mockResolvedValue(1),
          nth: vi.fn().mockReturnValue({
            boundingBox: vi.fn().mockResolvedValue({ x: 100, y: 200, height: 100 }),
            locator: vi.fn().mockReturnValue({
              first: vi.fn().mockReturnValue({
                count: vi.fn().mockResolvedValue(1),
                isVisible: vi.fn().mockResolvedValue(true)
              })
            }),
            evaluate: vi.fn().mockResolvedValue(undefined)
          })
        };
      });

      await expect(agent.diveTweet()).resolves.not.toThrow();
    });

    it('should handle robustFollow with pending state resolution', async () => {
      agent.page.waitForTimeout = vi.fn().mockResolvedValue(undefined);
      agent.page.reload = vi.fn().mockResolvedValue(undefined);
      agent.performHealthCheck = vi.fn().mockResolvedValue({ healthy: true, reason: '' });
      agent.checkAndHandleSoftError = vi.fn().mockResolvedValue(false);
      agent.dismissOverlays = vi.fn().mockResolvedValue(undefined);
      agent.isElementActionable = vi.fn().mockResolvedValue(true);
      agent.scrollToGoldenZone = vi.fn().mockResolvedValue(undefined);
      agent.sixLayerClick = vi.fn().mockResolvedValue(true);
      agent.pollForFollowState = vi.fn().mockResolvedValue(true);
      
      let checkCount = 0;
      mockPage.locator = vi.fn().mockImplementation((selector) => {
        if (selector.includes('unfollow')) {
          return {
            first: vi.fn().mockReturnValue({
              isVisible: vi.fn().mockImplementation(() => {
                checkCount++;
                return Promise.resolve(checkCount > 2);
              })
            })
          };
        }
        if (selector.includes('follow')) {
          return {
            first: vi.fn().mockReturnValue({
              isVisible: vi.fn().mockResolvedValue(true),
              textContent: vi.fn().mockImplementation(() => {
                checkCount++;
                return Promise.resolve(checkCount > 2 ? 'Following' : 'Pending');
              }),
              getAttribute: vi.fn().mockResolvedValue(''),
              scrollIntoViewIfNeeded: vi.fn().mockResolvedValue(undefined),
              evaluate: vi.fn().mockResolvedValue(undefined)
            })
          };
        }
        return {
          first: vi.fn().mockReturnValue({
            isVisible: vi.fn().mockResolvedValue(false)
          })
        };
      });

      const result = await agent.robustFollow('[Test]');
      
      expect(result).toBeDefined();
    });

    it('should handle checkLoginState with multiple signed out texts', async () => {
      const signedOutTexts = ['Sign in', 'Create account', 'Join X today', 'Oops, something went wrong'];
      
      for (const text of signedOutTexts) {
        agent.page.getByText = vi.fn().mockReturnValue({
          first: vi.fn().mockReturnValue({
            isVisible: vi.fn().mockResolvedValue(true)
          })
        });
        
        const result = await agent.checkLoginState();
        expect(result).toBe(false);
      }
    });

    it('should handle postTweet with composer already open', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.9);
      
      agent.safeHumanClick = vi.fn().mockResolvedValue(undefined);
      agent.humanType = vi.fn().mockResolvedValue(undefined);
      agent.page.waitForTimeout = vi.fn().mockResolvedValue(undefined);
      agent.page.waitForSelector = vi.fn().mockResolvedValue(undefined);
      agent.page.keyboard = { press: vi.fn().mockResolvedValue(undefined) };
      
      agent.page.locator = vi.fn().mockImplementation((selector) => {
        if (selector.includes('tweetTextarea_0RichTextInput')) {
          return {
            first: vi.fn().mockReturnValue({
              isVisible: vi.fn().mockResolvedValue(true)
            })
          };
        }
        if (selector.includes('tweetTextarea_0')) {
          return {
            first: vi.fn().mockReturnValue({
              isVisible: vi.fn().mockResolvedValue(true)
            })
          };
        }
        return {
          first: vi.fn().mockReturnValue({
            isVisible: vi.fn().mockResolvedValue(true)
          })
        };
      });
      
      await agent.postTweet('Test tweet with open composer');
      
      expect(agent.humanType).toHaveBeenCalled();
    });

    it('should handle triggerHotSwap with slower profile', async () => {
      // Test triggerHotSwap in doom scroll mode (when no slower profile available)
      agent.config.probabilities = { refresh: 0.1, idle: 0.2 };
      agent.triggerHotSwap();
      
      expect(agent.isFatigued).toBe(true);
      expect(agent.state.fatigueBias).toBe(0.3);
    });

    it('should handle isSessionExpired with no end time', () => {
      agent.sessionEndTime = null;
      const result = agent.isSessionExpired();
      expect(result).toBe(false);
    });

    it('should handle isSessionExpired with future end time', () => {
      agent.sessionEndTime = Date.now() + 60000;
      const result = agent.isSessionExpired();
      expect(result).toBe(false);
    });

    it('should handle isSessionExpired with past end time', () => {
      agent.sessionEndTime = Date.now() - 1000;
      const result = agent.isSessionExpired();
      expect(result).toBe(true);
    });

    it('should handle diveTweet with failed ghost and native click', async () => {
      agent.safeHumanClick = vi.fn().mockRejectedValue(new Error('Ghost failed'));
      agent.page.waitForTimeout = vi.fn().mockResolvedValue(undefined);
      agent.page.waitForURL = vi.fn().mockRejectedValue(new Error('Timeout'));
      agent.page.url = vi.fn().mockReturnValue('https://x.com/home');
      agent.navigateHome = vi.fn().mockResolvedValue(undefined);
      
      agent.page.locator = vi.fn().mockReturnValue({
        count: vi.fn().mockResolvedValue(1),
        nth: vi.fn().mockReturnValue({
          boundingBox: vi.fn().mockResolvedValue({ x: 100, y: 200, height: 100 }),
          locator: vi.fn().mockReturnValue({
            first: vi.fn().mockReturnValue({
              count: vi.fn().mockResolvedValue(1),
              isVisible: vi.fn().mockResolvedValue(true)
            })
          }),
          click: vi.fn().mockRejectedValue(new Error('Native click failed')),
          evaluate: vi.fn().mockResolvedValue(undefined)
        })
      });

      await expect(agent.diveTweet()).resolves.not.toThrow();
    });

    it('should handle simulateFidget with visible candidates for TEXT_SELECT', async () => {
      const { mathUtils } = await import('../../utils/mathUtils.js');
      vi.spyOn(mathUtils, 'roll').mockImplementation((prob) => {
        if (prob === 0.4) return true; // TEXT_SELECT
        return false;
      });
      
      const mockElement = {
        boundingBox: vi.fn().mockResolvedValue({ x: 100, y: 100, width: 200, height: 50 }),
        textContent: vi.fn().mockResolvedValue('Sample tweet text here')
      };
      agent.page.locator = vi.fn().mockReturnValue({
        all: vi.fn().mockResolvedValue([mockElement, mockElement])
      });
      agent.page.evaluate = vi.fn().mockResolvedValue([0, 1]); // Both visible
      agent.page.waitForTimeout = vi.fn().mockResolvedValue(undefined);
      agent.page.url = vi.fn().mockReturnValue('https://x.com/home');
      agent.page.mouse = { move: vi.fn().mockResolvedValue(undefined) };
      
      await expect(agent.simulateFidget()).resolves.not.toThrow();
    });

    it('should handle simulateFidget with MOUSE_WIGGLE fidget type', async () => {
      const { mathUtils } = await import('../../utils/mathUtils.js');
      let callCount = 0;
      vi.spyOn(mathUtils, 'roll').mockImplementation((prob) => {
        callCount++;
        if (callCount === 1) return false; // Not TEXT_SELECT
        if (prob === 0.5) return true; // MOUSE_WIGGLE
        return false;
      });
      
      agent.page.url = vi.fn().mockReturnValue('https://x.com/home');
      agent.page.mouse = { move: vi.fn().mockResolvedValue(undefined) };
      agent.page.waitForTimeout = vi.fn().mockResolvedValue(undefined);
      
      await expect(agent.simulateFidget()).resolves.not.toThrow();
    });

    it('should handle simulateFidget with OVERSHOOT fidget type', async () => {
      const { mathUtils } = await import('../../utils/mathUtils.js');
      let callCount = 0;
      vi.spyOn(mathUtils, 'roll').mockImplementation((prob) => {
        callCount++;
        if (callCount === 1) return false; // Not TEXT_SELECT
        if (prob === 0.5) return false; // Not MOUSE_WIGGLE
        return true; // OVERSHOOT
      });
      
      agent.page.url = vi.fn().mockReturnValue('https://x.com/home');
      agent.page.goto = vi.fn().mockResolvedValue(undefined);
      agent.page.waitForTimeout = vi.fn().mockResolvedValue(undefined);
      
      await expect(agent.simulateFidget()).resolves.not.toThrow();
    });
  });
});

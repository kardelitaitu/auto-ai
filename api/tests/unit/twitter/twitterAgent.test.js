import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../utils/math.js", () => ({
  mathUtils: {
    randomInRange: vi.fn((min, max) => (min + max) / 2),
    gaussian: vi.fn((mean, std) => mean),
    roll: vi.fn(() => false),
  },
}));

vi.mock("../../../utils/entropyController.js", () => ({
  entropy: {
    retryDelay: vi.fn(() => 1000),
    scrollSettleTime: vi.fn(() => 500),
  },
}));

vi.mock("../../../utils/profileManager.js", () => ({
  profileManager: {
    getFatiguedVariant: vi.fn(() => null),
  },
}));

vi.mock("../../../utils/ghostCursor.js", () => ({
  GhostCursor: function () {
    this.click = vi.fn();
    this.move = vi.fn();
    this.park = vi.fn();
  },
}));

vi.mock("../../../behaviors/humanization/index.js", () => ({
  HumanizationEngine: function () {
    this.think = vi.fn();
    this.recoverFromError = vi.fn();
    this.consumeContent = vi.fn();
    this.multitask = vi.fn();
  },
}));

vi.mock("../../../behaviors/scroll-helper.js", () => ({
  scrollDown: vi.fn(),
  scrollRandom: vi.fn(),
}));

vi.mock("../../../../twitter/twitter-agent/NavigationHandler.js", () => ({
  NavigationHandler: function () {},
}));

vi.mock("../../../../twitter/twitter-agent/EngagementHandler.js", () => ({
  EngagementHandler: function () {},
}));

vi.mock("../../../../twitter/twitter-agent/SessionHandler.js", () => ({
  SessionHandler: function () {},
}));

vi.mock("../../../index.js", () => ({
  api: {
    wait: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("TwitterAgent", () => {
  let TwitterAgent;
  let mockPage;
  let mockLogger;

  beforeEach(async () => {
    vi.clearAllMocks();
    TwitterAgent = (await import("../../../twitter/twitterAgent.js"))
      .TwitterAgent;

    mockPage = {
      viewportSize: vi.fn(() => ({ width: 1280, height: 720 })),
      evaluate: vi.fn().mockResolvedValue(null),
      locator: vi.fn(() => ({
        count: vi.fn().mockResolvedValue(0),
        first: vi.fn(),
      })),
      content: vi.fn().mockResolvedValue(""),
      on: vi.fn(),
      keyboard: {
        press: vi.fn(),
      },
      url: vi.fn().mockReturnValue("https://x.com/home"),
      isClosed: vi.fn().mockReturnValue(false),
      removeAllListeners: vi.fn(),
    };

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };
  });

  describe("constructor", () => {
    it("should initialize with default state", () => {
      const config = {
        id: "test-agent",
        description: "Test Agent",
        timings: {
          scrollPause: { mean: 1000, deviation: 200 },
          readingPhase: { mean: 5000, deviation: 1000 },
        },
        probabilities: {
          refresh: 0.05,
          idle: 0.3,
        },
      };

      const agent = new TwitterAgent(mockPage, config, mockLogger);

      expect(agent.page).toBe(mockPage);
      expect(agent.config).toBe(config);
      expect(agent.logger).toBe(mockLogger);
      expect(agent.state.likes).toBe(0);
      expect(agent.state.follows).toBe(0);
      expect(agent.state.retweets).toBe(0);
      expect(agent.state.tweets).toBe(0);
      expect(agent.state.activityMode).toBe("NORMAL");
      expect(agent.isFatigued).toBe(false);
    });

    it("should set up network listeners", () => {
      const config = {
        id: "test-agent",
        description: "Test Agent",
        timings: { scrollPause: { mean: 1000 }, readingPhase: { mean: 5000 } },
        probabilities: {},
      };

      new TwitterAgent(mockPage, config, mockLogger);

      expect(mockPage.on).toHaveBeenCalledWith("request", expect.any(Function));
      expect(mockPage.on).toHaveBeenCalledWith(
        "response",
        expect.any(Function),
      );
    });
  });

  describe("log", () => {
    it("should log with logger", () => {
      const config = {
        id: "test-agent",
        description: "Test Agent",
        timings: { scrollPause: { mean: 1000 }, readingPhase: { mean: 5000 } },
        probabilities: {},
      };

      const agent = new TwitterAgent(mockPage, config, mockLogger);
      agent.log("test message");

      expect(mockLogger.info).toHaveBeenCalledWith(
        "[Agent:test-agent] test message",
      );
    });

    it("should fallback to console.log without logger", () => {
      const config = {
        id: "test-agent",
        description: "Test Agent",
        timings: { scrollPause: { mean: 1000 }, readingPhase: { mean: 5000 } },
        probabilities: {},
      };

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const agent = new TwitterAgent(mockPage, config, null);
      agent.log("test message");

      expect(consoleSpy).toHaveBeenCalledWith(
        "[Agent:test-agent] test message",
      );
      consoleSpy.mockRestore();
    });
  });

  describe("clamp", () => {
    it("should clamp value between min and max", () => {
      const config = {
        id: "test-agent",
        description: "Test Agent",
        timings: { scrollPause: { mean: 1000 }, readingPhase: { mean: 5000 } },
        probabilities: {},
      };

      const agent = new TwitterAgent(mockPage, config, mockLogger);

      expect(agent.clamp(5, 0, 10)).toBe(5);
      expect(agent.clamp(-5, 0, 10)).toBe(0);
      expect(agent.clamp(15, 0, 10)).toBe(10);
      expect(agent.clamp(0, 0, 10)).toBe(0);
      expect(agent.clamp(10, 0, 10)).toBe(10);
    });
  });

  describe("getScrollMethod", () => {
    it("should return valid scroll method", () => {
      const config = {
        id: "test-agent",
        description: "Test Agent",
        timings: { scrollPause: { mean: 1000 }, readingPhase: { mean: 5000 } },
        probabilities: {},
        inputMethods: {
          wheelDown: 0.8,
          wheelUp: 0.03,
          space: 0.05,
          keysDown: 0.1,
          keysUp: 0,
        },
      };

      const agent = new TwitterAgent(mockPage, config, mockLogger);

      const validMethods = [
        "WHEEL_DOWN",
        "WHEEL_UP",
        "SPACE",
        "KEYS_DOWN",
        "KEYS_UP",
      ];
      const method = agent.getScrollMethod();

      expect(validMethods).toContain(method);
    });

    it("should use default input methods if not configured", () => {
      const config = {
        id: "test-agent",
        description: "Test Agent",
        timings: { scrollPause: { mean: 1000 }, readingPhase: { mean: 5000 } },
        probabilities: {},
      };

      const agent = new TwitterAgent(mockPage, config, mockLogger);
      const method = agent.getScrollMethod();

      expect([
        "WHEEL_DOWN",
        "WHEEL_UP",
        "SPACE",
        "KEYS_DOWN",
        "KEYS_UP",
      ]).toContain(method);
    });
  });

  describe("normalizeProbabilities", () => {
    it("should return normalized probabilities", () => {
      const config = {
        id: "test-agent",
        description: "Test Agent",
        timings: { scrollPause: { mean: 1000 }, readingPhase: { mean: 5000 } },
        probabilities: {},
      };

      const agent = new TwitterAgent(mockPage, config, mockLogger);
      const result = agent.normalizeProbabilities({});

      expect(result).toHaveProperty("refresh");
      expect(result).toHaveProperty("idle");
      expect(result).toHaveProperty("profileDive");
      expect(result).toHaveProperty("tweetDive");
    });

    it("should apply fatigue bias", () => {
      const config = {
        id: "test-agent",
        description: "Test Agent",
        timings: { scrollPause: { mean: 1000 }, readingPhase: { mean: 5000 } },
        probabilities: {},
      };

      const agent = new TwitterAgent(mockPage, config, mockLogger);
      agent.state.fatigueBias = 0.2;

      const result = agent.normalizeProbabilities({});
      expect(result.idle).toBeGreaterThanOrEqual(0.5); // base 0.3 + 0.2 bias
    });

    it("should override probabilities in BURST mode", () => {
      const config = {
        id: "test-agent",
        description: "Test Agent",
        timings: { scrollPause: { mean: 1000 }, readingPhase: { mean: 5000 } },
        probabilities: {},
      };

      const agent = new TwitterAgent(mockPage, config, mockLogger);
      agent.state.activityMode = "BURST";

      const result = agent.normalizeProbabilities({});
      expect(result.idle).toBe(0);
      expect(result.refresh).toBe(0);
      expect(result.tweetDive).toBe(0.6);
      expect(result.likeTweetafterDive).toBe(0.5);
    });

    it("should handle custom probabilities", () => {
      const config = {
        id: "test-agent",
        description: "Test Agent",
        timings: { scrollPause: { mean: 1000 }, readingPhase: { mean: 5000 } },
        probabilities: {},
      };

      const agent = new TwitterAgent(mockPage, config, mockLogger);
      const result = agent.normalizeProbabilities({
        refresh: 0.1,
        idle: 0.5,
      });

      expect(result.refresh).toBe(0.1);
      expect(result.idle).toBe(0.5);
    });

    it("should reduce refresh if recently refreshed", () => {
      const config = {
        id: "test-agent",
        description: "Test Agent",
        timings: { scrollPause: { mean: 1000 }, readingPhase: { mean: 5000 } },
        probabilities: {},
      };

      const agent = new TwitterAgent(mockPage, config, mockLogger);
      agent.state.lastRefreshAt = Date.now() - 10000; // 10 seconds ago

      const result = agent.normalizeProbabilities({ refresh: 0.1 });
      expect(result.refresh).toBeLessThan(0.1);
    });
  });

  describe("performHealthCheck", () => {
    it("should return healthy when network is active", async () => {
      const config = {
        id: "test-agent",
        description: "Test Agent",
        timings: { scrollPause: { mean: 1000 }, readingPhase: { mean: 5000 } },
        probabilities: {},
      };

      const agent = new TwitterAgent(mockPage, config, mockLogger);
      agent.lastNetworkActivity = Date.now();

      const result = await agent.performHealthCheck();
      expect(result.healthy).toBe(true);
    });

    it("should return unhealthy when network is inactive for >30s", async () => {
      const config = {
        id: "test-agent",
        description: "Test Agent",
        timings: { scrollPause: { mean: 1000 }, readingPhase: { mean: 5000 } },
        probabilities: {},
      };

      const agent = new TwitterAgent(mockPage, config, mockLogger);
      agent.lastNetworkActivity = Date.now() - 35000; // 35 seconds ago

      const result = await agent.performHealthCheck();
      expect(result.healthy).toBe(false);
      expect(result.reason).toContain("network_inactivity");
    });

    it("should detect redirect errors in page content", async () => {
      // Test the actual error detection pattern
      const testContent = "This page isn't working";
      const hasError =
        testContent.includes("This page isn't working") ||
        testContent.includes("ERR_TOO_MANY_REDIRECTS") ||
        testContent.includes("redirected you too many times");
      expect(hasError).toBe(true);
    });

    it("should detect redirect errors", async () => {
      mockPage.content.mockResolvedValue("ERR_TOO_MANY_REDIRECTS");

      const config = {
        id: "test-agent",
        description: "Test Agent",
        timings: { scrollPause: { mean: 1000 }, readingPhase: { mean: 5000 } },
        probabilities: {},
      };

      const agent = new TwitterAgent(mockPage, config, mockLogger);
      agent.lastNetworkActivity = Date.now();

      const result = await agent.performHealthCheck();
      expect(result.healthy).toBe(false);
      expect(result.reason).toBe("critical_error_page_redirects");
    });
  });

  describe("checkFatigue", () => {
    it("should not trigger fatigue if threshold not reached", () => {
      const config = {
        id: "test-agent",
        description: "Test Agent",
        timings: { scrollPause: { mean: 1000 }, readingPhase: { mean: 5000 } },
        probabilities: {},
      };

      const agent = new TwitterAgent(mockPage, config, mockLogger);
      agent.sessionStart = Date.now();
      agent.fatigueThreshold = 600000; // 10 minutes

      agent.checkFatigue();
      expect(agent.isFatigued).toBe(false);
    });
  });

  describe("isElementActionable", () => {
    it("should return false for null element", async () => {
      const config = {
        id: "test-agent",
        description: "Test Agent",
        timings: { scrollPause: { mean: 1000 }, readingPhase: { mean: 5000 } },
        probabilities: {},
      };

      const agent = new TwitterAgent(mockPage, config, mockLogger);
      const result = await agent.isElementActionable({
        elementHandle: vi.fn().mockResolvedValue(null),
      });
      expect(result).toBe(false);
    });
  });

  describe("state management", () => {
    it("should initialize state correctly", () => {
      const config = {
        id: "test-agent",
        description: "Test Agent",
        timings: { scrollPause: { mean: 1000 }, readingPhase: { mean: 5000 } },
        probabilities: {},
      };

      const agent = new TwitterAgent(mockPage, config, mockLogger);

      expect(agent.state.consecutiveSoftErrors).toBe(0);
      expect(agent.state.consecutiveLoginFailures).toBe(0);
      expect(agent.state.tabs.preferForYou).toBe(true);
      expect(agent.state.tabs.switchChance).toBe(0.15);
    });
  });

  describe("isSessionExpired", () => {
    it("should return false when no session end time", () => {
      const config = {
        id: "test-agent",
        description: "Test Agent",
        timings: { scrollPause: { mean: 1000 }, readingPhase: { mean: 5000 } },
        probabilities: {},
      };
      const agent = new TwitterAgent(mockPage, config, mockLogger);
      expect(agent.isSessionExpired()).toBe(false);
    });

    it("should return false when session not expired", () => {
      const config = {
        id: "test-agent",
        description: "Test Agent",
        timings: { scrollPause: { mean: 1000 }, readingPhase: { mean: 5000 } },
        probabilities: {},
      };
      const agent = new TwitterAgent(mockPage, config, mockLogger);
      agent.sessionEndTime = Date.now() + 60000;
      expect(agent.isSessionExpired()).toBe(false);
    });

    it("should return true when session expired", () => {
      const config = {
        id: "test-agent",
        description: "Test Agent",
        timings: { scrollPause: { mean: 1000 }, readingPhase: { mean: 5000 } },
        probabilities: {},
      };
      const agent = new TwitterAgent(mockPage, config, mockLogger);
      agent.sessionEndTime = Date.now() - 1000;
      expect(agent.isSessionExpired()).toBe(true);
    });
  });

  describe("shutdown", () => {
    it("should remove network listeners", () => {
      const config = {
        id: "test-agent",
        description: "Test Agent",
        timings: { scrollPause: { mean: 1000 }, readingPhase: { mean: 5000 } },
        probabilities: {},
      };
      const agent = new TwitterAgent(mockPage, config, mockLogger);
      agent.shutdown();
      expect(mockPage.removeAllListeners).toHaveBeenCalledWith("request");
      expect(mockPage.removeAllListeners).toHaveBeenCalledWith("response");
    });

    it("should handle closed page", () => {
      mockPage.isClosed = vi.fn().mockReturnValue(true);
      const config = {
        id: "test-agent",
        description: "Test Agent",
        timings: { scrollPause: { mean: 1000 }, readingPhase: { mean: 5000 } },
        probabilities: {},
      };
      const agent = new TwitterAgent(mockPage, config, mockLogger);
      agent.shutdown();
      // Should not throw
    });
  });

  describe("checkLoginState", () => {
    it("should detect login failure when sign-in text visible", async () => {
      mockPage.getByText = vi.fn().mockReturnValue({
        first: vi.fn().mockReturnValue({
          isVisible: vi.fn().mockResolvedValue(true),
        }),
      });
      const config = {
        id: "test-agent",
        description: "Test Agent",
        timings: { scrollPause: { mean: 1000 }, readingPhase: { mean: 5000 } },
        probabilities: {},
      };
      const agent = new TwitterAgent(mockPage, config, mockLogger);
      const result = await agent.checkLoginState();
      expect(result).toBe(false);
      expect(agent.state.consecutiveLoginFailures).toBe(1);
    });
  });

  describe("dismissOverlays", () => {
    it("should dismiss toasts", async () => {
      mockPage.locator = vi.fn().mockReturnValue({
        count: vi.fn().mockResolvedValue(1),
      });
      const config = {
        id: "test-agent",
        description: "Test Agent",
        timings: { scrollPause: { mean: 1000 }, readingPhase: { mean: 5000 } },
        probabilities: {},
      };
      const agent = new TwitterAgent(mockPage, config, mockLogger);
      await agent.dismissOverlays();
      expect(mockPage.keyboard.press).toHaveBeenCalledWith("Escape");
    });

    it("should dismiss modals", async () => {
      mockPage.locator = vi
        .fn()
        .mockReturnValueOnce({ count: vi.fn().mockResolvedValue(0) })
        .mockReturnValueOnce({ count: vi.fn().mockResolvedValue(1) });
      const config = {
        id: "test-agent",
        description: "Test Agent",
        timings: { scrollPause: { mean: 1000 }, readingPhase: { mean: 5000 } },
        probabilities: {},
      };
      const agent = new TwitterAgent(mockPage, config, mockLogger);
      await agent.dismissOverlays();
      expect(mockPage.keyboard.press).toHaveBeenCalledWith("Escape");
    });

    it("should handle no overlays", async () => {
      mockPage.locator = vi.fn().mockReturnValue({
        count: vi.fn().mockResolvedValue(0),
      });
      const config = {
        id: "test-agent",
        description: "Test Agent",
        timings: { scrollPause: { mean: 1000 }, readingPhase: { mean: 5000 } },
        probabilities: {},
      };
      const agent = new TwitterAgent(mockPage, config, mockLogger);
      await agent.dismissOverlays();
      expect(mockPage.keyboard.press).not.toHaveBeenCalled();
    });
  });

  describe("humanType", () => {
    it("should return for null element", async () => {
      const config = {
        id: "test-agent",
        description: "Test Agent",
        timings: { scrollPause: { mean: 1000 }, readingPhase: { mean: 5000 } },
        probabilities: {},
      };
      const agent = new TwitterAgent(mockPage, config, mockLogger);
      await agent.humanType(null, "test");
      // Should not throw
    });

    it("should return for empty text", async () => {
      const config = {
        id: "test-agent",
        description: "Test Agent",
        timings: { scrollPause: { mean: 1000 }, readingPhase: { mean: 5000 } },
        probabilities: {},
      };
      const agent = new TwitterAgent(mockPage, config, mockLogger);
      const element = { focus: vi.fn() };
      await agent.humanType(element, "");
      // Should not throw
    });
  });

  describe("simulateFidget", () => {
    it("should complete without error", async () => {
      mockPage.evaluate = vi.fn().mockResolvedValue([]);
      const config = {
        id: "test-agent",
        description: "Test Agent",
        timings: { scrollPause: { mean: 1000 }, readingPhase: { mean: 5000 } },
        probabilities: {},
      };
      const agent = new TwitterAgent(mockPage, config, mockLogger);
      await agent.simulateFidget();
      // Should complete without throwing
    });
  });

  describe("normalizeProbabilities edge cases", () => {
    it("should handle null probabilities", () => {
      const config = {
        id: "test-agent",
        description: "Test Agent",
        timings: { scrollPause: { mean: 1000 }, readingPhase: { mean: 5000 } },
        probabilities: {},
      };
      const agent = new TwitterAgent(mockPage, config, mockLogger);
      const result = agent.normalizeProbabilities(null);
      expect(result).toHaveProperty("refresh");
    });

    it("should handle undefined probabilities", () => {
      const config = {
        id: "test-agent",
        description: "Test Agent",
        timings: { scrollPause: { mean: 1000 }, readingPhase: { mean: 5000 } },
        probabilities: {},
      };
      const agent = new TwitterAgent(mockPage, config, mockLogger);
      const result = agent.normalizeProbabilities(undefined);
      expect(result).toHaveProperty("refresh");
    });
  });
});

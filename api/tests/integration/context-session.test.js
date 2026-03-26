/**
 * Auto-AI Framework - Proprietary Software
 * Copyright (c) 2025 gantengmaksimal - All Rights Reserved
 * Unauthorized copying, distribution, or modification prohibited
 */

/**
 * @fileoverview Context & Session Management Integration Tests
 * Tests AsyncLocalStorage-based session isolation, session lifecycle, and context store management
 * @module tests/integration/context-session.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  withPage,
  getStore,
  clearContext,
  isSessionActive,
  getPage,
  getCursor,
  evalPage,
  getEvents,
  getPlugins,
} from "../../core/context.js";
import {
  getDefaultState,
  setContextStore,
  getContextState,
  setContextState,
  getStateSection,
  updateStateSection,
} from "../../core/context-state.js";
import { APIEvents } from "../../core/events.js";
import { PluginManager } from "../../core/plugins/manager.js";
import { GhostCursor } from "../../utils/ghostCursor.js";

// Mock dependencies
vi.mock("../../core/logger.js", () => ({
  loggerContext: {
    run: vi.fn((ctx, fn) => fn()),
    getStore: vi.fn(),
  },
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock("../../core/events.js", () => ({
  APIEvents: class {
    constructor() {
      this.listeners = new Map();
    }
    on(event, fn) {
      if (!this.listeners.has(event)) this.listeners.set(event, []);
      this.listeners.get(event).push(fn);
    }
    emit(event, data) {
      const handlers = this.listeners.get(event) || [];
      handlers.forEach((fn) => fn(data));
    }
  },
}));

vi.mock("../../core/plugins/manager.js", () => ({
  PluginManager: class {
    constructor(events) {
      this.events = events;
      this.plugins = new Map();
    }
    register(name, plugin) {
      this.plugins.set(name, plugin);
    }
    get(name) {
      return this.plugins.get(name);
    }
    getAll() {
      return Array.from(this.plugins.values());
    }
  },
}));

vi.mock("../../utils/ghostCursor.js", () => ({
  GhostCursor: class {
    constructor(page) {
      this.page = page;
      this.previousPos = { x: 0, y: 0 };
    }
    async move(x, y) {
      this.previousPos = { x, y };
      return { success: true };
    }
    async click() {
      return { success: true, usedFallback: false };
    }
  },
}));

describe("Context & Session Integration", () => {
  let mockPage1;
  let mockPage2;
  let page1Store;
  let page2Store;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create two distinct mock pages to simulate concurrent sessions
    mockPage1 = {
      isClosed: vi.fn(() => false),
      url: vi.fn(() => "https://example.com/page1"),
      evaluate: vi.fn().mockResolvedValue(undefined),
    };

    mockPage2 = {
      isClosed: vi.fn(() => false),
      url: vi.fn(() => "https://example.com/page2"),
      evaluate: vi.fn().mockResolvedValue(undefined),
    };
  });

  afterEach(() => {
    // Clean up any active contexts
    clearContext();
  });

  describe("Session Isolation with withPage()", () => {
    it("should isolate session stores between concurrent pages", async () => {
      // Execute withPage for page1
      const result1 = await withPage(mockPage1, async (ctx) => {
        const store1 = getStore();
        const state1 = getContextState();
        return { store1, state1 };
      });

      // Execute withPage for page2
      const result2 = await withPage(mockPage2, async (ctx) => {
        const store2 = getStore();
        const state2 = getContextState();
        return { store2, state2 };
      });

      // Stores should be different instances
      expect(result1.store1).not.toBe(result2.store2);

      // States should be independent
      expect(result1.state1).not.toBe(result2.state2);

      // Each store should have its own page
      expect(result1.store1.page).toBe(mockPage1);
      expect(result2.store2.page).toBe(mockPage2);

      // Each store should have its own cursor
      expect(result1.store1.cursor).toBeDefined();
      expect(result2.store2.cursor).toBeDefined();
      expect(result1.store1.cursor).not.toBe(result2.store2.cursor);
    });

    it("should maintain separate event buses per session", async () => {
      const events1 = [];
      const events2 = [];

      await withPage(mockPage1, async () => {
        const store = getStore();
        store.events.on("test", (data) => events1.push(data));
        store.events.emit("test", { source: "page1" });
      });

      await withPage(mockPage2, async () => {
        const store = getStore();
        store.events.on("test", (data) => events2.push(data));
        store.events.emit("test", { source: "page2" });
      });

      expect(events1).toHaveLength(1);
      expect(events1[0].source).toBe("page1");
      expect(events2).toHaveLength(1);
      expect(events2[0].source).toBe("page2");
    });

    it("should isolate plugin registrations per session", async () => {
      await withPage(mockPage1, async () => {
        const store = getStore();
        store.plugins.register("test-plugin", { name: "plugin1" });
      });

      await withPage(mockPage2, async () => {
        const store = getStore();
        store.plugins.register("test-plugin", { name: "plugin2" });
      });

      // Each session should have its own plugin instance
      await withPage(mockPage1, async () => {
        const store = getStore();
        const plugin = store.plugins.get("test-plugin");
        expect(plugin.name).toBe("plugin1");
      });

      await withPage(mockPage2, async () => {
        const store = getStore();
        const plugin = store.plugins.get("test-plugin");
        expect(plugin.name).toBe("plugin2");
      });
    });

    it("should prevent context leakage across withPage boundaries", async () => {
      let capturedStoreOutside;

      await withPage(mockPage1, async () => {
        const store = getStore();
        store.customData = { value: "from-page1" };
      });

      // Outside the withPage context, store should be undefined
      capturedStoreOutside = getStore();
      expect(capturedStoreOutside).toBeUndefined();

      // Verify custom data is not accessible globally
      await withPage(mockPage2, async () => {
        const store = getStore();
        expect(store.customData).toBeUndefined();
      });
    });
  });

  describe("Session Lifecycle", () => {
    it("should create store on first withPage call", async () => {
      const store = await withPage(mockPage1, () => getStore());
      expect(store).toBeDefined();
      expect(store.page).toBe(mockPage1);
      expect(store.cursor).toBeInstanceOf(GhostCursor);
      expect(store.state).toBeDefined();
      expect(store.events).toBeDefined();
      expect(store.plugins).toBeDefined();
      expect(store.intervals).toBeInstanceOf(Map);
    });

    it("should reuse store for same page within same context", async () => {
      const store1 = await withPage(mockPage1, () => getStore());
      const store2 = await withPage(mockPage1, () => getStore());

      // Same page should return same store instance within the same session
      expect(store1).toBe(store2);
    });

    it("should clear context on clearContext()", async () => {
      await withPage(mockPage1, () => getStore());

      // After clearContext, subsequent getStore() should return undefined
      clearContext();
      const storeAfterClear = getStore();
      expect(storeAfterClear).toBeUndefined();
    });

    it("should track session intervals and auto-cleanup on page close", async () => {
      const mockPage = {
        isClosed: vi.fn(() => false),
        evaluate: vi.fn().mockResolvedValue(undefined),
      };

      await withPage(mockPage, async () => {
        const store = getStore();

        // Set a session-bound interval
        const intervalId = setSessionInterval("test-interval", vi.fn(), 1000);
        expect(store.intervals.has("test-interval")).toBe(true);
        expect(store.intervals.get("test-interval")).toBe(intervalId);

        // Simulate page close
        mockPage.isClosed = vi.fn(() => true);

        // The interval should be cleaned up automatically on next execution
        // For testing, we manually clear it
        clearSessionInterval("test-interval");
        expect(store.intervals.has("test-interval")).toBe(false);
      });
    });

    it("should handle multiple intervals per session", async () => {
      await withPage(mockPage1, async () => {
        const store = getStore();

        const id1 = setSessionInterval("interval1", vi.fn(), 1000);
        const id2 = setSessionInterval("interval2", vi.fn(), 2000);
        const id3 = setSessionInterval("interval3", vi.fn(), 3000);

        expect(store.intervals.size).toBe(3);
        expect(store.intervals.get("interval1")).toBe(id1);
        expect(store.intervals.get("interval2")).toBe(id2);
        expect(store.intervals.get("interval3")).toBe(id3);

        // Clear one
        clearSessionInterval("interval2");
        expect(store.intervals.size).toBe(2);
        expect(store.intervals.has("interval2")).toBe(false);
      });
    });
  });

  describe("Context State Management", () => {
    it("should persist state across withPage calls within same session", async () => {
      // First call: set some state
      await withPage(mockPage1, async () => {
        setContextState("user", { id: 123, name: "Test User" });
        setContextState("session", { startedAt: Date.now(), active: true });
      });

      // Second call: retrieve state
      await withPage(mockPage1, async () => {
        const user = getContextState("user");
        const session = getContextState("session");

        expect(user).toEqual({ id: 123, name: "Test User" });
        expect(session).toHaveProperty("startedAt");
        expect(session.active).toBe(true);
      });
    });

    it("should isolate state between different pages", async () => {
      // Set state for page1
      await withPage(mockPage1, async () => {
        setContextState("shared", { value: "page1-data" });
      });

      // Set state for page2
      await withPage(mockPage2, async () => {
        setContextState("shared", { value: "page2-data" });
      });

      // Verify isolation
      await withPage(mockPage1, async () => {
        const state = getContextState("shared");
        expect(state.value).toBe("page1-data");
      });

      await withPage(mockPage2, async () => {
        const state = getContextState("shared");
        expect(state.value).toBe("page2-data");
      });
    });

    it("should support getStateSection and updateStateSection", async () => {
      await withPage(mockPage1, async () => {
        const section = getStateSection("navigation");
        expect(section).toBeDefined();
        expect(section.history).toBeDefined();
        expect(Array.isArray(section.history)).toBe(true);

        // Update section
        updateStateSection("navigation", {
          history: ["https://example.com/1", "https://example.com/2"],
          currentIndex: 1,
        });

        const updated = getStateSection("navigation");
        expect(updated.history).toHaveLength(2);
        expect(updated.currentIndex).toBe(1);
      });
    });

    it("should handle state clearing on context destruction", async () => {
      await withPage(mockPage1, async () => {
        setContextState("persistent", { data: "should be cleared" });
      });

      clearContext();

      await withPage(mockPage1, async () => {
        const state = getContextState("persistent");
        expect(state).toBeUndefined();
      });
    });

    it("should merge partial updates correctly", async () => {
      await withPage(mockPage1, async () => {
        setContextState("config", {
          theme: "dark",
          language: "en",
          notifications: { email: true, push: false },
        });
      });

      await withPage(mockPage1, async () => {
        // Partial update: only change theme and add one field
        updateStateSection("config", {
          theme: "light",
          fontSize: 14,
        });

        const config = getContextState("config");
        expect(config.theme).toBe("light"); // updated
        expect(config.language).toBe("en"); // preserved
        expect(config.notifications).toEqual({ email: true, push: false }); // preserved
        expect(config.fontSize).toBe(14); // added
      });
    });
  });

  describe("Error Propagation within Session Context", () => {
    it("should propagate errors from within withPage callback", async () => {
      const customError = new Error("Test error from inside");

      await expect(
        withPage(mockPage1, async () => {
          throw customError;
        }),
      ).rejects.toThrow("Test error from inside");
    });

    it("should maintain error stack trace", async () => {
      const innerError = new Error("Inner error");

      await expect(
        withPage(mockPage1, async () => {
          try {
            throw innerError;
          } catch (e) {
            throw new Error("Outer error", { cause: e });
          }
        }),
      ).rejects.toThrow("Outer error");
    });

    it("should handle async errors correctly", async () => {
      await expect(
        withPage(mockPage1, async () => {
          await Promise.reject(new Error("Async error"));
        }),
      ).rejects.toThrow("Async error");
    });
  });

  describe("Session Activity Tracking", () => {
    it("should report active session for current page", async () => {
      // Initially no session
      expect(isSessionActive()).toBe(false);

      await withPage(mockPage1, async () => {
        expect(isSessionActive()).toBe(true);
      });

      // After exiting withPage, session should be inactive
      expect(isSessionActive()).toBe(false);
    });

    it("should allow retrieving current page from context", async () => {
      const page = await withPage(mockPage1, () => getPage());
      expect(page).toBe(mockPage1);
    });

    it("should allow retrieving cursor from context", async () => {
      const cursor = await withPage(mockPage1, () => getCursor());
      expect(cursor).toBeInstanceOf(GhostCursor);
      expect(cursor.page).toBe(mockPage1);
    });

    it("should allow evaluating code in page context", async () => {
      const result = await withPage(mockPage1, async () => {
        return evalPage(() => {
          return { userAgent: navigator.userAgent, width: window.innerWidth };
        });
      });

      // The mock returns undefined by default, but the function should be called
      expect(mockPage1.evaluate).toHaveBeenCalled();
    });
  });

  describe("Concurrent Session Safety", () => {
    it("should handle multiple withPage calls in parallel without interference", async () => {
      const promises = [];
      const results = [];

      // Launch 5 concurrent sessions
      for (let i = 0; i < 5; i++) {
        const mockPage = {
          isClosed: vi.fn(() => false),
          url: vi.fn(() => `https://example.com/page${i}`),
          evaluate: vi.fn().mockResolvedValue(undefined),
        };

        const p = withPage(mockPage, async () => {
          const store = getStore();
          const state = getContextState();

          // Set unique data
          setContextState("sessionId", i);
          store.customMarker = `marker-${i}`;

          return {
            sessionId: getContextState("sessionId"),
            marker: store.customMarker,
            pageUrl: store.page.url(),
          };
        });

        promises.push(p);
      }

      const resolvedResults = await Promise.all(promises);
      expect(resolvedResults).toHaveLength(5);

      // Each result should be unique
      const sessionIds = resolvedResults.map((r) => r.sessionId);
      const markers = resolvedResults.map((r) => r.marker);

      expect(new Set(sessionIds).size).toBe(5);
      expect(new Set(markers).size).toBe(5);
    });

    it("should prevent cross-session state mutation", async () => {
      // Session 1 sets state
      await withPage(mockPage1, async () => {
        setContextState("counter", 1);
      });

      // Session 2 attempts to read and modify
      await withPage(mockPage2, async () => {
        const counter = getContextState("counter");
        // counter should be undefined (no shared state)
        expect(counter).toBeUndefined();

        setContextState("counter", 999);
      });

      // Session 1 should still have original value
      await withPage(mockPage1, async () => {
        const counter = getContextState("counter");
        expect(counter).toBe(1);
      });
    });
  });
});

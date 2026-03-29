/**
 * Auto-AI Framework - Proprietary Software
 * Copyright (c) 2025 gantengmaksimal - All Rights Reserved
 */

/**
 * @fileoverview Unit tests for session isolation components
 * @module tests/unit/session-isolation.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@api/core/logger.js", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import LockManager from "@api/core/lock-manager.js";
import IntervalManager from "@api/core/interval-manager.js";
import SessionState from "@api/core/session-state.js";

describe("LockManager", () => {
  let lockManager;

  beforeEach(() => {
    lockManager = new LockManager();
  });

  afterEach(async () => {
    await lockManager.releaseAll();
  });

  describe("acquire", () => {
    it("should acquire and release lock", async () => {
      const lock = await lockManager.acquire("test-key");
      expect(lockManager.isLocked("test-key")).toBe(true);

      await lock.release();
      expect(lockManager.isLocked("test-key")).toBe(false);
    });

    it("should queue multiple acquires", async () => {
      const lock1 = await lockManager.acquire("resource");
      const lock2Promise = lockManager.acquire("resource");

      expect(lockManager.isLocked("resource")).toBe(true);

      await lock1.release();
      const lock2 = await lock2Promise;
      expect(lockManager.isLocked("resource")).toBe(true);

      await lock2.release();
    });
  });

  describe("releaseAll", () => {
    it("should release all locks", async () => {
      await lockManager.acquire("key1");
      await lockManager.acquire("key2");
      await lockManager.acquire("key3");

      await lockManager.releaseAll();

      expect(lockManager.isLocked("key1")).toBe(false);
      expect(lockManager.isLocked("key2")).toBe(false);
      expect(lockManager.isLocked("key3")).toBe(false);
    });
  });
});

describe("IntervalManager", () => {
  let intervalManager;

  beforeEach(() => {
    intervalManager = new IntervalManager();
  });

  describe("set/clear", () => {
    it("should set and clear intervals", () => {
      const fn = vi.fn();
      intervalManager.set("test-interval", fn, 10);

      expect(intervalManager.has("test-interval")).toBe(true);
      expect(intervalManager.size()).toBe(1);

      intervalManager.clear("test-interval");
      expect(intervalManager.has("test-interval")).toBe(false);
    });

    it("should clear all intervals", () => {
      intervalManager.set("interval1", () => {}, 100);
      intervalManager.set("interval2", () => {}, 100);
      intervalManager.set("interval3", () => {}, 100);

      expect(intervalManager.size()).toBe(3);

      intervalManager.clearAll();
      expect(intervalManager.size()).toBe(0);
    });
  });

  describe("keys", () => {
    it("should return all interval keys", () => {
      intervalManager.set("interval1", () => {}, 100);
      intervalManager.set("interval2", () => {}, 100);

      const keys = intervalManager.keys();
      expect(keys).toContain("interval1");
      expect(keys).toContain("interval2");
    });
  });
});

describe("SessionState", () => {
  let sessionState;

  beforeEach(() => {
    sessionState = new SessionState();
  });

  describe("get/set", () => {
    it("should store and retrieve values", () => {
      sessionState.set("name", "test-session");
      expect(sessionState.get("name")).toBe("test-session");
    });

    it("should return undefined for non-existent keys", () => {
      expect(sessionState.get("nonexistent")).toBeUndefined();
    });

    it("should clone objects to prevent mutation", () => {
      const obj = { nested: { value: 1 } };
      sessionState.set("data", obj);

      const retrieved = sessionState.get("data");
      retrieved.nested.value = 2;

      expect(sessionState.get("data").nested.value).toBe(1);
    });
  });

  describe("has/delete", () => {
    it("should check key existence", () => {
      sessionState.set("key", "value");
      expect(sessionState.has("key")).toBe(true);
      expect(sessionState.has("nonexistent")).toBe(false);
    });

    it("should delete keys", () => {
      sessionState.set("key", "value");
      sessionState.delete("key");
      expect(sessionState.has("key")).toBe(false);
    });
  });

  describe("freeze", () => {
    it("should prevent modifications when frozen", () => {
      sessionState.set("key", "value");
      sessionState.freeze();

      expect(sessionState.isFrozen()).toBe(true);
      expect(() => sessionState.set("key", "new")).toThrow("frozen");
      expect(() => sessionState.delete("key")).toThrow("frozen");
      expect(() => sessionState.clear()).toThrow("frozen");
    });

    it("should throw when accessing frozen state", () => {
      sessionState.set("key", "value");
      sessionState.freeze();

      expect(() => sessionState.get("key")).toThrow("frozen");
    });
  });

  describe("toJSON", () => {
    it("should export state as plain object", () => {
      sessionState.set("name", "test");
      sessionState.set("count", 42);

      const json = sessionState.toJSON();
      expect(json).toEqual({ name: "test", count: 42 });
    });
  });
});

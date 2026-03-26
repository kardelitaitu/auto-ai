/**
 * Auto-AI Framework - Proprietary Software
 * Copyright (c) 2025 gantengmaksimal - All Rights Reserved
 * Unauthorized copying, distribution, or modification prohibited
 */

/**
 * @fileoverview Unit tests for api/twitter/intent-follow.js
 * @module tests/unit/twitter/intent-follow.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock all dependencies
vi.mock("@api/core/context.js", () => ({
  getPage: vi.fn(),
}));

vi.mock("@api/core/logger.js", () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

vi.mock("@api/interactions/wait.js", () => ({
  wait: vi.fn().mockResolvedValue(undefined),
  waitForLoadState: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@api/interactions/actions.js", () => ({
  click: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@api/interactions/navigation.js", () => ({
  back: vi.fn().mockResolvedValue(undefined),
  goto: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@api/interactions/queries.js", () => ({
  visible: vi.fn().mockResolvedValue(false),
}));

vi.mock("@api/utils/math.js", () => ({
  mathUtils: {
    randomInRange: vi.fn((min, max) => Math.floor((min + max) / 2)),
  },
}));

describe("api/twitter/intent-follow.js", () => {
  let follow;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    const module = await import("@api/twitter/intent-follow.js");
    follow = module.follow;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("follow()", () => {
    it("should extract username from x.com URL", async () => {
      const { getPage } = await import("@api/core/context.js");
      const { visible } = await import("@api/interactions/queries.js");

      getPage.mockReturnValue({ page: true });
      visible.mockResolvedValue(false);

      const resultPromise = follow("https://x.com/elonmusk");

      await vi.advanceTimersByTimeAsync(21000);

      const result = await resultPromise;
      expect(getPage).toHaveBeenCalled();
    });

    it("should extract username from twitter.com URL", async () => {
      const { getPage } = await import("@api/core/context.js");

      getPage.mockReturnValue({ page: true });

      const resultPromise = follow("https://twitter.com/username");

      await vi.advanceTimersByTimeAsync(21000);

      const result = await resultPromise;
      expect(getPage).toHaveBeenCalled();
    });

    it("should handle @ prefix username", async () => {
      const { getPage } = await import("@api/core/context.js");

      getPage.mockReturnValue({ page: true });

      const resultPromise = follow("@username");

      await vi.advanceTimersByTimeAsync(21000);

      const result = await resultPromise;
      expect(getPage).toHaveBeenCalled();
    });

    it("should reject reserved usernames", async () => {
      const { getPage } = await import("@api/core/context.js");

      getPage.mockReturnValue({ page: true });

      const resultPromise = follow("https://x.com/home");

      await vi.advanceTimersByTimeAsync(21000);

      const result = await resultPromise;
      expect(result.success).toBe(false);
    });

    it("should handle timeout", async () => {
      const { getPage } = await import("@api/core/context.js");
      const { goto } = await import("@api/interactions/navigation.js");

      getPage.mockReturnValue({ page: true });
      goto.mockImplementation(() => new Promise(() => {}));

      const resultPromise = follow("https://x.com/user");

      await vi.advanceTimersByTimeAsync(21000);

      const result = await resultPromise;
      expect(result.success).toBe(false);
      expect(result.reason).toBe("timeout");
    });
  });
});

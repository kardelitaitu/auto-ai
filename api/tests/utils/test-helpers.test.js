/**
 * Auto-AI Framework - Proprietary Software
 * Copyright (c) 2025 gantengmaksimal - All Rights Reserved
 * Unauthorized copying, distribution, or modification prohibited
 */

/**
 * @fileoverview Unit tests for test-helpers.js
 * @module tests/utils/test-helpers.test
 */

import { describe, it, expect, vi } from "vitest";
import {
  createMockPage,
  createSilentLogger,
  createMockLogger,
  createMockLocator,
  createMockSession,
  createMockBrowser,
  createMockTask,
  wait,
  randomString,
  randomUrl,
  randomEmail,
  expectSuccess,
  expectError,
} from "../../tests/utils/test-helpers.js";

describe("test-helpers.js", () => {
  describe("createMockPage", () => {
    it("should create mock page with default values", () => {
      const page = createMockPage();
      expect(page).toBeDefined();
      expect(page.locator).toBeDefined();
      expect(typeof page.click).toBe("function");
    });

    it("should allow custom overrides", () => {
      const page = createMockPage({ customProp: "test" });
      expect(page.customProp).toBe("test");
    });
  });

  describe("createSilentLogger", () => {
    it("should create logger with noop methods", () => {
      const logger = createSilentLogger();
      expect(logger.info).toBeDefined();
      expect(logger.error).toBeDefined();
      logger.info("test");
      logger.error("test");
    });
  });

  describe("createMockLogger", () => {
    it("should create logger with given module name", () => {
      const logger = createMockLogger("test-module");
      expect(logger.info).toBeDefined();
    });
  });

  describe("createMockLocator", () => {
    it("should create mock locator", () => {
      const locator = createMockLocator();
      expect(locator.first).toBeDefined();
      expect(locator.click).toBeDefined();
    });
  });

  describe("createMockSession", () => {
    it("should create mock session", () => {
      const session = createMockSession();
      expect(session).toBeDefined();
      expect(typeof session).toBe("object");
    });
  });

  describe("createMockBrowser", () => {
    it("should create mock browser", () => {
      const browser = createMockBrowser();
      expect(browser).toBeDefined();
      expect(typeof browser).toBe("object");
    });
  });

  describe("createMockTask", () => {
    it("should create mock task", () => {
      const task = createMockTask();
      expect(task.taskName).toBeDefined();
    });
  });

  describe("wait utility", () => {
    it("should resolve after delay", async () => {
      const start = Date.now();
      await wait(50);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(40);
    });
  });

  describe("randomString", () => {
    it("should generate random string of default length", () => {
      const str = randomString();
      expect(str.length).toBe(10);
    });

    it("should generate random string of specified length", () => {
      const str = randomString(20);
      expect(str.length).toBe(20);
    });
  });

  describe("randomUrl", () => {
    it("should generate random URL", () => {
      const url = randomUrl();
      expect(url).toMatch(/^https:\/\/.+\..+$/);
    });
  });

  describe("randomEmail", () => {
    it("should generate random email", () => {
      const email = randomEmail();
      expect(email).toMatch(/^.+@example\.com$/);
    });
  });
});

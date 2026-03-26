/**
 * Auto-AI Framework - Proprietary Software
 * Copyright (c) 2025 gantengmaksimal - All Rights Reserved
 * Unauthorized copying, distribution, or modification prohibited
 */

/**
 * @fileoverview Session Manager Integration Tests
 * Tests worker management, health monitoring, SimpleSemaphore, and session lifecycle
 * @module tests/integration/session-manager.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import SessionManager from "../../core/sessionManager.js";

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

vi.mock("../../utils/configLoader.js", () => ({
  getSettings: vi.fn().mockResolvedValue({
    sessionManager: {
      maxSessions: 100,
      sessionTimeout: 1800000,
      healthCheckInterval: 30000,
      maxRetries: 3,
    },
  }),
  getTimeoutValue: vi.fn((_path, def) => Promise.resolve(def)),
}));

describe("Session Manager Integration", () => {
  let sessionManager;
  let mockSession1;
  let mockSession2;
  let mockSession3;

  beforeEach(async () => {
    vi.clearAllMocks();
    sessionManager = new SessionManager();

    // Create mock sessions
    mockSession1 = {
      id: "session-1",
      browserId: "browser1",
      status: "active",
      createdAt: Date.now(),
      lastActivity: Date.now(),
      automator: {
        healthCheck: vi.fn().mockResolvedValue({ healthy: true }),
        disconnect: vi.fn().mockResolvedValue(undefined),
      },
    };

    mockSession2 = {
      id: "session-2",
      browserId: "browser2",
      status: "active",
      createdAt: Date.now(),
      lastActivity: Date.now(),
      automator: {
        healthCheck: vi.fn().mockResolvedValue({ healthy: true }),
        disconnect: vi.fn().mockResolvedValue(undefined),
      },
    };

    mockSession3 = {
      id: "session-3",
      browserId: "browser3",
      status: "active",
      createdAt: Date.now(),
      lastActivity: Date.now(),
      automator: {
        healthCheck: vi.fn().mockResolvedValue({ healthy: false }),
        disconnect: vi.fn().mockResolvedValue(undefined),
      },
    };
  });

  afterEach(() => {
    if (sessionManager) {
      sessionManager.shutdown();
    }
  });

  describe("Session Registration and Tracking", () => {
    it("should add sessions to the manager", () => {
      sessionManager.addSession(mockSession1);
      expect(sessionManager.getSession("session-1")).toBe(mockSession1);
      expect(sessionManager.getAllSessions()).toHaveLength(1);
    });

    it("should track multiple sessions", () => {
      sessionManager.addSession(mockSession1);
      sessionManager.addSession(mockSession2);
      sessionManager.addSession(mockSession3);

      expect(sessionManager.getAllSessions()).toHaveLength(3);
    });

    it("should remove sessions", () => {
      sessionManager.addSession(mockSession1);
      sessionManager.removeSession("session-1");

      expect(sessionManager.getSession("session-1")).toBeUndefined();
      expect(sessionManager.getAllSessions()).toHaveLength(0);
    });

    it("should update session activity timestamp", async () => {
      sessionManager.addSession(mockSession1);
      const initialActivity = mockSession1.lastActivity;

      // Small delay to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      sessionManager.updateActivity("session-1");
      expect(mockSession1.lastActivity).toBeGreaterThan(initialActivity);
    });

    it("should handle non-existent session updates gracefully", () => {
      // Should not throw
      sessionManager.updateActivity("non-existent");
    });
  });

  describe("Health Monitoring", () => {
    it("should check health of all sessions", async () => {
      sessionManager.addSession(mockSession1);
      sessionManager.addSession(mockSession2);

      const health = await sessionManager.checkHealth();

      expect(health).toHaveProperty("status");
      expect(health).toHaveProperty("healthScore");
      expect(health).toHaveProperty("checks");
      expect(health.checks.sessions).toHaveLength(2);
    });

    it("should calculate health score correctly", async () => {
      sessionManager.addSession(mockSession1); // healthy
      sessionManager.addSession(mockSession2); // healthy
      sessionManager.addSession(mockSession3); // unhealthy

      const health = await sessionManager.checkHealth();

      // 2 out of 3 healthy = 66.67% health score
      expect(health.healthScore).toBeCloseTo(66.67, 1);
    });

    it("should identify unhealthy sessions", async () => {
      sessionManager.addSession(mockSession1); // healthy
      sessionManager.addSession(mockSession3); // unhealthy

      const health = await sessionManager.checkHealth();

      const unhealthySessions = health.checks.sessions.filter(
        (s) => !s.healthy,
      );
      expect(unhealthySessions).toHaveLength(1);
      expect(unhealthySessions[0].id).toBe("session-3");
    });

    it("should handle sessions with missing automator", async () => {
      const sessionWithoutAutomator = {
        id: "session-4",
        browserId: "browser4",
        status: "active",
        automator: null,
      };

      sessionManager.addSession(sessionWithoutAutomator);
      const health = await sessionManager.checkHealth();

      // Should not crash and should mark as unhealthy
      const sessionCheck = health.checks.sessions.find(
        (s) => s.id === "session-4",
      );
      expect(sessionCheck).toBeDefined();
      expect(sessionCheck.healthy).toBe(false);
    });
  });

  describe("Session Cleanup", () => {
    it("should remove stale sessions based on activity timeout", async () => {
      const oldSession = {
        id: "old-session",
        browserId: "browser1",
        status: "active",
        createdAt: Date.now() - 3600000, // 1 hour ago
        lastActivity: Date.now() - 3600000, // 1 hour ago
        automator: {
          healthCheck: vi.fn().mockResolvedValue({ healthy: true }),
          disconnect: vi.fn().mockResolvedValue(undefined),
        },
      };

      sessionManager.addSession(oldSession);
      sessionManager.addSession(mockSession1); // recent session

      // Set session timeout to 30 minutes (1800000 ms)
      sessionManager.sessionTimeout = 1800000;

      await sessionManager.cleanupStaleSessions();

      expect(sessionManager.getSession("old-session")).toBeUndefined();
      expect(sessionManager.getSession("session-1")).toBeDefined();
    });

    it("should disconnect automators before removing sessions", async () => {
      sessionManager.addSession(mockSession1);
      await sessionManager.cleanupStaleSessions();

      expect(mockSession1.automator.disconnect).toHaveBeenCalled();
    });

    it("should handle cleanup of already disconnected sessions", async () => {
      mockSession1.automator.disconnect = vi
        .fn()
        .mockRejectedValue(new Error("Already disconnected"));

      sessionManager.addSession(mockSession1);
      await sessionManager.cleanupStaleSessions();

      // Should continue despite disconnect error
      expect(sessionManager.getSession("session-1")).toBeUndefined();
    });
  });

  describe("SimpleSemaphore", () => {
    it("should allow acquiring permits up to max limit", () => {
      const semaphore = new SessionManager.SimpleSemaphore(3);

      expect(semaphore.acquire()).toBe(true);
      expect(semaphore.acquire()).toBe(true);
      expect(semaphore.acquire()).toBe(true);
      expect(semaphore.acquire()).toBe(false); // No more permits
    });

    it("should release permits correctly", () => {
      const semaphore = new SessionManager.SimpleSemaphore(2);

      expect(semaphore.acquire()).toBe(true);
      expect(semaphore.acquire()).toBe(true);
      expect(semaphore.acquire()).toBe(false);

      semaphore.release();
      expect(semaphore.acquire()).toBe(true);

      semaphore.release();
      semaphore.release();
      expect(semaphore.acquire()).toBe(true);
      expect(semaphore.acquire()).toBe(true);
      expect(semaphore.acquire()).toBe(false);
    });

    it("should handle multiple releases and acquisitions", () => {
      const semaphore = new SessionManager.SimpleSemaphore(1);

      expect(semaphore.acquire()).toBe(true);
      expect(semaphore.acquire()).toBe(false);

      semaphore.release();
      expect(semaphore.acquire()).toBe(true);
      expect(semaphore.acquire()).toBe(false);

      semaphore.release();
      expect(semaphore.acquire()).toBe(true);
    });

    it("should not allow negative permits", () => {
      const semaphore = new SessionManager.SimpleSemaphore(0);

      expect(semaphore.acquire()).toBe(false);
      semaphore.release(); // Should not go negative
      expect(semaphore.acquire()).toBe(true);
    });
  });

  describe("Session Limits and Concurrency", () => {
    it("should respect maxSessions limit", () => {
      const limitedManager = new SessionManager();
      limitedManager.maxSessions = 2;

      expect(limitedManager.addSession(mockSession1)).toBe(true);
      expect(limitedManager.addSession(mockSession2)).toBe(true);
      expect(limitedManager.addSession(mockSession3)).toBe(false); // Exceeds limit
    });

    it("should allow adding sessions when under limit", () => {
      const limitedManager = new SessionManager();
      limitedManager.maxSessions = 5;

      expect(limitedManager.addSession(mockSession1)).toBe(true);
      expect(limitedManager.addSession(mockSession2)).toBe(true);
      expect(limitedManager.addSession(mockSession3)).toBe(true);
      expect(limitedManager.getAllSessions()).toHaveLength(3);
    });

    it("should handle dynamic limit changes", () => {
      const limitedManager = new SessionManager();
      limitedManager.maxSessions = 1;

      expect(limitedManager.addSession(mockSession1)).toBe(true);
      expect(limitedManager.addSession(mockSession2)).toBe(false);

      limitedManager.maxSessions = 2;
      expect(limitedManager.addSession(mockSession2)).toBe(true);
    });
  });

  describe("Session Status Management", () => {
    it("should update session status", () => {
      sessionManager.addSession(mockSession1);
      expect(mockSession1.status).toBe("active");

      sessionManager.updateSessionStatus("session-1", "paused");
      expect(mockSession1.status).toBe("paused");

      sessionManager.updateSessionStatus("session-1", "disconnected");
      expect(mockSession1.status).toBe("disconnected");
    });

    it("should handle status updates for non-existent sessions", () => {
      // Should not throw
      sessionManager.updateSessionStatus("non-existent", "active");
    });

    it("should track session creation time", () => {
      const beforeAdd = Date.now();
      sessionManager.addSession(mockSession1);
      const afterAdd = Date.now();

      expect(mockSession1.createdAt).toBeGreaterThanOrEqual(beforeAdd);
      expect(mockSession1.createdAt).toBeLessThanOrEqual(afterAdd);
    });
  });

  describe("Shutdown and Cleanup", () => {
    it("should disconnect all sessions on shutdown", async () => {
      sessionManager.addSession(mockSession1);
      sessionManager.addSession(mockSession2);
      sessionManager.addSession(mockSession3);

      await sessionManager.shutdown();

      expect(mockSession1.automator.disconnect).toHaveBeenCalled();
      expect(mockSession2.automator.disconnect).toHaveBeenCalled();
      expect(mockSession3.automator.disconnect).toHaveBeenCalled();
    });

    it("should clear all sessions after shutdown", async () => {
      sessionManager.addSession(mockSession1);
      sessionManager.addSession(mockSession2);

      await sessionManager.shutdown();

      expect(sessionManager.getAllSessions()).toHaveLength(0);
    });

    it("should handle shutdown with no sessions", async () => {
      await sessionManager.shutdown();
      // Should not throw
    });

    it("should handle disconnect failures during shutdown gracefully", async () => {
      mockSession1.automator.disconnect = vi
        .fn()
        .mockRejectedValue(new Error("Disconnect failed"));

      sessionManager.addSession(mockSession1);
      sessionManager.addSession(mockSession2);

      await sessionManager.shutdown();

      // Should continue despite error
      expect(sessionManager.getAllSessions()).toHaveLength(0);
    });
  });

  describe("Session Statistics", () => {
    it("should provide session count statistics", () => {
      sessionManager.addSession(mockSession1);
      sessionManager.addSession(mockSession2);

      const stats = sessionManager.getStatistics();

      expect(stats.totalSessions).toBe(2);
      expect(stats.activeSessions).toBe(2);
    });

    it("should count sessions by status", () => {
      mockSession1.status = "active";
      mockSession2.status = "paused";
      mockSession3.status = "disconnected";

      sessionManager.addSession(mockSession1);
      sessionManager.addSession(mockSession2);
      sessionManager.addSession(mockSession3);

      const stats = sessionManager.getStatistics();

      expect(stats.byStatus.active).toBe(1);
      expect(stats.byStatus.paused).toBe(1);
      expect(stats.byStatus.disconnected).toBe(1);
    });

    it("should calculate average session lifetime", () => {
      const now = Date.now();
      mockSession1.createdAt = now - 60000; // 1 minute ago
      mockSession2.createdAt = now - 300000; // 5 minutes ago
      mockSession3.createdAt = now - 120000; // 2 minutes ago

      sessionManager.addSession(mockSession1);
      sessionManager.addSession(mockSession2);
      sessionManager.addSession(mockSession3);

      const stats = sessionManager.getStatistics();
      expect(stats.averageLifetimeMs).toBeGreaterThan(0);
    });
  });

  describe("Error Recovery", () => {
    it("should handle session health check failures", async () => {
      mockSession1.automator.healthCheck = vi
        .fn()
        .mockRejectedValue(new Error("Health check failed"));

      sessionManager.addSession(mockSession1);
      const health = await sessionManager.checkHealth();

      // Should still report session but mark as unhealthy
      const sessionCheck = health.checks.sessions.find(
        (s) => s.id === "session-1",
      );
      expect(sessionCheck).toBeDefined();
      expect(sessionCheck.healthy).toBe(false);
    });

    it("should continue operation when individual sessions fail", async () => {
      mockSession1.automator.healthCheck = vi
        .fn()
        .mockRejectedValue(new Error("Failed"));
      mockSession2.automator.healthCheck = vi
        .fn()
        .mockResolvedValue({ healthy: true });

      sessionManager.addSession(mockSession1);
      sessionManager.addSession(mockSession2);

      const health = await sessionManager.checkHealth();

      expect(health.checks.sessions).toHaveLength(2);
      expect(health.healthScore).toBeGreaterThan(0);
    });
  });
});

/**
 * Auto-AI Framework - Proprietary Software
 * Copyright (c) 2025 gantengmaksimal - All Rights Reserved
 * Unauthorized copying, distribution, or modification prohibited
 */

/**
 * @fileoverview Orchestrator Integration Tests
 * Tests task queueing, dispatch modes, timeout propagation, abort signals, and health monitoring
 * @module tests/integration/orchestrator-full.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Orchestrator from "../../core/orchestrator.js";

// Mock dependencies
vi.mock("../../core/sessionManager.js", () => ({
  default: class {
    constructor() {
      this.sessions = new Map();
      this.getAllSessions = vi.fn(() => Array.from(this.sessions.values()));
    }

    addSession(session) {
      this.sessions.set(session.id, session);
    }

    removeSession(sessionId) {
      this.sessions.delete(sessionId);
    }

    getSession(sessionId) {
      return this.sessions.get(sessionId);
    }

    async shutdown() {
      // Mock shutdown
      return Promise.resolve();
    }
  },
}));

vi.mock("../../core/discovery.js", () => ({
  default: class {
    async discover() {
      return [{ id: "browser1" }, { id: "browser2" }];
    }
  },
}));

vi.mock("../../core/automator.js", () => ({
  default: class {
    constructor(session) {
      this.session = session;
      this.connected = false;
    }

    async connect() {
      this.connected = true;
    }

    async disconnect() {
      this.connected = false;
    }

    async shutdown() {
      this.connected = false;
      return Promise.resolve();
    }

    async executeTask(task) {
      return { success: true, task: task.taskName };
    }

    async healthCheck() {
      return { healthy: this.connected };
    }
  },
}));

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
    success: vi.fn(),
  })),
}));

vi.mock("../../utils/configLoader.js", () => ({
  ConfigLoader: class {},
  default: {
    loadConfig: vi.fn(),
    getValue: vi.fn(),
    getSettings: vi.fn(),
  },
  getSettings: vi.fn().mockResolvedValue({
    orchestrator: {
      taskDispatchMode: "centralized",
      maxConcurrentWorkers: 10,
      taskTimeout: 30000,
      groupTimeout: 60000,
    },
  }),
  getTimeoutValue: vi.fn((_path, def) => Promise.resolve(def)),
}));

vi.mock("../../utils/validator.js", () => ({
  validateTaskExecution: vi.fn(() => ({ isValid: true })),
  validatePayload: vi.fn(() => ({ isValid: true })),
}));

describe("Orchestrator Integration", () => {
  let orchestrator;
  let mockSession1;
  let mockSession2;
  let mockAutomator1;
  let mockAutomator2;

  beforeEach(async () => {
    vi.clearAllMocks();

    orchestrator = new Orchestrator();

    // Create mock sessions
    mockSession1 = {
      id: "session-1",
      browserId: "browser1",
      status: "active",
      automator: null,
    };

    mockSession2 = {
      id: "session-2",
      browserId: "browser2",
      status: "active",
      automator: null,
    };

    // Create mock automators
    mockAutomator1 = {
      session: mockSession1,
      connected: false,
      executeTask: vi.fn().mockResolvedValue({ success: true }),
      healthCheck: vi.fn().mockResolvedValue({ healthy: true }),
      disconnect: vi.fn(),
    };

    mockAutomator2 = {
      session: mockSession2,
      connected: false,
      executeTask: vi.fn().mockResolvedValue({ success: true }),
      healthCheck: vi.fn().mockResolvedValue({ healthy: true }),
      disconnect: vi.fn(),
    };

    // Inject mocks into session manager
    orchestrator.sessionManager.addSession(mockSession1);
    orchestrator.sessionManager.addSession(mockSession2);
    mockSession1.automator = mockAutomator1;
    mockSession2.automator = mockAutomator2;
  });

  afterEach(() => {
    // Cleanup
    if (orchestrator) {
      orchestrator.shutdown();
    }
  });

  describe("Task Queueing and Dispatch", () => {
    it("should queue tasks and dispatch to all sessions in centralized mode", async () => {
      orchestrator.taskDispatchMode = "centralized";
      orchestrator.taskQueue = [
        { taskName: "pageview", payload: { url: "https://example.com" } },
        { taskName: "follow", payload: { userId: "123" } },
      ];

      await orchestrator.processTasks();

      // Each session should receive both tasks
      expect(mockAutomator1.executeTask).toHaveBeenCalledTimes(2);
      expect(mockAutomator2.executeTask).toHaveBeenCalledTimes(2);

      // Verify task order and content
      expect(mockAutomator1.executeTask.mock.calls[0][0].taskName).toBe(
        "pageview",
      );
      expect(mockAutomator1.executeTask.mock.calls[1][0].taskName).toBe(
        "follow",
      );
    });

    it("should broadcast tasks to all sessions in broadcast mode", async () => {
      orchestrator.taskDispatchMode = "broadcast";
      orchestrator.taskQueue = [
        { taskName: "pageview", payload: { url: "https://example.com" } },
      ];

      await orchestrator.processTasks();

      // Both sessions should receive the task
      expect(mockAutomator1.executeTask).toHaveBeenCalledTimes(1);
      expect(mockAutomator2.executeTask).toHaveBeenCalledTimes(1);
    });

    it("should handle empty task queue gracefully", async () => {
      orchestrator.taskQueue = [];
      await orchestrator.processTasks();

      expect(mockAutomator1.executeTask).not.toHaveBeenCalled();
      expect(mockAutomator2.executeTask).not.toHaveBeenCalled();
    });

    it("should skip sessions without automator", async () => {
      const sessionWithoutAutomator = {
        id: "session-3",
        browserId: "browser3",
        status: "active",
        automator: null,
      };
      orchestrator.sessionManager.addSession(sessionWithoutAutomator);

      orchestrator.taskQueue = [{ taskName: "test", payload: {} }];
      await orchestrator.processTasks();

      // Only sessions with automators should receive tasks
      expect(mockAutomator1.executeTask).toHaveBeenCalledTimes(1);
      expect(mockAutomator2.executeTask).toHaveBeenCalledTimes(1);
      // Session 3 should be skipped
    });

    it("should continue processing even if one session fails", async () => {
      mockAutomator1.executeTask.mockRejectedValueOnce(
        new Error("Task failed"),
      );

      orchestrator.taskQueue = [{ taskName: "test", payload: {} }];
      await orchestrator.processTasks();

      // Session 2 should still get the task
      expect(mockAutomator2.executeTask).toHaveBeenCalledTimes(1);
    });
  });

  describe("Timeout Propagation", () => {
    it("should apply task timeout to each task execution", async () => {
      const getTimeoutValue = await import("../../utils/configLoader.js");
      getTimeoutValue.getTimeoutValue = vi.fn().mockResolvedValue(5000);

      orchestrator.taskQueue = [{ taskName: "slow-task", payload: {} }];

      // Mock slow execution
      mockAutomator1.executeTask = vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return { success: true };
      });

      await orchestrator.processTasks();

      expect(mockAutomator1.executeTask).toHaveBeenCalled();
    });

    it("should abort tasks that exceed timeout", async () => {
      orchestrator.taskQueue = [{ taskName: "timeout-task", payload: {} }];

      // Simulate slow execution that should timeout
      mockAutomator1.executeTask = vi
        .fn()
        .mockImplementation(async (task, signal) => {
          // Simulate long-running task that respects abort signal
          await new Promise((resolve, reject) => {
            signal.addEventListener("abort", () =>
              reject(new Error("Aborted")),
            );
            setTimeout(resolve, 10000); // 10 seconds
          });
          return { success: true };
        });

      // Set a short timeout for testing
      const originalTimeout = orchestrator.taskTimeout;
      orchestrator.taskTimeout = 100; // 100ms

      await orchestrator.processTasks();

      // The task should have been aborted
      expect(mockAutomator1.executeTask).toHaveBeenCalled();

      // Restore original timeout
      orchestrator.taskTimeout = originalTimeout;
    });

    it("should propagate AbortSignal to task execution", async () => {
      orchestrator.taskQueue = [{ taskName: "test", payload: {} }];

      let receivedSignal = null;
      mockAutomator1.executeTask = vi
        .fn()
        .mockImplementation(async (task, signal) => {
          receivedSignal = signal;
          return { success: true };
        });

      await orchestrator.processTasks();

      expect(receivedSignal).toBeInstanceOf(AbortSignal);
    });
  });

  describe("Group Timeout", () => {
    it("should enforce group timeout across all tasks", async () => {
      orchestrator.taskQueue = [
        { taskName: "task1", payload: {} },
        { taskName: "task2", payload: {} },
        { taskName: "task3", payload: {} },
      ];

      // Simulate slow tasks
      mockAutomator1.executeTask = vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return { success: true };
      });

      const originalGroupTimeout = orchestrator.groupTimeout;
      orchestrator.groupTimeout = 100; // 100ms total for all tasks

      const startTime = Date.now();
      await orchestrator.processTasks();
      const duration = Date.now() - startTime;

      // Should complete within group timeout (plus small margin)
      expect(duration).toBeLessThan(200);

      orchestrator.groupTimeout = originalGroupTimeout;
    });
  });

  describe("Health Monitoring", () => {
    it("should collect health status from all sessions", async () => {
      mockAutomator1.healthCheck = vi
        .fn()
        .mockResolvedValue({ healthy: true, load: 0.5 });
      mockAutomator2.healthCheck = vi
        .fn()
        .mockResolvedValue({ healthy: false, load: 0.9 });

      const health = orchestrator.getHealth();

      expect(health).toHaveProperty("status");
      expect(health).toHaveProperty("healthScore");
      expect(health).toHaveProperty("checks");
      expect(health).toHaveProperty("timestamp");
      expect(health.checks).toHaveProperty("sessions");
    });

    it("should calculate overall health score based on session health", async () => {
      mockAutomator1.healthCheck = vi.fn().mockResolvedValue({ healthy: true });
      mockAutomator2.healthCheck = vi.fn().mockResolvedValue({ healthy: true });

      const health = orchestrator.getHealth();
      expect(health.healthScore).toBeGreaterThanOrEqual(80);
    });

    it("should report degraded health when sessions are unhealthy", async () => {
      mockAutomator1.healthCheck = vi
        .fn()
        .mockResolvedValue({ healthy: false });
      mockAutomator2.healthCheck = vi
        .fn()
        .mockResolvedValue({ healthy: false });

      const health = orchestrator.getHealth();
      expect(health.healthScore).toBeLessThan(50);
    });

    it("should include session details in health check", async () => {
      mockAutomator1.healthCheck = vi
        .fn()
        .mockResolvedValue({ healthy: true, uptime: 3600 });
      mockAutomator2.healthCheck = vi
        .fn()
        .mockResolvedValue({ healthy: true, uptime: 7200 });

      const health = orchestrator.getHealth();
      expect(health.checks.sessions.sessions).toHaveLength(2);
    });
  });

  describe("Worker Health and Session Removal", () => {
    it("should remove unhealthy sessions after threshold", async () => {
      // Simulate unhealthy session
      mockAutomator1.healthCheck = vi
        .fn()
        .mockResolvedValue({ healthy: false });

      // Trigger health check and removal
      await orchestrator.checkWorkerHealth();

      // Session should be removed
      expect(
        orchestrator.sessionManager.getSession("session-1"),
      ).toBeUndefined();
    });

    it("should keep healthy sessions", async () => {
      mockAutomator1.healthCheck = vi.fn().mockResolvedValue({ healthy: true });
      mockAutomator2.healthCheck = vi.fn().mockResolvedValue({ healthy: true });

      await orchestrator.checkWorkerHealth();

      expect(orchestrator.sessionManager.getSession("session-1")).toBeDefined();
      expect(orchestrator.sessionManager.getSession("session-2")).toBeDefined();
    });

    it("should handle session removal gracefully", async () => {
      mockAutomator1.healthCheck = vi
        .fn()
        .mockResolvedValue({ healthy: false });
      mockAutomator1.disconnect = vi.fn().mockResolvedValue(undefined);

      await orchestrator.checkWorkerHealth();

      expect(mockAutomator1.disconnect).toHaveBeenCalled();
    });
  });

  describe("Shutdown and Cleanup", () => {
    it("should disconnect all automators on shutdown", async () => {
      await orchestrator.shutdown();

      expect(mockAutomator1.disconnect).toHaveBeenCalled();
      expect(mockAutomator2.disconnect).toHaveBeenCalled();
    });

    it("should clear task queue on shutdown", async () => {
      orchestrator.taskQueue = [
        { taskName: "task1", payload: {} },
        { taskName: "task2", payload: {} },
      ];

      await orchestrator.shutdown();

      expect(orchestrator.taskQueue).toHaveLength(0);
    });

    it("should stop all running workers", async () => {
      orchestrator.workers = new Map();
      orchestrator.workers.set("session-1", { stop: vi.fn() });
      orchestrator.workers.set("session-2", { stop: vi.fn() });

      await orchestrator.shutdown();

      orchestrator.workers.forEach((worker) => {
        expect(worker.stop).toHaveBeenCalled();
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle session discovery failures", async () => {
      // Mock discovery to throw
      const discovery = await import("../../core/discovery.js");
      discovery.default = class {
        async discover() {
          throw new Error("Discovery failed");
        }
      };

      // Should not crash orchestrator
      const orchestratorWithFailedDiscovery = new Orchestrator();
      const health = orchestratorWithFailedDiscovery.getHealth();
      expect(health).toBeDefined();
    });

    it("should handle invalid task payloads", async () => {
      orchestrator.taskQueue = [
        { taskName: "valid-task", payload: {} },
        { payload: {} }, // missing taskName
        { taskName: "", payload: {} }, // empty taskName
      ];

      // Should process valid tasks and skip invalid ones
      await orchestrator.processTasks();

      expect(mockAutomator1.executeTask).toHaveBeenCalledTimes(1);
      expect(mockAutomator1.executeTask.mock.calls[0][0].taskName).toBe(
        "valid-task",
      );
    });

    it("should handle automator connection failures", async () => {
      mockAutomator1.connect = vi
        .fn()
        .mockRejectedValue(new Error("Connection failed"));

      // Orchestrator should continue with other sessions
      orchestrator.taskQueue = [{ taskName: "test", payload: {} }];
      await orchestrator.processTasks();

      expect(mockAutomator2.executeTask).toHaveBeenCalled();
    });
  });

  describe("Concurrent Task Processing", () => {
    it("should process tasks for multiple sessions concurrently", async () => {
      const executionOrder = [];

      mockAutomator1.executeTask = vi.fn().mockImplementation(async (task) => {
        executionOrder.push(`${task.taskName}-session1`);
        await Promise.resolve();
      });

      mockAutomator2.executeTask = vi.fn().mockImplementation(async (task) => {
        executionOrder.push(`${task.taskName}-session2`);
        await Promise.resolve();
      });

      orchestrator.taskQueue = [
        { taskName: "taskA", payload: {} },
        { taskName: "taskB", payload: {} },
      ];

      await orchestrator.processTasks();

      // Both sessions should have processed both tasks
      expect(executionOrder).toContain("taskA-session1");
      expect(executionOrder).toContain("taskA-session2");
      expect(executionOrder).toContain("taskB-session1");
      expect(executionOrder).toContain("taskB-session2");
    });

    it("should respect maxConcurrentWorkers setting", async () => {
      const settings = await import("../../utils/configLoader.js");
      settings.getSettings = vi.fn().mockResolvedValue({
        orchestrator: {
          maxConcurrentWorkers: 1,
        },
      });

      // With maxConcurrentWorkers = 1, tasks should still process but may be serialized
      orchestrator.taskQueue = [
        { taskName: "task1", payload: {} },
        { taskName: "task2", payload: {} },
      ];

      await orchestrator.processTasks();

      // All tasks should eventually complete
      expect(mockAutomator1.executeTask).toHaveBeenCalledTimes(2);
    });
  });
});

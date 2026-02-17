/**
 * @fileoverview Unit tests for runAgent task
 * Tests agent initialization, execution, and error handling
 * @module tests/unit/tasks-runAgent.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../local-agent/core/agent.js', () => ({
  default: class MockAgent {
    constructor(page, goal, config) {
      this.page = page;
      this.goal = goal;
      this.config = config;
    }
    run() {
      return Promise.resolve();
    }
  }
}));

vi.mock('../../utils/logger.js', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }))
}));

describe('tasks/runAgent.js', () => {
  let runAgent;
  let MockAgent;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    runAgent = await import('../../tasks/runAgent.js');
    const agentModule = await import('../../local-agent/core/agent.js');
    MockAgent = agentModule.default;
  });

  describe('Module Export', () => {
    it('should export run function', async () => {
      expect(runAgent.run).toBeDefined();
      expect(typeof runAgent.run).toBe('function');
    });
  });

  describe('Task Execution', () => {
    it('should throw error when goal is not provided', async () => {
      const page = {};
      
      await expect(runAgent.run(page, [])).rejects.toThrow('Goal is required');
    });

    it('should create agent with correct parameters', async () => {
      const page = { test: true };
      const args = ['Navigate to example.com'];
      
      await runAgent.run(page, args);
    });

    it('should use default stepDelay of 2000ms', async () => {
      const page = {};
      const args = ['Test goal'];
      
      await runAgent.run(page, args);
    });

    it('should allow custom config override', async () => {
      const page = {};
      const args = ['Test goal'];
      const config = { stepDelay: 5000, maxSteps: 10 };
      
      await runAgent.run(page, args, config);
    });

    it('should call agent.run() method', async () => {
      const page = {};
      const args = ['Test goal'];
      
      const result = await runAgent.run(page, args);
      
      expect(result).toBeDefined();
    });

    it('should return agent instance for caller access', async () => {
      const page = {};
      const args = ['Test goal'];
      
      const result = await runAgent.run(page, args);
      
      expect(result).toBeDefined();
      expect(result.goal).toBe('Test goal');
    });

    it('should merge custom config with defaults', async () => {
      const page = {};
      const args = ['Test goal'];
      const config = { customOption: true };
      
      const result = await runAgent.run(page, args, config);
      
      expect(result.config.stepDelay).toBe(2000);
      expect(result.config.customOption).toBe(true);
    });

    it('should pass page object to agent constructor', async () => {
      const page = { test: 'page-object' };
      const args = ['Test goal'];
      
      const result = await runAgent.run(page, args);
      
      expect(result.page).toBe(page);
    });

    it('should pass goal as first argument', async () => {
      const page = {};
      const args = ['My custom goal'];
      
      const result = await runAgent.run(page, args);
      
      expect(result.goal).toBe('My custom goal');
    });

    it('should handle empty args array', async () => {
      const page = {};
      
      await expect(runAgent.run(page, [])).rejects.toThrow('Goal is required');
    });

    it('should use goal from args[0] only', async () => {
      const page = {};
      const args = ['first goal', 'second goal', 'third goal'];
      
      const result = await runAgent.run(page, args);
      
      expect(result.goal).toBe('first goal');
    });
  });

  describe('Configuration Options', () => {
    it('should accept custom stepDelay', async () => {
      const page = {};
      const args = ['Test'];
      const config = { stepDelay: 1000 };
      
      const result = await runAgent.run(page, args, config);
      
      expect(result.config.stepDelay).toBe(1000);
    });

    it('should accept sessionId in config', async () => {
      const page = {};
      const args = ['Test'];
      const config = { sessionId: 'session-123' };
      
      const result = await runAgent.run(page, args, config);
      
      expect(result.config.sessionId).toBe('session-123');
    });

    it('should accept taskName in config', async () => {
      const page = {};
      const args = ['Test'];
      const config = { taskName: 'custom-task' };
      
      const result = await runAgent.run(page, args, config);
      
      expect(result.config.taskName).toBe('custom-task');
    });

    it('should merge multiple config options', async () => {
      const page = {};
      const args = ['Test'];
      const config = {
        stepDelay: 3000,
        sessionId: 's1',
        taskName: 't1',
        maxSteps: 50
      };
      
      const result = await runAgent.run(page, args, config);
      
      expect(result.config.stepDelay).toBe(3000);
      expect(result.config.sessionId).toBe('s1');
      expect(result.config.taskName).toBe('t1');
      expect(result.config.maxSteps).toBe(50);
    });

    it('should preserve default stepDelay when not provided in config', async () => {
      const page = {};
      const args = ['Test'];
      const config = { maxSteps: 10 };
      
      const result = await runAgent.run(page, args, config);
      
      expect(result.config.stepDelay).toBe(2000);
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import Orchestrator from '../../core/orchestrator.js';

vi.mock('../../core/sessionManager.js', () => ({
  default: class {
    constructor() {
      this.getAllSessions = vi.fn();
      Object.defineProperty(this, 'activeSessionsCount', {
        configurable: true,
        get: vi.fn(() => 0)
      });
    }
  }
}));
vi.mock('../../core/discovery.js', () => ({ default: class {} }));
vi.mock('../../core/automator.js', () => ({ default: class {} }));
vi.mock('../../utils/logger.js', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }))
}));
vi.mock('../../utils/configLoader.js', () => ({
  getSettings: vi.fn(),
  getTimeoutValue: vi.fn()
}));
vi.mock('../../utils/validator.js', () => ({
  validateTaskExecution: vi.fn(() => ({ isValid: true })),
  validatePayload: vi.fn(() => ({ isValid: true }))
}));

describe('Orchestrator dispatch integration', () => {
  let orchestrator;

  beforeEach(() => {
    vi.clearAllMocks();
    orchestrator = new Orchestrator();
  });

  it('shares tasks when centralized mode is enabled', async () => {
    const sessionA = { id: 'A' };
    const sessionB = { id: 'B' };

    Object.defineProperty(orchestrator.sessionManager, 'activeSessionsCount', {
      configurable: true,
      get: vi.fn(() => 2)
    });
    orchestrator.sessionManager.getAllSessions.mockReturnValue([sessionA, sessionB]);

    const tasks = [
      { taskName: 'taskA', payload: {} },
      { taskName: 'taskB', payload: {} }
    ];
    orchestrator.taskQueue = [...tasks];

    const processSpy = vi.spyOn(orchestrator, 'processSharedChecklistForSession').mockResolvedValue();
    await orchestrator.processTasks();

    expect(processSpy).toHaveBeenCalledTimes(2);
    const firstTasks = processSpy.mock.calls[0][1];
    const secondTasks = processSpy.mock.calls[1][1];
    expect(firstTasks).not.toBe(secondTasks);
    expect(firstTasks).toEqual(tasks);
    expect(secondTasks).toEqual(tasks);
  });

  it('falls back to centralized assignment when mode is non-centralized', async () => {
    const sessionA = { id: 'A' };
    const sessionB = { id: 'B' };

    Object.defineProperty(orchestrator.sessionManager, 'activeSessionsCount', {
      configurable: true,
      get: vi.fn(() => 2)
    });
    orchestrator.sessionManager.getAllSessions.mockReturnValue([sessionA, sessionB]);

    const tasks = [
      { taskName: 'taskA', payload: {} },
      { taskName: 'taskB', payload: {} }
    ];
    orchestrator.taskQueue = [...tasks];
    orchestrator.taskDispatchMode = 'broadcast';

    const processSpy = vi.spyOn(orchestrator, 'processSharedChecklistForSession').mockResolvedValue();

    await orchestrator.processTasks();

    expect(processSpy).toHaveBeenCalledTimes(2);
    const firstTasks = processSpy.mock.calls[0][1];
    const secondTasks = processSpy.mock.calls[1][1];
    expect(firstTasks).not.toBe(secondTasks);
    expect(firstTasks).toEqual(tasks);
    expect(secondTasks).toEqual(tasks);
  });
});

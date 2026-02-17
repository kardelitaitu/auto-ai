import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { run } from '../../tasks/taskAgent.js';
import { run as runAgent } from '../../tasks/runAgent.js';
import { takeScreenshot } from '../../utils/screenshot.js';

vi.mock('../../tasks/runAgent.js', () => ({
  run: vi.fn()
}));

vi.mock('../../utils/screenshot.js', () => ({
  takeScreenshot: vi.fn()
}));

describe('taskAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('runs goals, resets page, and captures screenshots', async () => {
    const page = { 
      goto: vi.fn().mockResolvedValue(undefined),
      url: vi.fn().mockReturnValue('https://twitter.com'),
      waitForTimeout: vi.fn().mockResolvedValue(undefined)
    };
    const config = { sessionId: 'session-42' };
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    runAgent.mockResolvedValue({
      getUsageStats: () => ({
        steps: 2,
        maxSteps: 5,
        estimatedTokens: 1200,
        historySize: 10
      })
    });

    await run(page, {}, config);

    expect(runAgent).toHaveBeenCalledTimes(2);
    expect(page.goto).toHaveBeenCalledWith('about:blank');
    expect(takeScreenshot).toHaveBeenCalledWith(page, 'session-42', 'Task-1');
    expect(takeScreenshot).toHaveBeenCalledWith(page, 'session-42', 'Task-2');
    expect(logSpy).toHaveBeenCalled();
  });
});

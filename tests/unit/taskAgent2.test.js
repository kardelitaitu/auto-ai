import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../tasks/runAgent.js', () => ({
  run: vi.fn()
}));

describe('taskAgent2', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('runs weather search steps', async () => {
    const page = {};
    const config = { sessionId: 'session-1' };
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const { run } = await import('../../tasks/taskAgent2.js');
    const { run: runAgent } = await import('../../tasks/runAgent.js');

    await run(page, {}, config);

    expect(runAgent).toHaveBeenCalledWith(
      page,
      ["Go to Google and search for 'weather in jakarta'"],
      config
    );
    expect(logSpy).toHaveBeenCalled();
  });
});

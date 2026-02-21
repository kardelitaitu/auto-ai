import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';

const mockLogEmitter = new EventEmitter();

vi.mock('../../utils/logger.js', () => ({
  logEmitter: mockLogEmitter
}));

describe('LogCapture', () => {
  let LogCapture;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockLogEmitter.removeAllListeners();
    ({ LogCapture } = await import('../../core/log-capture.js'));
  });

  afterEach(() => {
    vi.useRealTimers();
    mockLogEmitter.removeAllListeners();
  });

  it('discovers task modules from tasks directory', () => {
    const orchestrator = {
      updateSessionProcessing: vi.fn(),
      sessionManager: { getAllSessions: vi.fn().mockReturnValue([]) }
    };

    const capture = new LogCapture(orchestrator);

    expect(capture.allowedModules.has('ai-twitterActivity')).toBe(true);
    expect(capture.allowedModules.has('_template')).toBe(false);
    capture.stop();
  });

  it('starts and stops listening', () => {
    const onSpy = vi.spyOn(mockLogEmitter, 'on');
    const offSpy = vi.spyOn(mockLogEmitter, 'off');
    const orchestrator = {
      updateSessionProcessing: vi.fn(),
      sessionManager: { getAllSessions: vi.fn().mockReturnValue([]) }
    };

    const capture = new LogCapture(orchestrator);

    expect(onSpy).toHaveBeenCalledWith('log', expect.any(Function));
    capture.stop();
    expect(offSpy).toHaveBeenCalledWith('log', capture.boundHandleLog);
  });

  it('handles allowed log entries and updates activity', () => {
    const orchestrator = {
      updateSessionProcessing: vi.fn(),
      sessionManager: { getAllSessions: vi.fn().mockReturnValue([]) }
    };

    const capture = new LogCapture(orchestrator);
    capture.allowedModules = new Set(['taskOne']);

    capture.handleLog({
      sessionId: 's1',
      module: 'taskOne',
      message: '[taskOne] User opened timeline',
      level: 'info'
    });

    expect(orchestrator.updateSessionProcessing).toHaveBeenCalledWith('s1', 'User opened timeline');
    expect(capture.lastActivity.get('s1')).toBeDefined();
    capture.stop();
  });

  it('ignores log entries that should be filtered', () => {
    const orchestrator = {
      updateSessionProcessing: vi.fn(),
      sessionManager: { getAllSessions: vi.fn().mockReturnValue([]) }
    };

    const capture = new LogCapture(orchestrator);
    capture.allowedModules = new Set(['taskOne']);

    capture.handleLog({
      sessionId: 's1',
      module: 'taskOne',
      message: 'session initialized',
      level: 'info'
    });

    capture.handleLog({
      sessionId: 's1',
      module: 'taskOne',
      message: 'User action',
      level: 'debug'
    });

    expect(orchestrator.updateSessionProcessing).not.toHaveBeenCalled();
    capture.stop();
  });

  it('cleans log messages for activity display', () => {
    const orchestrator = {
      updateSessionProcessing: vi.fn(),
      sessionManager: { getAllSessions: vi.fn().mockReturnValue([]) }
    };

    const capture = new LogCapture(orchestrator);

    expect(capture.cleanMessage('[task] Action performed')).toBe('Action performed');
    expect(capture.cleanMessage('12:00:00 INFO] Activity happening')).toBe('Activity happening');
    capture.stop();
  });

  it('marks sessions idle after inactivity', () => {
    const orchestrator = {
      updateSessionProcessing: vi.fn(),
      sessionManager: {
        getAllSessions: vi.fn().mockReturnValue([{ id: 's1', currentTaskName: 'taskOne' }])
      }
    };

    const capture = new LogCapture(orchestrator);
    capture.lastActivity.set('s1', 0);
    vi.setSystemTime(10000);

    capture.checkIdle();

    expect(orchestrator.updateSessionProcessing).toHaveBeenCalledWith('s1', null);
    expect(capture.lastActivity.has('s1')).toBe(false);
    capture.stop();
  });
});

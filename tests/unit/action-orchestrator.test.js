import { describe, it, expect, vi } from 'vitest';
import { ActionOrchestrator, ACTION_ROUTINES, actionOrchestrator } from '../../utils/actionOrchestrator.js';

describe('action-orchestrator', () => {
  it('blocks repeated routines and recent notification checks', () => {
    const orchestrator = new ActionOrchestrator({ sessionId: 'test' });
    orchestrator.history = [
      ACTION_ROUTINES.PROFILE_DIVE,
      ACTION_ROUTINES.TWEET_DIVE,
      ACTION_ROUTINES.TWEET_DIVE,
      ACTION_ROUTINES.TWEET_DIVE
    ];
    const repeatedBlocked = orchestrator.getConstraintBlockedRoutines();
    expect(repeatedBlocked).toContain(ACTION_ROUTINES.TWEET_DIVE);

    orchestrator.history = [
      ACTION_ROUTINES.PROFILE_DIVE,
      ACTION_ROUTINES.NOTIFICATION_CHECK,
      ACTION_ROUTINES.TIMELINE_BROWSE
    ];
    const notificationBlocked = orchestrator.getConstraintBlockedRoutines();
    expect(notificationBlocked).toContain(ACTION_ROUTINES.NOTIFICATION_CHECK);
  });

  it('falls back when total weight is zero', () => {
    const orchestrator = new ActionOrchestrator({ sessionId: 'test' });
    orchestrator.weights = {
      [ACTION_ROUTINES.TIMELINE_BROWSE]: 0,
      [ACTION_ROUTINES.TWEET_DIVE]: 0,
      [ACTION_ROUTINES.PROFILE_DIVE]: 0,
      [ACTION_ROUTINES.NOTIFICATION_CHECK]: 0,
      [ACTION_ROUTINES.REFRESH]: 0,
      [ACTION_ROUTINES.IDLE]: 0
    };
    const next = orchestrator.getNextRoutine();
    expect(next).toBe(ACTION_ROUTINES.TIMELINE_BROWSE);
  });

  it('selects a routine by weight and records history', () => {
    const orchestrator = new ActionOrchestrator({ sessionId: 'test' });
    orchestrator.weights = {
      [ACTION_ROUTINES.TIMELINE_BROWSE]: 1,
      [ACTION_ROUTINES.TWEET_DIVE]: 0,
      [ACTION_ROUTINES.PROFILE_DIVE]: 0,
      [ACTION_ROUTINES.NOTIFICATION_CHECK]: 0,
      [ACTION_ROUTINES.REFRESH]: 0,
      [ACTION_ROUTINES.IDLE]: 0
    };
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const next = orchestrator.getNextRoutine();
    randomSpy.mockRestore();
    expect(next).toBe(ACTION_ROUTINES.TIMELINE_BROWSE);
    expect(orchestrator.history[0]).toBe(ACTION_ROUTINES.TIMELINE_BROWSE);
  });

  it('records and trims history to max length', () => {
    const orchestrator = new ActionOrchestrator({ sessionId: 'test' });
    for (let i = 0; i < orchestrator.maxHistory + 2; i++) {
      orchestrator.record(ACTION_ROUTINES.TIMELINE_BROWSE);
    }
    expect(orchestrator.history.length).toBe(orchestrator.maxHistory);
  });

  it('falls back when weighted selection does not resolve', () => {
    const orchestrator = new ActionOrchestrator({ sessionId: 'test' });
    orchestrator.weights = {
      [ACTION_ROUTINES.TIMELINE_BROWSE]: Number.NaN,
      [ACTION_ROUTINES.TWEET_DIVE]: 0,
      [ACTION_ROUTINES.PROFILE_DIVE]: 0,
      [ACTION_ROUTINES.NOTIFICATION_CHECK]: 0,
      [ACTION_ROUTINES.REFRESH]: 0,
      [ACTION_ROUTINES.IDLE]: 0
    };
    const next = orchestrator.getNextRoutine();
    expect(next).toBe(ACTION_ROUTINES.TIMELINE_BROWSE);
    expect(orchestrator.history[0]).toBe(ACTION_ROUTINES.TIMELINE_BROWSE);
  });

  it('getNext delegates to getNextRoutine', () => {
    const orchestrator = new ActionOrchestrator({ sessionId: 'test' });
    const spy = vi.spyOn(orchestrator, 'getNextRoutine').mockReturnValue(ACTION_ROUTINES.IDLE);
    const next = orchestrator.getNext();
    expect(next).toBe(ACTION_ROUTINES.IDLE);
    spy.mockRestore();
  });

  it('resets history', () => {
    const orchestrator = new ActionOrchestrator({ sessionId: 'test' });
    orchestrator.record(ACTION_ROUTINES.REFRESH);
    orchestrator.reset();
    expect(orchestrator.history).toEqual([]);
  });

  it('exports singleton instance', () => {
    const next = actionOrchestrator.getNextRoutine();
    expect(Object.values(ACTION_ROUTINES)).toContain(next);
  });
});

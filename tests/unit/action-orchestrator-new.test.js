import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ActionOrchestrator, ACTION_ROUTINES } from '../../utils/actionOrchestrator.js';

describe('ActionOrchestrator', () => {
  let orchestrator;

  beforeEach(() => {
    vi.spyOn(Math, 'random').mockRestore();
  });

  describe('Constructor', () => {
    it('should create instance with default options', () => {
      orchestrator = new ActionOrchestrator();
      expect(orchestrator.sessionId).toBeDefined();
      expect(orchestrator.history).toEqual([]);
      expect(orchestrator.maxHistory).toBe(10);
      expect(orchestrator.weights).toBeDefined();
    });

    it('should create instance with custom sessionId', () => {
      orchestrator = new ActionOrchestrator({ sessionId: 'test-session-123' });
      expect(orchestrator.sessionId).toBe('test-session-123');
    });

    it('should have default weights for all routines', () => {
      orchestrator = new ActionOrchestrator();
      expect(orchestrator.weights[ACTION_ROUTINES.TIMELINE_BROWSE]).toBe(0.45);
      expect(orchestrator.weights[ACTION_ROUTINES.TWEET_DIVE]).toBe(0.25);
      expect(orchestrator.weights[ACTION_ROUTINES.PROFILE_DIVE]).toBe(0.15);
      expect(orchestrator.weights[ACTION_ROUTINES.NOTIFICATION_CHECK]).toBe(0.05);
      expect(orchestrator.weights[ACTION_ROUTINES.REFRESH]).toBe(0.05);
      expect(orchestrator.weights[ACTION_ROUTINES.IDLE]).toBe(0.05);
    });
  });

  describe('ACTION_ROUTINES', () => {
    it('should have all required routine constants', () => {
      expect(ACTION_ROUTINES.TIMELINE_BROWSE).toBe('TIMELINE_BROWSE');
      expect(ACTION_ROUTINES.NOTIFICATION_CHECK).toBe('NOTIFICATION_CHECK');
      expect(ACTION_ROUTINES.PROFILE_DIVE).toBe('PROFILE_DIVE');
      expect(ACTION_ROUTINES.TWEET_DIVE).toBe('TWEET_DIVE');
      expect(ACTION_ROUTINES.IDLE).toBe('IDLE');
      expect(ACTION_ROUTINES.REFRESH).toBe('REFRESH');
    });
  });

  describe('record()', () => {
    it('should add routine to history', () => {
      orchestrator = new ActionOrchestrator();
      orchestrator.record(ACTION_ROUTINES.TIMELINE_BROWSE);
      expect(orchestrator.history).toContain(ACTION_ROUTINES.TIMELINE_BROWSE);
    });

    it('should limit history to maxHistory', () => {
      orchestrator = new ActionOrchestrator();
      orchestrator.maxHistory = 3;
      orchestrator.record('r1');
      orchestrator.record('r2');
      orchestrator.record('r3');
      orchestrator.record('r4');
      expect(orchestrator.history).toHaveLength(3);
      expect(orchestrator.history[0]).toBe('r2');
    });
  });

  describe('reset()', () => {
    it('should clear history', () => {
      orchestrator = new ActionOrchestrator();
      orchestrator.record(ACTION_ROUTINES.TIMELINE_BROWSE);
      orchestrator.record(ACTION_ROUTINES.TWEET_DIVE);
      orchestrator.reset();
      expect(orchestrator.history).toEqual([]);
    });
  });

  describe('getNext()', () => {
    it('should be alias for getNextRoutine', () => {
      orchestrator = new ActionOrchestrator();
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const result = orchestrator.getNext();
      expect(result).toBeDefined();
      expect(Object.values(ACTION_ROUTINES)).toContain(result);
    });
  });

  describe('getNextRoutine()', () => {
    it('should return a valid routine', () => {
      orchestrator = new ActionOrchestrator();
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const result = orchestrator.getNextRoutine();
      expect(Object.values(ACTION_ROUTINES)).toContain(result);
    });

    it('should record selected routine to history', () => {
      orchestrator = new ActionOrchestrator();
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      orchestrator.getNextRoutine();
      expect(orchestrator.history.length).toBe(1);
    });

    it('should return TIMELINE_BROWSE as fallback when all weights are zero', () => {
      orchestrator = new ActionOrchestrator();
      orchestrator.weights = {
        TIMELINE_BROWSE: 0,
        TWEET_DIVE: 0,
        PROFILE_DIVE: 0,
        NOTIFICATION_CHECK: 0,
        REFRESH: 0,
        IDLE: 0
      };
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const result = orchestrator.getNextRoutine();
      expect(result).toBe(ACTION_ROUTINES.TIMELINE_BROWSE);
    });
  });

  describe('getConstraintBlockedRoutines()', () => {
    it('should return empty array when history is empty', () => {
      orchestrator = new ActionOrchestrator();
      const blocked = orchestrator.getConstraintBlockedRoutines();
      expect(blocked).toEqual([]);
    });

    it('should return empty array when history has less than 3 entries', () => {
      orchestrator = new ActionOrchestrator();
      orchestrator.record(ACTION_ROUTINES.TIMELINE_BROWSE);
      orchestrator.record(ACTION_ROUTINES.TWEET_DIVE);
      const blocked = orchestrator.getConstraintBlockedRoutines();
      expect(blocked).toEqual([]);
    });

    it('should block routine repeated 3 times consecutively', () => {
      orchestrator = new ActionOrchestrator();
      orchestrator.record(ACTION_ROUTINES.TIMELINE_BROWSE);
      orchestrator.record(ACTION_ROUTINES.TIMELINE_BROWSE);
      orchestrator.record(ACTION_ROUTINES.TIMELINE_BROWSE);
      const blocked = orchestrator.getConstraintBlockedRoutines();
      expect(blocked).toContain(ACTION_ROUTINES.TIMELINE_BROWSE);
    });

    it('should block NOTIFICATION_CHECK if in last 3 entries', () => {
      orchestrator = new ActionOrchestrator();
      orchestrator.record(ACTION_ROUTINES.TIMELINE_BROWSE);
      orchestrator.record(ACTION_ROUTINES.NOTIFICATION_CHECK);
      orchestrator.record(ACTION_ROUTINES.TWEET_DIVE);
      const blocked = orchestrator.getConstraintBlockedRoutines();
      expect(blocked).toContain(ACTION_ROUTINES.NOTIFICATION_CHECK);
    });

    it('should not block NOTIFICATION_CHECK if not in last 3 entries', () => {
      orchestrator = new ActionOrchestrator();
      orchestrator.record(ACTION_ROUTINES.NOTIFICATION_CHECK);
      orchestrator.record(ACTION_ROUTINES.TIMELINE_BROWSE);
      orchestrator.record(ACTION_ROUTINES.TIMELINE_BROWSE);
      orchestrator.record(ACTION_ROUTINES.TWEET_DIVE);
      const blocked = orchestrator.getConstraintBlockedRoutines();
      expect(blocked).not.toContain(ACTION_ROUTINES.NOTIFICATION_CHECK);
    });
  });

  describe('weighted selection', () => {
    it('should select TIMELINE_BROWSE with low random value', () => {
      orchestrator = new ActionOrchestrator();
      vi.spyOn(Math, 'random').mockReturnValue(0.01);
      const result = orchestrator.getNextRoutine();
      expect(result).toBe(ACTION_ROUTINES.TIMELINE_BROWSE);
    });

    it('should select different routines based on random value', () => {
      const results = new Set();
      
      for (let i = 0; i < 50; i++) {
        const o = new ActionOrchestrator();
        results.add(o.getNextRoutine());
      }
      expect(results.size).toBeGreaterThan(1);
    });
  });
});

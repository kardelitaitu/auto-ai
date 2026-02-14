import { describe, it, expect, vi, beforeEach } from 'vitest';
import IntentClassifier from '../../core/intent-classifier.js';

// Mock logger
vi.mock('../../utils/logger.js', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

describe('IntentClassifier', () => {
  let classifier;

  beforeEach(() => {
    vi.clearAllMocks();
    classifier = new IntentClassifier();
  });

  describe('Initialization', () => {
    it('should initialize with predefined action sets and keywords', () => {
      expect(classifier.routineActions).toBeInstanceOf(Set);
      expect(classifier.routineActions.has('click')).toBe(true);
      expect(classifier.complexActions).toBeInstanceOf(Set);
      expect(classifier.complexActions.has('captcha_solve')).toBe(true);
      expect(classifier.errorKeywords).toContain('rate limit');
    });
  });

  describe('classify()', () => {
    // Priority 1: Error Indicators
    it('should route to CLOUD when context has error keywords (Priority 1)', () => {
      const result = classifier.classify({
        action: 'click', // Routine action, but error should override
        context: { lastError: 'Rate limit exceeded, please wait' },
      });

      expect(result).toEqual({
        destination: 'cloud',
        confidenceScore: 95,
        reason: 'Error condition detected, requires advanced reasoning',
        complexityScore: 9,
      });
    });

    it('should route to CLOUD when payload requires error recovery (Priority 1)', () => {
      const result = classifier.classify({
        action: 'navigate',
        payload: { errorRecovery: true },
      });

      expect(result).toMatchSnapshot();
    });

    // Priority 2: Complex Actions
    it('should route to CLOUD when action is explicitly complex (Priority 2)', () => {
      const result = classifier.classify({
        action: 'captcha_solve',
      });

      expect(result).toEqual({
        destination: 'cloud',
        confidenceScore: 90,
        reason: "Action 'captcha_solve' requires cloud-level reasoning",
        complexityScore: 8,
      });
    });

    // Priority 3: Complexity Score
    it('should route to CLOUD when complexity score is >= 7 (Priority 3)', () => {
      const result = classifier.classify({
        action: 'click',
        complexityScore: 7,
      });

      expect(result).toEqual({
        destination: 'cloud',
        confidenceScore: 85,
        reason: 'High complexity score from recent failures',
        complexityScore: 7,
      });
    });

    // Priority 4: Routine Actions
    it('should route to LOCAL when action is routine and no higher priorities met (Priority 4)', () => {
      const result = classifier.classify({
        action: 'click',
        complexityScore: 2,
      });

      expect(result).toEqual({
        destination: 'local',
        confidenceScore: 80,
        reason: "Routine action 'click' suitable for local processing",
        complexityScore: 2,
      });
    });

    // Priority 5: Payload Complexity
    it('should route to CLOUD when payload complexity is high (> 6) (Priority 5)', () => {
      // Construct payload to exceed score 6:
      // requiresVision (3) + steps > 3 (2) + dynamicTarget (2) = 7
      const result = classifier.classify({
        action: 'unknown_action',
        payload: {
          requiresVision: true,
          steps: [1, 2, 3, 4],
          dynamicTarget: true,
        },
      });

      expect(result.destination).toBe('cloud');
      expect(result.complexityScore).toBe(7);
      expect(result.reason).toBe('Complex payload requires cloud processing');
    });

    it('should route to LOCAL via default fallback if nothing else matches', () => {
      const result = classifier.classify({
        action: 'custom_action',
        payload: {},
      });

      expect(result).toEqual({
        destination: 'local',
        confidenceScore: 60,
        reason: 'Default routing to local for unclassified action',
        complexityScore: 3,
      });
    });
  });

  describe('forceCloud()', () => {
    it('should return cloud routing with max confidence', () => {
      const result = classifier.forceCloud();
      expect(result).toEqual({
        destination: 'cloud',
        confidenceScore: 100,
        reason: 'Forced cloud routing',
        complexityScore: 10,
      });
    });
  });

  describe('forceLocal()', () => {
    it('should return local routing with max confidence', () => {
      const result = classifier.forceLocal();
      expect(result).toEqual({
        destination: 'local',
        confidenceScore: 100,
        reason: 'Forced local routing',
        complexityScore: 1,
      });
    });
  });

  describe('getStats()', () => {
    it('should return correct statistics', () => {
      const stats = classifier.getStats();
      expect(stats).toEqual({
        routineActionsCount: 7,
        complexActionsCount: 6,
        errorKeywordsCount: 6,
      });
    });
  });

  describe('Payload Complexity Details', () => {
    it('should increase score when payload has conditions or branches', () => {
      // payloadComplexity > 6 triggers cloud.
      // We want to verify that 'conditions' adds 3 to the score.
      // Base score 0.
      // conditions (+3).
      // We need to inspect the internal score or infer it from the result.
      // If we only have conditions (+3), score is 3. Result is Local (complexity 3).
      
      const result = classifier.classify({
        action: 'custom',
        payload: { conditions: true }
      });
      // 3 is not enough to trigger Cloud (threshold > 6).
      // But we can check complexityScore in the result.
      expect(result.complexityScore).toBe(3); 

      // Try to exceed threshold with conditions
      // conditions (3) + requiresVision (3) + dynamicTarget (2) = 8
      const highResult = classifier.classify({
        action: 'custom',
        payload: { 
          conditions: true,
          requiresVision: true,
          dynamicTarget: true
        }
      });
      expect(highResult.destination).toBe('cloud');
      expect(highResult.complexityScore).toBe(8);
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined payload and context gracefully', () => {
      // Relying on default params
      const result = classifier.classify({ action: 'click' });
      expect(result.destination).toBe('local');
    });

    it('should handle lastError case insensitivity', () => {
      const result = classifier.classify({
        action: 'click',
        context: { lastError: 'RATE LIMIT' },
      });
      expect(result.destination).toBe('cloud');
    });

    it('should ignore lastError if it contains no keywords', () => {
      const result = classifier.classify({
        action: 'click',
        context: { lastError: 'Minor UI glitch' }, // Not in errorKeywords
      });
      // Should fall through to Routine Action (click -> local)
      expect(result.destination).toBe('local');
      expect(result.reason).toContain('Routine action');
    });
  });
});

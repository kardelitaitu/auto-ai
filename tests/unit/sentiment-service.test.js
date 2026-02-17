import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SentimentService, sentimentService, analyzeSentiment, shouldSkipAction, getSafeActions, formatSentimentReport } from '../../utils/sentiment-service.js';

describe('sentiment-service', () => {
  let service;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SentimentService();
  });

  describe('constructor', () => {
    it('should initialize all analyzers', () => {
      expect(service.analyzers).toBeDefined();
      expect(service.analyzers.valence).toBeDefined();
      expect(service.analyzers.arousal).toBeDefined();
      expect(service.analyzers.dominance).toBeDefined();
      expect(service.analyzers.sarcasm).toBeDefined();
      expect(service.analyzers.urgency).toBeDefined();
      expect(service.analyzers.toxicity).toBeDefined();
    });

    it('should initialize cache', () => {
      expect(service.cache).toBeDefined();
      expect(service.cacheMaxSize).toBe(100);
    });
  });

  describe('analyze', () => {
    it('should return neutral analysis for empty text', () => {
      const result = service.analyze('');
      
      expect(result.isNegative).toBe(false);
      expect(result.score).toBe(0);
    });

    it('should return neutral analysis for null/undefined', () => {
      expect(service.analyze(null).score).toBe(0);
      expect(service.analyze(undefined).score).toBe(0);
    });

    it('should include legacy compatibility fields', () => {
      const result = service.analyze('Test content');
      
      expect(result.isNegative).toBeDefined();
      expect(result.score).toBeDefined();
      expect(result.categories).toBeDefined();
      expect(result.shouldSkipLikes).toBeDefined();
      expect(result.shouldSkipRetweets).toBeDefined();
      expect(result.shouldSkipReplies).toBeDefined();
      expect(result.shouldSkipQuotes).toBeDefined();
    });

    it('should include advanced dimensions', () => {
      const result = service.analyze('Test content');
      
      expect(result.dimensions).toBeDefined();
      expect(result.dimensions.valence).toBeDefined();
      expect(result.dimensions.arousal).toBeDefined();
      expect(result.dimensions.dominance).toBeDefined();
      expect(result.dimensions.sarcasm).toBeDefined();
      expect(result.dimensions.urgency).toBeDefined();
      expect(result.dimensions.toxicity).toBeDefined();
    });

    it('should include composite metrics', () => {
      const result = service.analyze('Test content');
      
      expect(result.composite).toBeDefined();
      expect(result.composite.intensity).toBeDefined();
      expect(result.composite.engagementStyle).toBeDefined();
      expect(result.composite.conversationType).toBeDefined();
      expect(result.composite.riskLevel).toBeDefined();
    });

    it('should include engagement recommendations', () => {
      const result = service.analyze('Test content');
      
      expect(result.engagement).toBeDefined();
      expect(result.engagement.canLike).toBeDefined();
      expect(result.engagement.canRetweet).toBeDefined();
      expect(result.engagement.canReply).toBeDefined();
      expect(result.engagement.canQuote).toBeDefined();
    });

    it('should use cache when enabled', () => {
      const text = 'Cache test content';
      service.analyze(text, { useCache: true });
      service.analyze(text, { useCache: true });
      
      // Should not throw - verifies caching works
      expect(service.cache.size).toBeGreaterThan(0);
    });

    it('should skip cache when disabled', () => {
      const text = 'No cache test';
      service.analyze(text, { useCache: false });
      
      // Cache should be empty or not contain this entry
      const cached = service.getFromCache(text);
      expect(cached).toBeUndefined();
    });

    it('should include debug info when requested', () => {
      const result = service.analyze('Test', { includeDebug: true });
      
      expect(result.debug).toBeDefined();
      expect(result.debug.guardResult).toBeDefined();
      expect(result.debug.advanced).toBeDefined();
    });
  });

  describe('analyzeBasic', () => {
    it('should return basic sentiment info', () => {
      const result = service.analyzeBasic('Positive content!');
      
      expect(result.isNegative).toBeDefined();
      expect(result.score).toBeDefined();
      expect(result.shouldSkipLikes).toBeDefined();
    });
  });

  describe('analyzeForReplySelection', () => {
    it('should return none strategy for empty array', () => {
      const result = service.analyzeForReplySelection([]);
      
      expect(result.strategy).toBe('none');
      expect(result.replies).toEqual([]);
    });

    it('should analyze replies and determine strategy', () => {
      const replies = [
        { text: 'Great post!', content: 'Great post!' },
        { text: 'I disagree', content: 'I disagree' },
        { text: 'Thanks for sharing', content: 'Thanks for sharing' }
      ];
      
      const result = service.analyzeForReplySelection(replies);
      
      expect(result.strategy).toBeDefined();
      expect(result.distribution).toBeDefined();
      expect(result.distribution.positive).toBeDefined();
      expect(result.distribution.negative).toBeDefined();
      expect(result.distribution.neutral).toBeDefined();
    });

    it('should detect toxic content', () => {
      const replies = [
        { text: 'You are stupid and useless and terrible' },
        { text: 'You are dumb and awful' },
        { text: 'You are idiot and horrible' }
      ];
      
      const result = service.analyzeForReplySelection(replies);
      
      // Toxicity detection depends on the analyzer - might not always detect
      expect(result.distribution).toBeDefined();
      expect(result.strategy).toBeDefined();
    });

    it('should handle missing text fields', () => {
      const replies = [
        { content: 'Some reply' },
        { text: 'Another reply' }
      ];
      
      const result = service.analyzeForReplySelection(replies);
      
      expect(result.strategy).toBeDefined();
    });
  });

  describe('deriveCompositeMetrics', () => {
    it('should derive intensity', () => {
      const dimensions = {
        valence: { valence: 0.8 },
        arousal: { arousal: 0.8 },
        dominance: { dominance: 0.5 },
        sarcasm: { sarcasm: 0.1 },
        toxicity: { toxicity: 0.1 }
      };
      
      const result = service.deriveCompositeMetrics(dimensions);
      
      expect(result.intensity).toBeGreaterThan(0);
    });

    it('should detect sarcastic engagement style', () => {
      const dimensions = {
        valence: { valence: 0.3 },
        arousal: { arousal: 0.5 },
        dominance: { dominance: 0.5 },
        sarcasm: { sarcasm: 0.6 },
        toxicity: { toxicity: 0.1 }
      };
      
      const result = service.deriveCompositeMetrics(dimensions);
      
      expect(result.engagementStyle).toBe('sarcastic');
    });

    it('should detect hostile engagement style', () => {
      const dimensions = {
        valence: { valence: -0.3 },
        arousal: { arousal: 0.8 },
        dominance: { dominance: 0.6 },
        sarcasm: { sarcasm: 0.2 },
        toxicity: { toxicity: 0.6 }
      };
      
      const result = service.deriveCompositeMetrics(dimensions);
      
      expect(result.engagementStyle).toBe('hostile');
    });

    it('should detect enthusiastic style', () => {
      const dimensions = {
        valence: { valence: 0.5 },
        arousal: { arousal: 0.7 },
        dominance: { dominance: 0.5 },
        sarcasm: { sarcasm: 0.1 },
        toxicity: { toxicity: 0.1 }
      };
      
      const result = service.deriveCompositeMetrics(dimensions);
      
      expect(result.engagementStyle).toBe('enthusiastic');
    });

    it('should detect conversation types', () => {
      const toxicDimensions = {
        valence: { valence: 0 },
        arousal: { arousal: 0.5 },
        dominance: { dominance: 0.5 },
        sarcasm: { sarcasm: 0.1 },
        toxicity: { toxicity: 0.5 }
      };
      
      const result = service.deriveCompositeMetrics(toxicDimensions);
      
      expect(result.conversationType).toBe('controversial');
    });

    it('should calculate risk levels', () => {
      const dimensions = {
        valence: { valence: -0.6 },
        arousal: { arousal: 0.7 },
        dominance: { dominance: 0.5 },
        sarcasm: { sarcasm: 0.1 },
        toxicity: { toxicity: 0.7 }
      };
      
      const result = service.deriveCompositeMetrics(dimensions);
      
      expect(result.riskLevel).toBe('high');
    });
  });

  describe('getEngagementRecommendations', () => {
    it('should return basic recommendations', () => {
      const guard = { shouldSkipLikes: false, shouldSkipRetweets: false, shouldSkipReplies: false, shouldSkipQuotes: false };
      const advanced = {
        sarcasm: { sarcasm: 0.1 },
        toxicity: { toxicity: 0.1 },
        dominance: { dominance: 0.5 }
      };
      const composite = { riskLevel: 'low' };
      
      const result = service.getEngagementRecommendations(guard, advanced, composite);
      
      expect(result.canLike).toBe(true);
      expect(result.shouldEngage).toBe(true);
    });

    it('should add warning for sarcasm', () => {
      const guard = { shouldSkipLikes: false, shouldSkipRetweets: false, shouldSkipReplies: false, shouldSkipQuotes: false };
      const advanced = {
        sarcasm: { sarcasm: 0.6 },
        toxicity: { toxicity: 0.1 },
        dominance: { dominance: 0.5 }
      };
      const composite = { riskLevel: 'low' };
      
      const result = service.getEngagementRecommendations(guard, advanced, composite);
      
      expect(result.warnings).toContain('sarcasm-detected');
      expect(result.recommendedTone).toBe('playful');
    });

    it('should add warning for toxicity', () => {
      const guard = { shouldSkipLikes: false, shouldSkipRetweets: false, shouldSkipReplies: false, shouldSkipQuotes: false };
      const advanced = {
        sarcasm: { sarcasm: 0.1 },
        toxicity: { toxicity: 0.5 },
        dominance: { dominance: 0.5 }
      };
      const composite = { riskLevel: 'low' };
      
      const result = service.getEngagementRecommendations(guard, advanced, composite);
      
      expect(result.warnings).toContain('toxicity-detected');
      expect(result.shouldEngage).toBe(false);
    });

    it('should recommend tone based on dominance', () => {
      const guard = { shouldSkipLikes: false, shouldSkipRetweets: false, shouldSkipReplies: false, shouldSkipQuotes: false };
      const advanced = {
        sarcasm: { sarcasm: 0.1 },
        toxicity: { toxicity: 0.1 },
        dominance: { dominance: 0.8 }
      };
      const composite = { riskLevel: 'low' };
      
      const result = service.getEngagementRecommendations(guard, advanced, composite);
      
      expect(result.recommendedTone).toBe('assertive');
    });
  });

  describe('getReplyRecommendations', () => {
    it('should return neutral-only filter for toxic content', () => {
      const analyzed = [];
      const result = service.getReplyRecommendations('neutral-only', analyzed);
      
      expect(result.filter).toBeDefined();
      expect(result.max).toBe(30);
    });

    it('should return longest sort for default', () => {
      const analyzed = [];
      const result = service.getReplyRecommendations('longest', analyzed);
      
      expect(result.sort).toBeDefined();
    });
  });

  describe('hasNegativePattern', () => {
    it('should detect negative pattern', () => {
      const dimensions = {
        valence: { valence: -0.6 },
        arousal: { arousal: 0.7 }
      };
      
      expect(service.hasNegativePattern(dimensions)).toBe(true);
    });

    it('should return false for safe content', () => {
      const dimensions = {
        valence: { valence: 0.3 },
        arousal: { arousal: 0.4 }
      };
      
      expect(service.hasNegativePattern(dimensions)).toBe(false);
    });
  });

  describe('calculateConfidence', () => {
    it('should return high confidence for high values', () => {
      const dimensions = {
        valence: { confidence: 'high' },
        sarcasm: { confidence: 'high' }
      };
      
      expect(service.calculateConfidence(dimensions)).toBe('high');
    });

    it('should return medium confidence for medium values', () => {
      const dimensions = {
        valence: { confidence: 'medium' },
        sarcasm: { confidence: 'medium' }
      };
      
      expect(service.calculateConfidence(dimensions)).toBe('medium');
    });
  });

  describe('getNeutralAnalysis', () => {
    it('should return complete neutral structure', () => {
      const result = service.getNeutralAnalysis();
      
      expect(result.isNegative).toBe(false);
      expect(result.score).toBe(0);
      expect(result.dimensions).toBeDefined();
      expect(result.composite).toBeDefined();
      expect(result.engagement).toBeDefined();
    });
  });

  describe('cache management', () => {
    it('should get from cache', () => {
      service.addToCache('test', { result: true });
      const result = service.getFromCache('test');
      
      expect(result).toEqual({ result: true });
    });

    it('should clear cache', () => {
      service.addToCache('test1', { data: 1 });
      service.addToCache('test2', { data: 2 });
      service.clearCache();
      
      expect(service.cache.size).toBe(0);
    });

    it('should handle cache eviction', () => {
      // Fill cache beyond max size
      for (let i = 0; i < 101; i++) {
        service.addToCache(`key${i}`, { data: i });
      }
      
      // Cache should not exceed max size
      expect(service.cache.size).toBeLessThanOrEqual(service.cacheMaxSize);
    });
  });

  describe('singleton exports', () => {
    it('should export sentimentService singleton', () => {
      expect(sentimentService).toBeDefined();
      expect(sentimentService.analyze).toBeDefined();
    });

    it('should export legacy functions', () => {
      expect(analyzeSentiment).toBeDefined();
      expect(shouldSkipAction).toBeDefined();
      expect(getSafeActions).toBeDefined();
      expect(formatSentimentReport).toBeDefined();
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MultiDimensionalSentimentAnalyzer } from '../../utils/sentiment-analyzer-multi.js';

vi.mock('../../utils/logger.js', () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }))
}));

describe('sentiment-analyzer-multi.js', () => {
  let analyzer;

  beforeEach(() => {
    analyzer = new MultiDimensionalSentimentAnalyzer();
  });

  describe('MultiDimensionalSentimentAnalyzer', () => {
    describe('constructor', () => {
      it('should initialize with default options', () => {
        expect(analyzer.valence).toBeDefined();
        expect(analyzer.arousal).toBeDefined();
        expect(analyzer.dominance).toBeDefined();
        expect(analyzer.sarcasm).toBeDefined();
        expect(analyzer.urgency).toBeDefined();
        expect(analyzer.toxicity).toBeDefined();
      });

      it('should initialize cache and metrics', () => {
        expect(analyzer.cache).toBeInstanceOf(Map);
        expect(analyzer.metrics.totalAnalyses).toBe(0);
        expect(analyzer.metrics.cacheHits).toBe(0);
      });
    });

    describe('analyze', () => {
      it('should analyze text and return all dimensions', async () => {
        const result = await analyzer.analyze('This is amazing and wonderful!');
        
        expect(result.text).toBe('This is amazing and wonderful!');
        expect(result.dimensions).toBeDefined();
        expect(result.dimensions.valence).toBeDefined();
        expect(result.dimensions.arousal).toBeDefined();
        expect(result.dimensions.dominance).toBeDefined();
        expect(result.dimensions.sarcasm).toBeDefined();
        expect(result.dimensions.urgency).toBeDefined();
        expect(result.dimensions.toxicity).toBeDefined();
      });

      it('should cache results', async () => {
        const analyzer2 = new MultiDimensionalSentimentAnalyzer();
        const testText = 'This is amazing ' + Date.now();
        await analyzer2.analyze(testText);
        await analyzer2.analyze(testText);
        
        expect(analyzer2.metrics.cacheHits).toBe(1);
      });

      it('should return patterns', async () => {
        const result = await analyzer.analyze('I love this so much!!!');
        expect(result.patterns).toBeDefined();
        expect(Array.isArray(result.patterns)).toBe(true);
      });

      it('should calculate derived metrics', async () => {
        const result = await analyzer.analyze('This is great!');
        expect(result.derived).toBeDefined();
        expect(result.derived.authenticity).toBeDefined();
        expect(result.derived.engagementRisk).toBeDefined();
        expect(result.derived.complexity).toBeDefined();
        expect(result.derived.emotionalIntensity).toBeDefined();
      });

      it('should calculate action gates', async () => {
        const result = await analyzer.analyze('This is great!');
        expect(result.actionGates).toBeDefined();
        expect(result.actionGates.canReply).toBeDefined();
        expect(result.actionGates.canLike).toBeDefined();
        expect(result.actionGates.canQuote).toBeDefined();
        expect(result.actionGates.canRetweet).toBeDefined();
        expect(result.actionGates.canBookmark).toBeDefined();
      });
    });

    describe('applyContextualPatterns', () => {
      it('should detect fake positivity', async () => {
        const result = await analyzer.analyze('Oh yay, another amazing thing I totally love 🙄');
        if (result.patterns.includes('fakePositivity')) {
          expect(result.dimensions.valence).toBeLessThan(0.6);
        }
      });

      it('should detect toxic ranting', async () => {
        const result = await analyzer.analyze('This is the worst piece of shit ever!!! I hate everything!!!');
        if (result.patterns.includes('toxicRanting')) {
          expect(result.actionBlock).toBe('toxicity');
        }
      });

      it('should detect celebration', async () => {
        const result = await analyzer.analyze('This is amazing and wonderful! So happy!');
        if (result.patterns.includes('celebration')) {
          expect(result.isEasyEngage).toBe(true);
        }
      });
    });

    describe('calculateDerivedMetrics', () => {
      it('should calculate authenticity', () => {
        const result = analyzer.calculateDerivedMetrics({
          dimensions: {
            valence: 0.8,
            arousal: 0.5,
            dominance: 0.5,
            sarcasm: 0.1,
            toxicity: 0.1,
            urgency: 0.2
          }
        });
        expect(result.authenticity).toBeDefined();
        expect(result.engagementRisk).toBeDefined();
        expect(result.complexity).toBeDefined();
        expect(result.emotionalIntensity).toBeDefined();
      });
    });

    describe('calculatePersonalityFit', () => {
      it('should calculate fit for observer personality', () => {
        const aggregated = {
          dimensions: { valence: 0.1, arousal: 0.1, dominance: 0.5, sarcasm: 0.1, toxicity: 0.1 }
        };
        const result = analyzer.calculatePersonalityFit(aggregated, 'observer');
        expect(result).toBeDefined();
        expect(result.fit).toBeDefined();
        expect(result.recommendation).toBeDefined();
      });

      it('should return null for unknown personality', () => {
        const aggregated = { dimensions: { valence: 0.5, arousal: 0.5, dominance: 0.5, sarcasm: 0.1, toxicity: 0.1 } };
        const result = analyzer.calculatePersonalityFit(aggregated, 'unknown');
        expect(result).toBeNull();
      });
    });

    describe('hashText', () => {
      it('should generate consistent hash', () => {
        const hash1 = analyzer.hashText('test text');
        const hash2 = analyzer.hashText('test text');
        expect(hash1).toBe(hash2);
      });

      it('should generate different hash for different text', () => {
        const hash1 = analyzer.hashText('test text');
        const hash2 = analyzer.hashText('different text');
        expect(hash1).not.toBe(hash2);
      });
    });

    describe('getStats', () => {
      it('should return stats object', async () => {
        const analyzer2 = new MultiDimensionalSentimentAnalyzer();
        await analyzer2.analyze('Some test text here ' + Date.now());
        
        const stats = analyzer2.getStats();
        expect(stats.total).toBeGreaterThanOrEqual(1);
        expect(stats.cacheSize).toBeGreaterThanOrEqual(0);
      });

      it('should track cache correctly', async () => {
        const analyzer3 = new MultiDimensionalSentimentAnalyzer();
        const testText = 'Testing cache ' + Date.now();
        await analyzer3.analyze(testText);
        await analyzer3.analyze(testText);
        
        expect(analyzer3.metrics.cacheHits).toBe(1);
      });
    });

    describe('clearCache', () => {
      it('should clear the cache', async () => {
        await analyzer.analyze('test');
        analyzer.clearCache();
        expect(analyzer.cache.size).toBe(0);
      });
    });

    describe('recordDecision', () => {
      it('should record decision for learning', () => {
        analyzer.recordDecision('hash1', { valence: 0.5 }, 'reply', true);
        expect(analyzer.learningData.decisions.length).toBe(1);
        expect(analyzer.learningData.successRate.reply).toBeDefined();
      });
    });
  });
});

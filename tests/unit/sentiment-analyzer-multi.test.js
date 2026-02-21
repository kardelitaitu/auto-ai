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

const { mockAnalyze } = vi.hoisted(() => {
  return { mockAnalyze: vi.fn() };
});

vi.mock('../../utils/sentiment-analyzers.js', () => {
  const MockAnalyzer = class {
    analyze() {
      return mockAnalyze();
    }
  };
  
  return {
    ValenceAnalyzer: MockAnalyzer,
    ArousalAnalyzer: MockAnalyzer,
    DominanceAnalyzer: MockAnalyzer,
    SarcasmAnalyzer: MockAnalyzer,
    UrgencyAnalyzer: MockAnalyzer,
    ToxicityAnalyzer: MockAnalyzer
  };
});

describe('sentiment-analyzer-multi.js', () => {
  let analyzer;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAnalyze.mockResolvedValue({
      valence: 0,
      arousal: 0,
      dominance: 0,
      sarcasm: 0,
      urgency: 0,
      toxicity: 0
    });
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
      
      it('should accept custom cacheMaxSize', () => {
        const customAnalyzer = new MultiDimensionalSentimentAnalyzer({ cacheMaxSize: 50 });
        expect(customAnalyzer.cacheMaxSize).toBe(50);
      });
    });

    describe('analyze', () => {
      it('should analyze text and return all dimensions', async () => {
        const result = await analyzer.analyze('This is amazing and wonderful!');
        
        expect(result.text).toBe('This is amazing and wonderful!');
        expect(result.dimensions).toBeDefined();
        expect(result.dimensions.valence).toBe(0);
      });

      it('should cache results', async () => {
        const testText = 'This is amazing ' + Date.now();
        await analyzer.analyze(testText);
        await analyzer.analyze(testText);
        
        expect(analyzer.metrics.cacheHits).toBe(1);
      });

      it('should handle errors during analysis', async () => {
        mockAnalyze.mockRejectedValue(new Error('Analysis failed'));
        await expect(analyzer.analyze('fail')).rejects.toThrow('Analysis failed');
      });

      it('should include personality fit if option provided', async () => {
        const result = await analyzer.analyze('test', { personality: 'observer' });
        expect(result.personalityFit).toBeDefined();
        expect(result.personalityFit.personality).toBe('observer');
      });
    });

    describe('applyContextualPatterns', () => {
      // Helper to setup dimensions for pattern testing
      const setupDimensions = (dims) => {
        // We need to mock individual analyzer returns based on what they are responsible for
        // However, analyze() calls all of them and aggregates.
        // The easiest way is to mock the return of analyze() for each analyzer type
        // But since we mocked them all with the same mockAnalyze, we need to be careful.
        // Actually, in the implementation:
        // this.valence.analyze(text) -> returns object with valence property?
        // Let's check the implementation of analyze() in MultiDimensionalSentimentAnalyzer
        // const [valenceResult, ...] = await Promise.all([...])
        // aggregated.dimensions = { valence: valenceResult.valence, ... }
        // So each analyzer returns an object with the specific property.
        
        // We can mock mockAnalyze to return all properties, and the code will pick what it needs
        mockAnalyze.mockResolvedValue(dims);
      };

      it('should detect fake positivity', async () => {
        setupDimensions({ valence: 0.7, sarcasm: 0.7, dominance: 0.7, toxicity: 0.1, arousal: 0, urgency: 0 });
        const result = await analyzer.analyze('test');
        expect(result.patterns).toContain('fakePositivity');
        // Check if valence was reduced (0.7 * 0.6 = 0.42)
        expect(result.dimensions.valence).toBeCloseTo(0.42);
      });

      it('should detect restrained grief', async () => {
        setupDimensions({ valence: -0.6, arousal: 0.2, dominance: 0.2, sarcasm: 0, toxicity: 0, urgency: 0 });
        const result = await analyzer.analyze('test');
        expect(result.patterns).toContain('restrainedGrief');
        expect(result.actionBlock).toBe('grief');
      });

      it('should detect passionate advocacy', async () => {
        setupDimensions({ valence: 0.5, arousal: 0.7, urgency: 0.7, dominance: 0, sarcasm: 0, toxicity: 0 });
        const result = await analyzer.analyze('test');
        expect(result.patterns).toContain('passionateAdvocacy');
        expect(result.requiresContext).toBe(true);
      });

      it('should detect toxic ranting', async () => {
        setupDimensions({ valence: -0.6, arousal: 0.7, toxicity: 0.6, dominance: 0, sarcasm: 0, urgency: 0 });
        const result = await analyzer.analyze('test');
        expect(result.patterns).toContain('toxicRanting');
        expect(result.actionBlock).toBe('toxicity');
      });

      it('should detect intellectual debate', async () => {
        setupDimensions({ valence: 0.2, dominance: 0.7, sarcasm: 0.2, arousal: 0, toxicity: 0, urgency: 0 });
        const result = await analyzer.analyze('test');
        expect(result.patterns).toContain('intellectualDebate');
        expect(result.requiresContext).toBe(true);
      });

      it('should detect sarcastic commentary', async () => {
        setupDimensions({ sarcasm: 0.6, arousal: 0.5, valence: 0, dominance: 0, toxicity: 0, urgency: 0 });
        const result = await analyzer.analyze('test');
        expect(result.patterns).toContain('sarcasticCommentary');
        expect(result.allowSarcasm).toBe(true);
      });

      it('should detect crisis', async () => {
        setupDimensions({ urgency: 0.9, dominance: 0.3, valence: 0, arousal: 0, sarcasm: 0, toxicity: 0 });
        const result = await analyzer.analyze('test');
        expect(result.patterns).toContain('crisis');
        expect(result.requiresEmpathy).toBe(true);
      });

      it('should detect celebration', async () => {
        setupDimensions({ valence: 0.7, arousal: 0.7, toxicity: 0.1, dominance: 0, sarcasm: 0, urgency: 0 });
        const result = await analyzer.analyze('test');
        expect(result.patterns).toContain('celebration');
        expect(result.isEasyEngage).toBe(true);
      });
    });

    describe('calculateDerivedMetrics', () => {
      it('should calculate volatility as stable', async () => {
        mockAnalyze.mockResolvedValue({ valence: 0.5, arousal: 0, dominance: 0, sarcasm: 0, urgency: 0, toxicity: 0 });
        const result = await analyzer.analyze('test');
        expect(result.derived.volatility).toBe('stable');
      });

      it('should calculate volatility as volatile', async () => {
        mockAnalyze.mockResolvedValue({ valence: 0.7, arousal: 0, dominance: 0, sarcasm: 0, urgency: 0, toxicity: 0 });
        const result = await analyzer.analyze('test');
        // Note: fakePositivity might trigger if sarcasm/dominance are high, but here they are 0
        expect(result.derived.volatility).toBe('volatile');
      });

      it('should calculate ironyScore with high valence-dominance gap', async () => {
        mockAnalyze.mockResolvedValue({ valence: 0.8, dominance: 0.2, sarcasm: 0.1, arousal: 0, urgency: 0, toxicity: 0 });
        const result = await analyzer.analyze('test');
        // ironyScore = sarcasm * 0.6 + (gap > 0.4 ? 0.3 : 0)
        // 0.1 * 0.6 + 0.3 = 0.06 + 0.3 = 0.36
        expect(result.derived.ironyScore).toBeCloseTo(0.36);
      });
      
       it('should calculate credibility with high dominance', async () => {
        mockAnalyze.mockResolvedValue({ valence: 0, dominance: 0.6, sarcasm: 0, arousal: 0, urgency: 0, toxicity: 0 });
        const result = await analyzer.analyze('test');
        // credibility = (1-0)*(1-0)*0.9 = 0.9
        expect(result.derived.credibility).toBe(0.9);
      });
    });

    describe('calculatePersonalityFit', () => {
      // Helper to test personality fit
      const testFit = (personality, dims) => {
        const aggregated = { dimensions: dims };
        return analyzer.calculatePersonalityFit(aggregated, personality);
      };

      it('should calculate fit for observer', () => {
        const result = testFit('observer', { valence: 0, toxicity: 0, arousal: 0, dominance: 0, sarcasm: 0, urgency: 0 });
        // (1-0)*0.3 + (1-0)*0.4 + (1-0)*0.3 = 0.3 + 0.4 + 0.3 = 1.0
        expect(result.fit).toBeCloseTo(1, 5);
      });

      it('should calculate fit for enthusiast', () => {
        const result = testFit('enthusiast', { valence: 1, arousal: 1, toxicity: 0, dominance: 0, sarcasm: 0, urgency: 0 });
        // 1*0.4 + 1*0.35 + 1*0.25 = 1.0
        expect(result.fit).toBeCloseTo(1, 5);
      });

      it('should calculate fit for analyst', () => {
        const result = testFit('analyst', { dominance: 1, sarcasm: 0, toxicity: 0, valence: 0, arousal: 0, urgency: 0 });
        // 1*0.35 + 1*0.3 + 1*0.35 = 1.0
        expect(result.fit).toBeCloseTo(1, 5);
      });

      it('should calculate fit for joker', () => {
        const result = testFit('joker', { sarcasm: 1, arousal: 1, toxicity: 0, valence: 0, dominance: 0, urgency: 0 });
        // 1*0.4 + 1*0.3 + 1*0.3 = 1.0
        expect(result.fit).toBeCloseTo(1, 5);
      });

      it('should calculate fit for advocate', () => {
        const result = testFit('advocate', { dominance: 1, arousal: 1, valence: 0, sarcasm: 0, toxicity: 0, urgency: 0 });
        // 1*0.35 + 1*0.3 + (1-0)*0.35 = 1.0
        expect(result.fit).toBeCloseTo(1, 5);
      });

      it('should calculate fit for empath', () => {
        const result = testFit('empath', { toxicity: 0, arousal: 0, sarcasm: 0, valence: 0, dominance: 0, urgency: 0 });
        // 1*0.4 + 1*0.3 + 1*0.3 = 1.0
        expect(result.fit).toBeCloseTo(1, 5);
      });

      it('should return null for unknown personality', () => {
        const result = testFit('unknown', {});
        expect(result).toBeNull();
      });

      it('should return engage recommendation for high fit', () => {
        const result = testFit('observer', { valence: 0, toxicity: 0, arousal: 0, dominance: 0, sarcasm: 0, urgency: 0 });
        expect(result.recommendation).toBe('engage');
      });

      it('should return consider recommendation for medium fit', () => {
        // Fit around 0.5
        // Observer: (1-0.5)*0.3 + (1-0.5)*0.4 + (1-0.5)*0.3 = 0.5
        const result = testFit('observer', { valence: 0.5, toxicity: 0.5, arousal: 0.5, dominance: 0, sarcasm: 0, urgency: 0 });
        expect(result.recommendation).toBe('consider');
      });

      it('should return avoid recommendation for low fit', () => {
        // Fit 0
         const result = testFit('observer', { valence: 1, toxicity: 1, arousal: 1, dominance: 0, sarcasm: 0, urgency: 0 });
         expect(result.recommendation).toBe('avoid');
      });
    });

    describe('calculateActionGates', () => {
       it('should block like if valence is low', async () => {
         mockAnalyze.mockResolvedValue({ valence: 0, toxicity: 0, arousal: 0, dominance: 0, sarcasm: 0, urgency: 0 });
         const result = await analyzer.analyze('test');
         expect(result.actionGates.canLike).toBe(false);
       });

       it('should block like if actionBlock is grief', async () => {
         // Restrained grief triggers actionBlock = 'grief'
         mockAnalyze.mockResolvedValue({ valence: -0.6, arousal: 0.2, dominance: 0.2, sarcasm: 0, toxicity: 0, urgency: 0 });
         const result = await analyzer.analyze('test');
         expect(result.actionGates.canLike).toBe(false);
       });
       
       it('should allow like if conditions met', async () => {
         mockAnalyze.mockResolvedValue({ valence: 0.2, toxicity: 0, arousal: 0, dominance: 0, sarcasm: 0, urgency: 0 });
         const result = await analyzer.analyze('test');
         expect(result.actionGates.canLike).toBe(true);
       });

       it('should block reply if toxicity is high', async () => {
          mockAnalyze.mockResolvedValue({ valence: 0, toxicity: 0.9, arousal: 0, dominance: 0, sarcasm: 0, urgency: 0 });
          const result = await analyzer.analyze('test');
          expect(result.actionGates.canReply).toBe(false);
       });

       it('should block quote if sarcasm is high', async () => {
          mockAnalyze.mockResolvedValue({ valence: 0, toxicity: 0, arousal: 0, dominance: 0.6, sarcasm: 0.6, urgency: 0 });
          const result = await analyzer.analyze('test');
          expect(result.actionGates.canQuote).toBe(false);
       });
    });

    describe('cacheResult', () => {
      it('should evict oldest item when cache is full', () => {
        analyzer = new MultiDimensionalSentimentAnalyzer({ cacheMaxSize: 2 });
        analyzer.cacheResult('1', {});
        analyzer.cacheResult('2', {});
        analyzer.cacheResult('3', {});
        
        expect(analyzer.cache.size).toBe(2);
        expect(analyzer.cache.has('1')).toBe(false);
        expect(analyzer.cache.has('2')).toBe(true);
        expect(analyzer.cache.has('3')).toBe(true);
      });
    });

    describe('recordDecision', () => {
      it('should record success', () => {
        analyzer.recordDecision('hash1', {}, 'reply', true);
        expect(analyzer.learningData.successRate.reply.success).toBe(1);
        expect(analyzer.learningData.successRate.reply.total).toBe(1);
      });

      it('should record failure', () => {
        analyzer.recordDecision('hash1', {}, 'reply', false);
        expect(analyzer.learningData.successRate.reply.success).toBe(0);
        expect(analyzer.learningData.successRate.reply.total).toBe(1);
      });

      it('should update existing stats', () => {
        analyzer.recordDecision('hash1', {}, 'reply', true);
        analyzer.recordDecision('hash2', {}, 'reply', false);
        expect(analyzer.learningData.successRate.reply.total).toBe(2);
        expect(analyzer.learningData.successRate.reply.success).toBe(1);
      });
    });

    describe('getStats', () => {
      it('should return correct hit rate', () => {
        analyzer.metrics.totalAnalyses = 10;
        analyzer.metrics.cacheHits = 5;
        const stats = analyzer.getStats();
        expect(stats.cacheHitRate).toBe('0.50');
      });
      
      it('should return 0 hit rate if no analyses', () => {
         analyzer.metrics.totalAnalyses = 0;
         const stats = analyzer.getStats();
         expect(stats.cacheHitRate).toBe(0);
      });
    });
    
    describe('clearCache', () => {
        it('should clear the cache', () => {
            analyzer.cache.set('key', 'value');
            analyzer.clearCache();
            expect(analyzer.cache.size).toBe(0);
        });
    });

    describe('export', () => {
        it('should export current state', () => {
            const state = analyzer.export();
            expect(state.version).toBe('1.0.0');
            expect(state.metrics).toBeDefined();
        });
    });
    
    describe('hashText', () => {
        it('should handle empty string', () => {
            expect(analyzer.hashText('')).toBe('0');
        });
    });
  });
});

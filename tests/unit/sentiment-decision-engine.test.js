import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SentimentDecisionEngine } from '../../utils/sentiment-decision-engine.js';

vi.mock('../../utils/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe('SentimentDecisionEngine', () => {
  let engine;
  let mockAnalyzer;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockAnalyzer = {
      analyze: vi.fn()
    };

    engine = new SentimentDecisionEngine(mockAnalyzer, {
      replyProbability: 0.5,
      likeProbability: 0.7,
      quoteProbability: 0.3,
      maxRiskTolerance: 0.6
    });
  });

  describe('constructor', () => {
    it('should initialize with default config values', () => {
      const engine = new SentimentDecisionEngine(mockAnalyzer);
      
      expect(engine.config.replyProbability).toBe(0.5);
      expect(engine.config.likeProbability).toBe(0.7);
      expect(engine.config.quoteProbability).toBe(0.5);
      expect(engine.config.maxRiskTolerance).toBe(0.6);
    });

    it('should initialize with custom config values', () => {
      expect(engine.config.maxRiskTolerance).toBe(0.6);
    });

    it('should initialize empty stats', () => {
      expect(engine.stats.decisions).toEqual([]);
      expect(engine.stats.blockers).toEqual({});
      expect(engine.stats.fallbacks).toEqual({});
    });
  });

  describe('makeEngagementDecision', () => {
    it('should proceed when action is allowed and risk is low', async () => {
      const sentimentResult = {
        actionGates: { canReply: true },
        actionBlock: null,
        dimensions: { toxicity: 0.1, valence: 0.5, sarcasm: 0.1, urgency: 0.2, arousal: 0.3, dominance: 0.4 },
        derived: { credibility: 0.8, emotionalIntensity: 0.2, engagementRisk: 0.1, complexity: 0.5 },
        patterns: [],
        personalityFit: { fit: 0.8 }
      };

      mockAnalyzer.analyze.mockResolvedValue(sentimentResult);

      const decision = await engine.makeEngagementDecision('some text', 'reply', { personality: 'observer' });

      expect(decision.allowed).toBe(true);
      expect(decision.action).toBe('reply');
      expect(decision.riskLevel).toBe('low');
      expect(decision.sentimentAnalysis).toBe(sentimentResult);
    });

    it('should block action when gates prevent it', async () => {
      const sentimentResult = {
        actionGates: { canReply: false, canLike: true },
        actionBlock: null,
        dimensions: { toxicity: 0.1, valence: 0.5, sarcasm: 0.1, urgency: 0.2 },
        derived: { credibility: 0.8, emotionalIntensity: 0.2 }
      };

      mockAnalyzer.analyze.mockResolvedValue(sentimentResult);

      const decision = await engine.makeEngagementDecision('some text', 'reply');

      expect(decision.allowed).toBe(false);
      expect(decision.reason).toBe('Reply blocked by gates');
      expect(decision.blockType).toBe('gate');
      expect(decision.fallback.action).toBe('like');
    });

    it('should block action when risk is too high', async () => {
      const sentimentResult = {
        actionGates: { canReply: true, canLike: true },
        actionBlock: null,
        dimensions: { toxicity: 0.8, valence: -0.8, sarcasm: 0.1, urgency: 0.2 },
        derived: { credibility: 0.2, emotionalIntensity: 0.8 }
      };

      mockAnalyzer.analyze.mockResolvedValue(sentimentResult);

      const decision = await engine.makeEngagementDecision('some text', 'reply');

      expect(decision.allowed).toBe(false);
      expect(decision.blockType).toBe('risk');
      expect(decision.fallback.action).toBe('like');
    });

    it('should handle errors during analysis', async () => {
      const error = new Error('Analysis failed');
      mockAnalyzer.analyze.mockRejectedValue(error);

      await expect(engine.makeEngagementDecision('some text', 'reply'))
        .rejects.toThrow('Analysis failed');
    });
  });

  describe('checkActionGates', () => {
    it('should allow action when gate is open (reply)', () => {
      const sentimentResult = {
        actionGates: { canReply: true, canLike: true, canQuote: true },
        actionBlock: null
      };

      const result = engine.checkActionGates(sentimentResult, 'reply');

      expect(result.allowed).toBe(true);
    });

    it('should allow action when gate is open (like)', () => {
      const sentimentResult = {
        actionGates: { canReply: true, canLike: true, canQuote: true },
        actionBlock: null
      };

      const result = engine.checkActionGates(sentimentResult, 'like');

      expect(result.allowed).toBe(true);
    });

    it('should allow action when gate is open (quote)', () => {
      const sentimentResult = {
        actionGates: { canReply: true, canLike: true, canQuote: true },
        actionBlock: null
      };

      const result = engine.checkActionGates(sentimentResult, 'quote');

      expect(result.allowed).toBe(true);
    });

    it('should allow action when gate is open (retweet)', () => {
      const sentimentResult = {
        actionGates: { canRetweet: true },
        actionBlock: null
      };

      const result = engine.checkActionGates(sentimentResult, 'retweet');

      expect(result.allowed).toBe(true);
    });

    it('should allow action when gate is open (bookmark)', () => {
      const sentimentResult = {
        actionGates: { canBookmark: true },
        actionBlock: null
      };

      const result = engine.checkActionGates(sentimentResult, 'bookmark');

      expect(result.allowed).toBe(true);
    });

    it('should block action when gate is closed (reply)', () => {
      const sentimentResult = {
        actionGates: { canReply: false, canLike: true, canQuote: true },
        actionBlock: null
      };

      const result = engine.checkActionGates(sentimentResult, 'reply');

      expect(result.allowed).toBe(false);
      expect(result.blockType).toBe('gate');
    });

    it('should block action when gate is closed (like)', () => {
      const sentimentResult = {
        actionGates: { canReply: true, canLike: false, canQuote: true },
        actionBlock: null
      };

      const result = engine.checkActionGates(sentimentResult, 'like');

      expect(result.allowed).toBe(false);
      expect(result.blockType).toBe('gate');
    });

    it('should block action when gate is closed (quote)', () => {
      const sentimentResult = {
        actionGates: { canReply: true, canLike: true, canQuote: false },
        actionBlock: null
      };

      const result = engine.checkActionGates(sentimentResult, 'quote');

      expect(result.allowed).toBe(false);
      expect(result.blockType).toBe('gate');
    });

    it('should block action when gate is closed (retweet)', () => {
        const sentimentResult = {
          actionGates: { canRetweet: false },
          actionBlock: null
        };
  
        const result = engine.checkActionGates(sentimentResult, 'retweet');
  
        expect(result.allowed).toBe(false);
        expect(result.blockType).toBe('gate');
    });

    it('should block action when gate is closed (bookmark)', () => {
        const sentimentResult = {
          actionGates: { canBookmark: false },
          actionBlock: null
        };
  
        const result = engine.checkActionGates(sentimentResult, 'bookmark');
  
        expect(result.allowed).toBe(false);
        expect(result.blockType).toBe('gate');
    });

    it('should block action when actionBlock is grief', () => {
      const sentimentResult = {
        actionGates: { canReply: true, canLike: true, canQuote: true },
        actionBlock: 'grief'
      };

      const result = engine.checkActionGates(sentimentResult, 'reply');

      expect(result.allowed).toBe(false);
      expect(result.blockType).toBe('grief');
    });

    it('should block action when actionBlock is toxicity', () => {
      const sentimentResult = {
        actionGates: { canReply: true, canLike: true, canQuote: true },
        actionBlock: 'toxicity'
      };

      const result = engine.checkActionGates(sentimentResult, 'reply');

      expect(result.allowed).toBe(false);
      expect(result.blockType).toBe('toxicity');
    });
  });

  describe('assessRisk', () => {
    it('should return low risk for safe content', () => {
      const sentimentResult = {
        dimensions: { toxicity: 0.1, valence: 0.5, sarcasm: 0.1, urgency: 0.2 },
        derived: { credibility: 0.8, emotionalIntensity: 0.2 }
      };

      const result = engine.assessRisk(sentimentResult, 'like');

      expect(result.risk).toBeLessThan(0.4);
      expect(result.level).toBe('low');
      expect(result.shouldReviewManually).toBe(false);
    });

    it('should return high risk for toxic content', () => {
      const sentimentResult = {
        dimensions: { toxicity: 0.9, valence: -0.3, sarcasm: 0.2, urgency: 0.3 },
        derived: { credibility: 0.5, emotionalIntensity: 0.4 }
      };

      const result = engine.assessRisk(sentimentResult, 'reply');

      expect(result.risk).toBeGreaterThanOrEqual(0.3);
      expect(result.factors).toContainEqual(
        expect.objectContaining({ factor: 'toxicity' })
      );
    });

    it('should increase risk for negative valence + reply', () => {
      const sentimentResult = {
        dimensions: { toxicity: 0.2, valence: -0.7, sarcasm: 0.1, urgency: 0.2 },
        derived: { credibility: 0.6, emotionalIntensity: 0.3 }
      };

      const result = engine.assessRisk(sentimentResult, 'reply');

      expect(result.factors).toContainEqual(
        expect.objectContaining({ factor: 'negativity_for_reply' })
      );
    });

    it('should increase risk for high sarcasm + quote', () => {
      const sentimentResult = {
        dimensions: { toxicity: 0.1, valence: 0.3, sarcasm: 0.7, urgency: 0.2 },
        derived: { credibility: 0.7, emotionalIntensity: 0.3 }
      };

      const result = engine.assessRisk(sentimentResult, 'quote');

      expect(result.factors).toContainEqual(
        expect.objectContaining({ factor: 'sarcasm_for_quote' })
      );
    });

    it('should increase risk for low credibility + reply', () => {
        const sentimentResult = {
            dimensions: { toxicity: 0.1, valence: 0.3, sarcasm: 0.1, urgency: 0.2 },
            derived: { credibility: 0.3, emotionalIntensity: 0.3 }
        };

        const result = engine.assessRisk(sentimentResult, 'reply');

        expect(result.factors).toContainEqual(
            expect.objectContaining({ factor: 'low_credibility' })
        );
    });

    it('should increase risk for high emotional intensity', () => {
        const sentimentResult = {
            dimensions: { toxicity: 0.1, valence: 0.3, sarcasm: 0.1, urgency: 0.2 },
            derived: { credibility: 0.7, emotionalIntensity: 0.8 }
        };

        const result = engine.assessRisk(sentimentResult, 'reply');

        expect(result.factors).toContainEqual(
            expect.objectContaining({ factor: 'emotionalIntensity' })
        );
    });

    it('should increase risk for high urgency', () => {
        const sentimentResult = {
            dimensions: { toxicity: 0.1, valence: 0.3, sarcasm: 0.1, urgency: 0.9 },
            derived: { credibility: 0.7, emotionalIntensity: 0.3 }
        };

        const result = engine.assessRisk(sentimentResult, 'reply');

        expect(result.factors).toContainEqual(
            expect.objectContaining({ factor: 'high_urgency' })
        );
    });

    it('should reduce risk in suppressive mode', () => {
      const engineSuppressive = new SentimentDecisionEngine(mockAnalyzer, {
        suppressiveMode: true,
        maxRiskTolerance: 0.6
      });

      const sentimentResult = {
        dimensions: { toxicity: 0.8, valence: 0.0, sarcasm: 0.0, urgency: 0.2 },
        derived: { credibility: 0.5, emotionalIntensity: 0.3 }
      };

      const result = engineSuppressive.assessRisk(sentimentResult, 'like');

      expect(result.risk).toBeLessThan(0.3); // 0.3 * 0.7 = 0.21
    });

    it('should mark for manual review if risk > 0.5', () => {
        const sentimentResult = {
            dimensions: { toxicity: 0.9, valence: -0.8, sarcasm: 0.8, urgency: 0.9 },
            derived: { credibility: 0.1, emotionalIntensity: 0.9 }
        };

        const result = engine.assessRisk(sentimentResult, 'reply');
        
        expect(result.shouldReviewManually).toBe(true);
        expect(result.level).toBe('high');
    });
    
    it('should return medium risk level if risk is between 0.4 and 0.6', () => {
        // Risk = 0.3 (toxicity) + some other factor if needed
        // Let's craft inputs to hit exactly between 0.4 and 0.6
        // toxicity 0.8 -> 0.3 risk
        // reply + valence -0.7 -> 0.2 risk
        // total 0.5
        
        const result = engine.assessRisk({
            dimensions: { toxicity: 0.8, valence: -0.7, sarcasm: 0.0, urgency: 0.2 },
            derived: { credibility: 0.5, emotionalIntensity: 0.3 }
        }, 'reply');
        
        expect(result.risk).toBe(0.5);
        expect(result.level).toBe('medium');
    });
  });

  describe('getAdaptiveEngagementProbability', () => {
    // Reply
    it('should boost probability for high credibility + low toxicity (reply)', () => {
      const sentimentResult = {
        dimensions: { toxicity: 0.2, valence: 0.6, sarcasm: 0.1, dominance: 0.5 },
        derived: { credibility: 0.8, complexity: 0.5, engagementRisk: 0.2 },
        personalityFit: null
      };

      const probability = engine.getAdaptiveEngagementProbability(sentimentResult, 'reply');
      // base 0.5 * 1.3 = 0.65
      expect(probability).toBeCloseTo(0.65);
    });

    it('should suppress probability for very negative + toxic (reply)', () => {
        const sentimentResult = {
          dimensions: { toxicity: 0.6, valence: -0.8, sarcasm: 0.1, dominance: 0.5 },
          derived: { credibility: 0.5, complexity: 0.5, engagementRisk: 0.3 },
          personalityFit: null
        };
  
        const probability = engine.getAdaptiveEngagementProbability(sentimentResult, 'reply');
        // base 0.5 * 0.3 = 0.15
        expect(probability).toBeCloseTo(0.15);
    });

    // Like
    it('should boost probability for positive + good credibility (like)', () => {
        const sentimentResult = {
          dimensions: { toxicity: 0.1, valence: 0.6, sarcasm: 0.1, dominance: 0.5 },
          derived: { credibility: 0.7, complexity: 0.5, engagementRisk: 0.2 },
          personalityFit: null
        };
  
        const probability = engine.getAdaptiveEngagementProbability(sentimentResult, 'like');
        // base 0.7 * 1.4 = 0.98
        expect(probability).toBeCloseTo(0.98);
    });

    it('should suppress probability for toxic content (like)', () => {
      const sentimentResult = {
        dimensions: { toxicity: 0.6, valence: -0.5, sarcasm: 0.1, dominance: 0.5 },
        derived: { credibility: 0.5, complexity: 0.5, engagementRisk: 0.3 },
        personalityFit: null
      };

      const probability = engine.getAdaptiveEngagementProbability(sentimentResult, 'like');
      // base 0.7 * 0.2 = 0.14
      expect(probability).toBeCloseTo(0.14);
    });

    // Quote
    it('should boost probability for high credibility + low sarcasm (quote)', () => {
        const sentimentResult = {
          dimensions: { toxicity: 0.1, valence: 0.6, sarcasm: 0.1, dominance: 0.5 },
          derived: { credibility: 0.9, complexity: 0.5, engagementRisk: 0.2 },
          personalityFit: null
        };
  
        const probability = engine.getAdaptiveEngagementProbability(sentimentResult, 'quote');
        // base 0.3 * 1.2 = 0.36
        expect(probability).toBeCloseTo(0.36);
    });

    it('should suppress probability for low credibility (quote)', () => {
        const sentimentResult = {
          dimensions: { toxicity: 0.1, valence: 0.6, sarcasm: 0.1, dominance: 0.5 },
          derived: { credibility: 0.4, complexity: 0.5, engagementRisk: 0.2 },
          personalityFit: null
        };
  
        const probability = engine.getAdaptiveEngagementProbability(sentimentResult, 'quote');
        // base 0.3 * 0.4 = 0.12
        expect(probability).toBeCloseTo(0.12);
    });

    // Retweet
    it('should boost probability for low engagement risk + positive (retweet)', () => {
        const sentimentResult = {
          dimensions: { toxicity: 0.1, valence: 0.4, sarcasm: 0.1, dominance: 0.5 },
          derived: { credibility: 0.7, complexity: 0.5, engagementRisk: 0.2 },
          personalityFit: null
        };
  
        const probability = engine.getAdaptiveEngagementProbability(sentimentResult, 'retweet');
        // base 0.3 * 1.3 = 0.39
        expect(probability).toBeCloseTo(0.39);
    });

    it('should suppress probability for high engagement risk (retweet)', () => {
        const sentimentResult = {
          dimensions: { toxicity: 0.1, valence: 0.4, sarcasm: 0.1, dominance: 0.5 },
          derived: { credibility: 0.7, complexity: 0.5, engagementRisk: 0.7 },
          personalityFit: null
        };
  
        const probability = engine.getAdaptiveEngagementProbability(sentimentResult, 'retweet');
        // base 0.3 * 0.2 = 0.06
        expect(probability).toBeCloseTo(0.06);
    });

    // Bookmark
    it('should boost probability for high complexity + good credibility (bookmark)', () => {
        const sentimentResult = {
          dimensions: { toxicity: 0.1, valence: 0.4, sarcasm: 0.1, dominance: 0.5 },
          derived: { credibility: 0.6, complexity: 0.7, engagementRisk: 0.2 },
          personalityFit: null
        };
  
        const probability = engine.getAdaptiveEngagementProbability(sentimentResult, 'bookmark');
        // base 0.4 * 1.2 = 0.48
        expect(probability).toBeCloseTo(0.48);
    });

    // Personality Fit
    it('should adjust probability based on personality fit', () => {
        const sentimentResult = {
            dimensions: { toxicity: 0.1, valence: 0.5, sarcasm: 0.1, dominance: 0.5 },
            derived: { credibility: 0.8, complexity: 0.5, engagementRisk: 0.2 },
            personalityFit: { fit: 1.0 } // 0.7 + 0.6 = 1.3
        };

        const probability = engine.getAdaptiveEngagementProbability(sentimentResult, 'reply');
        // base 0.5 (from reply default)
        // reply branch -> cred > 0.7 & tox < 0.3 -> * 1.3 -> 0.65
        // personality fit -> * 1.3 -> 0.845
        expect(probability).toBeCloseTo(0.845);
    });

    it('should clamp probability between 0 and 1', () => {
        const sentimentResult = {
            dimensions: { toxicity: 0.1, valence: 0.5, sarcasm: 0.1, dominance: 0.5 },
            derived: { credibility: 0.8, complexity: 0.5, engagementRisk: 0.2 },
            personalityFit: { fit: 2.0 } // 0.7 + 1.2 = 1.9
        };
        // Artificial boost to exceed 1
        
        // Mock config to start high
        engine.config.replyProbability = 0.9;
        
        const probability = engine.getAdaptiveEngagementProbability(sentimentResult, 'reply');
        expect(probability).toBe(1);
    });

    it('should handle unknown action in getAdaptiveEngagementProbability', () => {
      const sentimentResult = {
        dimensions: { valence: 0.5, toxicity: 0.1 },
        derived: { credibility: 0.8 }
      };
      // Default is 0.5
      const prob = engine.getAdaptiveEngagementProbability(sentimentResult, 'unknown_action');
      expect(prob).toBe(0.5);
    });

    it('should handle quote probability for medium credibility', () => {
      const sentimentResult = {
        dimensions: { sarcasm: 0.1 },
        derived: { credibility: 0.6 } // Between 0.5 and 0.8
      };
      // Base quote probability is 0.3 (configured in beforeEach)
      // 0.6 is not > 0.8, and not < 0.5. So no change.
      const prob = engine.getAdaptiveEngagementProbability(sentimentResult, 'quote');
      expect(prob).toBe(0.3);
    });

    it('should handle bookmark probability for low complexity', () => {
      const sentimentResult = {
        dimensions: {},
        derived: { complexity: 0.3, credibility: 0.8 }
      };
      // Base bookmark probability is 0.4 (default in constructor)
      // Complexity < 0.6, so no boost.
      const prob = engine.getAdaptiveEngagementProbability(sentimentResult, 'bookmark');
      expect(prob).toBe(0.4);
    });
  });

  describe('recommendResponseTone', () => {
    it('should recommend sarcastic tone for sarcastic content', () => {
      const sentimentResult = {
        dimensions: { sarcasm: 0.7, dominance: 0.5, valence: 0.3, arousal: 0.4, toxicity: 0.1, urgency: 0.2 },
        patterns: [],
        actionBlock: null
      };

      const tones = engine.recommendResponseTone(sentimentResult);

      expect(tones).toContain('sarcastic_or_witty');
    });

    it('should recommend empathetic tone for grief content', () => {
      const sentimentResult = {
        dimensions: { sarcasm: 0.1, dominance: 0.3, valence: -0.5, arousal: 0.3, toxicity: 0.0, urgency: 0.2 },
        patterns: ['restrainedGrief'],
        actionBlock: 'grief'
      };

      const tones = engine.recommendResponseTone(sentimentResult);

      expect(tones).toContain('empathetic_supportive');
    });
    
    it('should recommend thoughtful tone for passionate advocacy', () => {
        const sentimentResult = {
          dimensions: { sarcasm: 0.1, dominance: 0.3, valence: 0.5, arousal: 0.3, toxicity: 0.0, urgency: 0.2 },
          patterns: ['passionateAdvocacy'],
          actionBlock: null
        };
  
        const tones = engine.recommendResponseTone(sentimentResult);
  
        expect(tones).toContain('thoughtful_engaged');
    });

    it('should recommend analytical tone for intellectual debate', () => {
        const sentimentResult = {
          dimensions: { sarcasm: 0.1, dominance: 0.3, valence: 0.5, arousal: 0.3, toxicity: 0.0, urgency: 0.2 },
          patterns: ['intellectualDebate'],
          actionBlock: null
        };
  
        const tones = engine.recommendResponseTone(sentimentResult);
  
        expect(tones).toContain('analytical_respectful');
    });

    it('should recommend enthusiastic tone for celebration', () => {
        const sentimentResult = {
          dimensions: { sarcasm: 0.1, dominance: 0.3, valence: 0.5, arousal: 0.3, toxicity: 0.0, urgency: 0.2 },
          patterns: ['celebration'],
          actionBlock: null
        };
  
        const tones = engine.recommendResponseTone(sentimentResult);
  
        expect(tones).toContain('enthusiastic_positive');
    });

    it('should return neutral tone by default', () => {
      const sentimentResult = {
        dimensions: { sarcasm: 0.1, dominance: 0.5, valence: 0.2, arousal: 0.4, toxicity: 0.1, urgency: 0.2 },
        patterns: [],
        actionBlock: null
      };

      const tones = engine.recommendResponseTone(sentimentResult);

      expect(tones).toContain('conversational_neutral');
    });
  });

  describe('generateEngagementHints', () => {
    it('should generate hint for sarcastic content', () => {
        const sentimentResult = {
            dimensions: { sarcasm: 0.6, arousal: 0.4, dominance: 0.5 },
            derived: { credibility: 0.8 },
            patterns: []
        };
        const hints = engine.generateEngagementHints(sentimentResult, 'reply');
        expect(hints).toContain('Content has sarcastic tone - respond carefully');
    });

    it('should generate hint for high arousal content', () => {
        const sentimentResult = {
            dimensions: { sarcasm: 0.4, arousal: 0.8, dominance: 0.5 },
            derived: { credibility: 0.8 },
            patterns: []
        };
        const hints = engine.generateEngagementHints(sentimentResult, 'reply');
        expect(hints).toContain('Author is highly emotional - keep response grounded');
    });

    it('should generate hint for low credibility content', () => {
        const sentimentResult = {
            dimensions: { sarcasm: 0.4, arousal: 0.4, dominance: 0.5 },
            derived: { credibility: 0.4 },
            patterns: []
        };
        const hints = engine.generateEngagementHints(sentimentResult, 'reply');
        expect(hints).toContain('Content has mixed signals - verify before engaging');
    });

    it('should generate hint for passionate advocacy', () => {
        const sentimentResult = {
            dimensions: { sarcasm: 0.4, arousal: 0.4, dominance: 0.5 },
            derived: { credibility: 0.8 },
            patterns: ['passionateAdvocacy']
        };
        const hints = engine.generateEngagementHints(sentimentResult, 'reply');
        expect(hints).toContain('Author is passionate about this topic - respect their position');
    });

    it('should generate hint for toxic ranting', () => {
        const sentimentResult = {
            dimensions: { sarcasm: 0.4, arousal: 0.4, dominance: 0.5 },
            derived: { credibility: 0.8 },
            patterns: ['toxicRanting']
        };
        const hints = engine.generateEngagementHints(sentimentResult, 'reply');
        expect(hints).toContain('Content shows signs of toxic rant - avoid escalation');
    });

    it('should generate hint for assertive author (reply)', () => {
        const sentimentResult = {
            dimensions: { sarcasm: 0.4, arousal: 0.4, dominance: 0.8 },
            derived: { credibility: 0.8 },
            patterns: []
        };
        const hints = engine.generateEngagementHints(sentimentResult, 'reply');
        expect(hints).toContain('Author is assertive - keep your response confident or humble, not weak');
    });

    it('should generate hint for sarcastic quote', () => {
        const sentimentResult = {
            dimensions: { sarcasm: 0.5, arousal: 0.4, dominance: 0.5 },
            derived: { credibility: 0.8 },
            patterns: []
        };
        const hints = engine.generateEngagementHints(sentimentResult, 'quote');
        expect(hints).toContain('Quote action with sarcasm present - might be misinterpreted as mockery');
    });
  });

  describe('suggestFallbackAction', () => {
    it('should suggest like as fallback for blocked reply', () => {
      const sentimentResult = {
        actionGates: { canLike: true, canBookmark: true, canReply: false }
      };

      const fallback = engine.suggestFallbackAction(sentimentResult, 'reply', 'gate');

      expect(fallback.action).toBe('like');
    });

    it('should suggest bookmark when like is unavailable', () => {
      const sentimentResult = {
        actionGates: { canLike: false, canBookmark: true, canReply: false }
      };

      const fallback = engine.suggestFallbackAction(sentimentResult, 'reply', 'gate');

      expect(fallback.action).toBe('bookmark');
      expect(fallback.reason).toContain('suggesting bookmark instead');
    });

    it('should suggest skip if no safe fallback', () => {
      const sentimentResult = {
        actionGates: { canLike: false, canBookmark: false, canReply: false }
      };

      const fallback = engine.suggestFallbackAction(sentimentResult, 'reply', 'gate');

      expect(fallback.action).toBe('skip');
    });
    
    it('should return null if blockType is unknown', () => {
        const sentimentResult = {
            actionGates: {}
        };
        const fallback = engine.suggestFallbackAction(sentimentResult, 'reply', 'unknown_type');
        expect(fallback).toBeNull();
    });
  });

  describe('getStats', () => {
    it('should return current stats and config', () => {
      const stats = engine.getStats();

      expect(stats.totalDecisions).toBe(0);
      expect(stats.blockers).toEqual({});
      expect(stats.fallbacks).toEqual({});
      expect(stats.config).toBeDefined();
    });
  });

  describe('explainDecision', () => {
    it('should explain allowed decision', () => {
      const decision = {
        action: 'reply',
        allowed: true,
        reason: 'Safe',
        riskLevel: 'low',
        probability: 0.8,
        recommendedTone: ['neutral'],
        hints: ['Be nice'],
        blockType: null
      };

      const explanation = engine.explainDecision(decision);

      expect(explanation.action).toBe('reply');
      expect(explanation.allowed).toBe(true);
      expect(explanation.fallback).toBeUndefined();
    });

    it('should explain blocked decision with fallback', () => {
      const decision = {
        action: 'reply',
        allowed: false,
        reason: 'Blocked',
        fallback: {
          action: 'like',
          reason: 'Safer'
        }
      };

      const explanation = engine.explainDecision(decision);

      expect(explanation.allowed).toBe(false);
      expect(explanation.fallback.action).toBe('like');
    });
    
    it('should handle missing optional fields in explainDecision', () => {
      const decision = {
        action: 'reply',
        allowed: true,
        reason: 'Safe'
        // Missing riskLevel, probability, recommendedTone, hints, blockType
      };

      const explanation = engine.explainDecision(decision);

      expect(explanation.riskLevel).toBe('N/A');
      expect(explanation.probability).toBe('N/A');
      expect(explanation.tone).toEqual([]);
      expect(explanation.hints).toEqual([]);
      expect(explanation.blockType).toBe('N/A');
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SentimentIntegration, getSentimentIntegration, initializeSentimentIntegration } from '../../utils/sentiment-integration.js';

vi.mock('../../utils/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe('sentiment-integration', () => {
  let integration;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset singleton
    integration = new SentimentIntegration({ enabled: true, personality: 'observer' });
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      const instance = new SentimentIntegration();
      expect(instance.enabled).toBe(true);
      expect(instance.personality).toBe('observer');
      expect(instance.analyzer).toBeDefined();
      expect(instance.engine).toBeDefined();
    });

    it('should accept custom options', () => {
      const instance = new SentimentIntegration({ enabled: false, personality: 'curious' });
      expect(instance.enabled).toBe(false);
      expect(instance.personality).toBe('curious');
    });
  });

  describe('shouldReplyCheck', () => {
    it('should allow reply when disabled', async () => {
      const instance = new SentimentIntegration({ enabled: false });
      const result = await instance.shouldReplyCheck('Any content');
      
      expect(result.shouldReply).toBe(true);
      expect(result.reason).toContain('disabled');
    });

    it('should handle errors gracefully (fail-safe)', async () => {
      // Pass invalid text to trigger error handling
      const result = await integration.shouldReplyCheck(null);
      
      expect(result.shouldReply).toBe(true);
      expect(result.reason).toContain('Error');
    });
  });

  describe('getReplyToneAdaptation', () => {
    it('should return tone adaptation for content', async () => {
      const result = await integration.getReplyToneAdaptation('Great post!');
      
      expect(result.tones).toBeDefined();
      expect(Array.isArray(result.tones)).toBe(true);
      expect(result.patterns).toBeDefined();
    });

    it('should handle errors gracefully', async () => {
      const result = await integration.getReplyToneAdaptation(null);
      
      expect(result.tones).toContain('conversational_neutral');
      expect(result.patterns).toEqual([]);
    });
  });

  describe('shouldQuoteCheck', () => {
    it('should allow quote when disabled', async () => {
      const instance = new SentimentIntegration({ enabled: false });
      const result = await instance.shouldQuoteCheck('Any content');
      
      expect(result.shouldQuote).toBe(true);
    });

    it('should return quote decision', async () => {
      const result = await integration.shouldQuoteCheck('Interesting tweet');
      
      expect(result.shouldQuote).toBeDefined();
      expect(result.reason).toBeDefined();
    });
  });

  describe('checkEngagementAction', () => {
    it('should allow action when disabled', async () => {
      const instance = new SentimentIntegration({ enabled: false });
      const result = await instance.checkEngagementAction('content', 'like');
      
      expect(result.allowed).toBe(true);
    });

    it('should return engagement decision for any action', async () => {
      const result = await integration.checkEngagementAction('Great tweet!', 'like');
      
      expect(result.allowed).toBeDefined();
      expect(result.reason).toBeDefined();
    });

    it('should handle different actions', async () => {
      const actions = ['like', 'retweet', 'reply', 'quote', 'bookmark'];
      
      for (const action of actions) {
        const result = await integration.checkEngagementAction('Test', action);
        expect(result.allowed).toBeDefined();
      }
    });
  });

  describe('enrichContext', () => {
    it('should return empty when disabled', async () => {
      const instance = new SentimentIntegration({ enabled: false });
      const result = await instance.enrichContext('content');
      
      expect(result).toEqual({});
    });

    it('should return sentiment metadata when enabled', async () => {
      const result = await integration.enrichContext('This is great!');
      
      expect(result.sentimentDimensions).toBeDefined();
      expect(result.patterns).toBeDefined();
      expect(result.derived).toBeDefined();
    });
  });

  describe('setPersonality', () => {
    it('should update personality', () => {
      integration.setPersonality('curious');
      expect(integration.personality).toBe('curious');
    });
  });

  describe('setEnabled', () => {
    it('should toggle enabled state', () => {
      integration.setEnabled(false);
      expect(integration.enabled).toBe(false);
      
      integration.setEnabled(true);
      expect(integration.enabled).toBe(true);
    });
  });

  describe('getStats', () => {
    it('should return stats object', () => {
      const stats = integration.getStats();
      
      expect(stats.enabled).toBe(true);
      expect(stats.personality).toBe('observer');
      expect(stats.analyzer).toBeDefined();
      expect(stats.engine).toBeDefined();
    });
  });

  describe('export', () => {
    it('should return export data with timestamp', () => {
      const exportData = integration.export();
      
      expect(exportData.timestamp).toBeDefined();
      expect(exportData.analyzer).toBeDefined();
      expect(exportData.engine).toBeDefined();
    });
  });

  describe('singleton functions', () => {
    it('getSentimentIntegration should return singleton', () => {
      const instance1 = getSentimentIntegration();
      const instance2 = getSentimentIntegration();
      
      expect(instance1).toBe(instance2);
    });

    it('initializeSentimentIntegration should create new instance', () => {
      const instance = initializeSentimentIntegration({ personality: 'tester' });
      
      expect(instance.personality).toBe('tester');
    });
  });
});

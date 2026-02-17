import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  REPLY_SYSTEM_PROMPT,
  getStrategyInstruction,
  buildReplyPrompt,
  getSentimentGuidance,
  getReplyLengthGuidance,
  buildEnhancedPrompt,
  buildAnalysisPrompt
} from '../../utils/twitter-reply-prompt.js';

describe('twitter-reply-prompt', () => {
  describe('REPLY_SYSTEM_PROMPT', () => {
    it('should be a non-empty string', () => {
      expect(typeof REPLY_SYSTEM_PROMPT).toBe('string');
      expect(REPLY_SYSTEM_PROMPT.length).toBeGreaterThan(0);
    });

    it('should contain critical formatting rules', () => {
      expect(REPLY_SYSTEM_PROMPT).toContain('NO @mentions');
      expect(REPLY_SYSTEM_PROMPT).toContain('NO #hashtags');
      expect(REPLY_SYSTEM_PROMPT).toContain('NO emojis');
      expect(REPLY_SYSTEM_PROMPT).toContain('MAX 10 WORDS');
    });

    it('should contain banned words section', () => {
      expect(REPLY_SYSTEM_PROMPT).toContain('BANNED WORDS');
      expect(REPLY_SYSTEM_PROMPT).toContain('Tapestry');
      expect(REPLY_SYSTEM_PROMPT).toContain('Testament');
    });

    it('should contain tone adaptation guidance', () => {
      expect(REPLY_SYSTEM_PROMPT).toContain('HUMOROUS THREAD');
      expect(REPLY_SYSTEM_PROMPT).toContain('NEWS/ANNOUNCEMENT');
      expect(REPLY_SYSTEM_PROMPT).toContain('PERSONAL/EMOTIONAL');
    });
  });

  describe('getStrategyInstruction', () => {
    beforeEach(() => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should return strategy for viral engagement', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.3);
      const context = { engagement: 'viral' };
      const result = getStrategyInstruction(context);
      expect(result.toLowerCase()).toContain('witty');
    });

    it('should return strategy for high engagement', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.6);
      const context = { engagement: 'high' };
      const result = getStrategyInstruction(context);
      expect(result).toContain('ONE word');
    });

    it('should return strategy for humorous type', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.2);
      const context = { type: 'humorous' };
      const result = getStrategyInstruction(context);
      expect(result).toContain('casual internet slang');
    });

    it('should return strategy for entertainment type', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.6);
      const context = { type: 'entertainment' };
      const result = getStrategyInstruction(context);
      expect(result).toContain('relatable');
    });

    it('should return strategy for news type', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.3);
      const context = { type: 'news' };
      const result = getStrategyInstruction(context);
      expect(result).toContain('casual, specific observation');
    });

    it('should return strategy for politics type', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.6);
      const context = { type: 'politics' };
      const result = getStrategyInstruction(context);
      expect(result).toContain('casual interest');
    });

    it('should return strategy for finance type', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.9);
      const context = { type: 'finance' };
      const result = getStrategyInstruction(context);
      expect(result).toContain('relevant question');
    });

    it('should return strategy for emotional type', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.2);
      const context = { type: 'emotional' };
      const result = getStrategyInstruction(context);
      expect(result).toContain('nostalgic');
    });

    it('should return strategy for personal type', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const context = { type: 'personal' };
      const result = getStrategyInstruction(context);
      expect(result).toContain('relatable');
    });

    it('should handle negative sentiment', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.3);
      const context = { sentiment: 'negative' };
      const result = getStrategyInstruction(context);
      expect(result).toContain('casual, specific observation');
    });

    it('should handle critical sentiment', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.6);
      const context = { sentiment: 'critical' };
      const result = getStrategyInstruction(context);
      expect(result).toContain('relevant question');
    });

    it('should return strategy for very low roll', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.05);
      const context = {};
      const result = getStrategyInstruction(context);
      expect(result).toContain('genuine compliment');
    });

    it('should return strategy for low roll', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.2);
      const context = {};
      const result = getStrategyInstruction(context);
      expect(result).toContain('nostalgic');
    });

    it('should return strategy for medium roll', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.3);
      const context = {};
      const result = getStrategyInstruction(context);
      expect(result).toContain('casual internet slang');
    });

    it('should return strategy for emoji-only roll', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.77);
      const context = {};
      const result = getStrategyInstruction(context);
      expect(result).toContain('ONLY 1-3 emojis');
    });

    it('should return strategy for text emoji roll', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.74);
      const context = {};
      const result = getStrategyInstruction(context);
      expect(result).toContain('ONE matching emoji');
    });

    it('should return OBSERVATION for very high roll', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.9);
      const context = {};
      const result = getStrategyInstruction(context);
      expect(result).toContain('casual, specific observation');
    });

    it('should use default values for empty context', () => {
      const result = getStrategyInstruction({});
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle science type', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.9);
      const context = { type: 'science' };
      const result = getStrategyInstruction(context);
      expect(result).toContain('relevant question');
    });

    it('should handle tech type', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.4);
      const context = { type: 'tech' };
      const result = getStrategyInstruction(context);
      expect(result).toContain('casual, specific observation');
    });
  });

  describe('buildReplyPrompt', () => {
    it('should build basic reply prompt', () => {
      const tweetText = 'This is a test tweet';
      const author = 'testuser';
      
      const prompt = buildReplyPrompt(tweetText, author);
      
      expect(prompt).toContain(tweetText);
      expect(prompt).toContain(author);
      expect(prompt).toContain('Tweet from @testuser');
    });

    it('should include replies in prompt', () => {
      const tweetText = 'Test tweet';
      const author = 'user1';
      const replies = [
        { author: 'user2', text: 'Great tweet!' },
        { author: 'user3', text: 'Agreed!' }
      ];
      
      const prompt = buildReplyPrompt(tweetText, author, replies);
      
      expect(prompt).toContain('@user2');
      expect(prompt).toContain('@user3');
      expect(prompt).toContain('Great tweet!');
      expect(prompt).toContain('Agreed!');
    });

    it('should handle empty replies array', () => {
      const tweetText = 'Test tweet';
      const author = 'user1';
      
      const prompt = buildReplyPrompt(tweetText, author, []);
      
      expect(prompt).toContain('no other replies visible');
    });

    it('should truncate long replies', () => {
      const tweetText = 'Test';
      const author = 'user';
      const longText = 'a'.repeat(300);
      const replies = [{ author: 'user2', text: longText }];
      
      const prompt = buildReplyPrompt(tweetText, author, replies);
      
      const replyLine = prompt.split('\n').find(line => line.startsWith('1. @user2:'));
      const replyText = replyLine.replace('1. @user2: ', '');
      expect(replyText.length).toBe(200);
    });

    it('should include context-based strategy', () => {
      const tweetText = 'Test';
      const author = 'user';
      const context = { type: 'humorous' };
      
      vi.spyOn(Math, 'random').mockReturnValue(0.2);
      const prompt = buildReplyPrompt(tweetText, author, [], '', context);
      
      expect(prompt).toContain('SPECIAL INSTRUCTION');
      
      vi.restoreAllMocks();
    });

    it('should handle URL parameter', () => {
      const tweetText = 'Test';
      const author = 'user';
      const url = 'https://x.com/user/status/123';
      
      const prompt = buildReplyPrompt(tweetText, author, [], url);
      
      // URL is not directly in prompt, but context might be
      expect(prompt).toContain('Test');
    });

    it('should format reply index correctly', () => {
      const replies = [
        { author: 'user1', text: 'Reply 1' },
        { author: 'user2', text: 'Reply 2' }
      ];
      
      const prompt = buildReplyPrompt('Test', 'author', replies);
      
      expect(prompt).toContain('1. @user1');
      expect(prompt).toContain('2. @user2');
    });
  });

  describe('getSentimentGuidance', () => {
    it('should return guidance for enthusiastic sentiment', () => {
      const guidance = getSentimentGuidance('enthusiastic', 'general', 0);
      expect(guidance).toContain('excitement');
      expect(guidance).toContain('energy');
    });

    it('should return guidance for humorous sentiment', () => {
      const guidance = getSentimentGuidance('humorous', 'general', 0);
      expect(guidance).toContain('witty');
      expect(guidance).toContain('fun');
    });

    it('should return guidance for informative sentiment', () => {
      const guidance = getSentimentGuidance('informative', 'general', 0);
      expect(guidance).toContain('fact');
      expect(guidance).toContain('information');
    });

    it('should return guidance for emotional sentiment', () => {
      const guidance = getSentimentGuidance('emotional', 'general', 0);
      expect(guidance).toContain('emotion');
      expect(guidance).toContain('resonate');
    });

    it('should return guidance for supportive sentiment', () => {
      const guidance = getSentimentGuidance('supportive', 'general', 0);
      expect(guidance).toContain('enthusiasm');
      expect(guidance).toContain('encourage');
    });

    it('should return guidance for thoughtful sentiment', () => {
      const guidance = getSentimentGuidance('thoughtful', 'general', 0);
      expect(guidance).toContain('considered');
      expect(guidance).toContain('perspective');
    });

    it('should return guidance for critical sentiment', () => {
      const guidance = getSentimentGuidance('critical', 'general', 0);
      expect(guidance).toContain('counterpoint');
      expect(guidance).toContain('respectfully');
    });

    it('should return guidance for neutral sentiment', () => {
      const guidance = getSentimentGuidance('neutral', 'general', 0);
      expect(guidance).toContain('question');
      expect(guidance).toContain('observation');
    });

    it('should return guidance for sarcastic sentiment', () => {
      const guidance = getSentimentGuidance('sarcastic', 'general', 0);
      expect(guidance).toContain('irony');
      expect(guidance).toContain('playful');
    });

    it('should return guidance for ironic sentiment', () => {
      const guidance = getSentimentGuidance('ironic', 'general', 0);
      expect(guidance).toContain('dry wit');
    });

    it('should handle high sarcasm score', () => {
      const guidance = getSentimentGuidance('sarcastic', 'general', 0.7);
      expect(guidance).toContain('ironic tone');
    });

    it('should return neutral guidance for unknown sentiment', () => {
      const guidance = getSentimentGuidance('unknown', 'general', 0);
      expect(guidance).toContain('question');
    });
  });

  describe('getReplyLengthGuidance', () => {
    it('should return guidance for heated-debate', () => {
      const guidance = getReplyLengthGuidance('heated-debate', 0);
      expect(guidance).toContain('Maximum 1 short sentence');
      expect(guidance).toContain('CRITICAL');
    });

    it('should return guidance for casual-chat', () => {
      const guidance = getReplyLengthGuidance('casual-chat', 0);
      expect(guidance).toContain('Maximum 1 short sentence');
    });

    it('should return guidance for announcement', () => {
      const guidance = getReplyLengthGuidance('announcement', 0);
      expect(guidance).toContain('Maximum 1 sentence');
    });

    it('should return guidance for question', () => {
      const guidance = getReplyLengthGuidance('question', 0);
      expect(guidance).toContain('One short question');
    });

    it('should return guidance for humor', () => {
      const guidance = getReplyLengthGuidance('humor', 0);
      expect(guidance).toContain('Maximum 1 punchy sentence');
    });

    it('should return guidance for news', () => {
      const guidance = getReplyLengthGuidance('news', 0);
      expect(guidance).toContain('Maximum 1 short sentence');
    });

    it('should return guidance for personal', () => {
      const guidance = getReplyLengthGuidance('personal', 0);
      expect(guidance).toContain('Maximum 1-2 short sentences');
    });

    it('should return guidance for controversial', () => {
      const guidance = getReplyLengthGuidance('controversial', 0);
      expect(guidance).toContain('CRITICAL');
      expect(guidance).toContain('Maximum 1 short sentence');
    });

    it('should return general guidance for unknown type', () => {
      const guidance = getReplyLengthGuidance('unknown', 0);
      expect(guidance).toContain('Maximum 1 short sentence');
    });

    it('should add expressiveness for high valence', () => {
      const guidance = getReplyLengthGuidance('general', 0.8);
      expect(guidance).toContain('expressive');
      expect(guidance).toContain('emotional');
    });

    it('should not add expressiveness for low valence', () => {
      const guidance = getReplyLengthGuidance('general', 0.3);
      expect(guidance).not.toContain('expressive');
    });
  });

  describe('buildEnhancedPrompt', () => {
    it('should build enhanced prompt with all context', () => {
      const context = {
        tweetText: 'Test tweet',
        author: 'testuser',
        replies: [],
        sentiment: {
          overall: 'positive',
          score: 0.8,
          engagementStyle: 'enthusiastic',
          conversationType: 'casual-chat',
          valence: 0.7,
          sarcasm: 0.1
        },
        url: 'https://x.com/test/status/123',
        engagementLevel: 'medium',
        metrics: {
          likes: 100,
          retweets: 20,
          replies: 5
        },
        hasImage: false,
        detectedLanguage: 'English'
      };

      const prompt = buildEnhancedPrompt(context);
      
      expect(prompt).toContain('Test tweet');
      expect(prompt).toContain('@testuser');
      expect(prompt).toContain('positive');
      expect(prompt).toContain('100 likes');
      expect(prompt).toContain('English');
    });

    it('should handle replies in enhanced prompt', () => {
      const context = {
        tweetText: 'Test',
        author: 'user',
        replies: [
          { author: 'reply1', text: 'Nice tweet', content: 'Nice tweet' },
          { author: 'reply2', text: 'Agreed' }
        ],
        sentiment: { overall: 'positive' },
        url: '',
        detectedLanguage: 'English'
      };

      const prompt = buildEnhancedPrompt(context);
      
      expect(prompt).toContain('@reply1');
      expect(prompt).toContain('@reply2');
      expect(prompt).toContain('Nice tweet');
    });

    it('should filter and sort replies', () => {
      const context = {
        tweetText: 'Test',
        author: 'user',
        replies: [
          { author: 'r1', text: 'ab' }, // Too short, filtered
          { author: 'r2', text: 'This is a longer reply with more content' },
          { author: 'r3', text: 'Short' }, // Too short, filtered
          { author: 'r4', text: 'Another longer reply here' }
        ],
        sentiment: { overall: 'neutral' },
        url: '',
        detectedLanguage: 'English'
      };

      const prompt = buildEnhancedPrompt(context);
      
      expect(prompt).toContain('@r2');
      expect(prompt).toContain('@r4');
      expect(prompt).not.toContain('@r1');
    });

    it('should handle image in tweet', () => {
      const context = {
        tweetText: 'Test',
        author: 'user',
        replies: [],
        sentiment: { overall: 'positive' },
        url: '',
        hasImage: true,
        detectedLanguage: 'English'
      };

      const prompt = buildEnhancedPrompt(context);
      
      expect(prompt).toContain('[IMAGE DETECTED]');
    });

    it('should handle reply sentiment data', () => {
      const context = {
        tweetText: 'Test',
        author: 'user',
        replies: [],
        sentiment: { overall: 'positive' },
        url: '',
        replySentiment: {
          overall: 'mixed',
          positive: 60,
          negative: 40
        },
        detectedLanguage: 'English'
      };

      const prompt = buildEnhancedPrompt(context);
      
      expect(prompt).toContain('60% positive');
      expect(prompt).toContain('40% negative');
    });

    it('should use default values for missing sentiment', () => {
      const context = {
        tweetText: 'Test',
        author: 'user',
        replies: [],
        sentiment: null,
        url: '',
        detectedLanguage: 'English'
      };

      const prompt = buildEnhancedPrompt(context);
      
      expect(prompt).toContain('neutral');
    });

    it('should limit replies to 30', () => {
      const manyReplies = Array(50).fill(null).map((_, i) => ({
        author: `user${i}`,
        text: `Reply number ${i} with some content`
      }));

      const context = {
        tweetText: 'Test',
        author: 'user',
        replies: manyReplies,
        sentiment: { overall: 'positive' },
        url: '',
        detectedLanguage: 'English'
      };

      const prompt = buildEnhancedPrompt(context);
      
      // Should only have 30 replies max
      const replyMatches = prompt.match(/@user\d+/g);
      expect(replyMatches.length).toBeLessThanOrEqual(30);
    });

    it('should handle missing detectedLanguage', () => {
      const context = {
        tweetText: 'Test',
        author: 'user',
        replies: [],
        sentiment: { overall: 'positive' },
        url: ''
        // detectedLanguage missing
      };

      const prompt = buildEnhancedPrompt(context);
      
      expect(prompt).toContain('English'); // Default
    });
  });

  describe('buildAnalysisPrompt', () => {
    it('should build analysis prompt', () => {
      const tweetText = 'This is a test tweet about technology';
      
      const prompt = buildAnalysisPrompt(tweetText);
      
      expect(prompt).toContain(tweetText);
      expect(prompt).toContain('Analyze this tweet');
      expect(prompt).toContain('safe');
      expect(prompt).toContain('reason');
      expect(prompt).toContain('topic');
    });

    it('should list safe topics', () => {
      const prompt = buildAnalysisPrompt('Test');
      
      expect(prompt).toContain('technology');
      expect(prompt).toContain('science');
      expect(prompt).toContain('everyday life');
    });

    it('should list unsafe topics', () => {
      const prompt = buildAnalysisPrompt('Test');
      
      expect(prompt).toContain('politics');
      expect(prompt).toContain('NSFW');
      expect(prompt).toContain('spam');
    });
  });
});

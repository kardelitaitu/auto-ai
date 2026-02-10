/**
 * @fileoverview AI Reply Engine
 * Handles AI reply generation, safety filtering, and fallback behavior
 * @module utils/ai-reply-engine
 */

import { createLogger } from './logger.js';
import { REPLY_SYSTEM_PROMPT, buildReplyPrompt } from './twitter-reply-prompt.js';
import { mathUtils } from './mathUtils.js';
import { sentimentService } from './sentiment-service.js';
import { config } from './config-service.js';
import { HumanInteraction } from './human-interaction.js';

const logger = createLogger('ai-reply-engine.js');

export class AIReplyEngine {
  constructor(agentConnector, options = {}) {
    this.agent = agentConnector;
    this.logger = createLogger('ai-reply-engine.js');
    this.config = {
      REPLY_PROBABILITY: options.replyProbability ?? 0.05,
      MAX_REPLY_LENGTH: 280,
      MIN_REPLY_LENGTH: 10,
      MAX_RETRIES: options.maxRetries ?? 2,
      SAFETY_FILTERS: {
        minTweetLength: 10,  // Allow shorter tweets (was 20)
        maxTweetLength: 500,
        excludedKeywords: [
          // Political
          'politics', 'political', 'vote', 'election', 'trump', 'biden', 'obama',
          'republican', 'democrat', 'congress', 'senate', 'president', 'policy',
          'taxes', 'immigration', 'abortion', 'gun rights', 'protest',
          // NSFW/Adult
          'nsfw', 'nude', 'naked', 'explicit', '18+', 'adult', 'xxx', 'porn',
          'sexual', 'erotic', 'dick', 'cock', 'pussy', 'fuck', 'shit', 'ass',
          // Spam/Solicitation
          'follow back', 'fb', 'make money', 'drop link', 'free crypto',
          'dm me', 'send dm', 'join now', 'limited offer', 'act now',
          // Controversial
          'religion', 'god', 'atheist', 'belief', 'vaccine', 'climate change',
          'conspiracy', 'wake up', 'sheep', 'brainwashed'
        ]
      }
    };

    this.stats = {
      attempts: 0,
      successes: 0,
      skips: 0,
      failures: 0,
      safetyBlocks: 0,
      errors: 0
    };

    this.logger.info(`[AIReplyEngine] Initialized (probability: ${this.config.REPLY_PROBABILITY})`);
  }

  /**
   * Update configuration at runtime
   */
  updateConfig(options) {
    if (options.replyProbability !== undefined) {
      this.config.REPLY_PROBABILITY = options.replyProbability;
    }
    if (options.maxRetries !== undefined) {
      this.config.MAX_RETRIES = options.maxRetries;
    }
  }

  /**
   * Main entry point: decide whether to reply to a tweet
   * @param {string} tweetText - The tweet content
   * @param {string} authorUsername - Tweet author username
   * @param {object} context - Enhanced context (screenshot, replies)
   * @returns {Promise<object>} Reply decision
   */
  async shouldReply(tweetText, authorUsername, context = {}) {
    this.stats.attempts++;

    // Step 1: Roll dice for reply opportunity
    if (!mathUtils.roll(this.config.REPLY_PROBABILITY)) {
      this.stats.skips++;
      return {
        decision: 'skip',
        reason: 'probability',
        action: null
      };
    }

    // Step 1b: Clip tweet text to 300 chars for AI processing
    const clippedTweet = tweetText.length > 300 ? tweetText.substring(0, 300) + '...' : tweetText;
    logger.debug(`[AIReply] Tweet clipped from ${tweetText.length} to ${clippedTweet.length} chars`);

    // ================================================================
    // FULL SENTIMENT ANALYSIS OF TWEET
    // ================================================================
    const tweetSentiment = sentimentService.analyze(tweetText);
    
    // Log comprehensive sentiment analysis
    logger.info(`[AIReply] Sentiment Analysis:`);
    logger.info(`[AIReply]   - Overall: ${tweetSentiment.isNegative ? 'NEGATIVE' : 'NEUTRAL/POSITIVE'} (score: ${tweetSentiment.score.toFixed(2)})`);
    logger.info(`[AIReply]   - Valence: ${tweetSentiment.dimensions?.valence?.valence?.toFixed(2) || 'N/A'}`);
    logger.info(`[AIReply]   - Arousal: ${tweetSentiment.dimensions?.arousal?.arousal?.toFixed(2) || 'N/A'}`);
    logger.info(`[AIReply]   - Dominance: ${tweetSentiment.dimensions?.dominance?.dominance?.toFixed(2) || 'N/A'}`);
    logger.info(`[AIReply]   - Sarcasm: ${tweetSentiment.dimensions?.sarcasm?.sarcasm?.toFixed(2) || 'N/A'}`);
    logger.info(`[AIReply]   - Toxicity: ${tweetSentiment.dimensions?.toxicity?.toxicity?.toFixed(2) || 'N/A'}`);
    logger.info(`[AIReply]   - Risk Level: ${tweetSentiment.composite?.riskLevel || 'N/A'}`);
    logger.info(`[AIReply]   - Engagement Style: ${tweetSentiment.composite?.engagementStyle || 'N/A'}`);
    logger.info(`[AIReply]   - Conversation Type: ${tweetSentiment.composite?.conversationType || 'N/A'}`);

    // ================================================================
    // SKIP HIGH-RISK CONVERSATIONS
    // ================================================================
    if (tweetSentiment.isNegative && tweetSentiment.score > 0.3) {
      this.stats.skips++;
      logger.warn(`[AIReply] Skipping negative content (score: ${tweetSentiment.score.toFixed(2)})`);
      return {
        decision: 'skip',
        reason: 'negative_content',
        action: this.randomFallback()
      };
    }

    if (tweetSentiment.composite?.riskLevel === 'high') {
      this.stats.skips++;
      logger.warn(`[AIReply] Skipping high-risk conversation`);
      return {
        decision: 'skip',
        reason: 'high_risk_conversation',
        action: this.randomFallback()
      };
    }

    // Extract derived sentiment values for prompt enhancement
    const sentiment = tweetSentiment.composite?.engagementStyle || 'neutral';
    const conversationType = tweetSentiment.composite?.conversationType || 'general';

    // Store sentiment in context for use in prompt generation
    const enhancedContext = {
      ...context,
      sentiment: {
        overall: tweetSentiment.isNegative ? 'negative' : 'neutral/positive',
        score: tweetSentiment.score,
        engagementStyle: sentiment,
        conversationType: conversationType,
        valence: tweetSentiment.dimensions?.valence?.valence || 0,
        sarcasm: tweetSentiment.dimensions?.sarcasm?.sarcasm || 0,
        toxicity: tweetSentiment.dimensions?.toxicity?.toxicity || 0,
        riskLevel: tweetSentiment.composite?.riskLevel || 'low'
      }
    };

    // Step 2: Apply safety filters on clipped text
    const safetyResult = this.applySafetyFilters(clippedTweet);
    if (!safetyResult.safe) {
      this.stats.safetyBlocks++;
      this.stats.skips++;
      logger.debug(`[AIReply] Safety block: ${safetyResult.reason}`);
      return {
        decision: 'skip',
        reason: 'safety',
        action: this.randomFallback()
      };
    }

    // Step 3: AI generate reply with context (use clipped tweet and enhanced context)
    const aiResult = await this.generateReply(clippedTweet, authorUsername, enhancedContext);

    if (!aiResult.success) {
      this.stats.failures++;
      this.stats.skips++;
      return {
        decision: 'skip',
        reason: 'ai_failed',
        action: this.randomFallback()
      };
    }

    // Step 4: Validate reply
    const validation = this.validateReply(aiResult.reply);
    if (!validation.valid) {
      this.stats.failures++;
      this.stats.skips++;
      logger.debug(`[AIReply] Reply validation failed: ${validation.reason}`);
      return {
        decision: 'skip',
        reason: 'validation_failed',
        action: this.randomFallback()
      };
    }

    // Success
    this.stats.successes++;
    logger.info(`[AIReply] Generated reply: "${aiResult.reply.substring(0, 50)}..."`);

    return {
      decision: 'reply',
      reason: 'success',
      action: 'post_reply',
      reply: aiResult.reply.trim()
    };
  }

  /**
   * Apply safety filters to tweet content
   * @param {string} text - Tweet text
   * @returns {object} { safe: boolean, reason: string }
   */
  applySafetyFilters(text) {
    if (!text || typeof text !== 'string') {
      return { safe: false, reason: 'empty_text' };
    }

    const lowerText = text.toLowerCase().trim();

    // Length check
    if (lowerText.length < this.config.SAFETY_FILTERS.minTweetLength) {
      return { safe: false, reason: 'too_short' };
    }

    if (lowerText.length > this.config.SAFETY_FILTERS.maxTweetLength) {
      return { safe: false, reason: 'too_long' };
    }

    // Keyword exclusion check
    const excluded = this.config.SAFETY_FILTERS.excludedKeywords;
    for (const keyword of excluded) {
      if (lowerText.includes(keyword)) {
        return { safe: false, reason: `excluded_keyword:${keyword}` };
      }
    }

    // Check for excessive caps (shouting)
    const capsRatio = (text.match(/[A-Z]/g)?.length || 0) / text.length;
    if (capsRatio > 0.7 && text.length > 20) {
      return { safe: false, reason: 'excessive_caps' };
    }

    // Check for excessive emojis
    const emojiCount = (text.match(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu)?.length || 0);
    if (emojiCount > 8) {
      return { safe: false, reason: 'too_many_emojis' };
    }

    return { safe: true, reason: 'passed' };
  }

  /**
    * Generate AI reply using the agent connector
    * @param {string} tweetText - Tweet content
    * @param {string} authorUsername - Author username
    * @param {object} context - Additional context (screenshot, replies)
     * @returns {Promise<object>} { success: boolean, reply?: string, language?: string }
    */
  async generateReply(tweetText, authorUsername, context = {}) {
    const maxAttempts = this.config.MAX_RETRIES;
    let lastError = null;

    const { screenshot = null, replies = [], url = '' } = context;

    // ================================================================
    // SENTIMENT-BASED REPLY SELECTION
    // Analyze conversation sentiment and select best replies for LLM
    // ================================================================
    let selectedReplies = replies;
    if (replies.length > 0) {
      const sentimentAnalysis = sentimentService.analyzeForReplySelection(replies);
      logger.info(`[AIReply] Reply selection strategy: ${sentimentAnalysis.strategy} ` +
                  `(pos: ${sentimentAnalysis.distribution.positive}, ` +
                  `neg: ${sentimentAnalysis.distribution.negative}, ` +
                  `sarcastic: ${sentimentAnalysis.distribution.sarcastic})`);
      
      const recs = sentimentAnalysis.recommendations;
      if (recs.manualSelection) {
        selectedReplies = recs.manualSelection;
      } else {
        selectedReplies = sentimentAnalysis.analyzed
          .filter(r => recs.filter(r))
          .sort(recs.sort)
          .slice(0, recs.max)
          .map(r => ({ author: r.author, text: r.text }));
      }
      
      logger.info(`[AIReply] Selected ${selectedReplies.length} replies for LLM context ` +
                  `(filtered from ${replies.length})`);
    }

    // Build enhanced prompt with language detection
    const sentimentContext = context.sentiment || {};
    const promptData = this.buildEnhancedPrompt(tweetText, authorUsername, selectedReplies, url, sentimentContext);

    // DEBUG: Log tweet, replies, and prompt being sent to LLM
    logger.info(`[DEBUG] ============================================`);
    logger.info(`[DEBUG] TWEET TO REPLY TO:`);
    logger.info(`[DEBUG] Author: @${authorUsername}`);
    logger.info(`[DEBUG] URL: ${url}`);
    logger.info(`[DEBUG] Tweet Text: "${tweetText}"`);
    logger.info(`[DEBUG] Tweet Length: ${tweetText.length} chars`);
    logger.info(`[DEBUG] ----------------------------------------------`);
    logger.info(`[DEBUG] REPLIES CONTEXT (${replies.length} loaded, showing longest 30):`);
    const sortedDebugReplies = replies
      .filter(r => r.text && r.text.length > 5)
      .sort((a, b) => (b.text?.length || 0) - (a.text?.length || 0))
      .slice(0, 30);
    sortedDebugReplies.forEach((reply, idx) => {
      const shortText = (reply.text || '').substring(0, 80);
      const ellipsis = (reply.text || '').length > 80 ? '...' : '';
      const authorName = reply.author && reply.author !== 'unknown' ? reply.author : 'User';
      logger.info(`[DEBUG] [${idx + 1}] Reply${idx + 1}: "@${authorName}: ${shortText}${ellipsis}"`);
    });
    logger.info(`[DEBUG] ----------------------------------------------`);
    logger.info(`[DEBUG] FULL PROMPT SENT TO LLM:`);
    logger.info(`[DEBUG] Language: ${promptData.language}`);
    logger.info(`[DEBUG] System Prompt Length: ${REPLY_SYSTEM_PROMPT.length} chars`);
    logger.info(`[DEBUG] User Prompt Length: ${promptData.text.length} chars`);
    logger.info(`[DEBUG] Vision Mode: ${screenshot ? 'enabled' : 'disabled'}`);
    logger.info(`[DEBUG] ============================================`);

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const request = {
          action: 'generate_reply',
          payload: {
            systemPrompt: REPLY_SYSTEM_PROMPT,
            userPrompt: promptData.text,
            maxTokens: 50,
            temperature: 0.7,
            // vision: screenshot, // Disabled - text focus only
            context: {
              hasScreenshot: false, // Vision disabled
              replyCount: replies.length,
              detectedLanguage: promptData.language
            }
          }
        };

        logger.info(`[AIReply] Generating ${promptData.language} reply (attempt ${attempt}/${maxAttempts})...`);

        const response = await this.agent.processRequest(request);

        if (!response.success) {
          lastError = response.error;
          continue;
        }

        // DEBUG: Log raw LLM response with token estimation
        const responseText = response.content || '';
        const estimatedInputTokens = Math.ceil((REPLY_SYSTEM_PROMPT.length + promptData.text.length) / 4);
        const estimatedOutputTokens = Math.ceil(responseText.length / 4);
        const totalTokens = estimatedInputTokens + estimatedOutputTokens;

        logger.info(`[DEBUG] ----------------------------------------------`);
        logger.info(`[DEBUG] TOKEN ESTIMATION:`);
        logger.info(`[DEBUG]   Input Tokens: ~${estimatedInputTokens} (system + prompt + ${replies.length} replies)`);
        logger.info(`[DEBUG]   Output Tokens: ~${estimatedOutputTokens} (response)`);
        logger.info(`[DEBUG]   Total Estimated: ~${totalTokens}`);
        logger.info(`[DEBUG] ----------------------------------------------`);
        logger.info(`[DEBUG] LLM RAW RESPONSE (attempt ${attempt}):`);
        logger.info(`[DEBUG] ${responseText || 'empty'}`);
        logger.info(`[DEBUG] ----------------------------------------------`);

        // Extract reply from response
        const reply = this.extractReplyFromResponse(response.content);

        if (reply) {
          logger.info(`[AIReply] Generated ${promptData.language} reply: "${reply.substring(0, 50)}..."`);
          return {
            success: true,
            reply,
            language: promptData.language,
            replyCount: promptData.replyCount
          };
        }

        lastError = 'No reply found in response';

      } catch (error) {
        lastError = error.message;
        logger.warn(`[AIReply] Generate attempt ${attempt} failed: ${error.message}`);
      }
    }

    logger.warn(`[AIReply] All ${maxAttempts} attempts failed: ${lastError}`);
    return { success: false };
  }

  /**
    * Detect primary language from text content
    * @param {string} text - Text to analyze
    * @returns {string} Detected language code
    */
  detectLanguage(text) {
    if (!text || typeof text !== 'string') return 'en';

    const textLower = text.toLowerCase();

    // Language patterns (common words/phrases)
    const languages = {
      en: /\b(the|is|are|was|were|have|has|been|will|would|could|should|this|that|these|those|i|you|he|she|it|we|they|what|which|who|when|where|why|how)\b/i,
      es: /\b(el|la|los|las|es|son|fue|fueron|tiene|tienen|será|sería|puede|podrían|esto|ese|esta|yo|tú|él|ella|ellos|qué|cualquién|cuando|dónde|por qué|cómo)\b/i,
      fr: /\b(le|la|les|est|sont|était|étaient|a|ont|été|sera|serait|peuvent|cela|cette|ces|je|tu|il|elle|nous|vous|ils|elles|que|qui|quoi|quand|où|pourquoi|comment)\b/i,
      de: /\b(der|die|das|den|dem|ist|sind|war|waren|hat|haben|wird|wäre|kann|können|dieser|diese|dieses|ich|du|er|sie|es|wir|sie|was|welcher|wer|wo|warum|wie)\b/i,
      pt: /\b(o|a|os|as|é|são|foi|foram|tem|têm|será|seria|podem|isso|essa|esses|eu|você|ele|ela|nós|vocês|eles|elas|o quê|qual|quem|quando|onde|por quê|como)\b/i,
      id: /\b(ini|itu|adalah|adalah|tersebut|dengan|untuk|dan|di|dari|yang|apa|siapa|apa|ketika|di mana|mengapa|bagai)\b/i,
      ja: /\b(これ|それ|あれ|この|その|あの|です|だ|ある|いる|ます|か|の|に|を|と|が|は|だれの|何|いつ|どこ|なぜ|怎样)\b/i,
      ko: /\b(이|그|저|이다|있다|하다|것|을|를|에|에서|과|와|는|은|다|吗|什么|何时|哪里|为什么)\b/i,
      zh: /\b(这|那|是|的|在|有|和|与|对|就|都|而|及|与|着|或|什么|谁|何时|何地|为何|如何)\b/i
    };

    const scores = {};
    let totalScore = 0;

    for (const [lang, pattern] of Object.entries(languages)) {
      const match = textLower.match(pattern);
      const score = match ? match.length : 0;
      scores[lang] = score;
      totalScore += score;
    }

    if (totalScore === 0) return 'en';

    // Find the language with highest score
    let maxScore = 0;
    let detectedLang = 'en';

    for (const [lang, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        detectedLang = lang;
      }
    }

    // Map to full language name
    const langNames = {
      en: 'English',
      es: 'Spanish',
      fr: 'French',
      de: 'German',
      pt: 'Portuguese',
      id: 'Indonesian',
      ja: 'Japanese',
      ko: 'Korean',
      zh: 'Chinese'
    };

    return langNames[detectedLang] || 'English';
  }

  /**
    * Detect primary language from array of replies
    * @param {Array} replies - Array of reply objects
    * @returns {string} Detected language
    */
  detectReplyLanguage(replies) {
    if (!replies || replies.length === 0) return 'English';

    // Collect all reply text
    const allText = replies
      .map(r => r.text || r.content || '')
      .join(' ');

    // Sample up to 5 replies for language detection
    const sampleText = replies
      .slice(0, 5)
      .map(r => (r.text || r.content || '').substring(0, 500))
      .join(' ');

    return this.detectLanguage(sampleText);
  }

  /**
    * Build enhanced prompt with context (tweet, replies, screenshot)
    * @param {string} tweetText - Original tweet
    * @param {string} authorUsername - Author
    * @param {Array} replies - Replies to include
    * @param {string} url - Tweet URL
    * @returns {object} Enhanced prompt with language info
    */
  buildEnhancedPrompt(tweetText, authorUsername, replies = [], url = '', sentimentContext = {}) {
    // Detect language from replies
    const detectedLanguage = this.detectReplyLanguage(replies);
    logger.debug(`[AIReply] Detected language: ${detectedLanguage}`);

    // Get sentiment guidance
    const sentiment = sentimentContext.engagementStyle || 'neutral';
    const conversationType = sentimentContext.conversationType || 'general';
    const valence = sentimentContext.valence || 0;
    const sarcasmScore = sentimentContext.sarcasm || 0;

    // Generate sentiment-aware tone guidance
    const toneGuidance = this.getSentimentGuidance(sentiment, conversationType, sarcasmScore);
    const lengthGuidance = this.getReplyLengthGuidance(conversationType, valence);

    let prompt = `Tweet from @${authorUsername}:
"${tweetText}"

Tweet URL: ${url}

`;

    if (replies.length > 0) {
      // Sort by length (longest first) and take top 30 for richer context
      const sortedReplies = replies
        .filter(r => r.text && r.text.length > 5)
        .sort((a, b) => (b.text?.length || 0) - (a.text?.length || 0))
        .slice(0, 30);
      
      prompt += `Other replies to this tweet (in ${detectedLanguage}):
 `;
      sortedReplies.forEach((reply, i) => {
        const author = reply.author || 'User';
        const text = reply.text || reply.content || '';
        prompt += `${i + 1}. @${author}: "${text.substring(0, 200)}"
 `;
      });
      prompt += `
 `;
    }

    prompt += `Language detected: ${detectedLanguage}

IMPORTANT: Keep it SHORT. Maximum 1 short sentence. No paragraphs.

Tweet Analysis:
- Sentiment: ${sentiment}
- Conversation Type: ${conversationType}
- Valence: ${valence > 0 ? 'Positive' : valence < 0 ? 'Negative' : 'Neutral'}

TONE GUIDANCE: ${toneGuidance}
LENGTH: MAXIMUM 1 SHORT SENTENCE

Write ONE short reply (1 sentence max):`;

    return {
      text: prompt,
      language: detectedLanguage,
      replyCount: replies.length,
      sentiment: {
        engagementStyle: sentiment,
        conversationType: conversationType,
        valence,
        sarcasmScore
      }
    };
  }

  getSentimentGuidance(sentiment, conversationType, sarcasmScore) {
    const guidance = {
      enthusiastic: 'Show genuine excitement and energy. Be warm and encouraging.',
      humorous: 'Add a light, witty observation. Keep it fun and relatable.',
      informative: 'Share a relevant fact, statistic, or related information.',
      emotional: 'Express genuine emotion - why does this resonate with you?',
      supportive: 'Show enthusiasm and encourage the author.',
      thoughtful: 'Offer a considered perspective or ask a thoughtful question.',
      critical: 'Present a thoughtful counterpoint or question respectfully.',
      neutral: 'Ask a specific question or add a relevant observation.',
      sarcastic: 'Use subtle irony, but keep it playful, never mean-spirited.',
      ironic: 'Employ dry wit, but avoid being dismissive or condescending.',
    };

    if (sarcasmScore > 0.5 && (sentiment === 'sarcastic' || sentiment === 'ironic')) {
      return 'Match the ironic tone - subtle, playful, never mean-spirited.';
    }

    return guidance[sentiment] || guidance.neutral;
  }

  getReplyLengthGuidance(conversationType, valence) {
    const valenceMultiplier = Math.abs(valence) > 0.5 ? 1.2 : 1.0;

    const lengthGuides = {
      'heated-debate': 'CRITICAL: Maximum 1 short sentence.',
      'casual-chat': 'Maximum 1 short sentence.',
      'announcement': 'Maximum 1 sentence.',
      'question': 'One short question or 1 sentence.',
      'humor': 'Maximum 1 punchy sentence.',
      'news': 'Maximum 1 short sentence.',
      'personal': 'Maximum 1-2 short sentences.',
      'controversial': 'CRITICAL: Maximum 1 short sentence.',
      'general': 'Maximum 1 short sentence.',
    };

    const baseGuidance = lengthGuides[conversationType] || lengthGuides.general;

    if (valenceMultiplier > 1.0) {
      return baseGuidance + ' Be more expressive given the emotional content.';
    }

    return baseGuidance;
  }

  /**
    * Capture tweet context (text-based replies only - vision disabled)
    * @param {object} page - Playwright page
    * @param {string} tweetUrl - Current tweet URL
    * @returns {Promise<object>} Context object
    */
  async captureContext(page, tweetUrl = '') {
    const context = {
      url: tweetUrl,
      screenshot: null, // Vision disabled - text focus only
      replies: []
    };

    // Skip screenshot - not needed for text-based replies

    try {
      logger.debug(`[AIReply] Extracting replies with multiple strategies...`);

      const extractedReplies = await this.extractRepliesMultipleStrategies(page);

      // Extract up to 25 replies for consensus-based replies
      context.replies = extractedReplies.slice(0, 50);
      logger.debug(`[AIReply] Extracted ${context.replies.length} replies`);

    } catch (error) {
      logger.warn(`[AIReply] Reply extraction failed: ${error.message}`);
    }

    return context;
  }

/**
     * Extract replies using multiple strategies for Twitter's complex DOM
     * @param {object} page - Playwright page
     * @returns {Promise<Array>} Array of reply objects
*/
  async extractRepliesMultipleStrategies(page) {
    const replies = [];
    const seenTexts = new Set();

    logger.debug(`[AIReply] Starting reply extraction...`);

    // Step 1: Ensure we're on the tweet page and content is loaded
    try {
      await page.waitForSelector('[data-testid="tweetText"], article, [role="article"]', {
        timeout: 5000
      }).catch(() => {});
      await page.waitForTimeout(mathUtils.randomInRange(500, 1000));
      logger.debug(`[AIReply] Tweet page loaded`);
    } catch (e) {
      logger.debug(`[AIReply] Page load check: ${e.message}`);
    }

    // Helper functions (defined at top level for all strategies)
    const uiPatterns = [
      /keyboard shortcuts/i,
      /press question mark/i,
      /view keyboard/i,
      /see new posts/i,
      /view more/i,
      /show more/i,
      /read more/i,
      /translated from/i,
      /translate tweet/i,
      /copy link/i,
      /share tweet/i,
      /report tweet/i,
      /post.*see new/i,
      /conversation/i,
      /more options/i,
      /view counts/i,
      /highlight/i,
      /bookmark tweet/i,
      /like tweet/i,
      /retweet/i,
      /reply/i,
      /^@\w+:\s*$/,
      /^@\w+:[\s…]*$/,
      /@\w+\s+@\w+\s+@\w+/
    ];

    const addReply = (author, text) => {
      if (!text || text.length < 3) return false;
      const cleaned = text.replace(/^@\w+\s*/g, '').replace(/\n+/g, ' ').trim();

      if (cleaned.length < 2) return false;
      if (cleaned.length > 280) return false;

      if (cleaned.endsWith('...') || cleaned.endsWith('…') || cleaned.includes('Show less')) {
        return false;
      }

      for (const pattern of uiPatterns) {
        if (pattern.test(cleaned)) {
          return false;
        }
      }

      const mentionCount = (cleaned.match(/@\w+/g) || []).length;
      const totalLength = cleaned.length;
      if (mentionCount >= 2 && mentionCount / totalLength > 0.5) {
        return false;
      }

      const lowerKey = cleaned.toLowerCase();
      if (seenTexts.has(lowerKey)) return false;
      seenTexts.add(lowerKey);

      replies.push({ author, text: cleaned.substring(0, 280) });
      return true;
    };

    // Step 2: HUMAN-LIKE - Scroll to bottom FIRST to load all replies
    try {
      logger.debug(`[AIReply] Step 1: Scrolling to bottom to load replies...`);

      // Scroll to bottom multiple times to trigger lazy loading (quicker)
      for (let scroll = 0; scroll < 6; scroll++) {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(mathUtils.randomInRange(150, 300));
        logger.debug(`[AIReply] Scroll to bottom ${scroll + 1}/6`);
      }

      // Now scroll back up through the replies (fewer steps)
      const scrollUpSteps = 15;
      for (let i = 0; i < scrollUpSteps; i++) {
        // Extract visible replies at current scroll position
        const visibleReplies = await page.evaluate(() => {
          const found = [];
          const elements = document.querySelectorAll('[data-testid="tweetText"]');
          elements.forEach(el => {
            const text = el.innerText?.trim();
            if (text && text.length > 3 && text.length < 300 && text.includes('@')) {
              found.push(text);
            }
          });
          return found;
        });

        for (const text of visibleReplies) {
          const mentionMatch = text.match(/@(\w+)/);
          const author = mentionMatch ? mentionMatch[1] : 'unknown';
          if (addReply(author, text)) {
            logger.debug(`[AIReply] Extracted reply from @${author}: "${text.substring(0, 50)}..."`);
          }
        }

        await page.evaluate((i) => {
          const pos = (document.body.scrollHeight / 30) * i;
          window.scrollTo(0, document.body.scrollHeight - pos);
        }, i);
        await page.waitForTimeout(mathUtils.randomInRange(100, 200));

        if (replies.length >= 50) {
          logger.debug(`[AIReply] Target reached: ${replies.length} replies`);
          break;
        }
      }

      // Final wait for all content
      await page.waitForTimeout(mathUtils.randomInRange(800, 1200));

    } catch (e) {
      logger.debug(`[AIReply] Scroll extraction failed: ${e.message}`);
    }

    // Strategy 1: Use optimized selectors for current Twitter DOM
    if (replies.length < 50) {
      try {
        logger.debug(`[AIReply] Strategy 1: Querying optimized selectors...`);

        const selectors = [
          '[data-testid="tweetText"]',
          '[class*="css-175oi2"]',
          '[class*="tweetText"]',
          '[class*="replyText"]',
          'article [dir="auto"]',
          '[role="article"] [dir="auto"]'
        ];

        for (const selector of selectors) {
          try {
            const elements = await page.$$(selector);
            if (elements.length > 0) {
              logger.debug(`[AIReply] Selector "${selector}": ${elements.length} elements`);

              for (const el of elements.slice(0, 60)) {
                try {
                  const text = await el.innerText().catch(() => '');
                  if (text && text.includes('@') && text.length > 3 && text.length < 300) {
                    const mentionMatch = text.match(/@(\w+)/);
                    const author = mentionMatch ? mentionMatch[1] : 'unknown';
                    addReply(author, text);
                  }
                } catch {}
              }
            }
          } catch (e) {
            logger.debug(`[AIReply] Selector "${selector}" error: ${e.message}`);
          }
        }

        if (replies.length >= 50) {
          logger.debug(`[AIReply] Strategy 1 success: ${replies.length} replies`);
          await this._returnToMainTweet(page);
          return replies.slice(0, 50);
        }
      } catch (e) {
        logger.debug(`[AIReply] Strategy 1 failed: ${e.message}`);
      }
    }

    // Strategy 2: Extract from all article elements
    if (replies.length < 50) {
      try {
        logger.debug(`[AIReply] Strategy 2: Extracting from articles...`);

        const articles = await page.$$('article');
        logger.debug(`[AIReply] Found ${articles.length} articles`);

        for (let i = 0; i < Math.min(articles.length, 60); i++) {
          try {
            const article = articles[i];
            const textEl = await article.$('[data-testid="tweetText"]');
            if (textEl) {
              const text = await textEl.innerText().catch(() => '');
              addReply('unknown', text);
            }
          } catch {}
        }

        if (replies.length >= 50) {
          logger.debug(`[AIReply] Strategy 2 success: ${replies.length} replies`);
          await this._returnToMainTweet(page);
          return replies.slice(0, 50);
        }
      } catch (e) {
        logger.debug(`[AIReply] Strategy 2 failed: ${e.message}`);
      }
    }

    // Strategy 3: Deep DOM extraction
    if (replies.length < 50) {
      try {
        logger.debug(`[AIReply] Strategy 3: Deep DOM extraction...`);

        const bodyText = await page.evaluate(() => {
          const textNodes = [];
          const sections = document.querySelectorAll('[role="region"], main, [aria-label*="Timeline"]');

          sections.forEach(section => {
            const walker = document.createTreeWalker(
              section,
              NodeFilter.SHOW_TEXT,
              null,
              false
            );

            let node;
            while ((node = walker.nextNode())) {
              const text = node.textContent?.trim();
              if (text && text.length > 3 && text.length < 300 && text.startsWith('@')) {
                textNodes.push(text);
              }
            }
          });

          return [...new Set(textNodes)].slice(0, 100);
        });

        logger.debug(`[AIReply] Found ${bodyText.length} text nodes`);

        for (const text of bodyText) {
          const mentionMatch = text.match(/@(\w+)/);
          const author = mentionMatch ? mentionMatch[1] : 'unknown';
          addReply(author, text);
        }
      } catch (e) {
        logger.debug(`[AIReply] Strategy 3 failed: ${e.message}`);
      }
    }

    // Strategy 4: Final fallback
    if (replies.length < 50) {
      try {
        logger.debug(`[AIReply] Strategy 4: Final fallback...`);

        const allMentions = await page.evaluate(() => {
          const mentions = [];
          const elements = document.querySelectorAll('*');

          elements.forEach(el => {
            const children = el.childNodes;
            children.forEach(child => {
              if (child.nodeType === Node.TEXT_NODE) {
                const text = child.textContent?.trim();
                if (text && text.startsWith('@') && text.length > 3 && text.length < 300) {
                  mentions.push(text);
                }
              }
            });
          });

          return [...new Set(mentions)].slice(0, 50);
        });

        logger.debug(`[AIReply] Found ${allMentions.length} mentions`);

        for (const text of allMentions) {
          const mentionMatch = text.match(/@(\w+)/);
          const author = mentionMatch ? mentionMatch[1] : 'unknown';
          addReply(author, text);
        }
      } catch (e) {
        logger.debug(`[AIReply] Strategy 4 failed: ${e.message}`);
      }
    }

    // Strategy 5: ULTRA AGGRESSIVE when few replies found
    if (replies.length < 10) {
      logger.debug(`[AIReply] Strategy 5: ULTRA AGGRESSIVE - extracting any text from articles...`);

      try {
        const ultraAggressive = await page.evaluate(() => {
          const found = [];

          const articles = document.querySelectorAll('article');
          articles.forEach(article => {
            const text = article.innerText?.trim();
            if (text && text.length > 5 && text.length < 300 &&
                !text.includes('http') && !text.includes('www') &&
                !text.includes('://') &&
                !text.includes('keyboard') &&
                !text.includes('shortcut') &&
                !text.includes('View ') &&
                !text.includes('Post ') &&
                !text.includes('See ') &&
                !text.includes('More ') &&
                !text.includes('Menu')) {
              const lines = text.split('\n').filter(l => l.trim().length > 3 && l.trim().length < 150);
              found.push(...lines);
            }
          });

          return [...new Set(found)].slice(0, 50);
        });

        logger.debug(`[AIReply] Strategy 5 found ${ultraAggressive.length} potential replies`);

        for (const text of ultraAggressive) {
          const cleaned = text.replace(/^@\w+\s*/g, '').trim();
          if (cleaned.length > 3 && cleaned.length < 200) {
            const mentionMatch = text.match(/@(\w+)/);
            const author = mentionMatch ? mentionMatch[1] : 'ultra';
            replies.push({ author, text: cleaned.substring(0, 280) });
            logger.debug(`[AIReply] Added from Strategy 5: "${cleaned.substring(0, 40)}..."`);
          }
        }
      } catch (e) {
        logger.debug(`[AIReply] Strategy 5 failed: ${e.message}`);
      }
    }

    // Return to main tweet
    await this._returnToMainTweet(page);

    logger.debug(`[AIReply] Total extracted: ${replies.length} replies`);
    return replies.slice(0, 50);
}

  /**
    * Return to main tweet after extracting replies
    * @param {object} page - Playwright page
    */
  async _returnToMainTweet(page) {
    try {
      logger.debug(`[AIReply] Returning to main tweet...`);

      // Wait a bit first
      await page.waitForTimeout(mathUtils.randomInRange(500, 1000));

      // Multiple approaches to return to top

      // Approach 1: Press Home multiple times
      for (let i = 0; i < 3; i++) {
        await page.keyboard.press('Home');
        await page.waitForTimeout(mathUtils.randomInRange(200, 400));
      }

      // Approach 2: Scroll to top using JavaScript
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(mathUtils.randomInRange(300, 600));

      // Approach 3: Also try focusing on main content
      await page.evaluate(() => {
        const main = document.querySelector('main, [role="main"]');
        if (main) {
          main.scrollTop = 0;
        }
      });

      await page.waitForTimeout(mathUtils.randomInRange(400, 800));

      // Verify we're near top
      const scrollPos = await page.evaluate(() => window.scrollY);
      if (scrollPos > 100) {
        await page.evaluate(() => window.scrollTo(0, 0));
      }

      await page.waitForTimeout(mathUtils.randomInRange(300, 500));
      logger.debug(`[AIReply] Returned to main tweet (scrollY: ${scrollPos})`);
    } catch (e) {
      logger.debug(`[AIReply] Return scroll failed: ${e.message}`);
    }
  }

  /**
    * Extract reply text and author from an article element
    * @param {object} article - Playwright element
    * @param {object} page - Playwright page
    * @returns {Promise<object>} Reply object with author and text
    */
  async extractReplyFromArticle(article, page) {
    try {
      // Get tweet text
      const textEl = await article.$('[data-testid="tweetText"], [dir="auto"]');
      if (!textEl) return null;

      const text = await textEl.innerText().catch(() => '');
      if (!text || text.length < 5) return null;

      // Extract author from article header (not from text content)
      const author = await this.extractAuthorFromArticle(article);

      // Clean up text - remove leading @mentions (keep other mentions in text)
      let cleanedText = text;
      const firstAtMatch = text.match(/^@\w+/);
      if (firstAtMatch && firstAtMatch[0] === author) {
        // Remove author @mention from start
        cleanedText = text.replace(/^@\w+\s*/, '').trim();
      }
      cleanedText = cleanedText.replace(/\n+/g, ' ').trim();

      return { author, text: cleanedText.substring(0, 300) };
    } catch (error) {
      return null;
    }
  }

  /**
    * Extract author username from article header
    * @param {object} article - Playwright article element
    * @returns {Promise<string>} Author username
    */
  async extractAuthorFromArticle(article) {
    try {
      // Look for author in article header - typically in a link with href="/username"
      const headerLink = await article.$('a[href^="/"][role="link"], a[href*="/status/"]');
      
      if (headerLink) {
        const href = await headerLink.getAttribute('href');
        if (href && href.startsWith('/')) {
          const username = href.replace(/^\/|\/$/g, '').split('/')[0];
          if (username && username.length > 0 && username.length <= 20 && !username.includes('?')) {
            return username;
          }
        }
      }

      // Alternative: look for any link that looks like a username
      const allLinks = await article.$$('a[href^="/"]');
      for (const link of allLinks) {
        const href = await link.getAttribute('href');
        if (href && href.startsWith('/') && !href.includes('status')) {
          const username = href.replace(/^\/|\/$/g, '').split('/')[0];
          if (username && username.length > 0 && username.length <= 20 && /^[a-zA-Z0-9_]+$/.test(username)) {
            return username;
          }
        }
      }

      return 'unknown';
    } catch (error) {
      return 'unknown';
    }
  }

  /**
    * Extract author username from a tweet text element
    * @param {object} element - Playwright element
    * @param {object} page - Playwright page
    * @returns {Promise<string>} Author username
    */
  async extractAuthorFromElement(element, page) {
    try {
      // Get the parent article to find author
      const article = await element.$x('ancestor::article[1]');
      if (article && article[0]) {
        return await this.extractAuthorFromArticle(article[0]);
      }

      // Fallback: Try to find @username in the text (less reliable for replies)
      const mentionMatch = await element.evaluate((el) => {
        const text = el.textContent || '';
        const match = text.match(/@(\w{1,15})/);
        return match ? match[1] : null;
      });

      if (mentionMatch) {
        return mentionMatch;
      }

      return 'unknown';
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Extract clean reply text from AI response
   * @param {string} content - Raw AI response
   * @returns {string|null} Clean reply or null
   */
  extractReplyFromResponse(content) {
    if (!content) return null;

    // Remove markdown code blocks
    let cleaned = content
      .replace(/```json?\s*/gi, '')
      .replace(/```\s*/gi, '')
      .trim();

    // Remove any leading "Reply:" or similar prefixes
    cleaned = cleaned
      .replace(/^["']?(Reply|Response|Here|Output):?\s*/i, '')
      .replace(/^["']|["']$/g, '');

    // If it starts with { or [, try to parse as JSON
    if (cleaned.startsWith('{') || cleaned.startsWith('[')) {
      try {
        const parsed = JSON.parse(cleaned);
        if (parsed.reply) {
          cleaned = parsed.reply;
        } else if (Array.isArray(parsed) && parsed[0]) {
          cleaned = typeof parsed[0] === 'string' ? parsed[0] : JSON.stringify(parsed[0]);
        }
      } catch (e) {
        // Not JSON, continue with text
      }
    }

    // Clean up whitespace
    cleaned = cleaned
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join(' ')
      .trim();

    // Remove broken/replacement characters and strip emojis
    cleaned = this.cleanEmojis(cleaned);

    // 30% chance to make all lowercase (human-like casual behavior)
    if (Math.random() < 0.30) {
        cleaned = cleaned.toLowerCase();
    }

    // 80% chance to remove trailing period
    if (Math.random() < 0.80 && cleaned.endsWith('.')) {
        cleaned = cleaned.slice(0, -1);
    }

    return cleaned.length > 0 ? cleaned : null;
  }

  /**
   * Clean emojis and broken characters from text
   * @param {string} text - Text to clean
   * @returns {string} Cleaned text
   */
  cleanEmojis(text) {
    if (!text) return text;

    // Remove replacement characters (broken emoji indicator)
    let cleaned = text.replace(/[��]/g, '');

    // Remove common broken emoji patterns
    cleaned = cleaned.replace(/<[a-z]+[^>]*>/gi, '');
    cleaned = cleaned.replace(/&[a-z]+;/gi, '');

    // Remove emoji characters (unicode ranges)
    cleaned = cleaned
      .replace(/[\p{Extended_Pictographic}]/gu, '')
      .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
      .replace(/[\u{2600}-\u{26FF}]/gu, '')
      .replace(/[\u{2700}-\u{27BF}]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();

    return cleaned;
  }

  /**
   * Validate generated reply
   * @param {string} reply - Generated reply
   * @returns {object} { valid: boolean, reason?: string }
   */
  validateReply(reply) {
    if (!reply || typeof reply !== 'string') {
      return { valid: false, reason: 'empty' };
    }

    const trimmed = reply.trim();

    if (trimmed.length < this.config.MIN_REPLY_LENGTH) {
      return { valid: false, reason: 'too_short' };
    }

    if (trimmed.length > this.config.MAX_REPLY_LENGTH) {
      return { valid: false, reason: 'too_long' };
    }

    // Check for AI indicators
    const aiIndicators = [
      'as an ai', 'i am an ai', 'i\'m an ai', 'being an ai',
      'language model', 'language model', 'artificial intelligence',
      'i cannot', 'i can\'t', 'i do not', 'i don\'t',
      'here is a', 'here\'s a', 'here are some'
    ];

    const lowerReply = reply.toLowerCase();
    for (const indicator of aiIndicators) {
      if (lowerReply.includes(indicator)) {
        return { valid: false, reason: 'ai_indicator' };
      }
    }

    return { valid: true };
  }

  /**
   * Generate random fallback action when skipping AI reply
   * @returns {object} Fallback action
   */
  randomFallback() {
    const roll = Math.random();

    // 30% no action, 35% bookmark, 35% like
    if (roll < 0.30) {
      return {
        action: 'none',
        description: 'No action taken',
        emoji: '➡️'
      };
    } else if (roll < 0.65) {
      return {
        action: 'bookmark',
        description: 'Bookmarked tweet',
        emoji: '🔖'
      };
    } else {
      return {
        action: 'like',
        description: 'Liked tweet',
        emoji: '❤️'
      };
    }
  }

  /**
   * Adaptive retry with exponential backoff and fallback strategies
   * @param {Function} operation - Async operation to retry
   * @param {object} options - Retry options
   * @returns {Promise<object>} Result with success flag and any error
   */
  async adaptiveRetry(operation, options = {}) {
    const {
      maxAttempts = 3,
      baseDelay = 1000,
      maxDelay = 10000,
      backoffMultiplier = 2,
      jitter = true,
      fallbackOnFailure = null
    } = options;

    let lastError = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await operation(attempt);
        if (result.success !== false) {
          return { success: true, attempt, result };
        }
        lastError = result.error || 'Unknown error';
        
        // Calculate delay with exponential backoff
        const delay = Math.min(baseDelay * Math.pow(backoffMultiplier, attempt - 1), maxDelay);
        
        // Add jitter if enabled
        const finalDelay = jitter ? delay * (0.5 + Math.random() * 0.5) : delay;
        
        this.logger.debug(`[AIReply] Attempt ${attempt} failed: ${lastError}, retrying in ${Math.round(finalDelay)}ms...`);
        await new Promise(resolve => setTimeout(resolve, finalDelay));
        
      } catch (error) {
        lastError = error.message;
        this.logger.warn(`[AIReply] Attempt ${attempt} exception: ${error.message}`);
        
        const delay = Math.min(baseDelay * Math.pow(backoffMultiplier, attempt - 1), maxDelay);
        const finalDelay = jitter ? delay * (0.5 + Math.random() * 0.5) : delay;
        
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, finalDelay));
        }
      }
    }

    // All attempts failed
    this.logger.warn(`[AIReply] All ${maxAttempts} attempts failed: ${lastError}`);
    
    if (fallbackOnFailure !== null) {
      return { success: false, fallback: fallbackOnFailure, error: lastError };
    }
    
    return { success: false, error: lastError };
  }

  /**
   * Quick fallback reply generator for when AI fails
   * Generates a simple, safe response
   */
  generateQuickFallback(tweetText, authorUsername) {
    const lowerTweet = tweetText.toLowerCase();
    
    // Question-based fallback patterns
    if (lowerTweet.includes('?')) {
      const responses = [
        "Honestly still figuring that out myself 😅",
        "That's the question isn't it",
        "Wish I had a better answer",
        "Same honestly",
        "This is giving me questions"
      ];
      return responses[Math.floor(Math.random() * responses.length)];
    }
    
    // Positive sentiment patterns
    if (lowerTweet.includes('love') || lowerTweet.includes('amazing') || lowerTweet.includes('great')) {
      const responses = [
        "This is so real",
        "Exactly this",
        "Can't argue with that",
        "This hits different",
        "So accurate"
      ];
      return responses[Math.floor(Math.random() * responses.length)];
    }
    
    // Negative/expressive patterns
    if (lowerTweet.includes('hate') || lowerTweet.includes('worst') || lowerTweet.includes('why')) {
      const responses = [
        "It's giving rough",
        "Too real",
        "This is rough",
        "Can't relate but also can",
        "Oof"
      ];
      return responses[Math.floor(Math.random() * responses.length)];
    }
    
    // General reaction fallbacks
    const generalResponses = [
      "This is it, this is the tweet",
      "Post made",
      "Couldn't have said it better",
      "Real recognize real",
      "This one's for the algorithm",
      "ngl this is true"
    ];
    
    return generalResponses[Math.floor(Math.random() * generalResponses.length)];
  }

  /**
   * Validate and sanitize reply with multiple checks
   * @param {string} reply - Reply to validate
   * @param {string} originalTweet - Original tweet for context
   * @returns {object} Validation result
   */
  validateReplyAdvanced(reply, originalTweet = '') {
    const result = this.validateReply(reply);
    
    if (!result.valid) {
      return result;
    }
    
    // Additional checks
    
    // Check for self-reference (AI admitting it's AI)
    const aiPatterns = [
      /as an ai/i,
      /i am a language/i,
      /i cannot/i,
      /i'm an ai/i,
      /being an ai/i,
      /language model/i
    ];
    
    for (const pattern of aiPatterns) {
      if (pattern.test(reply)) {
        return { valid: false, reason: 'ai_indicator' };
      }
    }
    
    // Check for template/generic responses
    const genericPatterns = [
      /^here'?s (a|my|your)/i,
      /^below is/i,
      /^as requested/i,
      /^per your request/i
    ];
    
    for (const pattern of genericPatterns) {
      if (pattern.test(reply)) {
        return { valid: false, reason: 'generic_template' };
      }
    }
    
    // Check for excessive length (more than needed)
    if (reply.length > 250) {
      this.logger.debug(`[AIReply] Long reply detected (${reply.length} chars), may need trimming`);
    }
    
    // Check for very short replies
    if (reply.length < 5) {
      this.logger.debug(`[AIReply] Very short reply detected (${reply.length} chars)`);
    }
    
    // Check for mentions of the author (often weird in context)
    if (originalTweet && reply.includes('@')) {
      const mentionMatch = originalTweet.match(/@(\w+)/);
      if (mentionMatch && reply.includes('@' + mentionMatch[1])) {
        // It's okay to mention the author
      } else if ((reply.match(/@\w+/g) || []).length > 1) {
        // Too many mentions
        return { valid: false, reason: 'excessive_mentions' };
      }
    }
    
    return { valid: true };
  }

  /**
   * Clean and normalize reply text
   * @param {string} reply - Raw reply
   * @returns {string} Cleaned reply
   */
  normalizeReply(reply) {
    if (!reply) return '';
    
    let cleaned = reply;
    
    // Remove leading/trailing whitespace and quotes
    cleaned = cleaned.trim().replace(/^["']|["']$/g, '');
    
    // Remove common prefixes
    cleaned = cleaned.replace(/^(reply:|response:|my take:|answer:)/i, '').trim();
    
    // Remove any remaining markdown
    cleaned = cleaned.replace(/```\w*\s*/g, '').replace(/```/g, '');
    
    // Normalize whitespace
    cleaned = cleaned.replace(/\s+/g, ' ');
    
    // Remove broken characters
    cleaned = cleaned.replace(/[�]/g, '');
    
    return cleaned.trim();
  }

  /**
   * Get engine statistics
   * @returns {object} Statistics
   */
  getStats() {
    const total = this.stats.attempts;
    return {
      ...this.stats,
      successRate: total > 0 ? ((this.stats.successes / total) * 100).toFixed(1) + '%' : '0%',
      skipRate: total > 0 ? ((this.stats.skips / total) * 100).toFixed(1) + '%' : '0%'
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      attempts: 0,
      successes: 0,
      skips: 0,
      failures: 0,
      safetyBlocks: 0
    };
  }

  // ============================================================================
  // HUMAN-LIKE REPLY EXECUTION (4 Methods)
  // ============================================================================

  /**
   * Execute reply with human-like behavior
   * Selects method randomly based on weights
   */
  async executeReply(page, replyText, options = {}) {
    this.logger.info(`[AIReply] Executing reply (${replyText.length} chars)...`);

    const human = new HumanInteraction();
    human.debugMode = true;

    // Define 4 reply methods with weights
    const methods = [
      { name: 'keyboard_shortcut', weight: 40, fn: () => this.replyMethodA_Keyboard(page, replyText, human) },
      { name: 'button_click', weight: 35, fn: () => this.replyMethodB_Button(page, replyText, human) },
      { name: 'tab_navigation', weight: 15, fn: () => this.replyMethodC_Tab(page, replyText, human) },
      { name: 'right_click', weight: 10, fn: () => this.replyMethodD_RightClick(page, replyText, human) }
    ];

    const selected = human.selectMethod(methods);
    this.logger.info(`[AIReply] Using method: ${selected.name}`);

    try {
      const result = await selected.fn();
      return result;
    } catch (error) {
      this.logger.error(`[AIReply] Method ${selected.name} failed: ${error.message}`);
      // Try fallback to button click
      this.logger.warn(`[AIReply] Trying fallback: button_click`);
      return await this.replyMethodB_Button(page, replyText, human);
    }
  }

  /**
   * Method A: Keyboard Shortcut (40%)
   * Escape → R → [wait] → [type] → Ctrl+Enter
   */
   async replyMethodA_Keyboard(page, replyText, human) {
     human.logStep('KEYBOARD_SHORTCUT', 'Starting');

     // Check page state
     const pageState = await page.evaluate(() => ({
       url: window.location.href,
       title: document.title,
       activeTag: document.activeElement?.tagName,
       activeAria: document.activeElement?.getAttribute('aria-label'),
       hasComposer: !!document.querySelector('[data-testid="tweetTextarea_0"]')
     }));
     human.logStep('PAGE_STATE', `URL: ${pageState.url.substring(0, 50)}... Active: ${pageState.activeTag} aria="${pageState.activeAria}"`);

     // Close any open menus
     human.logStep('ESCAPE', 'Closing open menus');
     await page.keyboard.press('Escape');
     await new Promise(resolve => setTimeout(resolve, 300));

     // Click on the page body first to ensure focus
     await page.click('body', { offset: { x: 100, y: 100 } }).catch(() => {});
     await new Promise(resolve => setTimeout(resolve, 200));

     // Press R for reply
     human.logStep('R_KEY', 'Opening reply composer');
     await page.keyboard.press('r');
     await new Promise(resolve => setTimeout(resolve, 2000));

     // Verify composer opened
     const verify = await human.verifyComposerOpen(page);
     if (!verify.open) {
       human.logStep('VERIFY_FAILED', 'Composer did not open');
       // Try clicking on the page body again and pressing R
       await page.click('body', { offset: { x: 100, y: 100 } }).catch(() => {});
       await new Promise(resolve => setTimeout(resolve, 500));
       await page.keyboard.press('r');
       await new Promise(resolve => setTimeout(resolve, 1500));
       const verify2 = await human.verifyComposerOpen(page);
       if (!verify2.open) {
         human.logStep('VERIFY_FAILED_2', 'Composer still not open after retry');
         return { success: false, reason: 'composer_not_open', method: 'keyboard_shortcut' };
       }
       return { success: true, method: 'keyboard_shortcut', selector: verify2.selector };
     }

     // Type reply
     const composer = page.locator(verify.selector).first();
     await human.typeText(page, replyText, composer);

     // Post with Ctrl+Enter
     const postResult = await human.postTweet(page);

     return {
       success: postResult.success,
       reason: postResult.reason || 'posted',
       method: 'keyboard_shortcut',
       selector: verify.selector
     };
   }

   /**
    * Method B: Button Click (35%)
    * Scroll to top → Click main tweet → Find reply → Scroll → Fixation → Click → [type] → Ctrl+Enter
    */
   async replyMethodB_Button(page, replyText, human) {
     human.logStep('BUTTON_CLICK', 'Starting');

     // CRITICAL: Ensure we're at the TOP of the tweet page
     human.logStep('SCROLL_TOP', 'Scrolling to top of tweet page');
     await page.evaluate(() => window.scrollTo(0, 0));
     await new Promise(resolve => setTimeout(resolve, 800));

     // Click on the main tweet text area to ensure we're focused on it
     human.logStep('FOCUS_MAIN', 'Clicking main tweet to ensure focus');
     const mainTweetSelectors = [
       '[data-testid="tweetText"]',
       '[class*="tweetText"]',
       'article[role="article"] [dir="auto"]'
     ];

     let mainTweetClicked = false;
     for (const selector of mainTweetSelectors) {
       try {
         const el = page.locator(selector).first();
         if (await el.count() > 0) {
           await el.click({ offset: { x: 10, y: 10 } }).catch(() => {});
           await new Promise(resolve => setTimeout(resolve, 300));
           mainTweetClicked = true;
           human.logStep('FOCUS_MAIN', `Clicked with ${selector}`);
           break;
         }
       } catch (e) {}
     }

     if (!mainTweetClicked) {
       human.logStep('FOCUS_MAIN', 'Could not click main tweet, continuing anyway');
     }

     // Random delay before action
     await human.hesitation(500, 1500);

     // Find reply button - prioritize replyEdge (usually on main tweet)
     human.logStep('FIND_BUTTON', 'Locating reply button on main tweet');
     const replyBtnSelectors = [
       '[data-testid="replyEdge"]',  // Edge reply button (definitely on main tweet)
       '[data-testid="reply"]'       // Main reply button
     ];

     const btnResult = await human.findElement(page, replyBtnSelectors, { visibleOnly: true });
     if (!btnResult.element) {
       human.logStep('FIND_FAILED', 'Reply button not found');
       return { success: false, reason: 'button_not_found', method: 'button_click' };
     }

     // Verify button is in the TOP half of viewport (main tweet area)
     try {
       const btnBox = await btnResult.element.boundingBox();
       const viewportHeight = await page.evaluate(() => window.innerHeight);

       if (btnBox && btnBox.y > viewportHeight * 0.5) {
         human.logStep('WARNING', `Button at y=${Math.round(btnBox.y)} > 50% of viewport - might be on reply thread`);
         // Scroll to top and retry
         await page.evaluate(() => window.scrollTo(0, 0));
         await new Promise(resolve => setTimeout(resolve, 1000));

         const btnResult2 = await human.findElement(page, replyBtnSelectors, { visibleOnly: true });
         if (btnResult2.element) {
           human.logStep('RETRY', 'Found button after scroll to top');
         }
       } else {
         human.logStep('POSITION_OK', `Button at y=${Math.round(btnBox.y)} (top half of viewport)`);
       }
     } catch (e) {
       human.logStep('POSITION_CHECK', `Could not check position: ${e.message}`);
     }

     // Scroll to make visible
     human.logStep('SCROLL', 'Making button visible');
     try {
       await btnResult.element.scrollIntoViewIfNeeded();
     } catch (e) {}

    // Target fixation
    await human.fixation(300, 800);

    // Micro movement
    await human.microMove(page, 20);

    // Click
    human.logStep('CLICK', `Clicking with ${btnResult.selector}`);
    try {
      await btnResult.element.click();
    } catch (e) {
      human.logStep('CLICK_FAILED', `Trying force click: ${e.message}`);
      await btnResult.element.click({ force: true });
    }

    await new Promise(resolve => setTimeout(resolve, 1500));

    // Verify composer
    const verify = await human.verifyComposerOpen(page);
    if (!verify.open) {
      return { success: false, reason: 'composer_not_open', method: 'button_click' };
    }

    // Type
    const composer = page.locator(verify.selector).first();
    await human.typeText(page, replyText, composer);

    // Post
    const postResult = await human.postTweet(page);

    return {
      success: postResult.success,
      reason: postResult.reason || 'posted',
      method: 'button_click',
      selector: verify.selector
    };
  }

  /**
   * Method C: Tab Navigation (15%)
   * Tab × N → Find reply → Enter → [type] → Ctrl+Enter
   */
  async replyMethodC_Tab(page, replyText, human) {
    human.logStep('TAB_NAVIGATION', 'Starting');

    // Press Tab multiple times to focus on reply button
    human.logStep('TAB', 'Tabbing to find reply button');
    let tabCount = 0;
    const maxTabs = 20;

    for (let i = 0; i < maxTabs; i++) {
      await page.keyboard.press('Tab');
      await new Promise(resolve => setTimeout(resolve, 50));

      // Check if we can find the reply button focused
      const focused = await page.evaluate(() => {
        const el = document.activeElement;
        return {
          tag: el?.tagName,
          aria: el?.getAttribute('aria-label'),
          role: el?.getAttribute('role')
        };
      });

      tabCount++;

      // Check if this looks like a reply button - STRICT check
      const ariaLower = focused.aria?.toLowerCase() || '';
      const isReplyButton = 
        (ariaLower.includes('reply') && !ariaLower.includes('more') && !ariaLower.includes('replying')) ||
        (focused.tag === 'BUTTON' && ariaLower.includes('reply'));
      
      if (isReplyButton) {
        human.logStep('TAB_SUCCESS', `Found reply button at tab ${tabCount}: aria="${focused.aria}"`);
        break;
      } else if (tabCount % 5 === 0) {
        human.logStep('TAB_DEBUG', `Tab ${tabCount}: ${focused.tag} aria="${focused.aria}"`);
      }
    }

    // Small hesitation before pressing Enter
    await human.hesitation(200, 500);

     // Press Enter
     human.logStep('ENTER', 'Pressing Enter');
     await page.keyboard.press('Enter');
     await new Promise(resolve => setTimeout(resolve, 1500));

     // Verify
     const verify = await human.verifyComposerOpen(page);
     if (!verify.open) {
       human.logStep('ENTER_FAILED', 'Composer did not open with Enter, trying R key');
       // Fallback: try pressing R
       await page.keyboard.press('Escape');
       await new Promise(resolve => setTimeout(resolve, 300));
       await page.keyboard.press('r');
       await new Promise(resolve => setTimeout(resolve, 2000));
       const verify2 = await human.verifyComposerOpen(page);
       if (!verify2.open) {
         return { success: false, reason: 'composer_not_open', method: 'tab_navigation', tabCount };
       }
       // Continue with the opened composer
       const composer = page.locator(verify2.selector).first();
       await human.typeText(page, replyText, composer);
       const postResult = await human.postTweet(page);
       return {
         success: postResult.success,
         reason: postResult.reason || 'posted',
         method: 'tab_navigation',
         tabCount
       };
     }

     // Type
     const composer = page.locator(verify.selector).first();
     await human.typeText(page, replyText, composer);

     // Post
     const postResult = await human.postTweet(page);

     return {
       success: postResult.success,
       reason: postResult.reason || 'posted',
       method: 'tab_navigation',
       tabCount
     };
   }

  /**
   * Method D: Right-Click Context (10%)
   * Hover → Right-click → Move → Click → [type] → Ctrl+Enter
   */
  async replyMethodD_RightClick(page, replyText, human) {
    human.logStep('RIGHT_CLICK', 'Starting');

    // Find reply button first
    const replyBtnSelectors = [
      '[data-testid="reply"]',
      '[aria-label="Reply"]'
    ];

    const btnResult = await human.findElement(page, replyBtnSelectors, { visibleOnly: true });
    if (!btnResult.element) {
      human.logStep('FIND_FAILED', 'Reply button not found');
      return { success: false, reason: 'button_not_found', method: 'right_click' };
    }

    // Get button position
    const btnPos = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (el) {
        const rect = el.getBoundingClientRect();
        return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
      }
      return null;
    }, btnResult.selector);

    if (btnPos) {
      // Move to button
      human.logStep('MOVE', 'Moving to reply button');
      await page.mouse.move(btnPos.x, btnPos.y);
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    // Right-click
    human.logStep('RIGHT_CLICK', 'Right-clicking reply button');
    await page.mouse.click(btnPos?.x || 0, btnPos?.y || 0, { button: 'right' });
    await new Promise(resolve => setTimeout(resolve, 500));

    // Check if context menu opened
    const contextMenuOpen = await page.locator('[role="menuitem"], [role="menu"]').count() > 0;
    human.logStep('CONTEXT_MENU', contextMenuOpen ? 'Opened' : 'Not opened');

    // Try clicking Reply from menu if visible
    if (contextMenuOpen) {
      const replyOption = page.locator('text=Reply', '[aria-label*="Reply"]').first();
      if (await replyOption.count() > 0) {
        human.logStep('MENU_CLICK', 'Clicking Reply from menu');
        await replyOption.click();
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } else {
      // Fallback to left click
      human.logStep('LEFT_CLICK', 'Left-clicking as fallback');
      if (btnPos) {
        await page.mouse.click(btnPos.x, btnPos.y);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Verify
    const verify = await human.verifyComposerOpen(page);
    if (!verify.open) {
      return { success: false, reason: 'composer_not_open', method: 'right_click' };
    }

    // Type
    const composer = page.locator(verify.selector).first();
    await human.typeText(page, replyText, composer);

    // Post
    const postResult = await human.postTweet(page);

    return {
      success: postResult.success,
      reason: postResult.reason || 'posted',
      method: 'right_click'
    };
  }
}

export default AIReplyEngine;

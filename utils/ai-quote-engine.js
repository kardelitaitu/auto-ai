/**
 * AI Quote Tweet Engine
 * Handles AI quote generation, safety filtering, and posting
 * @module utils/ai-quote-engine
 */

import { createLogger } from './logger.js';
import { mathUtils } from './mathUtils.js';
import { sentimentService } from './sentiment-service.js';
import { scrollRandom } from './scroll-helper.js';
import { config } from './config-service.js';
import { HumanInteraction } from './human-interaction.js';
import { getStrategyInstruction } from './twitter-reply-prompt.js';

const logger = createLogger('ai-quote-engine.js');

export const QUOTE_SYSTEM_PROMPT = `You are a real Twitter user crafting an authentic quote tweet.
Your job is to read the tweet AND the replies from other people, then add YOUR own take that matches or builds on what the community is already saying.

## CONSENSUS QUOTE STYLE

1. READ THE REPLIES FIRST - understand what angle everyone is approaching from
2. PICK UP ON THE CONSENSUS - what's the general sentiment or theme?
3. ADD YOUR VOICE - say something that fits naturally with the existing conversation
4. BE SPECIFIC - react to the actual content, not just generic praise

## TONE ADAPTATION

Match your quote tone to the conversation:

### 🎭 HUMOROUS THREAD
- Keep it playful, use light emojis naturally
- Short punchy comments work best
- Examples: "main character energy", "this is giving chaos", "copium overload"

### 📢 NEWS/ANNOUNCEMENT THREAD  
- More informative, acknowledge the news
- Show awareness of implications
- Examples: "this is bigger than people realize", "finally some good news", "waiting for the follow-up"

### 💭 PERSONAL/EMOTIONAL THREAD
- Show empathy without being preachy
- Relate to the experience
- Examples: "this hits different", "so real", "respect for sharing"

### 💻 TECH/PRODUCT THREAD
- Be specific about features or issues
- Mention actual details if you have experience
- Examples: "the battery optimization is actually great", "still waiting on the feature"

## WHAT TO AVOID
- Generic: "That's interesting", "Cool!", "Nice"
- Generic praise without specifics
- Questions (creates threads you don't want)
- Being overly formal or try-hard
- Contrarian takes just to be different
- Hashtags, @mentions (unless organic)
- Using emoji in every quote - match the vibe

Write ONE quote tweet. Maximum 1 short sentence. Be specific and authentic.
IMPORTANT: Return ONLY the final quote tweet text. Do NOT include:
- Any reasoning, thinking, or internal monologue
- Any prefixes like "Here's my quote:" or "My response:"
- Any code blocks or markdown
- Any explanation of your choice

Just output the quote tweet itself.`;

export class AIQuoteEngine {
    constructor(agentConnector, options = {}) {
        this.agent = agentConnector;
        this.logger = createLogger('ai-quote-engine.js');
        this.config = {
            QUOTE_PROBABILITY: options.quoteProbability ?? 1.0,
            MAX_QUOTE_LENGTH: 250,
            MIN_QUOTE_LENGTH: 10,
            MAX_RETRIES: options.maxRetries ?? 2,
            SAFETY_FILTERS: {
                minTweetLength: 10,
                maxTweetLength: 280,
                excludedKeywords: [
                    'politics', 'political', 'vote', 'election', 'trump', 'biden', 'obama',
                    'republican', 'democrat', 'congress', 'senate', 'president', 'policy',
                    'nsfw', 'nude', 'naked', 'explicit', '18+', 'adult', 'xxx', 'porn',
                    'follow back', 'fb', 'make money', 'drop link', 'free crypto',
                    'dm me', 'send dm', 'join now', 'limited offer', 'act now'
                ],
                genericResponses: [
                    'interesting',
                    'so true',
                    'agreed',
                    'facts',
                    'literally me',
                    'mood',
                    'relatable',
                    'this 👏',
                    'preach',
                    'couldn\'t agree more',
                    'absolutely',
                    'can confirm',
                    'same energy',
                    'spot on',
                    'big mood',
                    'my life',
                    'me rn',
                    'real talk',
                    'needed this',
                    'speak louder',
                    'says who',
                    'waiting for this',
                    'finally',
                    'go off',
                    'queen behavior',
                    'king behavior',
                    'didn\'t ask',
                    'nobody asked',
                    'who asked',
                    '🤷',
                    '💯',
                    '🔥',
                    '👏👏',
                    '👏',
                    '🤝',
                    '✨',
                    '🙏'
                ]
            }
        };

        this.stats = {
            attempts: 0,
            successes: 0,
            skips: 0,
            failures: 0,
            safetyBlocks: 0,
            errors: 0,
            emptyContent: 0,
            extractFailed: 0,
            validationFailed: 0,
            retriesUsed: 0,
            fallbackUsed: 0
        };

        this.logger.info(`[AIQuoteEngine] Initialized (probability: ${this.config.QUOTE_PROBABILITY})`);
    }

    updateConfig(options) {
        if (options.quoteProbability !== undefined) {
            this.config.QUOTE_PROBABILITY = options.quoteProbability;
        }
        if (options.maxRetries !== undefined) {
            this.config.MAX_RETRIES = options.maxRetries;
        }
    }

    /**
     * Detect primary language from text content
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
     */
    buildEnhancedPrompt(tweetText, authorUsername, replies = [], url = '', sentimentContext = {}, hasImage = false, engagementLevel = 'unknown') {
        // Detect language from replies
        const detectedLanguage = this.detectReplyLanguage(replies);
        this.logger.debug(`[AIQuote] Detected language: ${detectedLanguage}`);

        // Get sentiment guidance
        const sentiment = sentimentContext.engagementStyle || 'neutral';
        const conversationType = sentimentContext.conversationType || 'general';
        const valence = sentimentContext.valence || 0;
        const sarcasmScore = sentimentContext.sarcasm || 0;

        // Generate sentiment-aware tone guidance
        const toneGuidance = this.getStyleGuidance(sentiment, sarcasmScore);
        const lengthGuidance = this.getLengthGuidance(conversationType, valence);

        // === STRATEGY SELECTION ===
        // Use the improved strategy selector from twitter-reply-prompt.js
        const strategyInstruction = getStrategyInstruction({
            sentiment: valence < -0.3 ? 'negative' : (valence > 0.3 ? 'positive' : 'neutral'),
            type: conversationType,
            engagement: engagementLevel
        });

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
  ${hasImage ? '- [IMAGE DETECTED] This tweet contains an image. Analyze it and comment on visual details.' : ''}

  TONE GUIDANCE: ${toneGuidance}
  STRATEGY INSTRUCTION: ${strategyInstruction}
LENGTH: MAXIMUM 1 SHORT SENTENCE

Write ONE short quote tweet (1 sentence max).
IMPORTANT: This is a QUOTE TWEET, not a reply. You are sharing this tweet with your own followers adding your commentary.
`;

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

    /**
     * Decide whether to quote a tweet
     */
    async shouldQuote(tweetText, authorUsername, context = {}) {
        this.stats.attempts++;

        const rolled = Math.random();
        this.logger.debug(`[AI-Quote] Probability check: ${(this.config.QUOTE_PROBABILITY * 100).toFixed(1)}% threshold, rolled ${(rolled * 100).toFixed(1)}%`);

        if (!mathUtils.roll(this.config.QUOTE_PROBABILITY)) {
            this.stats.skips++;
            return {
                decision: 'skip',
                reason: 'probability',
                quote: null
            };
        }

        return {
            decision: 'proceed',
            reason: 'eligible',
            quote: null
        };
    }

    /**
      * Generate a quote tweet using AI
      */
    async generateQuote(tweetText, authorUsername, context = {}) {
        const { url = '', replies = [] } = context;

        // ================================================================
        // FULL SENTIMENT ANALYSIS OF TWEET
        // ================================================================
        const tweetSentiment = sentimentService.analyze(tweetText);
        
        // Log comprehensive sentiment analysis
        this.logger.info(`[AIQuote] Sentiment Analysis:`);
        this.logger.info(`[AIQuote]   - Overall: ${tweetSentiment.isNegative ? 'NEGATIVE' : 'NEUTRAL/POSITIVE'} (score: ${tweetSentiment.score.toFixed(2)})`);
        this.logger.info(`[AIQuote]   - Valence: ${tweetSentiment.dimensions?.valence?.valence?.toFixed(2) || 'N/A'}`);
        this.logger.info(`[AIQuote]   - Arousal: ${tweetSentiment.dimensions?.arousal?.arousal?.toFixed(2) || 'N/A'}`);
        this.logger.info(`[AIQuote]   - Dominance: ${tweetSentiment.dimensions?.dominance?.dominance?.toFixed(2) || 'N/A'}`);
        this.logger.info(`[AIQuote]   - Sarcasm: ${tweetSentiment.dimensions?.sarcasm?.sarcasm?.toFixed(2) || 'N/A'}`);
        this.logger.info(`[AIQuote]   - Toxicity: ${tweetSentiment.dimensions?.toxicity?.toxicity?.toFixed(2) || 'N/A'}`);
        this.logger.info(`[AIQuote]   - Risk Level: ${tweetSentiment.composite?.riskLevel || 'N/A'}`);
        this.logger.info(`[AIQuote]   - Engagement Style: ${tweetSentiment.composite?.engagementStyle || 'N/A'}`);
        this.logger.info(`[AIQuote]   - Conversation Type: ${tweetSentiment.composite?.conversationType || 'N/A'}`);

        // ================================================================
        // SKIP HIGH-RISK CONVERSATIONS
        // ================================================================
        if (tweetSentiment.isNegative && tweetSentiment.score > 0.3) {
            this.logger.warn(`[AIQuote] Skipping negative content (score: ${tweetSentiment.score.toFixed(2)})`);
            return { quote: null, success: false, reason: 'negative_content' };
        }

        if (tweetSentiment.composite?.riskLevel === 'high') {
            this.logger.warn(`[AIQuote] Skipping high-risk conversation`);
            return { quote: null, success: false, reason: 'high_risk_conversation' };
        }

        // Extract derived sentiment values
        const sentiment = tweetSentiment.composite?.engagementStyle || 'neutral';
        const conversationType = tweetSentiment.composite?.conversationType || 'general';
        const valence = tweetSentiment.dimensions?.valence?.valence || 0;
        const sarcasmScore = tweetSentiment.dimensions?.sarcasm?.sarcasm || 0;

        // ================================================================
        // SENTIMENT-BASED REPLY SELECTION
        // ================================================================
        let selectedReplies = replies;
        if (replies && replies.length > 0) {
            const sentimentAnalysis = sentimentService.analyzeForReplySelection(replies);
            this.logger.info(`[AIQuote] Reply selection strategy: ${sentimentAnalysis.strategy} ` +
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
            
            this.logger.info(`[AIQuote] Selected ${selectedReplies.length} replies for LLM context ` +
                        `(filtered from ${replies.length})`);
        }

        // Build enhanced prompt with language detection
        const sentimentContext = {
            engagementStyle: sentiment,
            conversationType: conversationType,
            valence,
            sarcasm: sarcasmScore
        };
        const hasImage = !!context.screenshot;
        const engagementLevel = context.engagementLevel || 'unknown';
        const promptData = this.buildEnhancedPrompt(tweetText, authorUsername, selectedReplies, url, sentimentContext, hasImage, engagementLevel);

        const systemPrompt = QUOTE_SYSTEM_PROMPT;

        // DEBUG: Log tweet and prompt being sent to LLM
        this.logger.info(`[DEBUG] ============================================`);
        this.logger.info(`[DEBUG] TWEET TO QUOTE:`);
        this.logger.info(`[DEBUG] Author: @${authorUsername}`);
        this.logger.info(`[DEBUG] URL: ${url}`);
        this.logger.info(`[DEBUG] Tweet Text: "${tweetText}"`);
        this.logger.info(`[DEBUG] Tweet Length: ${tweetText.length} chars`);
        this.logger.info(`[DEBUG] Sentiment: ${sentiment}, Tone: ${conversationType}`);
        this.logger.info(`[DEBUG] ----------------------------------------------`);
        this.logger.info(`[DEBUG] REPLIES CONTEXT (${selectedReplies.length} selected from ${replies.length}):`);
        selectedReplies.forEach((reply, idx) => {
            const author = reply.author && reply.author !== 'unknown' ? reply.author : 'User';
            const text = (reply.text || '').substring(0, 80);
            const ellipsis = (reply.text || '').length > 80 ? '...' : '';
            this.logger.info(`[DEBUG] [${idx + 1}] Reply${idx + 1}: "@${author}: ${text}${ellipsis}"`);
        });
        this.logger.info(`[DEBUG] ----------------------------------------------`);
        this.logger.info(`[DEBUG] FULL PROMPT SENT TO LLM:`);
        this.logger.info(`[DEBUG] Language: ${promptData.language}`);
        this.logger.info(`[DEBUG] System Prompt Length: ${systemPrompt.length} chars`);
        this.logger.info(`[DEBUG] User Prompt Length: ${promptData.text.length} chars`);
        this.logger.info(`[DEBUG] ============================================`);

        try {
            let lastError = null;
            const maxRetries = this.config.MAX_RETRIES;

            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                this.logger.info(`[AI-Quote] Generating ${promptData.language} quote tweet (attempt ${attempt}/${maxRetries})...`);

                try {
                    const result = await this.agent.processRequest({
                        action: 'generate_reply',
                        sessionId: this.agent.sessionId || 'quote-engine',
                        payload: {
                            systemPrompt,
                            userPrompt: promptData.text,
                            tweetText,
                            authorUsername,
                            engagementType: 'quote',
                            maxTokens: 75,
                            context: {
                                hasScreenshot: hasImage,
                                replyCount: replies.length,
                                detectedLanguage: promptData.language
                            }
                        }
                    });

                    // DEBUG: Log raw LLM response
                    this.logger.info(`[DEBUG] ----------------------------------------------`);
                    this.logger.info(`[DEBUG] LLM RAW RESPONSE (attempt ${attempt}):`);
                    this.logger.info(`[DEBUG] ${result ? JSON.stringify(result).substring(0, 1000) : 'result is null/undefined'}`);
                    this.logger.info(`[DEBUG] ----------------------------------------------`);

                    // Detailed failure analysis
                    if (!result) {
                        this.logger.error(`[AIQuoteEngine] ❌ LLM result is null/undefined (attempt ${attempt})`);
                        lastError = 'llm_result_null';
                        continue;
                    }

                    if (!result.success) {
                        this.logger.error(`[AIQuoteEngine] ❌ LLM request failed: ${result.error || 'unknown error'} (attempt ${attempt})`);
                        lastError = `llm_failed: ${result.error || 'unknown'}`;
                        continue;
                    }

                    // Extract content from nested response structure (result.data.content) or direct result.content
                    const rawContent = result.data?.content || result.content || '';
                    this.logger.info(`[DEBUG] Extracted content: "${rawContent.substring(0, 100)}..." (length: ${rawContent.length})`);

                    if (!rawContent || rawContent.trim().length === 0) {
                        this.logger.error(`[AIQuoteEngine] ❌ LLM returned empty content (attempt ${attempt}/${maxRetries})`);
                        this.stats.emptyContent++;
                        lastError = 'llm_empty_content';
                        if (attempt < maxRetries) {
                            this.logger.info(`[AIQuoteEngine] Retrying...`);
                            this.stats.retriesUsed++;
                            continue;
                        }
                        return { quote: null, success: false, reason: 'llm_empty_content' };
                    }

                    this.logger.debug(`[DEBUG] Raw content length: ${rawContent.length} chars`);

                    const reply = this.extractReplyFromResponse(rawContent);
                    this.logger.debug(`[DEBUG] Extracted reply: "${reply?.substring(0, 100)}..."`);

                    if (!reply) {
                        this.logger.warn(`[AIQuoteEngine] ⚠️ Could not extract reply from LLM response patterns (attempt ${attempt})`);
                        this.logger.warn(`[DEBUG] Full raw content:\n${rawContent}`);
                        // Fallback: use raw content directly if it's a valid quote
                        const fallbackReply = rawContent.trim();
                        if (fallbackReply.length >= this.config.MIN_QUOTE_LENGTH) {
                            this.logger.info(`[AIQuoteEngine] 🔄 Using raw content as fallback: "${fallbackReply.substring(0, 50)}..."`);
                            this.stats.fallbackUsed++;
                            return {
                                quote: fallbackReply,
                                success: true,
                                note: 'fallback_content_used'
                            };
                        }
                        this.stats.extractFailed++;
                        lastError = 'extract_reply_failed';
                        if (attempt < maxRetries) {
                            this.logger.info(`[AIQuoteEngine] Retrying...`);
                            this.stats.retriesUsed++;
                            continue;
                        }
                        return { quote: null, success: false, reason: 'extract_reply_failed' };
                    }

                    const cleaned = this.cleanQuote(reply);
                    this.logger.info(`[AIQuoteEngine] ✨ Cleaned quote: "${cleaned}" (${cleaned.length} chars)`);

                    if (cleaned.length < this.config.MIN_QUOTE_LENGTH) {
                        this.logger.error(`[AIQuoteEngine] ❌ Quote too short: ${cleaned.length} chars (min: ${this.config.MIN_QUOTE_LENGTH}) (attempt ${attempt})`);
                        lastError = 'quote_too_short';
                        if (attempt < maxRetries) {
                            this.logger.info(`[AIQuoteEngine] Retrying...`);
                            this.stats.retriesUsed++;
                            continue;
                        }
                        return { quote: null, success: false, reason: 'quote_too_short' };
                    }

                    const validation = this.validateQuote(cleaned);
                    if (validation.valid) {
                        this.stats.successes++;
                        return {
                            quote: cleaned,
                            success: true,
                            language: promptData.language
                        };
                    } else {
                        this.logger.warn(`[AIQuoteEngine] ❌ Quote validation failed (${validation.reason}): "${cleaned}" (attempt ${attempt})`);
                        this.stats.validationFailed++;
                        lastError = `validation_failed: ${validation.reason}`;
                        if (attempt < maxRetries) {
                            this.logger.info(`[AIQuoteEngine] Retrying...`);
                            this.stats.retriesUsed++;
                            continue;
                        }
                        return { quote: null, success: false, reason: `validation_failed: ${validation.reason}` };
                    }

                } catch (error) {
                    this.logger.error(`[AIQuoteEngine] ❌ Generation error (attempt ${attempt}): ${error.message}`);
                    this.stats.errors++;
                    lastError = error.message;
                    if (attempt < maxRetries) {
                        this.logger.info(`[AIQuoteEngine] Retrying...`);
                        this.stats.retriesUsed++;
                        continue;
                    }
                    return { quote: null, success: false, reason: error.message };
                }
            }

            // All retries exhausted
            this.logger.error(`[AIQuoteEngine] ❌ All ${maxRetries} attempts failed. Last error: ${lastError}`);
            this.stats.failures++;
            return { quote: null, success: false, reason: `all_attempts_failed: ${lastError}` };

        } catch (error) {
            this.logger.error(`[AIQuoteEngine] Generation failed: ${error.message}`);
            this.stats.errors++;
            return { quote: null, success: false, reason: error.message };
        }
    }

    extractReplyFromResponse(content) {
        if (!content) {
            this.logger.warn(`[extractReplyFromResponse] Empty content received`);
            return null;
        }

        const trimmed = content.trim();
        this.logger.debug(`[extractReplyFromResponse] Processing content: "${trimmed.substring(0, 100)}..." (length: ${trimmed.length})`);

        // ================================================================
        // PATTERN 0: Direct content (already clean, most common case)
        // ================================================================
        if (trimmed.length >= 10 && trimmed.length < 300) {
            // Check if it looks like a real tweet (not JSON, not thinking)
            const isCleanResponse = !trimmed.startsWith('{') && 
                                    !trimmed.startsWith('[') &&
                                    !trimmed.startsWith('```') &&
                                    !trimmed.toLowerCase().includes('thinking') &&
                                    !trimmed.toLowerCase().includes('reasoning') &&
                                    !trimmed.toLowerCase().includes('<thought>');

            if (isCleanResponse) {
                // Check for reasoning patterns
                const isReasoning = /I (?:need to|should|want to|will|must|can|have) /i.test(trimmed) ||
                                   /Let me|I'll|First|Then|So I|Now I/i.test(trimmed) ||
                                   /This is my|My draft|Here's my|I think this/i.test(trimmed) ||
                                   /It needs to be|My draft fits/i.test(trimmed) ||
                                   /That'?s specific|It feels authentic/i.test(trimmed);

                if (!isReasoning) {
                    this.logger.debug(`[extractReplyFromResponse] ✓ Direct content used`);
                    return trimmed;
                }
            }
        }

        // ================================================================
        // PATTERN 1: Look for trailing quoted text (highest priority)
        // ================================================================
        const quotedMatch = trimmed.match(/"([^"]{10,280})"\s*$/);
        if (quotedMatch) {
            const quoted = quotedMatch[1].trim();
            if (!/I (?:need to|should|want to|will|must) /i.test(quoted)) {
                this.logger.debug(`[extractReplyFromResponse] ✓ Quoted text pattern matched`);
                return quoted;
            }
        }

        // Pattern 1b: Single quotes
        const singleQuotedMatch = trimmed.match(/'([^']{10,280})'\s*$/);
        if (singleQuotedMatch) {
            const quoted = singleQuotedMatch[1].trim();
            if (!/I (?:need to|should|want to|will|must) /i.test(quoted)) {
                this.logger.debug(`[extractReplyFromResponse] ✓ Single-quoted text pattern matched`);
                return quoted;
            }
        }

        // ================================================================
        // PATTERN 2: Look for content after last newline (often the actual response)
        // ================================================================
        const lines = trimmed.split('\n');
        const lastLine = lines[lines.length - 1].trim();
        
        if (lastLine.length > 10 && lastLine.length < 300) {
            // Check if it looks like a real response (not internal reasoning)
            const isReasoning = /I (?:need to|should|want to|will|must|can|have) /i.test(lastLine) ||
                               /Let me|I'll|First|Then|So I|Now I/i.test(lastLine) ||
                               /This is my|My draft|Here's my/i.test(lastLine) ||
                               /It needs to be|My draft fits|I think this/i.test(lastLine) ||
                               /That'?s specific|It feels authentic/i.test(lastLine) ||
                               /That's specific|My draft|Here's my|I think this/i.test(lastLine);
            
            if (!isReasoning) {
                this.logger.debug(`[extractReplyFromResponse] ✓ Last line pattern matched`);
                return lastLine;
            }
        }

        // ================================================================
        // PATTERN 3: Look for the last paragraph if it looks like a real response
        // ================================================================
        const paragraphs = trimmed.split(/\n\n+/);
        for (let i = paragraphs.length - 1; i >= 0; i--) {
            const para = paragraphs[i].trim();
            if (para.length > 10 && para.length < 300) {
                const isReasoning = /I (?:need to|should|want to|will|must|can|have) /i.test(para) ||
                                   /Let me|I'll|First|Then|So I|Now I/i.test(para) ||
                                   /This is my|My draft|Here's my/i.test(para) ||
                                   /It needs to be|My draft fits|I think this/i.test(para);
                if (!isReasoning) {
                    this.logger.debug(`[extractReplyFromResponse] ✓ Paragraph pattern matched`);
                    return para;
                }
            }
        }

        // ================================================================
        // PATTERN 4: Look for content after "Answer:", "Response:", "Quote:", etc.
        // ================================================================
        const labelPatterns = [
            /^(?:Answer|Response|Quote|Tweet|My response|Here's my):?\s*/i,
            /^(?:The|Ma) quote:?\s*/i,
            /^(?:I'd|I would|No) (?:say|think|respond):?\s*/i
        ];

        for (const pattern of labelPatterns) {
            const match = trimmed.match(pattern);
            if (match) {
                const afterLabel = trimmed.substring(match[0].length).trim();
                if (afterLabel.length >= 10 && afterLabel.length < 300) {
                    this.logger.debug(`[extractReplyFromResponse] ✓ Label pattern matched`);
                    return afterLabel;
                }
            }
        }

        // ================================================================
        // PATTERN 5: Look for sentences in the content
        // ================================================================
        const sentenceMatch = trimmed.match(/^[^.!?]*[.!?]/);
        if (sentenceMatch && sentenceMatch[0].length >= 10 && sentenceMatch[0].length < 300) {
            this.logger.debug(`[extractReplyFromResponse] ✓ Sentence pattern matched`);
            return sentenceMatch[0].trim();
        }

        // ================================================================
        // STANDARD EXTRACTION (for non-thinking models)
        // ================================================================

        let cleaned = content
            .replace(/```json?\s*/gi, '')
            .replace(/```\s*/gi, '')
            .trim();

        cleaned = cleaned.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');
        cleaned = cleaned.replace(/<\/?THINKING>/gi, '');
        cleaned = cleaned.replace(/\[\/?THINKING\]/gi, '');
        cleaned = cleaned.replace(/\[[\s]*REASONING[\s]*\][\s\S]*?$/gim, '');
        cleaned = cleaned.replace(/^(?:First,?\s*)?I\s+(?:need to|should|want to|must|will|have to|can)\s+[\s\S]*?(?=\n\n|[.!?]\s*[A-Z][a-z]+)/gim, '');
        cleaned = cleaned.replace(/(?:Let me|I'll|I will)\s+(?:think|reason|analyze)[\s\S]*?(?=\.\s*[A-Z]|\n\n)/gi, '');
        cleaned = cleaned.replace(/^(?:My|Here's|The)\s+(?:draft|response|answer|output|suggestion):?\s*/gi, '');
        cleaned = cleaned.replace(/^(?:Okay,?\s*)?I (?:need to|should|want to|will) [^\n]*/i, '');

        if (cleaned.startsWith('{') || cleaned.startsWith('[')) {
            try {
                const parsed = JSON.parse(cleaned);
                if (parsed.reply) return parsed.reply;
                if (parsed.content) return parsed.content;
                if (parsed.text) return parsed.text;
                if (parsed.message) return parsed.message;
                if (parsed.output) return parsed.output;
                // Try to find any string field
                for (const key of Object.keys(parsed)) {
                    if (typeof parsed[key] === 'string' && parsed[key].length >= 10 && parsed[key].length < 300) {
                        return parsed[key];
                    }
                }
            } catch (e) {
                // Not JSON, continue
            }
        }

        cleaned = cleaned
            .replace(/^(?:Okay,?\s*)?I (?:need to|should|want to|will) [^\n]*/i, '')
            .trim();

        if (cleaned && cleaned.length >= 10 && cleaned.length < 300) {
            this.logger.debug(`[extractReplyFromResponse] ✓ Cleaned content used`);
            return cleaned;
        }

        this.logger.warn(`[extractReplyFromResponse] ❌ No pattern matched, returning null`);
        this.logger.debug(`[DEBUG] Full content that failed to extract:\n${content}`);
        return null;
    }

    /**
     * Execute the quote tweet flow
     * Method A: Keyboard Compose + Quote (40%)
     * Method B: Retweet Menu -> Quote (35%)
     * Method C: New Post with URL (25%)
     */
    async executeQuote(page, quoteText, options = {}) {
        const { logger = console, humanTyping } = options;
        this.logger.info(`[AIQuote] Executing quote (${quoteText.length} chars)...`);

        const human = new HumanInteraction(page);
        human.debugMode = true;

        // If humanTyping function is provided, wrap it
        if (humanTyping) {
            // We can attach it to human interaction or use it directly in methods
            // For now, let's assume methods use human.type or page.fill
        }

        const methods = [
            { name: 'keyboard_compose', weight: 40, fn: () => this.quoteMethodA_Keyboard(page, quoteText, human) },
            { name: 'retweet_menu', weight: 35, fn: () => this.quoteMethodB_Retweet(page, quoteText, human) },
            { name: 'new_post', weight: 25, fn: () => this.quoteMethodC_Url(page, quoteText, human) }
        ];

        const selected = human.selectMethod(methods);
        this.logger.info(`[AIQuote] Using method: ${selected.name}`);

        try {
            const result = await selected.fn();
            
            // Update stats based on result
            if (result.success) {
                this.stats.successes++;
            } else {
                this.stats.failures++;
            }
            
            return result;
        } catch (error) {
            this.logger.error(`[AIQuote] Method ${selected.name} failed: ${error.message}`);
            this.logger.warn(`[AIQuote] Trying fallback: retweet_menu`);
            
            // Fallback to Retweet Menu method
            try {
                const result = await this.quoteMethodB_Retweet(page, quoteText, human);
                if (result.success) this.stats.successes++;
                else this.stats.failures++;
                return result;
            } catch (fallbackError) {
                this.stats.failures++;
                return { success: false, reason: `fallback_failed: ${fallbackError.message}` };
            }
        }
    }



    getToneGuidance(tone) {
        const tones = {
            humorous: 'Be witty, add a clever observation, or a lighthearted take.',
            informative: 'Share a relevant fact, statistic, or related information.',
            emotional: 'Express genuine emotion - why does this resonate with you?',
            supportive: 'Show enthusiasm and encourage the author.',
            critical: 'Offer a thoughtful counterpoint or question.',
            neutral: 'Ask a specific question or add a relevant observation.'
        };
        return tones[tone] || tones.neutral;
    }

    getEngagementGuidance(engagement) {
        const engagements = {
            low: 'Maximum 1 short sentence.',
            medium: 'Maximum 1 short sentence.',
            high: 'Maximum 1-2 short sentences.'
        };
        return engagements[engagement] || engagements.low;
    }

    cleanQuote(text) {
        if (!text) return '';

        let cleaned = text
            .replace(/```[\s\S]*?```/g, '')
            .replace(/`([^`]+)`/g, '$1')
            .replace(/^\s*[-*]\s+/gm, '')
            .replace(/^\s*\d+\.\s+/gm, '')
            .replace(/\n+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .replace(/^["']+|["']+$/g, '') // Remove surrounding quotes
            .substring(0, this.config.MAX_QUOTE_LENGTH);

        if (Math.random() < 0.30) {
            cleaned = cleaned.toLowerCase();
        }

        if (Math.random() < 0.80 && cleaned.endsWith('.')) {
            cleaned = cleaned.slice(0, -1);
        }

        return cleaned;
    }

    validateQuote(text) {
        if (!text || text.length < this.config.MIN_QUOTE_LENGTH) {
            return { valid: false, reason: 'too_short' };
        }

        const lower = text.toLowerCase().trim();

        for (const keyword of this.config.SAFETY_FILTERS.excludedKeywords) {
            if (lower.includes(keyword)) {
                return { valid: false, reason: `excluded_keyword:${keyword}` };
            }
        }

        for (const pattern of this.config.SAFETY_FILTERS.genericResponses) {
            if (lower === pattern || lower.startsWith(pattern + ' ') || lower.startsWith(pattern + '.')) {
                return { valid: false, reason: `generic_response:${pattern}` };
            }
            
            const patternIndex = lower.indexOf(' ' + pattern + ' ');
            if (patternIndex !== -1) {
                if (text.length < 40 || (pattern.length / text.length) > 0.4) {
                    return { valid: false, reason: `generic_response:${pattern}` };
                }
            }
        }

        const emojiRegex = /^[\p{Emoji_Presentation}\p{Extended_Pictographic}\s]*$/u;
        if (emojiRegex.test(text) && text.length < 10) {
            return { valid: false, reason: 'emoji_only' };
        }

        return { valid: true, reason: 'passed' };
    }

    getStats() {
        return {
            ...this.stats,
            successRate: this.stats.attempts > 0
                ? ((this.stats.successes / this.stats.attempts) * 100).toFixed(1) + '%'
                : '0%'
        };
    }

    getSentimentGuidance(tweetSentiment) {
        const sentiment = tweetSentiment.composite?.engagementStyle || 'neutral';
        const sarcasmScore = tweetSentiment.dimensions?.sarcasm?.sarcasm || 0;
        const valence = tweetSentiment.dimensions?.valence?.valence || 0;

        const guidance = {
            enthusiastic: 'Show genuine excitement and energy. Use exclamation points naturally.',
            humorous: 'Add a light, witty observation. Keep it fun and relatable.',
            informative: 'Share a relevant fact, statistic, or related information.',
            emotional: 'Express genuine emotion - why does this resonate with you?',
            supportive: 'Show enthusiasm and encourage the author.',
            thoughtful: 'Offer a considered perspective or ask a thoughtful question.',
            critical: 'Present a thoughtful counterpoint or question respectfully.',
            neutral: 'Ask a specific question or add a relevant observation.',
            sarcastic: 'Use subtle irony, but keep it playful, not mean.',
            ironic: 'Employ dry wit, but avoid being dismissive or condescending.',
        };

        if (sarcasmScore > 0.5 && (sentiment === 'sarcastic' || sentiment === 'ironic')) {
            return 'Match the ironic tone - subtle, playful, never mean-spirited.';
        }

        return guidance[sentiment] || guidance.neutral;
    }

    getLengthGuidance(conversationType, valence) {
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

    getStyleGuidance(sentiment, sarcasmScore) {
        const styles = {
            enthusiastic: 'Style: High energy, exclamation points allowed.',
            humorous: 'Style: Witty, maybe use a common internet slang.',
            informative: 'Style: Clear, factual, helpful.',
            emotional: 'Style: Empathetic, personal.',
            supportive: 'Style: Warm, encouraging.',
            thoughtful: 'Style: Reflective, balanced.',
            critical: 'Style: Sharp, questioning.',
            neutral: 'Style: Conversational, casual.',
            sarcastic: 'Style: Dry wit, playful irony.',
            ironic: 'Style: Subtle humor, unexpected twist.'
        };
        return styles[sentiment] || styles.neutral;
    }


    /**
     * Method A: Keyboard Compose + Quote (40%)
     * Click Tweet Text → T → Down → Down → Enter → [type] → Ctrl+Enter
     */
    async quoteMethodA_Keyboard(page, quoteText, human) {
        human.logStep('KEYBOARD_COMPOSE', 'Starting');

        // Close any open menus
        human.logStep('ESCAPE', 'Closing menus');
        await page.keyboard.press('Escape');
        await new Promise(resolve => setTimeout(resolve, 300));

        // STEP 1: Click on the main tweet text first (required for quote to work)
        human.logStep('CLICK_TWEET', 'Clicking main tweet text');
        const tweetTextSelector = '[data-testid="tweetText"]';
        
        let tweetClicked = false;
        try {
            const tweetEl = page.locator(tweetTextSelector).first();
            if (await tweetEl.count() > 0) {
                await tweetEl.click({ offset: { x: 10, y: 10 } });
                await new Promise(resolve => setTimeout(resolve, 500));
                tweetClicked = true;
                human.logStep('CLICK_TWEET', 'Tweet text clicked');
            } else {
                human.logStep('CLICK_TWEET', 'Tweet text not found');
            }
        } catch (e) {
            human.logStep('CLICK_TWEET', `Error: ${e.message}`);
        }

        // STEP 2: Press T to open compose with quote options
        human.logStep('T_KEY', 'Opening quote composer');
        await page.keyboard.press('t');
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Verify composer opened
        let verify = await human.verifyComposerOpen(page);
        if (!verify.open) {
            human.logStep('VERIFY_FAILED', 'Composer did not open with T');
            return { success: false, reason: 'composer_not_open', method: 'keyboard_compose' };
        }

        // STEP 3: Navigate to quote option (usually Down + Enter)
        const menuQuote = page.locator('div[role="menu"] >> text=/Quote/i').first();
        if (await menuQuote.count() > 0) {
            human.logStep('MENU_CLICK', 'Selecting quote');
            await menuQuote.click();
            await new Promise(resolve => setTimeout(resolve, 1200));
        } else {
            for (let i = 0; i < 1; i++) { //lets only do it once
                human.logStep('NAVIGATE', 'Attempting selection via keys');
                await page.keyboard.press('ArrowDown');
                await new Promise(resolve => setTimeout(resolve, 500));
                await page.keyboard.press('Enter');
                await new Promise(resolve => setTimeout(resolve, 1500));
                const found = await page.locator('[data-testid="quotedTweet"], [data-testid="quotedTweetPlaceholder"]').count();
                if (found > 0) break;
            }
        }

        // Verify quote mode (check for quoted tweet preview using multiple strategies)
        const quoteDetectionStrategies = [
            // Strategy 1: Check standard quotedTweet selectors
            async () => {
                const selectors = [
                    '[data-testid="quotedTweet"]',
                    '[data-testid="quotedTweetPlaceholder"]',
                    '[data-testid="tweetText"]',
                    '[class*="quoted"]',
                    '[class*="quoteCard"]',
                    '[class*="QuotedTweet"]',
                    '[class*="quotedTweet"]',
                    '[aria-label*="Quoted"]',
                    '[role="article"][tabindex]'
                ];
                for (const selector of selectors) {
                    const count = await page.locator(selector).count();
                    if (count > 0) {
                        human.logStep('QUOTE_DETECTED', selector);
                        return true;
                    }
                }
                return false;
            },
            // Strategy 2: Check composer HTML for embedded quote
            async () => {
                const composerHTML = await page.evaluate(() => {
                    const composer = document.querySelector('[data-testid="tweetTextarea_0"]');
                    return composer?.innerHTML || '';
                });
                const hasQuote = composerHTML.includes('quoted') ||
                                composerHTML.includes('Pop Base') ||
                                composerHTML.includes('tweet-') ||
                                composerHTML.includes(' TweetText') ||
                                composerHTML.length > 800;
                if (hasQuote) {
                    human.logStep('QUOTE_DETECTED', 'composer_content');
                }
                return hasQuote;
            },
            // Strategy 3: Check composer value for embedded tweet text
            async () => {
                try {
                    const composer = page.locator('[data-testid="tweetTextarea_0"], [role="textbox"][contenteditable="true"]').first();
                    const text = await composer.textContent().catch(() => '');
                    if (text && text.length > 50) {
                        human.logStep('QUOTE_DETECTED', 'composer_text');
                        return true;
                    }
                    return false;
                } catch (_e) {
                    return false;
                }
            }
        ];

        let hasQuotePreview = false;
        for (const strategy of quoteDetectionStrategies) {
            try {
                if (await strategy()) {
                    hasQuotePreview = true;
                    break;
                }
            } catch (e) {
                human.logStep('DETECTION_ERROR', e.message);
            }
        }

        if (!hasQuotePreview) {
            human.logStep('FALLBACK', 'Trying retweet menu approach');
            await page.keyboard.press('Escape');
            await new Promise(resolve => setTimeout(resolve, 500));
            return await this.quoteMethodB_Retweet(page, quoteText, human);
        }

        // Wait for quote preview to be fully loaded before typing
        human.logStep('WAIT_QUOTE', 'Waiting for quote preview to load...');
        await page.waitForSelector('[data-testid="quotedTweet"], [data-testid="quotedTweetPlaceholder"]', {
            timeout: 5000,
            state: 'visible'
        }).catch(() => {
            human.logStep('QUOTE_WAIT_TIMEOUT', 'Quote preview not visible, proceeding anyway');
        });
        await new Promise(resolve => setTimeout(resolve, 500));  // Additional settle time

        // Find composer textarea
        verify = await human.verifyComposerOpen(page);
        const composer = page.locator(verify.selector).first();

        // Verify quote preview is still present
        const quotePreviewCheck = await page.locator('[data-testid="quotedTweet"], [data-testid="quotedTweetPlaceholder"]').first();
        if (await quotePreviewCheck.count() > 0) {
            human.logStep('QUOTE_READY', 'Quote preview confirmed');
        } else {
            human.logStep('QUOTE_WARN', 'Quote preview may not be loaded');
        }

        // Type quote
        human.logStep('TYPE_QUOTE', `Typing ${quoteText.length} chars...`);
        await human.typeText(page, quoteText, composer);

        // Post with Ctrl+Enter
        const postResult = await human.postTweet(page);

        return {
            success: postResult.success,
            reason: postResult.reason || 'posted',
            method: 'keyboard_compose',
            quotePreview: hasQuotePreview
        };
    }

    /**
     * Method B: Retweet Menu (35%)
     * Click Retweet → Find Quote → Click → [type] → Ctrl+Enter
     */
    async quoteMethodB_Retweet(page, quoteText, human) {
        human.logStep('RETWEET_MENU', 'Starting');

        await page.evaluate(() => window.scrollTo(0, 0));
        await new Promise(resolve => setTimeout(resolve, 500));

        // Close any open menus
        await page.keyboard.press('Escape');
        await new Promise(resolve => setTimeout(resolve, 300));

        // STEP 1: Find and click retweet button with specific selectors
        human.logStep('FIND_RETWEET', 'Locating retweet button');
        
        const retweetBtnSelectors = [
            '[data-testid="retweet"]',
            '[aria-label*="Repost"]',
            '[aria-label*="Retweet"]',
            'button[aria-label*="repost"]',
            'button[aria-label*="retweet"]'
        ];

        let retweetBtn = null;
        for (const selector of retweetBtnSelectors) {
            const elements = await page.locator(selector).all();
            for (const el of elements) {
                const isVisible = await el.isVisible().catch(() => false);
                const ariaLabel = (await el.getAttribute('aria-label').catch(() => null)) || '';
                const count = await el.count().catch(() => 0);
                if (count > 0 && isVisible) {
                    retweetBtn = el;
                    human.logStep('RETWEET_FOUND', `${selector} (aria-label: ${ariaLabel})`);
                    break;
                }
            }
            if (retweetBtn) break;
        }

        if (!retweetBtn) {
            human.logStep('FIND_FAILED', 'Retweet button not found');
            return { success: false, reason: 'retweet_button_not_found', method: 'retweet_menu' };
        }

        // Human-like click sequence
        await retweetBtn.scrollIntoViewIfNeeded();
        await human.fixation(300, 800);
        await human.microMove(page, 20);
        await retweetBtn.click({ timeout: 5000 });
        human.logStep('CLICK', 'Clicked retweet button');
        let menuReady = false;
        for (let i = 0; i < 3; i++) {
            const menu = page.locator('[role="menu"]').first();
            const visible = await menu.isVisible().catch(() => false);
            if (visible) {
                menuReady = true;
                break;
            }
            await new Promise(resolve => setTimeout(resolve, 400));
            await retweetBtn.click({ timeout: 5000 }).catch(() => {});
            await new Promise(resolve => setTimeout(resolve, 600));
        }
        if (!menuReady) {
            return { success: false, reason: 'retweet_menu_not_open', method: 'retweet_menu' };
        }

        // STEP 2: Find and click Quote option in dropdown menu
        human.logStep('FIND_QUOTE', 'Looking for Quote option in menu');
        
        const quoteOptionSelectors = [
            'a[role="menuitem"]:has-text("Quote")',
            '[role="menuitem"]:has-text("Quote")',
            'a:has-text("Quote"):not([href])',
            '[data-testid="retweetQuote"]',
            'text=Quote'
        ];

        let quoteOption = null;
        for (const selector of quoteOptionSelectors) {
            try {
                const elements = await page.locator(selector).all();
                for (const el of elements) {
                    const isVisible = await el.isVisible().catch(() => false);
                    const text = await el.innerText().catch(() => '');
                    const count = await el.count().catch(() => 0);
                    if (count > 0 && isVisible && text.toLowerCase().includes('quote')) {
                        quoteOption = el;
                        human.logStep('QUOTE_FOUND', `${selector} (text: "${text}")`);
                        break;
                    }
                }
                if (quoteOption) break;
            } catch (e) {
                human.logStep('SELECTOR_ERROR', `${selector}: ${e.message}`);
            }
        }

        if (!quoteOption) {
            human.logStep('QUOTE_NOT_FOUND', 'Quote option not found in menu');
            // Debug: show what's in the menu
            const menuItems = await page.locator('[role="menuitem"]').all();
            human.logStep('DEBUG', `Found ${menuItems.length} menu items`);
            
            // Fallback to keyboard method
            await page.keyboard.press('Escape');
            await new Promise(resolve => setTimeout(resolve, 500));
            return await this.quoteMethodA_Keyboard(page, quoteText, human);
        }

        // Click Quote option with human-like behavior
        await human.fixation(100, 300);
        await human.microMove(page, 10);
        await quoteOption.click({ timeout: 5000 });
        human.logStep('QUOTE_CLICK', 'Clicked Quote option');
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Wait for quote preview to load before typing
        human.logStep('WAIT_QUOTE', 'Waiting for quote preview...');
        await page.waitForSelector('[data-testid="quotedTweet"], [data-testid="quotedTweetPlaceholder"]', {
            timeout: 5000,
            state: 'visible'
        }).catch(() => {
            human.logStep('QUOTE_WAIT_TIMEOUT', 'Quote preview not visible');
        });
        await new Promise(resolve => setTimeout(resolve, 500));

        // STEP 3: Verify composer is ready
        const verify = await human.verifyComposerOpen(page);
        if (!verify.open) {
            human.logStep('VERIFY_FAILED', 'Composer did not open');
            return { success: false, reason: 'composer_not_open', method: 'retweet_menu' };
        }
        human.logStep('COMPOSER_READY', verify.selector);

        // STEP 4: Enhanced quote detection
        const quoteDetectionStrategies = [
            async () => {
                const selectors = [
                    '[data-testid="quotedTweet"]',
                    '[data-testid="quotedTweetPlaceholder"]',
                    '[class*="quoted"]',
                    '[class*="quoteCard"]'
                ];
                for (const sel of selectors) {
                    const count = await page.locator(sel).count();
                    if (count > 0) return true;
                }
                return false;
            },
            async () => {
                try {
                    const composer = page.locator('[data-testid="tweetTextarea_0"], [role="textbox"][contenteditable="true"]').first();
                    const text = await composer.textContent().catch(() => '');
                    return !!text && text.length > 50;
                } catch (_e) {
                    return false;
                }
            }
        ];

        let hasQuotePreview = false;
        for (const strategy of quoteDetectionStrategies) {
            try {
                if (await strategy()) {
                    hasQuotePreview = true;
                    break;
                }
            } catch (e) {
                human.logStep('DETECTION_ERROR', e.message);
            }
        }

        if (!hasQuotePreview) {
            human.logStep('WARNING', 'Quote preview not detected - continuing anyway');
        }

        // STEP 5: Type and post
        const composer = page.locator(verify.selector).first();
        
        // Clear and type
        await composer.click();
        await page.keyboard.press('Control+a');
        await page.keyboard.press('Delete');
        await new Promise(resolve => setTimeout(resolve, 200));
        
        human.logStep('TYPING', `Entering ${quoteText.length} chars`);
        await human.typeText(page, quoteText, composer);

        // Post
        const postResult = await human.postTweet(page);

        return {
            success: postResult.success,
            reason: postResult.reason || 'posted',
            method: 'retweet_menu',
            quotePreview: hasQuotePreview
        };
    }

    /**
     * Method C: New Post Button → Paste URL → Type Comment (15%)
     */
    async quoteMethodC_Url(page, quoteText, human) {
        human.logStep('NEW_POST_URL', 'Starting');

        // Get current tweet URL
        const currentUrl = page.url();
        human.logStep('CURRENT_URL', currentUrl);

        // Copy URL to clipboard for pasting
        await page.evaluate((url) => {
            navigator.clipboard.writeText(url);
        }, currentUrl);
        human.logStep('CLIPBOARD', 'URL copied to clipboard');

        // Close any open menus
        await page.keyboard.press('Escape');
        await new Promise(resolve => setTimeout(resolve, 300));

        // STEP 1: Find and click Compose / New Post button
        human.logStep('FIND_COMPOSE', 'Looking for Compose button');
        const composeBtnSelectors = [
            '[data-testid="SideNav_NewTweet_Button"]',
            '[aria-label="Post"]',
            '[aria-label="New post"]',
            '[aria-label="Post your reply"]',
            'button:has-text("Post")',
            'button:has-text("New post")'
        ];

        let composeBtn = null;
        for (const selector of composeBtnSelectors) {
            const elements = await page.locator(selector).all();
            for (const el of elements) {
                const isVisible = await el.isVisible().catch(() => false);
                const ariaLabel = (await el.getAttribute('aria-label').catch(() => null)) || '';
                const count = await el.count().catch(() => 0);
                if (count > 0 && isVisible) {
                    composeBtn = el;
                    human.logStep('COMPOSE_FOUND', `${selector} (aria-label: "${ariaLabel}")`);
                    break;
                }
            }
            if (composeBtn) break;
        }

        if (!composeBtn) {
            human.logStep('FIND_FAILED', 'Compose button not found');
            return { success: false, reason: 'compose_button_not_found', method: 'new_post' };
        }

        // Human-like click sequence
        await composeBtn.scrollIntoViewIfNeeded();
        await human.fixation(300, 800);
        await human.microMove(page, 20);
        await composeBtn.click({ timeout: 5000 });
        human.logStep('CLICK', 'Clicked Compose button');
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Wait for composer to be fully loaded
        await page.waitForSelector('[data-testid="tweetTextarea_0"]', {
            timeout: 5000,
            state: 'visible'
        }).catch(() => {
            human.logStep('COMPOSER_WAIT_TIMEOUT', 'Composer not visible');
        });

        // STEP 2: Verify composer is open
        const verify = await human.verifyComposerOpen(page);
        if (!verify.open) {
            human.logStep('VERIFY_FAILED', 'Composer did not open');
            return { success: false, reason: 'composer_not_open', method: 'new_post' };
        }
        human.logStep('COMPOSER_READY', verify.selector);

        // Additional wait for composer to be fully interactive
        await new Promise(resolve => setTimeout(resolve, 500));

        // STEP 3: Type the comment FIRST
        const composer = page.locator(verify.selector).first();
        
        human.logStep('TYPING', `Entering ${quoteText.length} chars`);
        await human.typeText(page, quoteText, composer);

        // Step 4: Create new line AFTER typing comment
        human.logStep('NEWLINE', 'Creating new line...');
        await page.keyboard.press('Enter');
        await new Promise(resolve => setTimeout(resolve, 500));

        // Verify new line was created
        const contentAfterEnter = await page.evaluate(() => {
            const composer = document.querySelector('[data-testid="tweetTextarea_0"]');
            return composer?.innerHTML || '';
        });
        
        // If no <br> or new div, try Enter again
        if (!contentAfterEnter.includes('<br>') && !contentAfterEnter.includes('<div>')) {
            human.logStep('NEWLINE', 'Pressing Enter again...');
            await page.keyboard.press('Enter');
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Step 5: Paste the URL LAST (appears as preview/card below comment)
        human.logStep('PASTE_URL', 'Pasting tweet URL...');
        await page.keyboard.press('Control+v');
        await new Promise(resolve => setTimeout(resolve, 750));

        // Verify URL was pasted
        const finalContent = await page
            .locator('[data-testid="tweetTextarea_0"], [role="textbox"][contenteditable="true"]')
            .first()
            .textContent()
            .catch(() => '');
        if (finalContent.includes('x.com') || finalContent.includes('twitter.com')) {
            human.logStep('URL_PASTED', 'URL pasted successfully');
        } else {
            human.logStep('PASTE_WARN', 'URL may not have pasted correctly');
        }

        // STEP 6: Post
        const postResult = await human.postTweet(page);

        return {
            success: postResult.success,
            reason: postResult.reason || 'posted',
            method: 'new_post',
            url: currentUrl
        };
    }
}

export default AIQuoteEngine;

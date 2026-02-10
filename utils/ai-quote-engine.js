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

const logger = createLogger('ai-quote-engine.js');

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
            errors: 0
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

        // Build replies context for the prompt
        let repliesContext = '';
        if (selectedReplies && selectedReplies.length > 0) {
            repliesContext = `\n\nOther people's reactions:\n${selectedReplies.map((r, i) => {
                const author = r.author && r.author !== 'unknown' ? r.author : 'User';
                const text = (r.text || '').substring(0, 200);
                return `[${i + 1}] @${author}: ${text}${r.text?.length > 200 ? '...' : ''}`;
            }).join('\n')}`;
        }

        // ================================================================
        // SENTIMENT-AWARE PROMPT GENERATION
        // ================================================================
        const toneGuidance = this.getSentimentGuidance(tweetSentiment);
        const lengthGuidance = this.getLengthGuidance(conversationType, valence);
        const styleGuidance = this.getStyleGuidance(sentiment, sarcasmScore);

        const systemPrompt = `You are a real Twitter user crafting an authentic quote tweet.

IMPORTANT: Keep it SHORT. Maximum 1 short sentence.

TWEET ANALYSIS:
- Sentiment: ${sentiment}
- Conversation Type: ${conversationType}
- Valence: ${valence > 0 ? 'Positive' : valence < 0 ? 'Negative' : 'Neutral'}
- Tone Match Required: ${toneGuidance}
- Style: ${styleGuidance}

CRITICAL RULES:
- NEVER use generic openers like "Interesting...", "So true!", "Agreed!", "facts", "literally me", "mood"
- NEVER just say "Interesting" or "So true" or "facts" or "mood" or "relatable"
- Add SPECIFIC insight, question, or perspective that shows you actually engaged
- Reference something specific from the tweet or reply context
- Be authentic - write like a real person, not an AI
- KEEP IT SHORT: ${lengthGuidance}
${toneGuidance}

${styleGuidance}

What makes a GOOD quote tweet:
- Asks a specific question about the content, OR
- Adds related information or context, OR
- Shares a personal connection or experience, OR
- Offers a different perspective or insight

Write ONE quote tweet. Maximum 1 short sentence. Be specific and authentic.
IMPORTANT: Return ONLY the final quote tweet text. Do NOT include:
- Any reasoning, thinking, or internal monologue
- Any prefixes like "Here's my quote:" or "My response:"
- Any code blocks or markdown
- Any explanation of your choice

Just output the quote tweet itself.`;

        const userPrompt = `Original tweet by @${authorUsername}:
"${tweetText}"${repliesContext}

IMPORTANT: Maximum 1 short sentence.

Write ONE quote tweet that:
- Matches the "${sentiment}" tone
- Is appropriate for "${conversationType}" type content
- ${toneGuidance}
- KEEP IT SHORT: ${lengthGuidance}

Output only the quote tweet text.`;

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
        this.logger.info(`[DEBUG] System Prompt Length: ${systemPrompt.length} chars`);
        this.logger.info(`[DEBUG] User Prompt Length: ${userPrompt.length} chars`);
        this.logger.info(`[DEBUG] ============================================`);

        try {
            this.logger.info(`[AI-Quote] Generating quote tweet (attempt 1/2)...`);

            const result = await this.agent.processRequest({
                action: 'generate_reply',
                payload: {
                    systemPrompt,
                    userPrompt,
                    tweetText,
                    authorUsername,
                    engagementType: 'quote',
                    maxTokens: 75
                },
                sessionId: 'quote-engine'
            });

            // DEBUG: Log raw LLM response
            this.logger.info(`[DEBUG] ----------------------------------------------`);
            this.logger.info(`[DEBUG] LLM RAW RESPONSE:`);
            this.logger.info(`[DEBUG] ${result ? JSON.stringify(result).substring(0, 500) : 'result is null/undefined'}`);
            this.logger.info(`[DEBUG] ----------------------------------------------`);

            // Detailed failure analysis
            if (!result) {
                this.logger.error(`[AIQuoteEngine] ❌ LLM result is null/undefined`);
                return { quote: null, success: false, reason: 'llm_result_null' };
            }

            if (!result.success) {
                this.logger.error(`[AIQuoteEngine] ❌ LLM request failed: ${result.error || 'unknown error'}`);
                return { quote: null, success: false, reason: `llm_failed: ${result.error || 'unknown'}` };
            }

            if (!result.content) {
                this.logger.error(`[AIQuoteEngine] ❌ LLM returned empty content`);
                return { quote: null, success: false, reason: 'llm_empty_content' };
            }

            this.logger.debug(`[DEBUG] Raw content length: ${result.content.length} chars`);

            const reply = this.extractReplyFromResponse(result.content);
            this.logger.debug(`[DEBUG] Extracted reply: "${reply?.substring(0, 100)}..."`);

            if (!reply) {
                this.logger.error(`[AIQuoteEngine] ❌ Could not extract reply from LLM response`);
                this.logger.debug(`[DEBUG] Full raw content:\n${result.content}`);
                return { quote: null, success: false, reason: 'extract_reply_failed' };
            }

            const cleaned = this.cleanQuote(reply);
            this.logger.info(`[AIQuoteEngine] ✨ Cleaned quote: "${cleaned}" (${cleaned.length} chars)`);

            if (cleaned.length < this.config.MIN_QUOTE_LENGTH) {
                this.logger.error(`[AIQuoteEngine] ❌ Quote too short: ${cleaned.length} chars (min: ${this.config.MIN_QUOTE_LENGTH})`);
                return { quote: null, success: false, reason: 'quote_too_short' };
            }

            const validation = this.validateQuote(cleaned);
            if (validation.valid) {
                return {
                    quote: cleaned,
                    success: true
                };
            } else {
                this.logger.warn(`[AIQuoteEngine] ❌ Quote validation failed (${validation.reason}): "${cleaned}"`);
                return { quote: null, success: false, reason: `validation_failed: ${validation.reason}` };
            }

        } catch (error) {
            this.logger.error(`[AIQuoteEngine] Generation failed: ${error.message}`);
            return { quote: null, success: false, reason: error.message };
        }
    }

    extractReplyFromResponse(content) {
        if (!content) return null;

        const trimmed = content.trim();

        // ================================================================
        // SPECIAL HANDLING FOR THINKING/REASONING MODELS (DeepSeek R1, etc.)
        // ================================================================

        // Pattern 1: Look for trailing quoted text (highest priority)
        const quotedMatch = trimmed.match(/"([^"]{10,280})"\s*$/);
        if (quotedMatch) {
            const quoted = quotedMatch[1].trim();
            if (!/I (?:need to|should|want to|will|must) /i.test(quoted)) {
                return quoted;
            }
        }

        // Pattern 2: Look for content after last newline (often the actual response)
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
                return lastLine;
            }
        }

        // Pattern 3: Look for single quoted text at the end
        const singleQuotedMatch = trimmed.match(/'([^']{10,280})'\s*$/);
        if (singleQuotedMatch) {
            const quoted = singleQuotedMatch[1].trim();
            if (!/I (?:need to|should|want to|will|must) /i.test(quoted)) {
                return quoted;
            }
        }

        // Pattern 4: Look for the last paragraph if it looks like a real response
        const paragraphs = trimmed.split(/\n\n+/);
        for (let i = paragraphs.length - 1; i >= 0; i--) {
            const para = paragraphs[i].trim();
            if (para.length > 10 && para.length < 300) {
                const isReasoning = /I (?:need to|should|want to|will|must|can|have) /i.test(para) ||
                                   /Let me|I'll|First|Then|So I|Now I/i.test(para) ||
                                   /This is my|My draft|Here's my/i.test(para) ||
                                   /It needs to be|My draft fits|I think this/i.test(para);
                if (!isReasoning) {
                    return para;
                }
            }
        }

        // ================================================================
        // STANDARD EXTRACTION (for non-thinking models)
        // ================================================================

        let cleaned = content
            .replace(/```json?\s*/gi, '')
            .replace(/```\s*/gi, '')
            .trim();

        cleaned = cleaned.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');
        cleaned = cleaned.replace(/\[\/?THINKING\]/gi, '');
        cleaned = cleaned.replace(/\[[\s]*REASONING[\s]*\][\s\S]*?$/gim, '');
        cleaned = cleaned.replace(/^(?:First,?\s*)?I\s+(?:need to|should|want to|must|will|have to|can)\s+[\s\S]*?(?=\n\n|[.!?]\s*[A-Z][a-z]+)/gim, '');
        cleaned = cleaned.replace(/(?:Let me|I'll|I will)\s+(?:think|reason|analyze)[\s\S]*?(?=\.\s*[A-Z]|\n\n)/gi, '');
        cleaned = cleaned.replace(/^(?:My|Here's|The)\s+(?:draft|response|answer|output|suggestion):?\s*/gi, '');

        if (cleaned.startsWith('{') || cleaned.startsWith('[')) {
            try {
                const parsed = JSON.parse(cleaned);
                if (parsed.reply) return parsed.reply;
                if (parsed.content) return parsed.content;
                if (parsed.text) return parsed.text;
                if (parsed.message) return parsed.message;
            } catch (e) {
            }
        }

        cleaned = cleaned
            .replace(/^(?:Okay,?\s*)?I (?:need to|should|want to|will) [^\n]*/i, '')
            .trim();

        return cleaned || null;
    }

    /**
     * Execute the quote tweet flow
     */
    async executeQuote(page, quoteText, options = {}) {
        const { logger = console, humanTyping } = options;

        try {
            logger.info(`[AIQuote] Executing quote tweet...`);

            const clickResult = await this.clickRetweetAndQuote(page, quoteText, { logger, humanTyping });

            if (!clickResult || !clickResult.success) {
                this.stats.failures++;
                const reason = clickResult?.reason || 'unknown';
                logger.warn(`[AIQuote] Quote tweet failed: ${reason}`);
                return { success: false, reason };
            }

            logger.info(`[AIQuote] Step 3: Typing quote tweet...`);

            const composer = page.locator('[data-testid="tweetTextarea_0"]').first();
            if (await composer.count() === 0) {
                logger.warn(`[AIQuote] Composer not found`);
                return { success: false, reason: 'composer_not_found' };
            }

            const quoteReadTime = mathUtils.randomInRange(10000, 15000);
            logger.info(`[AIQuote] Reading existing replies for ${Math.round(quoteReadTime / 1000)}s before composing...`);

            if (Math.random() < 0.6) {
                await scrollRandom(page, 150, 300);
                await page.waitForTimeout(mathUtils.randomInRange(2000, 4000));
                await scrollRandom(page, 100, 200);
                await page.waitForTimeout(mathUtils.randomInRange(2000, 4000));
            } else {
                await page.waitForTimeout(quoteReadTime / 3);
                await page.mouse.move(mathUtils.randomInRange(-10, 10), mathUtils.randomInRange(-5, 5));
                await page.waitForTimeout(quoteReadTime / 3);
                await page.mouse.move(mathUtils.randomInRange(-8, 8), mathUtils.randomInRange(-6, 6));
                await page.waitForTimeout(quoteReadTime / 3);
            }

            logger.info(`[AIQuote] Done reading, now composing quote...`);
            logger.info('[AIQuote] Returning to top of conversation...');
            await page.evaluate(() => window.scrollTo(0, 0));
            await page.waitForTimeout(mathUtils.randomInRange(500, 1000));

            if (humanTyping && typeof humanTyping === 'function') {
                await composer.click();
                await humanTyping(composer, quoteText);
            } else {
                await composer.fill(quoteText);
            }
            await page.waitForTimeout(mathUtils.randomInRange(500, 1000));

            logger.info(`[AIQuote] Step 4: Posting with Ctrl+Enter...`);

            // Use Ctrl+Enter to post (more reliable than clicking button)
            await page.keyboard.press('Control+Enter');
            await page.waitForTimeout(500);

            // Verify post was attempted (check if composer closed)
            const composerCheck = await page.locator('[data-testid="tweetTextarea_0"]').count();
            
            if (composerCheck === 0) {
                logger.info(`[AIQuote] Quote tweet posted (composer closed)`);
                this.stats.successes++;
                return { success: true };
            }

            // Fallback: Try clicking button if Ctrl+Enter didn't work
            logger.warn(`[AIQuote] Ctrl+Enter didn't close composer, trying button click...`);
            const postBtn = page.locator('span:has-text("Post")').first();
            if (await postBtn.count() > 0) {
                await postBtn.click();
                await page.waitForTimeout(mathUtils.randomInRange(1500, 2500));
            }

            logger.info(`[AIQuote] Quote tweet posted`);
            this.stats.successes++;
            return { success: true };

        } catch (error) {
            this.stats.errors++;
            logger.error(`[AIQuote] Error: ${error.message}`);
            return { success: false, reason: error.message };
        }
    }

     async clickRetweetAndQuote(page, quoteText, options = {}) {
        const { logger = console } = options;

        try {
            logger.info(`[AIQuote] Step 1: Using keyboard sequence for quote...`);

            // First press Escape to close any open menus
            await page.keyboard.press('Escape');
            await page.waitForTimeout(300);

            // Press 'T' to open compose
            logger.info(`[AIQuote] Pressing 'T' to open compose...`);
            await page.keyboard.press('t');
            await page.waitForTimeout(1000);

            // Check if composer opened
            let composer = page.locator('[data-testid="tweetTextarea_0"]').first();
            if (await composer.count() === 0) {
                logger.warn(`[AIQuote] Composer didn't open with 'T', trying alternative...`);
                // Alternative: Go directly to tweet URL with compose
                return { success: false, reason: 'keyboard_sequence_failed' };
            }

            logger.info(`[AIQuote] Composer opened, pressing Down + Enter to quote...`);

            // Press Down Arrow to navigate to quote option
            await page.keyboard.press('ArrowDown');
            await page.waitForTimeout(500);

            // Press Enter to select quote
            await page.keyboard.press('Enter');
            await page.waitForTimeout(1500);

            // Verify we're in quote mode (should have quoted tweet preview)
            const quotedPreview = await page.locator('[data-testid="quotedTweet"]', '[data-testid="tweetText"]').first();
            const hasQuotedPreview = await quotedPreview.count() > 0;

            if (!hasQuotedPreview) {
                logger.warn(`[AIQuote] No quote preview detected, trying retweet menu approach...`);
                // Fallback: Click retweet then find quote
                await page.keyboard.press('Escape');
                await page.waitForTimeout(300);

                const retweetBtn = page.locator('[data-testid="retweet"]').first();
                if (await retweetBtn.count() > 0) {
                    await retweetBtn.click();
                    await page.waitForTimeout(800);

                    // Try to find quote option
                    const quoteOption = page.locator('text=Quote').first();
                    if (await quoteOption.count() > 0) {
                        await quoteOption.click();
                        await page.waitForTimeout(1500);
                    } else {
                        return { success: false, reason: 'quote_option_not_found' };
                    }
                } else {
                    return { success: false, reason: 'retweet_button_not_found' };
                }
            }

            // Now we should be in the quote composer
            composer = page.locator('[data-testid="tweetTextarea_0"]').first();
            if (await composer.count() === 0) {
                logger.warn(`[AIQuote] Composer not found after quote sequence`);
                return { success: false, reason: 'composer_not_found' };
            }

            logger.info(`[AIQuote] Successfully opened quote composer`);
            return { success: true };

        } catch (error) {
            logger.error(`[AIQuote] Click flow error: ${error.message}`);
            return { success: false, reason: `click_error: ${error.message}` };
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
        const valenceMultiplier = Math.abs(valence) > 0.5 ? 1.1 : 1.0;

        const lengthGuides = {
            'heated-debate': 'CRITICAL: Maximum 1 short sentence.',
            'casual-chat': 'Maximum 1 short sentence.',
            'announcement': 'Maximum 1 sentence.',
            'question': 'One short question.',
            'humor': 'Maximum 1 punchy sentence.',
            'news': 'Maximum 1 short sentence.',
            'personal': 'Maximum 1 short sentence.',
            'controversial': 'CRITICAL: Maximum 1 short sentence.',
            'general': 'Maximum 1 short sentence.',
        };

        const baseGuidance = lengthGuides[conversationType] || lengthGuides.general;

        if (valenceMultiplier > 1.0) {
            return baseGuidance + ' Slightly more expressive given emotional content.';
        }

        return baseGuidance;
    }

    getStyleGuidance(sentiment, sarcasmScore) {
        const styles = {
            enthusiastic: '- Voice: Enthusiastic but authentic\n- Energy: High\n- Example: "This is exactly what I needed to see today!"',
            humorous: '- Voice: Witty, playful\n- Energy: Light\n- Example: "My brain needed this take"',
            informative: '- Voice: Knowledgeable but not preachy\n- Energy: Calm\n- Example: "Related: this connects to..."',
            emotional: '- Voice: Genuine, vulnerable\n- Energy: Warm\n- Example: "This hits different..."',
            supportive: '- Voice: Encouraging, warm\n- Energy: Positive\n- Example: "We love to see it!"',
            thoughtful: '- Voice: Reflective, measured\n- Energy: Calm\n- Example: "Interesting perspective because..."',
            critical: '- Voice: Skeptical but respectful\n- Energy: Measured\n- Example: "Counterpoint worth considering..."',
            neutral: '- Voice: Curious, engaged\n- Energy: Neutral\n- Example: "Question about this..."',
            sarcastic: '- Voice: Dry wit, subtle irony\n- Energy: Understated\n- Example: "Oh absolutely, that\'s exactly how it works"',
            ironic: '- Voice: Ironic, sardonic\n- Energy: Dry\n- Example: "Sure, because that\'s realistic"',
        };

        if (sarcasmScore > 0.6 && (sentiment === 'sarcastic' || sentiment === 'ironic')) {
            return styles.sarcastic;
        }

        return styles[sentiment] || styles.neutral;
    }

    async executeQuote(page, quoteText, options = {}) {
        this.logger.info(`[AIQuote] Executing quote (${quoteText.length} chars)...`);

        const human = new HumanInteraction();
        human.debugMode = true;

        const methods = [
            { name: 'keyboard_compose', weight: 40, fn: () => this.quoteMethodA_Keyboard(page, quoteText, human) },
            { name: 'retweet_menu', weight: 35, fn: () => this.quoteMethodB_Retweet(page, quoteText, human) },
            { name: 'new_post', weight: 25, fn: () => this.quoteMethodC_Url(page, quoteText, human) }
        ];

        const selected = human.selectMethod(methods);
        this.logger.info(`[AIQuote] Using method: ${selected.name}`);

        try {
            const result = await selected.fn();
            return result;
        } catch (error) {
            this.logger.error(`[AIQuote] Method ${selected.name} failed: ${error.message}`);
            this.logger.warn(`[AIQuote] Trying fallback: retweet_menu`);
            return await this.quoteMethodB_Retweet(page, quoteText, human);
        }
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

        // STEP 3: Navigate to quote option (usually Down + Down)
        human.logStep('NAVIGATE', 'Pressing Down to find quote option');
        await page.keyboard.press('ArrowDown');
        await new Promise(resolve => setTimeout(resolve, 300));
        await page.keyboard.press('ArrowDown');
        await new Promise(resolve => setTimeout(resolve, 300));

        // STEP 4: Press Enter to select quote
        human.logStep('ENTER', 'Selecting quote option');
        await page.keyboard.press('Enter');
        await new Promise(resolve => setTimeout(resolve, 1500));

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
                const composerValue = await page.evaluate(() => {
                    const composer = document.querySelector('[data-testid="tweetTextarea_0"]');
                    return composer?.value || composer?.textContent || '';
                });
                if (composerValue.length > 50) {
                    human.logStep('QUOTE_DETECTED', 'composer_value');
                    return true;
                }
                return false;
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

        // Find composer textarea
        verify = await human.verifyComposerOpen(page);
        const composer = page.locator(verify.selector).first();

        // Type quote
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
                try {
                    const isVisible = await el.isVisible();
                    const ariaLabel = await el.getAttribute('aria-label') || '';
                    const count = await el.count();
                    if (count > 0 && isVisible) {
                        retweetBtn = el;
                        human.logStep('RETWEET_FOUND', `${selector} (aria-label: ${ariaLabel})`);
                        break;
                    }
                } catch {}
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
        await new Promise(resolve => setTimeout(resolve, 1000));

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
                    try {
                        const isVisible = await el.isVisible();
                        const text = await el.innerText().catch(() => '');
                        const count = await el.count();
                        
                        if (count > 0 && isVisible && text.toLowerCase().includes('quote')) {
                            quoteOption = el;
                            human.logStep('QUOTE_FOUND', `${selector} (text: "${text}")`);
                            break;
                        }
                    } catch {}
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
                const composerValue = await page.evaluate(() => {
                    const composer = document.querySelector('[data-testid="tweetTextarea_0"]');
                    return composer?.value || composer?.textContent || '';
                });
                return composerValue.length > 50;
            }
        ];

        let hasQuotePreview = false;
        for (const strategy of quoteDetectionStrategies) {
            try {
                if (await strategy()) {
                    hasQuotePreview = true;
                    break;
                }
            } catch {}
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
                try {
                    const isVisible = await el.isVisible();
                    const ariaLabel = await el.getAttribute('aria-label') || '';
                    const count = await el.count();
                    if (count > 0 && isVisible) {
                        composeBtn = el;
                        human.logStep('COMPOSE_FOUND', `${selector} (aria-label: "${ariaLabel}")`);
                        break;
                    }
                } catch {}
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

        // STEP 2: Verify composer is open
        const verify = await human.verifyComposerOpen(page);
        if (!verify.open) {
            human.logStep('VERIFY_FAILED', 'Composer did not open');
            return { success: false, reason: 'composer_not_open', method: 'new_post' };
        }
        human.logStep('COMPOSER_READY', verify.selector);

        // STEP 3: Paste the tweet URL
        human.logStep('PASTE_URL', 'Pasting tweet URL...');
        await page.keyboard.press('Control+v');
        await new Promise(resolve => setTimeout(resolve, 750));

        // Step 4: Type the comment FIRST
        const composer = page.locator(verify.selector).first();
        
        human.logStep('TYPING', `Entering ${quoteText.length} chars`);
        await human.typeText(page, quoteText, composer);

        // Step 5: Create new line AFTER typing comment
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

        // Step 6: Paste the URL LAST (appears as preview/card below comment)
        human.logStep('PASTE_URL', 'Pasting tweet URL...');
        await page.keyboard.press('Control+v');
        await new Promise(resolve => setTimeout(resolve, 750));

        // Verify URL was pasted
        const finalContent = await page.evaluate(() => {
            const composer = document.querySelector('[data-testid="tweetTextarea_0"]');
            return composer?.value || composer?.textContent || '';
        });
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

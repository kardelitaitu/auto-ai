/**
 * @fileoverview AI-Enhanced Twitter Agent
 * Extends TwitterAgent with AI reply capability when diving into tweets
 * @module utils/ai-twitterAgent
 */

import { TwitterAgent } from './twitterAgent.js';
import { AIReplyEngine } from './ai-reply-engine.js';
import { AIQuoteEngine } from './ai-quote-engine.js';
import { AIContextEngine } from './ai-context-engine.js';
import { microInteractions } from './micro-interactions.js';
import { motorControl } from './motor-control.js';
import AgentConnector from '../core/agent-connector.js';
import { mathUtils } from './mathUtils.js';
import { entropy } from './entropyController.js';
import { engagementLimits } from './engagement-limits.js';
import { sessionPhases } from './session-phases.js';
import { sentimentService } from './sentiment-service.js';
import { buildEnhancedPrompt } from './twitter-reply-prompt.js';
import { scrollDown, scrollUp, scrollRandom } from './scroll-helper.js';
import { config } from './config-service.js';

/**
 * @deprecated Use config.getEngagementLimits() instead (supports env overrides)
 */
const DEFAULT_ENGAGEMENT_LIMITS = {
    replies: 3,
    retweets: 1,
    quotes: 1,
    likes: 5,
    follows: 2,
    bookmarks: 2
};

export class AITwitterAgent extends TwitterAgent {
    constructor(page, initialProfile, logger, options = {}) {
        super(page, initialProfile, logger);

        // AI reply lock - prevents other activities during reply
        this.aiReplyLock = false;

        // Initialize AgentConnector for AI requests
        this.agentConnector = new AgentConnector();

        // Initialize AI Reply Engine with AgentConnector
        // Values come from config/settings.json → ai-twitterActivity.js → here
        this.replyEngine = new AIReplyEngine(this.agentConnector, {
            replyProbability: options.replyProbability ?? 0.50, // Default from settings.json
            maxRetries: options.maxRetries ?? 2
        });

        // Initialize AI Quote Engine with AgentConnector
        // Values come from config/settings.json → ai-twitterActivity.js → here
        this.quoteEngine = new AIQuoteEngine(this.agentConnector, {
            quoteProbability: options.quoteProbability ?? 0.50, // Default from settings.json
            maxRetries: options.maxRetries ?? 2
        });

        // Initialize Enhanced Context Engine for better AI replies
        this.contextEngine = new AIContextEngine({
            maxReplies: 30,
            sentimentThreshold: 0.3,
            includeMetrics: true
        });

        this.aiStats = {
            attempts: 0,
            replies: 0,
            skips: 0,
            safetyBlocks: 0,
            errors: 0
        };

        // Initialize engagement limits tracker
        const customLimits = options.engagementLimits || DEFAULT_ENGAGEMENT_LIMITS;
        this.engagementTracker = engagementLimits.createEngagementTracker(customLimits);

        // Initialize Micro-Interactions handler
        this.microHandler = microInteractions.createMicroInteractionHandler({
            highlightChance: 0.03,
            rightClickChance: 0.02,
            logoClickChance: 0.05,
            whitespaceClickChance: 0.04,
            fidgetChance: 0.08,
            fidgetInterval: { min: 15000, max: 45000 }
        });

        // Initialize Motor Control handler
        this.motorHandler = motorControl.createMotorController({
            layoutShiftThreshold: 5,
            spiralSearchAttempts: 4,
            retryDelay: 100,
            maxRetries: 3,
            targetTimeout: 5000
        });

        // Session phase tracking
        this.sessionStart = Date.now();
        this.sessionDuration = 0;
        this.currentPhase = 'warmup';
        this.lastPhaseLogged = null;

        // Track processed tweets to avoid re-diving
        this._processedTweetIds = new Set();

        this.log(`[AITwitterAgent] Initialized (replyProbability: ${this.replyEngine.config.REPLY_PROBABILITY})`);
        this.log(`[AITwitterAgent] Engagement limits: ${this.engagementTracker.getSummary()}`);
        this.log(`[AITwitterAgent] Session phases: warmup(0-10%) → active(10-80%) → cooldown(80-100%)`);
    }

    /**
     * Debug logging - only logs when debug mode is enabled
     * @param {string} message - Message to log
     */
    logDebug(message) {
        this.log(`[DEBUG] ${message}`);
    }

    logWarn(message) {
        this.log(`[WARN] ${message}`);
    }

    /**
     * Update session phase based on elapsed time
     * Call this periodically during session
     */
    updateSessionPhase() {
        this.sessionDuration = Date.now() - this.sessionStart;
        const newPhase = sessionPhases.getSessionPhase(this.sessionDuration, this.sessionDuration * 1.25);
        
        if (newPhase !== this.currentPhase) {
            const phaseInfo = sessionPhases.getPhaseStats(newPhase);
            this.log(`[Phase] Transition: ${this.currentPhase} → ${newPhase} (${phaseInfo.description})`);
            this.currentPhase = newPhase;
        }
        
        return this.currentPhase;
    }

    /**
     * Get phase-modified probability for an action
     * Applies session phase modifiers to base probabilities
     */
    getPhaseModifiedProbability(action, baseProbability) {
        this.updateSessionPhase();
        const modifier = sessionPhases.getPhaseModifier(action, this.currentPhase);
        const adjusted = baseProbability * modifier;
        
        if (this.currentPhase !== 'active') {
            this.log(`[PhaseMod] ${action}: ${(baseProbability * 100).toFixed(1)}% × ${modifier.toFixed(2)} = ${(adjusted * 100).toFixed(1)}% (${this.currentPhase})`);
        }
        
        return adjusted;
    }

    /**
     * Get current session progress percentage
     */
    getSessionProgress() {
        this.sessionDuration = Date.now() - this.sessionStart;
        const estimatedTotal = this.sessionDuration * 1.25;
        return Math.min(100, (this.sessionDuration / estimatedTotal) * 100);
    }

    /**
     * Check if we're in cooldown phase (wind-down behavior)
     */
    isInCooldown() {
        this.updateSessionPhase();
        return this.currentPhase === 'cooldown';
    }

    /**
     * Check if we're in warmup phase (cautious behavior)
     */
    isInWarmup() {
        this.updateSessionPhase();
        return this.currentPhase === 'warmup';
    }

    /**
     * Trigger a micro-interaction during reading/pauses
     * Adds human fidgeting behaviors
     */
    async triggerMicroInteraction(context = 'reading') {
        try {
            const roll = Math.random();
            const actionThreshold = this.microHandler.config.highlightChance 
                + this.microHandler.config.rightClickChance 
                + this.microHandler.config.logoClickChance 
                + this.microHandler.config.whitespaceClickChance;
            
            if (roll > actionThreshold) {
                this.log(`[Micro] No micro-interaction triggered (${context})`);
                return { success: false, reason: 'probability_skip' };
            }
            
            const result = await this.microHandler.executeMicroInteraction(this.page, {
                logger: { 
                    info: (msg) => this.log(msg), 
                    error: (msg) => this.log(`[Micro-Error] ${msg}`) 
                }
            });
            
            if (result.success) {
                this.log(`[Micro] Executed ${result.type} (${context})`);
            }
            
            return result;
        } catch (error) {
            this.log(`[Micro] Error during micro-interaction: ${error.message}`);
            return { success: false, reason: error.message };
        }
    }

    /**
     * Text highlighting micro-interaction
     * Simulates humans highlighting interesting text
     */
    async highlightText(selector = 'article [data-testid="tweetText"]') {
        return await this.microHandler.textHighlight(this.page, {
            logger: {
                info: (msg) => this.log(msg),
                error: (msg) => this.log(`[Micro-Error] ${msg}`)
            },
            selector
        });
    }

    /**
     * Start background fidget loop during long reads
     */
    startFidgetLoop() {
        return this.microHandler.startFidgetLoop(this.page, {
            logger: {
                info: (msg) => this.log(msg),
                error: (msg) => this.log(`[Micro-Error] ${msg}`)
            }
        });
    }

    /**
     * Stop background fidget loop
     */
    stopFidgetLoop() {
        return this.microHandler.stopFidgetLoop();
    }

    /**
     * Override simulateFidget to use micro-interactions module
     * Replaces parent's TEXT_SELECT/MOUSE_WIGGLE/OVERSHOOT with:
     * - Text highlighting
     * - Random right-click
     * - Logo clicks
     * - Whitespace clicks
     */
    async simulateFidget() {
        try {
            const result = await this.microHandler.executeMicroInteraction(this.page, {
                logger: {
                    info: (msg) => this.log(msg.replace('[Micro]', '[Fidget]')),
                    error: (msg) => this.log(`[Fidget-Error] ${msg}`)
                }
            });

            if (!result.success) {
                // Commented out - too noisy
                // this.log(`[Fidget] Skipped: ${result.reason || 'no action'}`);
            }
        } catch (error) {
            this.log(`[Fidget] Error: ${error.message}`);
        }
    }

    /**
     * Smart Click using motor control
     * Uses continuous target tracking, overlap protection, and spiral recovery
     */
    async smartClick(context, options = {}) {
        const {
            verifySelector = null,
            timeout = 5000
        } = options;

        try {
            const result = await this.motorHandler.smartClick(this.page, null, {
                logger: {
                    info: (msg) => this.log(msg),
                    warn: (msg) => this.log(msg),
                    debug: (msg) => this.log(`[Motor-Debug] ${msg}`)
                },
                context,
                verifySelector,
                timeout
            });

            if (result.success) {
                this.log(`[Motor] Smart click: ${context} @ (${Math.round(result.x)}, ${Math.round(result.y)}${result.recovered ? ', recovered' : ''}${result.usedFallback ? ', fallback' : ''})`);
            } else {
                this.log(`[Motor] Smart click failed: ${result.reason}`);
            }

            return result;
        } catch (error) {
            this.log(`[Motor] Error: ${error.message}`);
            return { success: false, reason: error.message };
        }
    }

    /**
     * Click with smart selector fallback and verification
     */
    async smartClickElement(selector, fallbacks = [], options = {}) {
        const {
            verifySelector = null,
            verifyTimeout = 500
        } = options;

        try {
            const result = await this.motorHandler.smartClick(this.page, { primary: selector, fallbacks }, {
                logger: {
                    info: (msg) => this.log(msg),
                    warn: (msg) => this.log(msg),
                    debug: (msg) => this.log(`[Motor-Debug] ${msg}`)
                },
                verifySelector,
                verifyTimeout
            });

            if (result.success) {
                this.log(`[Motor] Clicked: ${result.selector} @ (${Math.round(result.x)}, ${Math.round(result.y)}${result.recovered ? ', recovered' : ''})`);
            }

            return result;
        } catch (error) {
            this.log(`[Motor] Click error: ${error.message}`);
            return { success: false, reason: error.message };
        }
    }

    /**
     * Override diveTweet to add AI reply after expanding tweet

      * Uses lock to prevent race conditions
      */
    async diveTweet() {
        // Acquire lock
        this.aiReplyLock = true;
        this.log('[AI] Reply lock ACQUIRED');

        try {
            this.log('[Branch] Tweet Dive (Expanding with AI)...');

            // Run the parent diveTweet logic but with our modifications
            await this._diveTweetWithAI();

        } finally {
            this.aiReplyLock = false;
            this.log('[AI] Reply lock RELEASED');
        }
    }

    /**
      * Internal method: diveTweet with AI reply
      */
    async _diveTweetWithAI() {
        try {
            let targetTweet = null;

            // Find suitable tweet (same logic as parent)
            for (let attempt = 0; attempt < 3; attempt++) {
                const tweets = this.page.locator('article[data-testid="tweet"]');
                const count = await tweets.count();

                if (count > 0) {
                    for (let i = 0; i < Math.min(count, 10); i++) {
                        const t = tweets.nth(i);
                        const box = await t.boundingBox();
                        if (box && box.height > 0 && box.y > -50 && box.y < 1000) {
                            targetTweet = t;
                            if (Math.random() > 0.4) break;
                        }
                    }
                }

                if (targetTweet) break;

                this.log('[Dive] No suitable tweets. Scrolling...');
                await scrollDown(this.page, 300);
                await this.page.waitForTimeout(entropy.retryDelay(attempt));
            }

            if (!targetTweet) {
                this.log('No suitable tweets found. Refreshing Home...');
                await this.page.goto('https://x.com/');
                await this.ensureForYouTab();
                return;
            }

            // Get username from tweet for URL construction
            let username = 'unknown';
            try {
                const tweetTextEl = targetTweet.locator('[data-testid="tweetText"]').first();
                if (await tweetTextEl.count() > 0) {
                    const parent = await tweetTextEl.$x('..');
                    if (parent && parent[0]) {
                        const link = await parent[0].$('a[href*="/"]');
                        if (link) {
                            const href = await link.getAttribute('href');
                            username = href?.replace(/^\/|\/$/g, '') || 'unknown';
                        }
                    }
                }
            } catch (e) {
                username = 'unknown';
            }

            // Determine click target
            let clickTarget = null;
            const timeStamp = targetTweet.locator('time').first();

            const tweetTextEl = targetTweet.locator('[data-testid="tweetText"]').first();

            if (await tweetTextEl.count() > 0 && await tweetTextEl.isVisible()) {
                clickTarget = tweetTextEl;
                this.log('[Debug] Targeting tweet text body (Primary).');
            } else if (await timeStamp.count() > 0 && await timeStamp.isVisible()) {
                const parentLink = timeStamp.locator('xpath=./ancestor::a[1]');
                clickTarget = (await parentLink.count() > 0) ? parentLink : timeStamp;
                this.log('[Debug] Targeting tweet permalink/time (Fallback).');
            } else {
                clickTarget = targetTweet;
                this.log('[Debug] Targeting entire tweet card (Last Resort).');
            }

            if (clickTarget) {
                await clickTarget.evaluate(el => el.scrollIntoView({ block: 'center', inline: 'center' }));
                await this.page.waitForTimeout(entropy.scrollSettleTime());

                const dbgBox = await clickTarget.boundingBox();
                this.log(`[Debug] Target: Box=${dbgBox ? `x:${Math.round(dbgBox.x)},y:${Math.round(dbgBox.y)}` : 'null'}`);

                this.log('[Attempt] Ghost Click on Permalink...');
                await this.humanClick(clickTarget, 'Tweet Permalink');
            }

            // Wait for navigation to tweet page
            let tweetUrl = '';
            let expanded = false;
            try {
                // Wait for URL to contain /status/
                await this.page.waitForURL('**/status/**', { timeout: 8000 });
                tweetUrl = this.page.url();
                this.log('[Success] Navigated to tweet page.');
                this.log(`[Debug] Tweet URL: ${tweetUrl}`);
                expanded = true;
            } catch (e) {
                this.log('[Fail] Ghost Click did not navigate. Retrying with NATIVE click...');
                if (clickTarget) {
                    await clickTarget.click({ force: true });
                }
                try {
                    await this.page.waitForURL('**/status/**', { timeout: 8000 });
                    tweetUrl = this.page.url();
                    this.log('[Success] Native Click navigated to tweet.');
                    expanded = true;
                } catch (e2) {
                    this.log('[Fail] Failed to expand tweet. Aborting dive.');
                    return;
                }
            }

            if (!expanded) return;

            // Skip if already processed this tweet
            const tweetIdMatch = tweetUrl.match(/status\/(\d+)/);
            if (tweetIdMatch) {
                const tweetId = tweetIdMatch[1];
                if (this._processedTweetIds.has(tweetId)) {
                    this.log(`[AI] Already processed tweet ${tweetId}, skipping...`);
                    await this.navigateHome();
                    return;
                }
                this._processedTweetIds.add(tweetId);
                this.log(`[AI] Tracking new tweet ${tweetId}`);
            }

            // ================================================================
            // EXTRACT TWEET CONTENT AFTER NAVIGATION (PRIMARY SOURCE)
            // ================================================================
            this.log('[AI] Extracting tweet content from full page...');

            // Wait for tweet content to fully load
            await this.page.waitForSelector('[data-testid="tweetText"]', { timeout: 5000 }).catch(() => { });
            await this.page.waitForTimeout(1000);  // Additional settle time

            // Extract FRESH tweet text AFTER navigation
            let tweetText = '';
            const freshTextEl = this.page.locator('[data-testid="tweetText"]').first();

            if (await freshTextEl.count() > 0) {
                tweetText = await freshTextEl.innerText().catch(() => '');
                this.log(`[AI] Extracted tweet text (${tweetText.length} chars)`);

                if (tweetText.length < 10) {
                    this.log('[AI] Tweet text too short, trying alternative selectors...');
                    // Try alternative selectors
                    const alternatives = [
                        '[data-testid="tweetText"]',
                        '[lang] > div',
                        'article [role="group"]',
                        '.tweet-text'
                    ];

                    for (const selector of alternatives) {
                        const altEl = this.page.locator(selector).first();
                        if (await altEl.count() > 0) {
                            const altText = await altEl.innerText().catch(() => '');
                            if (altText.length > tweetText.length) {
                                tweetText = altText;
                                this.log(`[AI] Found better text (${altText.length} chars) with ${selector}`);
                            }
                        }
                    }
                }
            } else {
                this.log('[AI] WARNING: Could not find tweet text element!');
            }

            // Extract username from page URL
            if (username === 'unknown') {
                try {
                    const url = this.page.url();
                    const match = url.match(/x\.com\/(\w+)\/status/);
                    if (match) username = match[1];
                } catch (e) { }
            }

            // Validate we have tweet text
            if (!tweetText || tweetText.length < 5) {
                this.log('[AI] WARNING: Could not extract valid tweet text. Skipping AI reply.');
                // Still read the page and return normally
                await this._readExpandedTweet();
                return;
            }

            // ================================================================
            // AI DECISION: Choose ONE action (Reply OR Quote OR Skip)
            // ================================================================
            const replyProb = this.replyEngine.config.REPLY_PROBABILITY;
            const quoteProb = this.quoteEngine.config.QUOTE_PROBABILITY;
            const roll = Math.random();
            const totalProb = replyProb + quoteProb;

            let action = 'skip';
            if (roll < replyProb) {
                action = 'reply';
            } else if (roll < totalProb) {
                action = 'quote';
            }

            this.log(`[AI-Engage] Decision: ${action.toUpperCase()} (roll: ${(roll * 100).toFixed(1)}%, reply: ${(replyProb * 100).toFixed(0)}%, quote: ${(quoteProb * 100).toFixed(0)}%)`);

            if (action === 'reply') {
                await this.handleAIReply(tweetText, username, { url: tweetUrl });
            } else if (action === 'quote') {
                await this.handleAIQuote(tweetText, username, { url: tweetUrl });
            } else {
                this.log(`[AI-Engage] Skipped (both reply and quote rolled out)`);
            }

            // ================================================================
            // Read expanded tweet (existing behavior)
            // ================================================================
            await this._readExpandedTweet();
        } catch (error) {
            this.log('Dive sequence failed: ' + error.message);
            if (!this.page.url().includes('home')) {
                await this.navigateHome();
            }
        }
    }

    /**
     * Read expanded tweet page (reading, media, replies, etc.)
     */
    async _readExpandedTweet() {
        // Text highlighting before reading
        if (Math.random() < 0.15) {
            await this.highlightText().catch(() => {});
        }

        // Read main tweet
        const readTime = mathUtils.randomInRange(5000, 15000);
        this.log(`[Idle] Reading expanded tweet for ${readTime}ms...`);

        // During long reads, occasionally trigger micro-interactions
        const fidgetDuringRead = readTime > 8000;
        let fidgetInterval = null;

        if (fidgetDuringRead) {
            fidgetInterval = this.startFidgetLoop();
        }

        await this.page.waitForTimeout(readTime);

        if (fidgetInterval) {
            this.stopFidgetLoop();
        }

        // Optional micro-interaction after reading
        if (Math.random() < 0.2) {
            await this.triggerMicroInteraction('post_read');
        }

        // Optional media
        if (mathUtils.roll(0.2)) {
            const media = this.page.locator('[data-testid="tweetPhoto"]').first();
            if (await media.count() > 0 && await media.isVisible()) {
                this.log('[Action] Open media viewer');
                await this.humanClick(media, 'Media Viewer');
                const viewTime = mathUtils.randomInRange(5000, 12000);
                this.log(`[Media] Viewing media for ${(viewTime / 1000).toFixed(1)}s...`);
                await this.page.waitForTimeout(viewTime);
                await this.page.keyboard.press('Escape', { delay: mathUtils.randomInRange(50, 150) });
                await this.page.waitForTimeout(mathUtils.randomInRange(400, 900));
            }
        }

        // Read replies
        this.log('[Scroll] Reading replies...');
        await scrollRandom(this.page, 300, 600);
        await this.page.waitForTimeout(mathUtils.randomInRange(2000, 4000));

        // Return scroll
        await scrollRandom(this.page, 240, 660);
        await this.page.waitForTimeout(mathUtils.randomInRange(1000, 2000));

        const p = this.normalizeProbabilities(this.config.probabilities);

        // Like after dive
        if (mathUtils.roll(p.likeTweetafterDive)) {
            await this.handleLike();
        }

        // Bookmark after dive
        if (mathUtils.roll(p.bookmarkAfterDive)) {
            await this.handleBookmark();
        }

        // Idle and return home
        await this.page.waitForTimeout(mathUtils.randomInRange(1200, 2400));
        await this.navigateHome();
        await this.page.waitForTimeout(mathUtils.randomInRange(1500, 3000));
    }

    /**
     * Override runSession to wrap diveTweet with lock
     */
    async runSession(cycles, minDurationSec, maxDurationSec) {
        this.log(`[AITwitterAgent] Starting AI-Enhanced Session...`);

        // Store original diveTweet reference
        const originalDiveTweet = this.diveTweet.bind(this);


        // Run original session
        await super.runSession(cycles, minDurationSec, maxDurationSec);

        // Log final stats
        const stats = this.getAIStats();
        this.log(`[AITwitterAgent] Final AI Stats: ${JSON.stringify(stats)}`);
    }

    /**
     * Handle AI reply decision and execution
     * Flow: Probability check → Sentiment check → Enhanced Context → Reply
      */
    async handleAIReply(tweetText, username, options = {}) {
        this.aiStats.attempts++;

        const { url = '' } = options;

        this.log(`[AI] Analyzing tweet from @${username}...`);
        this.log(`[AI] Tweet URL: ${url}`);

        // ================================================================
        // NOTE: Probability check was done by the caller (handleAIEngage)
        // Proceed directly to sentiment analysis
        // ================================================================

        // ================================================================
        // STEP 1: Sentiment analysis (skip negative content)
        // ================================================================
        this.log(`[Sentiment] Analyzing tweet sentiment...`);
        const sentimentResult = sentimentService.analyze(tweetText);
        
        // Log basic sentiment (backward compatible)
        this.log(`[SentimentGuard] ${sentimentResult.isNegative ? '🚫 NEGATIVE' : '✅ Neutral/Positive'} content (score: ${sentimentResult.score.toFixed(2)})`);
        
        // Log advanced dimensions
        this.log(`[Sentiment] Dimensions - Valence: ${sentimentResult.dimensions.valence.valence.toFixed(2)}, ` +
                 `Arousal: ${sentimentResult.dimensions.arousal.arousal.toFixed(2)}, ` +
                 `Dominance: ${sentimentResult.dimensions.dominance.dominance.toFixed(2)}, ` +
                 `Sarcasm: ${sentimentResult.dimensions.sarcasm.sarcasm.toFixed(2)}`);
        
        // Log engagement recommendations
        if (sentimentResult.engagement.warnings.length > 0) {
            this.log(`[Sentiment] Warnings: ${sentimentResult.engagement.warnings.join(', ')}`);
        }

        if (sentimentResult.isNegative) {
            this.log(`[AI-Replies] Skipped (negative sentiment)`);
            this.aiStats.skips++;
            return;
        }

        // Check advanced risk factors
        if (sentimentResult.composite.riskLevel === 'high') {
            this.log(`[AI-Replies] Skipped (high risk: ${sentimentResult.composite.conversationType})`);
            this.aiStats.skips++;
            return;
        }

        // ================================================================
        // STEP 3: Enhanced Context Capture (metrics, sentiment, tone)
        // ================================================================
        this.log(`[AI-Context] Extracting enhanced context...`);
        const enhancedContext = await this.contextEngine.extractEnhancedContext(
            this.page,
            url,
            tweetText,
            username
        );

        this.log(`[AI-Context] Enhanced: sentiment=${enhancedContext.sentiment?.overall}, tone=${enhancedContext.tone?.primary}, engagement=${enhancedContext.engagementLevel}, ${enhancedContext.replies.length} replies`);

        // ================================================================
        // STEP 4: Generate reply with enhanced context
        // ================================================================
        const decision = await this.replyEngine.shouldReply(tweetText, username, enhancedContext);

        // ================================================================
        // STEP 5: Execute decision
        // ================================================================
        switch (decision.decision) {
            case 'reply':
                // Double-check engagement limits before replying
                if (!this.engagementTracker.canPerform('replies')) {
                    this.log(`[AI-Replies] Skipped (engagement limit reached)`);
                    this.aiStats.skips++;
                    return;
                }
                this.log(`[AI-Replies] Generating reply: "${decision.reply?.substring(0, 30)}..."`);
                await this.executeAIReply(decision.reply);
                this.aiStats.replies++;
                break;

            case 'skip': {
                this.log(`[AI-Replies] Skipped (${decision.reason})`);
                this.aiStats.skips++;
                
                // Fallback: When skipping, small chance to still engage (20% like OR 10% bookmark)
                const fallbackRoll = Math.random();
                if (fallbackRoll < 0.20) {
                    this.log(`[AI-Fallback] Skip → Attempting like (20% chance)`);
                    await this.handleLike();
                } else if (fallbackRoll < 0.30) { // 0.20 + 0.10 = 30%
                    this.log(`[AI-Fallback] Skip → Attempting bookmark (10% chance)`);
                    await this.handleBookmark();
                }
                break;
            }

            default: {
                this.log(`[AI-Replies] Skipped (no decision)`);
                this.aiStats.skips++;
                
                // Fallback: When skipping, small chance to still engage (20% like OR 10% bookmark)
                const fallbackRoll = Math.random();
                if (fallbackRoll < 0.20) {
                    this.log(`[AI-Fallback] No decision → Attempting like (20% chance)`);
                    await this.handleLike();
                } else if (fallbackRoll < 0.30) {
                    this.log(`[AI-Fallback] No decision → Attempting bookmark (10% chance)`);
                    await this.handleBookmark();
                }
                break;
            }
        }
    }

    async executeAIReply(replyText) {
        try {
            this.log('[AI] Executing reply with human-like behavior...');

            // Use the new human-like reply engine
            const result = await this.replyEngine.executeReply(this.page, replyText);

            if (result.success) {
                this.log(`[AI] Reply posted successfully via ${result.method}`);
                this.state.replies++;

                // Record engagement
                if (this.engagementTracker.record('replies')) {
                    const progress = this.engagementTracker.getProgress('replies');
                    this.log(`[Engagement] ${progress} Replies posted`);
                }
            } else {
                this.logWarn(`[AI] Reply failed: ${result.reason} (method: ${result.method})`);
            }

            return result.success;

        } catch (error) {
            this.log(`[AI] Failed to post reply: ${error.message}`);
            return false;
        }
    }

    /**
     * Verify reply was posted by scanning DOM for reply content
     * @param {string} replyText - The text we attempted to post
     * @returns {Promise<boolean>} True if reply found in DOM
     */
    async verifyReplyPosted(replyText) {
        try {
            // Get current page URL to verify we're still on tweet page
            const currentUrl = this.page.url();
            if (!currentUrl.includes('/status/')) {
                this.log('[Verify] No longer on tweet page');
                return false;
            }

            // Wait a bit for DOM to update
            await this.page.waitForTimeout(1000);

            // Look for the reply text in article elements (newly posted reply)
            const articles = await this.page.$$('article');
            this.log(`[Verify] Found ${articles.length} articles on page`);

            // Get the first few words of our reply to search for
            const searchWords = replyText.split(' ').slice(0, 5).join(' ').toLowerCase();
            this.log(`[Verify] Searching for: "${searchWords}"`);

            // Check each article for our reply text
            for (let i = 0; i < Math.min(articles.length, 5); i++) {
                try {
                    const article = articles[i];
                    const textEl = await article.$('[data-testid="tweetText"], [dir="auto"]');
                    if (textEl) {
                        const articleText = await textEl.innerText().catch(() => '');
                        const articleTextLower = articleText.toLowerCase();

                        // Check if article contains our reply text (partial match)
                        if (articleTextLower.includes(searchWords) ||
                            searchWords.includes(articleTextLower.slice(0, 30))) {
                            this.log(`[Verify] Found reply in article ${i + 1}`);
                            return true;
                        }
                    }
                } catch (e) {
                    // Skip failed articles
                }
            }

            // Alternative: Look for reply count increase or new elements
            const replyBtn = this.page.locator('[data-testid="reply"]').first();
            const replyCount = await replyBtn.count();

            // Check if composer is closed (reply submitted)
            const composer = this.page.locator('[data-testid="tweetText"]').first();
            const composerCount = await composer.count();

            if (composerCount > 0) {
                const composerText = await composer.innerText().catch(() => '');
                // If composer is empty or cleared, reply was likely posted
                if (!composerText || composerText.trim().length === 0) {
                    this.log('[Verify] Composer cleared - reply likely posted');
                    return true;
                }
            }

            this.log('[Verify] Could not verify reply in DOM');
            return false;

        } catch (error) {
            this.log(`[Verify] Error checking reply: ${error.message}`);
            return false;
        }
    }

    /**
     * Ultra-human-like typing simulation
     * Mimics real human typing patterns to avoid detection
     */
    async humanTypingWithTypos(inputEl, text) {
        const chars = text.split('');

        // Keyboard layout for proximity typos
        const keyboardLayout = {
            'q': ['w', 'a', '1'], 'w': ['q', 'e', 'a', 's', '2'],
            'e': ['w', 'r', 'd', 's', '3', '4'], 'r': ['e', 't', 'f', 'g', '4', '5'],
            't': ['r', 'y', 'g', 'h', '5', '6'], 'y': ['t', 'u', 'h', 'j', '6', '7'],
            'u': ['y', 'i', 'j', 'k', '7', '8'], 'i': ['u', 'o', 'k', 'l', '8', '9'],
            'o': ['i', 'p', 'l', ';', '9', '0'], 'p': ['o', '[', "'", '0'],
            'a': ['q', 'w', 's', 'z'], 's': ['w', 'e', 'd', 'x', 'z', 'a'],
            'd': ['e', 'r', 'f', 'c', 'x', 's'], 'f': ['r', 't', 'g', 'v', 'c', 'd'],
            'g': ['t', 'y', 'h', 'b', 'v', 'f'], 'h': ['y', 'u', 'j', 'n', 'b', 'g'],
            'j': ['u', 'i', 'k', 'm', 'n', 'h'], 'k': ['i', 'o', 'l', ',', 'm', 'j'],
            'l': ['o', 'p', ';', ',', '.', 'k'], 'z': ['a', 's', 'x'], 'x': ['z', 'c', 'd', 's'],
            'c': ['x', 'v', 'f', 'd'], 'v': ['c', 'b', 'g', 'f'], 'b': ['v', 'n', 'h', 'g'],
            'n': ['b', 'm', 'j', 'h'], 'm': ['n', ',', 'j', 'k'],
            '0': ['9', 'p', 'o'], '1': ['2', 'q'], '2': ['1', '3', 'w', 'q'],
            '3': ['2', '4', 'e', 'w'], '4': ['3', '5', 'r', 'e'], '5': ['4', '6', 't', 'r'],
            '6': ['5', '7', 'y', 't'], '7': ['6', '8', 'u', 'y'], '8': ['7', '9', 'i', 'u'],
            '9': ['8', '0', 'o', 'i'],
            '.': [',', 'l', ';', '/'], ',': ['m', '.', 'k', 'j', 'n'],
            ';': ['l', "'", 'p', '/'], "'": [';', 'p', '[', ']'],
            '[': ['p', "'", ']', '\\'], ']': ['[', '\\'], '\\': [']'],
            '-': ['0', '=', '['], '=': ['-', '[', ']']
        };

        // Shift-required characters
        const shiftChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$%^&*()_+{}|:"<>?~';

        // Track typing state
        let i = 0;
        let consecutiveErrors = 0;

        while (i < chars.length) {
            const char = chars[i];
            const isUpperCase = char >= 'A' && char <= 'Z';
            const isShiftChar = shiftChars.includes(char);
            const isSpace = char === ' ';
            const isPunctuation = '.,!?;:;\'"-()[]{}'.includes(char);
            const isNewline = char === '\n';
            const prevChar = i > 0 ? chars[i - 1] : null;
            const nextChar = i < chars.length - 1 ? chars[i + 1] : null;

            // Context-aware typing speed
            let baseDelay;

            // Position-based speed patterns
            const positionProgress = i / chars.length;
            const charsTyped = i;
            const charsRemaining = chars.length - i;

            if (charsTyped < 3) {
                // Very slow start (finding keyboard)
                baseDelay = mathUtils.randomInRange(200, 400);
            } else if (charsTyped < 10) {
                // Warming up
                baseDelay = mathUtils.randomInRange(120, 250);
            } else if (positionProgress > 0.8) {
                // Slowing down at end
                baseDelay = mathUtils.randomInRange(100, 200);
            } else {
                // Normal typing rhythm
                baseDelay = mathUtils.randomInRange(60, 150);
            }

            // Context adjustments
            if (isUpperCase || isShiftChar) {
                // Hold shift - takes extra time
                baseDelay += mathUtils.randomInRange(50, 150);
            }

            if (isSpace) {
                // Word boundary pause
                baseDelay += mathUtils.randomInRange(80, 200);

                // Sometimes longer pause between sentences
                if (prevChar === '.' || prevChar === '!' || prevChar === '?') {
                    baseDelay += mathUtils.randomInRange(200, 500);
                }
            }

            if (isPunctuation && !isSpace) {
                // Punctuation pause
                baseDelay += mathUtils.randomInRange(30, 100);

                // Longer for sentence end
                if (char === '.' || char === '!' || char === '?') {
                    baseDelay += mathUtils.randomInRange(100, 300);
                }
            }

            if (isNewline) {
                baseDelay += mathUtils.randomInRange(200, 400);
            }

            // ERROR SIMULATION
            // Determine if we should make an error
            let makeError = false;
            let errorType = null;

            if (charsTyped >= 3 && charsRemaining >= 2 && consecutiveErrors < 2) {
                const errorRoll = Math.random();

                // 8% base error rate
                if (errorRoll < 0.08) {
                    makeError = true;

                    // Error type distribution:
                    // 40% - adjacent key
                    // 25% - double letter
                    // 20% - skipped letter
                    // 10% - transposition
                    // 5% - no error (just pause)
                    const errorRoll2 = Math.random();
                    if (errorRoll2 < 0.40) errorType = 'adjacent';
                    else if (errorRoll2 < 0.65) errorType = 'double';
                    else if (errorRoll2 < 0.85) errorType = 'skip';
                    else if (errorRoll2 < 0.95) errorType = 'transposition';
                    else errorType = 'pause';
                }
            }

            if (makeError && errorType !== 'pause') {
                switch (errorType) {
                    case 'adjacent':
                        const charLower = char.toLowerCase();
                        const adjacent = keyboardLayout[charLower];
                        if (adjacent && Math.random() < 0.7) {
                            const wrongChar = adjacent[Math.floor(Math.random() * adjacent.length)];
                            // Type wrong char
                            await this.page.keyboard.type(wrongChar, { delay: baseDelay });
                            // Pause like human noticing
                            await this.page.waitForTimeout(mathUtils.randomInRange(80, 200));
                            // Backspace
                            await this.page.keyboard.press('Backspace', { delay: mathUtils.randomInRange(40, 100) });
                            // Brief pause before correct
                            await this.page.waitForTimeout(mathUtils.randomInRange(30, 80));
                            // Type correct
                            await this.page.keyboard.type(char, { delay: baseDelay + mathUtils.randomInRange(20, 60) });
                            consecutiveErrors++;
                        } else {
                            await this.page.keyboard.type(char, { delay: baseDelay });
                        }
                        break;

                    case 'double':
                        // Type the same char twice by accident
                        if (Math.random() < 0.6) {
                            await this.page.keyboard.type(char, { delay: baseDelay });
                            await this.page.waitForTimeout(mathUtils.randomInRange(20, 60));
                            await this.page.keyboard.type(char, { delay: baseDelay });
                            await this.page.waitForTimeout(mathUtils.randomInRange(50, 150));
                            // Backspace once to fix
                            await this.page.keyboard.press('Backspace', { delay: mathUtils.randomInRange(40, 100) });
                            consecutiveErrors++;
                        } else {
                            await this.page.keyboard.type(char, { delay: baseDelay });
                        }
                        break;

                    case 'skip':
                        // Type next char instead of current (transposition)
                        if (i < chars.length - 1 && Math.random() < 0.5) {
                            const nextCharTyped = chars[i + 1];
                            await this.page.keyboard.type(nextCharTyped, { delay: baseDelay });
                            await this.page.waitForTimeout(mathUtils.randomInRange(50, 120));
                            // Notice and correct
                            await this.page.keyboard.press('Backspace', { delay: mathUtils.randomInRange(40, 100) });
                            // Type correct char
                            await this.page.keyboard.type(char, { delay: baseDelay + mathUtils.randomInRange(20, 80) });
                            consecutiveErrors++;
                        } else {
                            await this.page.keyboard.type(char, { delay: baseDelay });
                        }
                        break;

                    case 'transposition':
                        // Type char in wrong order (like "teh" for "the")
                        // Handle naturally as skip + adjacent
                        await this.page.keyboard.type(char, { delay: baseDelay });
                        consecutiveErrors++;
                        break;
                }
            } else if (errorType === 'pause') {
                // Human paused while typing (thinking)
                await this.page.waitForTimeout(mathUtils.randomInRange(300, 800));
                await this.page.keyboard.type(char, { delay: baseDelay });
            } else {
                // Normal typing - add slight variation
                await this.page.keyboard.type(char, {
                    delay: baseDelay + mathUtils.randomInRange(-10, 20)
                });
                consecutiveErrors = 0;
            }

            // Random "thinking pause" - 3% chance during typing
            if (Math.random() < 0.03 && charsTyped > 5 && charsRemaining > 5) {
                await this.page.waitForTimeout(mathUtils.randomInRange(200, 600));
            }

            // Micro mouse movements (hand adjustment) - 5% chance
            if (Math.random() < 0.05) {
                const dx = mathUtils.randomInRange(-20, 20);
                const dy = mathUtils.randomInRange(-10, 10);
                await this.page.mouse.move(dx, dy, { steps: 2 });
            }

            i++;
        }

        // Final human touch - sometimes cursor moves away at end
        await this.page.waitForTimeout(mathUtils.randomInRange(100, 300));
    }

    /**
     * Handle fallback action when AI skips
     */
    async handleFallback(action) {
        try {
            switch (action) {
                case 'bookmark':
                    // Check engagement limits before bookmarking
                    if (!this.engagementTracker.canPerform('bookmarks')) {
                        this.log('[AI-Fallback] Bookmark limit reached, skipping');
                        return;
                    }
                    
                    const bm = this.page.locator('button[data-testid="bookmark"]').first();
                    if (await bm.count() > 0 && await bm.isVisible()) {
                        this.log('[AI-Fallback] Bookmarking tweet');
                        await this.humanClick(bm, 'Bookmark');

                        if (this.engagementTracker.record('bookmarks')) {
                            const progress = this.engagementTracker.getProgress('bookmarks');
                            this.log(`[Engagement] ${progress} Bookmarks used`);
                        }
                    }
                    break;

                case 'like':
                    await this.handleLike();
                    break;

                case 'none':
                default:
                    this.log('[AI-Fallback] No action taken');
                    break;
            }
        } catch (error) {
            this.log(`[AI-Fallback] Error: ${error.message}`);
        }
    }

     /**
     * Handle like button (extracted from parent for reuse)
     * Optionally accepts tweetText for sentiment analysis
     */
    async handleLike(tweetText = null) {
        try {
            // ================================================================
            // SENTIMENT CHECK - Skip likes on negative content
            // ================================================================
            if (tweetText) {
                const sentimentResult = sentimentService.analyze(tweetText);
                if (!sentimentResult.engagement.canLike) {
                    this.log(`[Sentiment] 🚫 Skipping like on negative content ` +
                             `(risk: ${sentimentResult.composite.riskLevel}, ` +
                             `toxicity: ${sentimentResult.dimensions.toxicity.toxicity.toFixed(2)})`);
                    return;
                }
            }

            // Check engagement limits
            if (!this.engagementTracker.canPerform('likes')) {
                this.log('[Like] Limit reached, skipping');
                return;
            }

            const likeButton = this.page.locator('button[data-testid="like"][role="button"]').first();
            const unlikeButton = this.page.locator('button[data-testid="unlike"][role="button"]').first();

            if (await unlikeButton.isVisible()) {
                this.log('[Skip] Tweet is ALREADY LIKED.');
                return;
            }

            if (await likeButton.count() > 0) {
                await likeButton.scrollIntoViewIfNeeded();
                await this.page.waitForTimeout(mathUtils.randomInRange(500, 1000));

                if (await likeButton.isVisible()) {
                    const label = await likeButton.getAttribute('aria-label') || '';
                    if (!label.includes('Unlike')) {
                        this.log('[Action] ❤ Like');
                        await this.humanClick(likeButton, 'Like Button');

                        if (this.engagementTracker.record('likes')) {
                            const progress = this.engagementTracker.getProgress('likes');
                            this.log(`[Engagement] ${progress} Likes given`);
                        }

                        await this.page.waitForTimeout(mathUtils.randomInRange(2000, 5000));
                    }
                }
            }
        } catch (error) {
            this.log(`[Like] Error: ${error.message}`);
        }
    }

    /**
     * Handle bookmark button (extracted from parent for reuse)
     */
    async handleBookmark() {
        try {
            // Check engagement limits
            if (!this.engagementTracker.canPerform('bookmarks')) {
                this.log('[Bookmark] Limit reached, skipping');
                return;
            }

            const bm = this.page.locator('button[data-testid="bookmark"]').first();
            const unbm = this.page.locator('button[data-testid="removeBookmark"]').first();

            if (await unbm.isVisible()) {
                this.log('[Skip] Tweet ALREADY bookmarked.');
                return;
            }

            if (await bm.count() > 0 && await bm.isVisible()) {
                this.log('[Action] 🔖 Bookmark');
                await this.humanClick(bm, 'Bookmark Button');

                if (this.engagementTracker.record('bookmarks')) {
                    const progress = this.engagementTracker.getProgress('bookmarks');
                    this.log(`[Engagement] ${progress} Bookmarks saved`);
                }

                await this.page.waitForTimeout(entropy.postClickDelay());
            }
        } catch (error) {
            this.log(`[Bookmark] Error: ${error.message}`);
        }
    }

    /**
     * Handle AI Quote Tweet decision and execution
     * Flow: Probability check → Generate quote → Click Retweet → Select Quote → Type → Post
      */
    async handleAIQuote(tweetText, username, options = {}) {
        const { url = '' } = options;

        this.log(`[AI-Quote] Analyzing tweet from @${username}...`);
        this.log(`[AI-Quote] Tweet URL: ${url}`);

        // ================================================================
        // NOTE: Probability check was done by the caller (handleAIEngage)
        // Proceed directly to sentiment analysis
        // ================================================================

        // ================================================================
        // STEP 1: Sentiment analysis (skip negative content)
        // ================================================================
        this.log(`[Sentiment] Analyzing tweet sentiment...`);
        const sentimentResult = sentimentService.analyze(tweetText);
        
        // Log basic sentiment (backward compatible)
        this.log(`[SentimentGuard] ${sentimentResult.isNegative ? '🚫 NEGATIVE' : '✅ Neutral/Positive'} content (score: ${sentimentResult.score.toFixed(2)})`);
        
        // Log advanced dimensions
        this.log(`[Sentiment] Dimensions - Valence: ${sentimentResult.dimensions.valence.valence.toFixed(2)}, ` +
                 `Arousal: ${sentimentResult.dimensions.arousal.arousal.toFixed(2)}, ` +
                 `Dominance: ${sentimentResult.dimensions.dominance.dominance.toFixed(2)}, ` +
                 `Sarcasm: ${sentimentResult.dimensions.sarcasm.sarcasm.toFixed(2)}`);

        if (sentimentResult.isNegative) {
            this.log(`[AI-Quote] Skipped (negative sentiment)`);
            return;
        }

        // Check advanced risk factors
        if (sentimentResult.composite.riskLevel === 'high') {
            this.log(`[AI-Quote] Skipped (high risk: ${sentimentResult.composite.conversationType})`);
            return;
        }

        // ================================================================
        // STEP 2: Engagement limits check
        // ================================================================
        if (!this.engagementTracker.canPerform('quotes')) {
            this.log(`[AI-Quote] Skipped (engagement limit reached)`);
            return;
        }

        // ================================================================
        // STEP 3: Extract context (replies) for better AI quotes
        // ================================================================
        this.log(`[AI-Context] Loading replies for quote context...`);
        const enhancedContext = await this.contextEngine.extractEnhancedContext(
            this.page,
            url,
            tweetText,
            username
        );

        this.log(`[AI-Context] Enhanced: sentiment=${enhancedContext.sentiment?.overall}, tone=${enhancedContext.tone?.primary}, ${enhancedContext.replies.length} replies`);

        // ================================================================
        // STEP 5: Generate AI quote
        // ================================================================
        this.log(`[AI-Quote] Generating quote tweet...`);

        const quoteResult = await this.quoteEngine.generateQuote(tweetText, username, {
            url,
            sentiment: sentimentResult.composite?.engagementStyle || 'neutral',
            tone: sentimentResult.composite?.conversationType || 'neutral',
            engagement: 'low',
            replies: enhancedContext.replies
        });

        if (!quoteResult.success || !quoteResult.quote) {
            const reason = quoteResult.reason || 'unknown';
            this.log(`[AI-Quote] ❌ Failed to generate quote (reason: ${reason})`);
            return;
        }

        // ================================================================
        // STEP 5: Display AI result BEFORE executing
        // ================================================================
        this.log(`[AI-Quote] AI QUOTE: "${quoteResult.quote}"`);

        // Execute quote with human-like behavior (uses 4 methods randomly)
        const result = await this.quoteEngine.executeQuote(this.page, quoteResult.quote);

        if (result.success) {
            if (this.engagementTracker.record('quotes')) {
                const progress = this.engagementTracker.getProgress('quotes');
                this.log(`[Engagement] ${progress} Quotes posted`);
            }
            this.log(`[AI-Quote] Quote tweet posted successfully via ${result.method}`);
        } else {
            this.log(`[AI-Quote] Quote tweet failed: ${result.reason} (method: ${result.method})`);
        }
    }

    /**
     * Get AI stats
     */
    getAIStats() {
        return {
            ...this.aiStats,
            successRate: this.aiStats.attempts > 0
                ? ((this.aiStats.replies / this.aiStats.attempts) * 100).toFixed(1) + '%'
                : '0%'
        };
    }
    
    /**
     * Get engagement stats
     */
    getEngagementStats() {
        return {
            tracker: this.engagementTracker.getStatus(),
            summary: this.engagementTracker.getSummary(),
            usageRate: this.engagementTracker.getUsageRate()
        };
    }
    
    /**
     * Log current engagement status
     */
    logEngagementStatus() {
        const status = this.engagementTracker.getStatus();
        for (const [action, data] of Object.entries(status)) {
            const emoji = data.remaining === 0 ? '🚫' : 
                          parseFloat(data.percentage) >= 80 ? '⚠️' : '✅';
            this.log(`[Engagement] ${emoji} ${action}: ${data.current}/${data.limit} (${data.percentage} used)`);
        }
    }
}

export default AITwitterAgent;

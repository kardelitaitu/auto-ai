/**
 * @fileoverview AI-Enhanced Twitter Activity Task
 * Uses AITwitterAgent with AI reply capability when diving
 * @module tasks/ai-twitterActivity
 * 
 * CONFIGURATION GUIDE - Edit settings in config/settings.json to customize behavior
 */

// ============================================================================
// CORE SETTINGS - Main task behavior (defaults - can be overridden in config/settings.json)
// ============================================================================
const TARGET_URL = 'https://x.com';
const DEFAULT_CYCLES = 10;
const DEFAULT_MIN_DURATION = 300;
const DEFAULT_MAX_DURATION = 540;

// ============================================================================
// ENGAGEMENT LIMITS - Per-session caps (conservative)
// @deprecated Use config.getEngagementLimits() instead (supports env overrides)
// ============================================================================
const ENGAGEMENT_LIMITS = {
    replies: 3,
    retweets: 1,
    quotes: 1,
    likes: 5,
    follows: 2,
    bookmarks: 2
};

// ============================================================================
// TIMING SETTINGS (milliseconds)
// @deprecated Use config.getTiming() instead (supports env overrides)
// ============================================================================
const WARMUP_MIN = 2000;
const WARMUP_MAX = 15000;
const SCROLL_MIN = 300;
const SCROLL_MAX = 700;
const SCROLL_PAUSE_MIN = 1500;
const SCROLL_PAUSE_MAX = 4000;
const READ_MIN = 5000;
const READ_MAX = 15000;
const DIVE_READ = 10000;
const POST_REPLY = 3000;

// ============================================================================
// SESSION PHASE SETTINGS
// @deprecated Use config.getSessionPhases() instead
// ============================================================================
const SESSION_PHASES = {
    warmupPercent: 0.10,
    activePercent: 0.70,
    cooldownPercent: 0.20
};

// ============================================================================
// NAVIGATION & HEADERS
// ============================================================================
const ADD_UTM_PARAMS = true;
const HEADER_SEC_FETCH_SITE = 'none';
const HEADER_SEC_FETCH_MODE = 'navigate';
const WAIT_UNTIL = 'domcontentloaded';

// ============================================================================
// CONFIG SERVICE - Centralized Configuration (Phase 1)
// ============================================================================
// The config service provides unified access to settings with env var support:
// - Settings from config/settings.json
// - Environment variable overrides (TWITTER_ACTIVITY_CYCLES, TWITTER_REPLY_PROBABILITY, etc.)
// - Fallback defaults when settings are missing
//
// Usage:
//   const activityConfig = await config.getTwitterActivity();
//   const limits = await config.getEngagementLimits();
//   const timing = await config.getTiming();
//
// Environment Variables:
//   TWITTER_ACTIVITY_CYCLES     - Override defaultCycles
//   TWITTER_MIN_DURATION        - Override defaultMinDuration (seconds)
//   TWITTER_MAX_DURATION        - Override defaultMaxDuration (seconds)
//   TWITTER_REPLY_PROBABILITY   - Override reply probability (0.0-1.0)
//   TWITTER_QUOTE_PROBABILITY   - Override quote probability (0.0-1.0)
//   GLOBAL_SCROLL_MULTIPLIER     - Override scroll speed multiplier
// ============================================================================

// ============================================================================
// RETRY & TIMEOUT SETTINGS
// ============================================================================
const MAX_RETRIES = 2;
const LOGIN_CHECK_LOOPS = 3;
const LOGIN_CHECK_DELAY = 3000;
const PAGE_TIMEOUT_MS = 60000;

// ============================================================================
// IMPORTS
// ============================================================================
import { createLogger } from '../utils/logger.js';
import { getSettings } from '../utils/configLoader.js';
import { AITwitterAgent } from '../utils/ai-twitterAgent.js';
import { profileManager } from '../utils/profileManager.js';
import { mathUtils } from '../utils/mathUtils.js';
import { GhostCursor } from '../utils/ghostCursor.js';
import { entropy } from '../utils/entropyController.js';
import { ReferrerEngine } from '../utils/urlReferrer.js';
import metricsCollector from '../utils/metrics.js';
import { applyHumanizationPatch } from '../utils/browserPatch.js';
import { sessionPhases } from '../utils/session-phases.js';
import { humanTiming } from '../utils/human-timing.js';
import { scrollHumanizer } from '../utils/scroll-humanizer.js';
import { config } from '../utils/config-service.js';
import { replyMethods, quoteMethods } from '../utils/twitter-interaction-methods.js';
import { HumanInteraction } from '../utils/human-interaction.js';

/**
 * AI-Enhanced Twitter Activity Task
 * 
 * Configuration Priority:
 * 1. Environment variables (TWITTER_ACTIVITY_CYCLES, etc.)
 * 2. settings.json (config/settings.json)
 * 3. Hardcoded defaults (above)
 */
export default async function aiTwitterActivityTask(page, payload) {
    const startTime = process.hrtime.bigint();
    const browserInfo = payload.browserInfo || "unknown_profile";
    const logger = createLogger(`ai-twitterActivity.js [${browserInfo}]`);
    
    logger.info(`[ai-twitterActivity] Initializing AI-Enhanced Agent...`);
    
    // Initialize config service early (loads settings + env overrides)
    await config.init();
    
    // Load settings from config/settings.json (async)
    const settings = await getSettings();
    const twitterSettings = settings?.twitter || {};

    // Get reply and quote probabilities from config (centralized in settings.json)
    const REPLY_PROBABILITY = twitterSettings.reply?.probability ?? 0.5;
    const QUOTE_PROBABILITY = twitterSettings.quote?.probability ?? 0.5;

    // Method selection configuration with configurable probabilities
    const REPLY_METHODS_CONFIG = twitterSettings.reply?.methods ?? {
        replyA: { weight: 40, enabled: true },  // Keyboard shortcut (R key)
        replyB: { weight: 35, enabled: true },  // Reply button click
        replyC: { weight: 25, enabled: true }   // Direct composer focus
    };

    const QUOTE_METHODS_CONFIG = twitterSettings.quote?.methods ?? {
        quoteA: { weight: 40, enabled: true },  // Keyboard compose (T key)
        quoteB: { weight: 35, enabled: true },  // Retweet menu
        quoteC: { weight: 25, enabled: true }   // New post + paste URL
    };

    logger.info(`[ai-twitterActivity] Config loaded - reply probability: ${(REPLY_PROBABILITY * 100).toFixed(0)}%, quote probability: ${(QUOTE_PROBABILITY * 100).toFixed(0)}%`);
    logger.info(`[ai-twitterActivity] Reply methods: A=${REPLY_METHODS_CONFIG.replyA?.weight ?? 40}%, B=${REPLY_METHODS_CONFIG.replyB?.weight ?? 35}%, C=${REPLY_METHODS_CONFIG.replyC?.weight ?? 25}%`);
    logger.info(`[ai-twitterActivity] Quote methods: A=${QUOTE_METHODS_CONFIG.quoteA?.weight ?? 40}%, B=${QUOTE_METHODS_CONFIG.quoteB?.weight ?? 35}%, C=${QUOTE_METHODS_CONFIG.quoteC?.weight ?? 25}%`);

    /**
     * Select a method based on weighted probabilities
     * @param {object} methodsConfig - Configuration object with method weights
     * @returns {string} Selected method name
     */
    function selectWeightedMethod(methodsConfig) {
        const enabledMethods = Object.entries(methodsConfig)
            .filter(([_, config]) => config.enabled !== false)
            .map(([name, config]) => ({ name, weight: config.weight ?? 33 }));
        
        if (enabledMethods.length === 0) {
            return Object.keys(methodsConfig)[0]; // Fallback to first method
        }

        const totalWeight = enabledMethods.reduce((sum, m) => sum + m.weight, 0);
        let random = Math.random() * totalWeight;
        
        for (const method of enabledMethods) {
            random -= method.weight;
            if (random <= 0) {
                return method.name;
            }
        }
        
        return enabledMethods[enabledMethods.length - 1].name;
    }

    // Validate HumanInteraction has required methods
    const requiredHumanMethods = ['findElement', 'verifyComposerOpen', 'postTweet', 'typeText', 'fixation', 'microMove'];
    const testHuman = new HumanInteraction();
    const missingMethods = requiredHumanMethods.filter(method => typeof testHuman[method] !== 'function');
    if (missingMethods.length > 0) {
        logger.warn(`[ai-twitterActivity] HumanInteraction missing methods: ${missingMethods.join(', ')}`);
    }

    /**
     * Execute reply using modularized methods with random selection
     * @param {object} page - Playwright page object
     * @param {string} text - Reply text to post
     * @returns {Promise<object>} Result object
     */
    async function executeModularReply(page, text) {
        const human = new HumanInteraction();
        human.debugMode = true;
        
        const selectedMethod = selectWeightedMethod(REPLY_METHODS_CONFIG);
        logger.info(`[ai-twitterActivity] Selected reply method: ${selectedMethod}`);
        
        const methodFn = replyMethods[selectedMethod];
        if (!methodFn) {
            logger.error(`[ai-twitterActivity] Unknown reply method: ${selectedMethod}`);
            return { success: false, reason: 'unknown_method', method: selectedMethod };
        }

        try {
            const result = await methodFn(page, text, human, logger);
            logger.info(`[ai-twitterActivity] Reply method ${selectedMethod} completed: ${result.success ? 'success' : 'failed'}`);
            return result;
        } catch (error) {
            logger.error(`[ai-twitterActivity] Reply method ${selectedMethod} failed: ${error.message}`);
            return { success: false, reason: error.message, method: selectedMethod };
        }
    }

    /**
     * Execute quote using modularized methods with random selection
     * @param {object} page - Playwright page object
     * @param {string} text - Quote text to post
     * @returns {Promise<object>} Result object
     */
    async function executeModularQuote(page, text) {
        const human = new HumanInteraction();
        human.debugMode = true;
        
        const selectedMethod = selectWeightedMethod(QUOTE_METHODS_CONFIG);
        logger.info(`[ai-twitterActivity] Selected quote method: ${selectedMethod}`);
        
        const methodFn = quoteMethods[selectedMethod];
        if (!methodFn) {
            logger.error(`[ai-twitterActivity] Unknown quote method: ${selectedMethod}`);
            return { success: false, reason: 'unknown_method', method: selectedMethod };
        }

        try {
            const result = await methodFn(page, text, human, logger);
            logger.info(`[ai-twitterActivity] Quote method ${selectedMethod} completed: ${result.success ? 'success' : 'failed'}`);
            return result;
        } catch (error) {
            logger.error(`[ai-twitterActivity] Quote method ${selectedMethod} failed: ${error.message}`);
            return { success: false, reason: error.message, method: selectedMethod };
        }
    }

    let profile = null;
    let agent = null;
    let cursor = null;

    try {
        const hardTimeoutMs = payload.taskTimeoutMs || (DEFAULT_MIN_DURATION + DEFAULT_MAX_DURATION) * 1000;

        await Promise.race([
            (async () => {
                for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
                    try {
                        if (attempt > 0) {
                            logger.info(`[ai-twitterActivity] Retry ${attempt}/${MAX_RETRIES} in 5s...`);
                            await page.waitForTimeout(5000);
                        }

                        profile = payload.profileId
                            ? (profileManager.getById(payload.profileId) || profileManager.getStarter())
                            : profileManager.getStarter();

                        if (profile) {
                            const profileDesc = `${profile.id}-${profile.type} | Input: ${profile.inputMethod} (${profile.inputMethodPct}%) | Dive: ${profile.probabilities.dive}% | Like: ${profile.probabilities.like}% | Follow: ${profile.probabilities.follow}%`;
                            logger.info(`[ai-twitterActivity] Profile: ${profileDesc}`);
                        }

                        cursor = new GhostCursor(page);
                        agent = new AITwitterAgent(page, profile, logger, {
                            replyProbability: REPLY_PROBABILITY,
                            quoteProbability: QUOTE_PROBABILITY,
                            engagementLimits: ENGAGEMENT_LIMITS
                        });

                        // Override agent's reply/quote execution to use modularized methods
                        logger.info(`[ai-twitterActivity] Overriding agent methods with modularized versions...`);
                        
                        // Store original methods for fallback
                        const originalExecuteReply = agent.replyEngine.executeReply.bind(agent.replyEngine);
                        const originalExecuteQuote = agent.quoteEngine.executeQuote.bind(agent.quoteEngine);
                        
                        // Override reply execution
                        agent.replyEngine.executeReply = async (page, replyText, options = {}) => {
                            logger.info(`[ai-twitterActivity] Using modularized reply execution`);
                            const result = await executeModularReply(page, replyText);
                            
                            // If modularized method fails, try original as fallback
                            if (!result.success) {
                                logger.warn(`[ai-twitterActivity] Modularized reply failed: ${result.reason}, trying fallback...`);
                                return await originalExecuteReply(page, replyText, options);
                            }
                            
                            return result;
                        };
                        
                        // Override quote execution
                        agent.quoteEngine.executeQuote = async (page, quoteText, options = {}) => {
                            logger.info(`[ai-twitterActivity] Using modularized quote execution`);
                            const result = await executeModularQuote(page, quoteText);
                            
                            // If modularized method fails, try original as fallback
                            if (!result.success) {
                                logger.warn(`[ai-twitterActivity] Modularized quote failed: ${result.reason}, trying fallback...`);
                                return await originalExecuteQuote(page, quoteText, options);
                            }
                            
                            return result;
                        };

                        logger.info(`[ai-twitterActivity] AITwitterAgent initialized`);
                        logger.info(`[ai-twitterActivity] Engagement limits: ${agent.engagementTracker.getSummary()}`);

                        await applyHumanizationPatch(page, logger);

                        const wakeUp = humanTiming.getWarmupDelay({ min: WARMUP_MIN, max: WARMUP_MAX });
                        logger.info(`[ai-twitterActivity] Warm-up ${humanTiming.formatDuration(wakeUp)}...`);
                        await page.waitForTimeout(wakeUp);

                        const referrerEngine = new ReferrerEngine({ addUTM: ADD_UTM_PARAMS });
                        const ctx = referrerEngine.generateContext(TARGET_URL);

                        await page.setExtraHTTPHeaders({
                            ...ctx.headers,
                            'Sec-Fetch-Site': HEADER_SEC_FETCH_SITE,
                            'Sec-Fetch-Mode': HEADER_SEC_FETCH_MODE
                        });

                        logger.info(`[ai-twitterActivity] Navigating to ${TARGET_URL} (bookmark style)`);
                        await page.goto(TARGET_URL, { waitUntil: WAIT_UNTIL, timeout: PAGE_TIMEOUT_MS });

                        // Wait for X.com to load - use multiple selectors for reliability
                        const xLoaded = await Promise.race([
                            page.waitForSelector('[data-testid="AppTabBar_Home_Link"]', { timeout: 15000 }).then(() => 'home'),
                            page.waitForSelector('[data-testid="loginButton"]', { timeout: 15000 }).then(() => 'login'),
                            page.waitForSelector('[role="main"]', { timeout: 15000 }).then(() => 'main'),
                            new Promise((_, reject) => setTimeout(() => reject(new Error('X.com load timeout')), 20000))
                        ]).catch(() => null);

                        logger.info(`[ai-twitterActivity] X.com loaded (${xLoaded || 'partial'})`);

                        for (let i = 0; i < LOGIN_CHECK_LOOPS; i++) {
                            const loggedIn = await agent.checkLoginState();
                            if (loggedIn) break;
                            await page.waitForTimeout(LOGIN_CHECK_DELAY);
                        }

                        const cycles = typeof payload.cycles === 'number' ? payload.cycles : DEFAULT_CYCLES;
                        const minDuration = typeof payload.minDuration === 'number' ? payload.minDuration : DEFAULT_MIN_DURATION;
                        const maxDuration = typeof payload.maxDuration === 'number' ? payload.maxDuration : DEFAULT_MAX_DURATION;

                        logger.info(`[ai-twitterActivity] Starting session (${cycles} cycles, ${minDuration}-${maxDuration}s)...`);
                        await agent.runSession(cycles, minDuration, maxDuration);

                        const aiStats = agent.getAIStats();
                        logger.info(`[ai-twitterActivity] AI Stats: ${JSON.stringify(aiStats)}`);

                        logger.info(`[ai-twitterActivity] Session completed`);
                        return;

                    } catch (innerError) {
                        logger.warn(`[ai-twitterActivity] Attempt ${attempt + 1} failed: ${innerError.message}`);
                        if (attempt === MAX_RETRIES) throw innerError;
                    }
                }

            })(),
            new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout`)), hardTimeoutMs))
        ]);

    } catch (error) {
        logger.error(`[ai-twitterActivity] Error: ${error.message}`);
    } finally {
        if (agent) {
            if (agent.state.follows > 0) metricsCollector.recordSocialAction('follow', agent.state.follows);
            if (agent.state.likes > 0) metricsCollector.recordSocialAction('like', agent.state.likes);
            if (agent.state.retweets > 0) metricsCollector.recordSocialAction('retweet', agent.state.retweets);
            if (agent.state.tweets > 0) metricsCollector.recordSocialAction('tweet', agent.state.tweets);

            const aiStats = agent.getAIStats();
            logger.info(`[ai-twitterActivity] Final AI Stats: ${JSON.stringify(aiStats)}`);
            agent.logEngagementStatus();

            const duration = ((Date.now() - agent.sessionStart) / 1000 / 60).toFixed(1);
            logger.info(`[ai-twitterActivity] Task Finished. Duration: ${duration}m`);
        }

        try { if (page && !page.isClosed()) await page.close(); } catch {}
        const duration = (Number(process.hrtime.bigint() - startTime) / 1e9).toFixed(2);
        logger.info(`[ai-twitterActivity] Done in ${duration}s`);
    }
}

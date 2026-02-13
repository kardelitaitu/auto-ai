/** AI-Enhanced Twitter Activity Task using AITwitterAgent. Customize via config/settings.json or env vars. */
import { getLoggingConfig, formatEngagementLine, formatEngagementSummary } from '../utils/logging-config.js';
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
import { TWITTER_TIMEOUTS } from '../constants/twitter-timeouts.js';
import { config } from '../utils/config-service.js';
import { createLogger } from '../utils/logger.js';
import { loadAiTwitterActivityConfig } from '../utils/task-config-loader.js';

const TARGET_URL = 'https://x.com';
const DEFAULT_CYCLES = 20;
const DEFAULT_MIN_DURATION = 360;
const DEFAULT_MAX_DURATION = 540;
const WAIT_UNTIL = 'domcontentloaded';

// Config service: settings.json + env var overrides.
const MAX_RETRIES = 2;
const LOGIN_CHECK_LOOPS = 3;
const LOGIN_CHECK_DELAY = 3000;
const PAGE_TIMEOUT_MS = 60000;

// Env vars examples: TWITTER_ACTIVITY_CYCLES, TWITTER_REPLY_PROBABILITY.

/** AI-Enhanced Twitter Activity Task. Config priority: Env Vars > settings.json > defaults. */
export default async function aiTwitterActivityTask(page, payload) {
    const startTime = process.hrtime.bigint();
    const browserInfo = payload.browserInfo || "unknown_profile";
    const logger = createLogger(`ai-twitterActivity.js [${browserInfo}]`);

    logger.info(`[ai-twitterActivity] Initializing AI-Enhanced Agent...`);

    // Optimized config loading.
    let taskConfig;
    try {
        taskConfig = await loadAiTwitterActivityConfig(payload);

        // Debug mode enables verbose config logging.
        if (taskConfig.system.debugMode) {
            logger.info(`[ai-twitterActivity] Config loaded: ${taskConfig.session.cycles} cycles, reply=${taskConfig.engagement.probabilities.reply}`);
        }
    } catch (configError) {
        logger.error(`[ai-twitterActivity] Configuration loading failed: ${configError.message}`);
        throw new Error(`Task initialization failed due to configuration error: ${configError.message}`);
    }

    let profile = null;
    let agent = null;
    let cursor = null;
    let cleanupPerformed = false;

    try {
        const hardTimeoutMs = payload.taskTimeoutMs || (DEFAULT_MIN_DURATION + DEFAULT_MAX_DURATION) * 1000;

        await Promise.race([
            (async () => {
                for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
                    try {
                        if (attempt > 0) {
                            // Exponential backoff.
                            const delay = Math.pow(2, attempt) * 1000;
                            logger.info(`[ai-twitterActivity] Retry ${attempt}/${MAX_RETRIES} in ${delay}ms...`);
                            await page.waitForTimeout(delay);
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
                            replyProbability: taskConfig.engagement.probabilities.reply,
                            quoteProbability: taskConfig.engagement.probabilities.quote,
                            engagementLimits: taskConfig.engagement.limits,
                            config: taskConfig  // Pass full task config for actions
                        });

                        // Debug mode logs agent init.
                        if (taskConfig.system.debugMode) {
                            logger.info(`[ai-twitterActivity] AITwitterAgent initialized with reply=${taskConfig.engagement.probabilities.reply}`);
                        }

                        // Agent uses AI for method selection, avoiding overrides and race conditions.

                        // Enforce dark theme immediately.
                        const theme = profile?.theme || 'dark';
                        logger.info(`[ai-twitterActivity] Enforcing theme: ${theme}`);
                        await page.emulateMedia({ colorScheme: theme });

                        await applyHumanizationPatch(page, logger);

                        const wakeUp = humanTiming.getWarmupDelay({
                            min: taskConfig.timing.warmup.min,
                            max: taskConfig.timing.warmup.max
                        });
                        logger.info(`[ai-twitterActivity] Warm-up ${humanTiming.formatDuration(wakeUp)}...`);
                        await page.waitForTimeout(wakeUp);

                        const referrerEngine = new ReferrerEngine({ addUTM: true });
                        const ctx = referrerEngine.generateContext(TARGET_URL);

                        await page.setExtraHTTPHeaders({
                            ...ctx.headers,
                            'Sec-Fetch-Site': 'none',
                            'Sec-Fetch-Mode': 'navigate'
                        });

                        logger.info(`[ai-twitterActivity] Navigating to ${TARGET_URL} (bookmark style)`);
                        await page.goto(TARGET_URL, { waitUntil: WAIT_UNTIL, timeout: PAGE_TIMEOUT_MS });

                        // Wait for X.com to load (multi-selector for reliability).
                        const xLoaded = await Promise.race([
                            page.waitForSelector('[data-testid="AppTabBar_Home_Link"]', { timeout: TWITTER_TIMEOUTS.ELEMENT_VISIBLE }).then(() => 'home'),
                            page.waitForSelector('[data-testid="loginButton"]', { timeout: TWITTER_TIMEOUTS.ELEMENT_VISIBLE }).then(() => 'login'),
                            page.waitForSelector('[role="main"]', { timeout: TWITTER_TIMEOUTS.ELEMENT_VISIBLE }).then(() => 'main'),
                            new Promise((_, reject) => setTimeout(() => reject(new Error('X.com load timeout')), TWITTER_TIMEOUTS.NAVIGATION))
                        ]).catch(() => null);

                        logger.info(`[ai-twitterActivity] X.com loaded (${xLoaded || 'partial'})`);

                        // Optimize network idle wait based on load state; prevents long waits.
                        const idleTimeout = xLoaded ? 4000 : 10000;
                        logger.info(`[ai-twitterActivity] Waiting for network settlement (${idleTimeout}ms)...`);

                        try {
                            await page.waitForLoadState('networkidle', { timeout: idleTimeout });
                            logger.info(`[ai-twitterActivity] Network idle reached.`);
                        } catch (e) {
                            // Network idle timeout expected due to X.com background polling.
                            logger.info(`[ai-twitterActivity] Network active, proceeding after ${idleTimeout}ms...`);
                        }

                        // Adaptive login check.
                        logger.info(`[ai-twitterActivity] Checking login state...`);
                        let loginCheckDelay = LOGIN_CHECK_DELAY;
                        for (let i = 0; i < LOGIN_CHECK_LOOPS; i++) {
                            const loggedIn = await agent.checkLoginState();
                            if (loggedIn) {
                                logger.info(`[ai-twitterActivity] ✅ Logged in (check ${i + 1}/${LOGIN_CHECK_LOOPS})`);
                                break;
                            }
                            if (i < LOGIN_CHECK_LOOPS - 1) {
                                logger.info(`[ai-twitterActivity] Not logged in yet, waiting ${loginCheckDelay}ms...`);
                                await page.waitForTimeout(loginCheckDelay);
                                // Progressive delay increase.
                                loginCheckDelay = Math.min(loginCheckDelay + 1000, 5000);
                            }
                        }

                        const cycles = typeof payload.cycles === 'number' ? payload.cycles : DEFAULT_CYCLES;
                        const minDuration = typeof payload.minDuration === 'number' ? payload.minDuration : DEFAULT_MIN_DURATION;
                        const maxDuration = typeof payload.maxDuration === 'number' ? payload.maxDuration : DEFAULT_MAX_DURATION;

                        logger.info(`[ai-twitterActivity] Starting session (${cycles} cycles, ${minDuration}-${maxDuration}s)...`);

                        // ERROR BOUNDARY: Graceful session error handling.
                        try {
                            await agent.runSession(cycles, minDuration, maxDuration);
                            logger.info(`[ai-twitterActivity] Session completed successfully`);
                        } catch (sessionError) {
                            logger.warn(`[ai-twitterActivity] Session error: ${sessionError.message}`);
                            // Attempt graceful recovery.
                            try {
                                if (agent && agent.page && !agent.page.isClosed()) {
                                    await agent.navigateHome();
                                    logger.info('[ai-twitterActivity] Recovered to home page after session error');
                                }
                            } catch (recoveryError) {
                                logger.warn(`[ai-twitterActivity] Recovery attempt failed: ${recoveryError.message}`);
                            }
                        }

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
        // CRITICAL: Cleanup flag set first to prevent race conditions and ensure single execution.
        cleanupPerformed = true;

        if (agent) {
            if (agent.state.follows > 0) metricsCollector.recordSocialAction('follow', agent.state.follows);
            if (agent.state.likes > 0) metricsCollector.recordSocialAction('like', agent.state.likes);
            if (agent.state.retweets > 0) metricsCollector.recordSocialAction('retweet', agent.state.retweets);
            if (agent.state.tweets > 0) metricsCollector.recordSocialAction('tweet', agent.state.tweets);

            const aiStats = agent.getAIStats();
            logger.info(`[ai-twitterActivity] Final AI Stats: ${JSON.stringify(aiStats)}`);

            // Defer non-critical logging (engagement progress) to unblock cleanup.
            if (agent.diveQueue) {
                const queueStats = agent.diveQueue.getFullStatus();

                // Record session duration.
                const sessionStartTime = agent.sessionStart || Date.now();
                const duration = ((Date.now() - sessionStartTime) / 1000 / 60).toFixed(1);

                // Defer non-critical logging for faster cleanup.
                setTimeout(async () => {
                    try {
                        const logConfig = await getLoggingConfig();

                        if (logConfig?.finalStats?.showQueueStatus !== false) {
                            logger.info(`[ai-twitterActivity] DiveQueue: queue=${queueStats.queue.queueLength}, active=${queueStats.queue.activeCount}, utilization=${queueStats.queue.utilizationPercent}%`);
                        }

                        if (logConfig?.finalStats?.showEngagement !== false && logConfig?.engagementProgress?.enabled) {
                            const engagementProgress = agent.diveQueue.getEngagementProgress();
                            const progressConfig = logConfig.engagementProgress;

                            const summary = formatEngagementSummary(engagementProgress, progressConfig);
                            logger.info(`[ai-twitterActivity] Engagement Progress: ${summary}`);
                        }
                    } catch (loggingError) {
                        logger.warn(`[ai-twitterActivity] Deferred logging error: ${loggingError.message}`);
                    }
                }, 50);

                logger.info(`[ai-twitterActivity] Task Finished. Duration: ${duration}m`);
            }
        }

        // Close page with error logging.
        try {
            if (page && !page.isClosed()) {
                await page.close();
            }
        } catch (closeError) {
            logger.warn(`[ai-twitterActivity] Page close warning: ${closeError.message}`);
        }
        const duration = (Number(process.hrtime.bigint() - startTime) / 1e9).toFixed(2);
        logger.info(`[ai-twitterActivity] Done in ${duration}s`);
    }
}
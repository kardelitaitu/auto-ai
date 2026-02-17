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
import OllamaClient from '../core/ollama-client.js';
import PopupCloser from '../utils/popup-closer.js';

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
const ENTRY_POINTS = [
    { url: 'https://x.com/', weight: 80 },
    { url: 'https://x.com/explore', weight: 5 },
    { url: 'https://x.com/notifications', weight: 5 },
    { url: 'https://x.com/notifications/mentions', weight: 3 },
    { url: 'https://x.com/explore/tabs/for_you', weight: 1 },
    { url: 'https://x.com/explore/tabs/trending', weight: 1 },
    { url: 'https://x.com/explore/tabs/news', weight: 1 },
    { url: 'https://x.com/explore/tabs/sports', weight: 1 },
    { url: 'https://x.com/explore/tabs/entertai', weight: 1 },
    { url: 'https://x.com/i/connect_people?show_topics=false', weight: 1 },
    { url: 'https://x.com/i/connect_people?is_creator_only=true', weight: 1 }
];

// Env vars examples: TWITTER_ACTIVITY_CYCLES, TWITTER_REPLY_PROBABILITY.

const createAsyncLock = () => {
    let chain = Promise.resolve();
    return async (task) => {
        const previous = chain;
        let release = () => {};
        chain = new Promise(resolve => {
            release = resolve;
        });
        try {
            await previous.catch(() => {});
            return await task();
        } finally {
            release();
        }
    };
};

const selectEntryPoint = () => {
    const total = ENTRY_POINTS.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = Math.random() * total;
    for (const entry of ENTRY_POINTS) {
        roll -= entry.weight;
        if (roll <= 0) return entry.url;
    }
    return ENTRY_POINTS[0].url;
};

/** AI-Enhanced Twitter Activity Task. Config priority: Env Vars > settings.json > defaults. */
export default async function aiTwitterActivityTask(page, payload) {
    const startTime = process.hrtime.bigint();
    const browserInfo = payload.browserInfo || "unknown_profile";
    const logger = createLogger(`ai-twitterActivity.js [${browserInfo}]`);

    logger.info(`[ai-twitterActivity] Initializing AI-Enhanced Agent...`);

    // --- INITIALIZATION HELPERS ---
    const handleLLMWarmup = async () => {
        try {
            if (await config.isLocalLLMEnabled()) {
                const client = new OllamaClient();
                await client.wakeLocal();
                await client.checkModel('Warmup: Reply with OK then a short 30-word sentence about reading a social feed.');
                return true;
            }
        } catch (warmErr) {
            logger.warn(`[ai-twitterActivity] Local LLM warmup: ${warmErr.message}`);
        }
        return false;
    };

    const resolveProfile = () => {
        const resolved = payload.profileId
            ? (profileManager.getById(payload.profileId) || profileManager.getStarter())
            : profileManager.getStarter();
        
        if (resolved) {
            const profileDesc = `${resolved.id}-${resolved.type} | Input: ${resolved.inputMethod} (${resolved.inputMethodPct}%) | Dive: ${resolved.probabilities.dive}% | Like: ${resolved.probabilities.like}% | Follow: ${resolved.probabilities.follow}%`;
            logger.info(`[ai-twitterActivity] Profile: ${profileDesc}`);
        }
        return resolved;
    };

    const startupJitter = Math.floor(Math.random() * 10000); // 0-10 seconds
    logger.info(`[ai-twitterActivity] ⏳ Startup: Running parallel initialization (Jitter: ${startupJitter}ms)...`);

    // --- PARALLEL INITIALIZATION ---
    let taskConfig, profile, warmupResult;
    try {
        [taskConfig, profile, warmupResult] = await Promise.all([
            loadAiTwitterActivityConfig(payload),
            Promise.resolve().then(resolveProfile),
            handleLLMWarmup(),
            new Promise(resolve => setTimeout(resolve, startupJitter))
        ]);

        if (taskConfig.system.debugMode) {
            logger.info(`[ai-twitterActivity] Config loaded: ${taskConfig.session.cycles} cycles, reply=${taskConfig.engagement.probabilities.reply}`);
        }
    } catch (initError) {
        logger.error(`[ai-twitterActivity] Initialization failed: ${initError.message}`);
        throw new Error(`Task initialization failed: ${initError.message}`, { cause: initError });
    }

    let agent;
    let hasAgent = false;
    let agentState = { follows: 0, likes: 0, retweets: 0, tweets: 0 };
    let getAIStats = () => null;
    let getQueueStats = () => null;
    let getEngagementProgress = () => null;
    let sessionStart;
    let cursor = null;
    let cleanupPerformed = false;
    let popupCloser;
    let hasPopupCloser = false;
    let stopPopupCloser = () => {};
    const abortController = new AbortController();
    const abortSignal = abortController.signal;
    const withPageLock = createAsyncLock();

    const throwIfAborted = () => {
        if (abortSignal.aborted) {
            const reason = abortSignal.reason instanceof Error ? abortSignal.reason : new Error('Aborted');
            throw reason;
        }
    };

    try {
        const hardTimeoutMs = payload.taskTimeoutMs || (DEFAULT_MIN_DURATION + DEFAULT_MAX_DURATION) * 1000;
        let timeoutId;

        try {
            await Promise.race([
                (async () => {
                    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
                        try {
                            throwIfAborted();
                            if (attempt > 0) {
                                const delay = Math.pow(2, attempt) * 1000;
                                logger.info(`[ai-twitterActivity] Retry ${attempt}/${MAX_RETRIES} in ${delay}ms...`);
                                await page.waitForTimeout(delay);
                            }

                            throwIfAborted();
                            
                            cursor = new GhostCursor(page, logger);
                            agent = new AITwitterAgent(page, profile, logger, {
                                replyProbability: taskConfig.engagement.probabilities.reply,
                                quoteProbability: taskConfig.engagement.probabilities.quote,
                                engagementLimits: taskConfig.engagement.limits,
                                config: taskConfig
                            });
                            hasAgent = true;
                            agentState = agent.state;
                            getAIStats = agent.getAIStats.bind(agent);
                            getQueueStats = () => agent.diveQueue?.getFullStatus?.();
                            getEngagementProgress = () => agent.diveQueue?.getEngagementProgress?.();
                            sessionStart = agent.sessionStart;

                            if (taskConfig.system.debugMode) {
                                logger.info(`[ai-twitterActivity] AITwitterAgent initialized with reply=${taskConfig.engagement.probabilities.reply}`);
                            }

                            const theme = profile?.theme || 'dark';
                            logger.info(`[ai-twitterActivity] Enforcing theme: ${theme}`);
                            await withPageLock(async () => page.emulateMedia({ colorScheme: theme }));

                            await withPageLock(async () => applyHumanizationPatch(page, logger));
                            if (!popupCloser) {
                                popupCloser = new PopupCloser(page, logger, {
                                    lock: withPageLock,
                                    signal: abortSignal
                                });
                                stopPopupCloser = popupCloser.stop.bind(popupCloser);
                                hasPopupCloser = true;
                                popupCloser.start();
                            }

                            const wakeUp = humanTiming.getWarmupDelay({
                                min: taskConfig.timing.warmup.min,
                                max: taskConfig.timing.warmup.max
                            });
                            logger.info(`[ai-twitterActivity] Warm-up ${humanTiming.formatDuration(wakeUp)}...`);
                            await page.waitForTimeout(wakeUp);

                            throwIfAborted();
                            const referrerEngine = new ReferrerEngine({ addUTM: true });
                            const ctx = referrerEngine.generateContext(TARGET_URL);

                            await withPageLock(async () => page.setExtraHTTPHeaders({
                                ...ctx.headers,
                                'Sec-Fetch-Site': 'none',
                                'Sec-Fetch-Mode': 'navigate'
                            }));

                            const entryUrl = selectEntryPoint();
                            logger.info(`[ai-twitterActivity] Navigating to ${entryUrl} (random entry point)`);
                            await withPageLock(async () => page.goto(entryUrl, { waitUntil: WAIT_UNTIL, timeout: PAGE_TIMEOUT_MS }));

                            const xLoaded = await withPageLock(async () => Promise.race([
                                page.waitForSelector('[data-testid="AppTabBar_Home_Link"]', { timeout: TWITTER_TIMEOUTS.ELEMENT_VISIBLE }).then(() => 'home'),
                                page.waitForSelector('[data-testid="loginButton"]', { timeout: TWITTER_TIMEOUTS.ELEMENT_VISIBLE }).then(() => 'login'),
                                page.waitForSelector('[role="main"]', { timeout: TWITTER_TIMEOUTS.ELEMENT_VISIBLE }).then(() => 'main'),
                                new Promise((_, reject) => setTimeout(() => reject(new Error('X.com load timeout')), TWITTER_TIMEOUTS.NAVIGATION))
                            ])).catch(() => null);

                            logger.info(`[ai-twitterActivity] X.com loaded (${xLoaded || 'partial'})`);

                            const idleTimeout = xLoaded ? 4000 : 10000;
                            logger.info(`[ai-twitterActivity] Waiting for network settlement (${idleTimeout}ms)...`);

                            try {
                                await withPageLock(async () => page.waitForLoadState('networkidle', { timeout: idleTimeout }));
                                logger.info(`[ai-twitterActivity] Network idle reached.`);
                            } catch (e) {
                                logger.info(`[ai-twitterActivity] Network active, proceeding after ${idleTimeout}ms...`);
                            }

                            const currentUrl = page.url();
                            const onHome = currentUrl.includes('/home') || currentUrl === 'https://x.com/' || currentUrl === 'https://x.com';
                            if (!onHome) {
                                const scrollDuration = mathUtils.randomInRange(3000, 5000);
                                const scrollStart = Date.now();
                                while (Date.now() - scrollStart < scrollDuration) {
                                    const delta = mathUtils.randomInRange(200, 600);
                                    await withPageLock(async () => page.mouse.wheel(0, delta));
                                    await page.waitForTimeout(mathUtils.randomInRange(200, 500));
                                }
                                await withPageLock(async () => agent.navigateHome());
                            }

                            throwIfAborted();
                            logger.info(`[ai-twitterActivity] Checking login state...`);
                            let loginCheckDelay = LOGIN_CHECK_DELAY;
                            for (let i = 0; i < LOGIN_CHECK_LOOPS; i++) {
                                throwIfAborted();
                                const loggedIn = await withPageLock(async () => agent.checkLoginState());
                                if (loggedIn) {
                                    logger.info(`[ai-twitterActivity] ✅ Logged in (check ${i + 1}/${LOGIN_CHECK_LOOPS})`);
                                    break;
                                }
                                if (i < LOGIN_CHECK_LOOPS - 1) {
                                    logger.info(`[ai-twitterActivity] Not logged in yet, waiting ${loginCheckDelay}ms...`);
                                    await page.waitForTimeout(loginCheckDelay);
                                    loginCheckDelay = Math.min(loginCheckDelay + 1000, 5000);
                                }
                            }

                            throwIfAborted();
                            const cycles = typeof payload.cycles === 'number' ? payload.cycles : DEFAULT_CYCLES;
                            const minDuration = typeof payload.minDuration === 'number' ? payload.minDuration : DEFAULT_MIN_DURATION;
                            const maxDuration = typeof payload.maxDuration === 'number' ? payload.maxDuration : DEFAULT_MAX_DURATION;

                            logger.info(`[ai-twitterActivity] Starting session (${cycles} cycles, ${minDuration}-${maxDuration}s)...`);

                            try {
                                await agent.runSession(cycles, minDuration, maxDuration, { abortSignal });
                                logger.info(`[ai-twitterActivity] Session completed successfully`);
                            } catch (sessionError) {
                                if (abortSignal.aborted) {
                                    throw sessionError;
                                }
                                logger.warn(`[ai-twitterActivity] Session error: ${sessionError.message}`);
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
                new Promise((_, reject) => {
                    timeoutId = setTimeout(() => {
                        const timeoutError = new Error('Timeout');
                        abortController.abort(timeoutError);
                        reject(timeoutError);
                    }, hardTimeoutMs);
                })
            ]);
        } finally {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        }

    } catch (error) {
        logger.error(`[ai-twitterActivity] Error: ${error.message}`);
    } finally {
        // CRITICAL: Cleanup flag set first to prevent race conditions and ensure single execution.
        cleanupPerformed = true;

        if (hasAgent) {
            const agentStateSnapshot = { ...agentState };
            if (agentStateSnapshot.follows > 0) metricsCollector.recordSocialAction('follow', agentStateSnapshot.follows);
            if (agentStateSnapshot.likes > 0) metricsCollector.recordSocialAction('like', agentStateSnapshot.likes);
            if (agentStateSnapshot.retweets > 0) metricsCollector.recordSocialAction('retweet', agentStateSnapshot.retweets);
            if (agentStateSnapshot.tweets > 0) metricsCollector.recordSocialAction('tweet', agentStateSnapshot.tweets);
            const engagementProgressSnapshot = getEngagementProgress ? getEngagementProgress() : null;
            const completedReplies = engagementProgressSnapshot?.replies?.current ?? 0;
            const completedQuotes = engagementProgressSnapshot?.quotes?.current ?? 0;
            const completedBookmarks = engagementProgressSnapshot?.bookmarks?.current ?? 0;
            if (completedReplies > 0) metricsCollector.recordTwitterEngagement('reply', completedReplies);
            if (completedQuotes > 0) metricsCollector.recordTwitterEngagement('quote', completedQuotes);
            if (completedBookmarks > 0) metricsCollector.recordTwitterEngagement('bookmark', completedBookmarks);

            const aiStatsSnapshot = getAIStats ? getAIStats() : null;
            if (aiStatsSnapshot) {
                logger.info(`[ai-twitterActivity] Final AI Stats: ${JSON.stringify(aiStatsSnapshot)}`);
            }

            if (getQueueStats) {
                const queueStatsSnapshot = getQueueStats();
                const engagementProgressSnapshot = getEngagementProgress ? getEngagementProgress() : null;
                const sessionStartTime = sessionStart || Date.now();
                const duration = ((Date.now() - sessionStartTime) / 1000 / 60).toFixed(1);

                setTimeout(async () => {
                    if (abortSignal.aborted) return;
                    try {
                        const logConfig = await getLoggingConfig();

                        if (queueStatsSnapshot && logConfig?.finalStats?.showQueueStatus !== false) {
                            logger.info(`[ai-twitterActivity] DiveQueue: queue=${queueStatsSnapshot.queue.queueLength}, active=${queueStatsSnapshot.queue.activeCount}, utilization=${queueStatsSnapshot.queue.utilizationPercent}%`);
                        }

                        if (logConfig?.finalStats?.showEngagement !== false && logConfig?.engagementProgress?.enabled) {
                            const progressConfig = logConfig.engagementProgress;

                            if (engagementProgressSnapshot) {
                                const summary = formatEngagementSummary(engagementProgressSnapshot, progressConfig);
                                logger.info(`[ai-twitterActivity] Engagement Progress: ${summary}`);
                            }
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
            if (hasPopupCloser) {
                stopPopupCloser();
                stopPopupCloser = () => {};
                hasPopupCloser = false;
            }
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

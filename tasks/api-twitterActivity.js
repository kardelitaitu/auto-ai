/**
 * AI-Enhanced Twitter Activity Task using Unified API
 * Full feature parity with ai-twitterActivity.js using api/ modules
 * @module tasks/api-twitterActivity
 */

import { api } from '../api/index.js';
import { AITwitterAgent } from '../utils/ai-twitterAgent.js';
import { profileManager } from '../utils/profileManager.js';
import { mathUtils } from '../utils/mathUtils.js';
import { ReferrerEngine } from '../utils/urlReferrer.js';
import metricsCollector from '../utils/metrics.js';
import { getLoggingConfig, formatEngagementSummary } from '../utils/logging-config.js';
import { createLogger } from '../utils/logger.js';
import { loadAiTwitterActivityConfig } from '../utils/task-config-loader.js';
import PopupCloser from '../utils/popup-closer.js';
import { humanTiming } from '../utils/human-timing.js';
import { TWITTER_TIMEOUTS } from '../constants/twitter-timeouts.js';

const TARGET_URL = 'https://x.com';
const DEFAULT_CYCLES = 20;
const DEFAULT_MIN_DURATION = 360;
const DEFAULT_MAX_DURATION = 600;
const WAIT_UNTIL = 'domcontentloaded';

const MAX_RETRIES = 2;
const LOGIN_CHECK_LOOPS = 3;
const LOGIN_CHECK_DELAY = 3000;
const PAGE_TIMEOUT_MS = 60000;

const ENTRY_POINTS = [
    { url: 'https://x.com/', weight: 59 },
    { url: 'https://x.com/i/jf/global-trending/home', weight: 4 },
    { url: 'https://x.com/explore', weight: 4 },
    { url: 'https://x.com/explore/tabs/for-you', weight: 4 },
    { url: 'https://x.com/explore/tabs/trending', weight: 4 },
    { url: 'https://x.com/i/bookmarks', weight: 4 },
    { url: 'https://x.com/notifications', weight: 4 },
    { url: 'https://x.com/notifications/mentions', weight: 4 },
    { url: 'https://x.com/i/chat/', weight: 4 },
    { url: 'https://x.com/i/connect_people?show_topics=false', weight: 2 },
    { url: 'https://x.com/i/connect_people?is_creator_only=true', weight: 2 },
    { url: 'https://x.com/explore/tabs/news', weight: 1 },
    { url: 'https://x.com/explore/tabs/sports', weight: 1 },
    { url: 'https://x.com/explore/tabs/entertainment', weight: 1 },
    { url: 'https://x.com/explore/tabs/for_you', weight: 1 },
    { url: 'https://x.com/notifications', weight: 1 },
];

function selectEntryPoint() {
    const totalWeight = ENTRY_POINTS.reduce((sum, ep) => sum + ep.weight, 0);
    let random = Math.random() * totalWeight;
    for (const entry of ENTRY_POINTS) {
        random -= entry.weight;
        if (random <= 0) return entry.url;
    }
    return ENTRY_POINTS[0].url;
}

/**
 * API-based Twitter Activity Task
 * Full feature parity with original using unified api
 * @param {object} page - Playwright page instance
 * @param {object} payload - Task payload
 * @returns {Promise<object>} Task result
 */
export default async function apiTwitterActivityTask(page, payload) {
    const startTime = process.hrtime.bigint();
    const browserInfo = payload.browserInfo || 'unknown_profile';
    const logger = createLogger(`api-twitterActivity.js [${browserInfo}]`);

    logger.info(`[api-twitterActivity] Initializing with Unified API...`);

    // Initialize API context
    api.setPage(page);

    // Apply detection patches
    await api.patch.apply();

    // Profile resolution
    const resolveProfile = () => {
        const resolved = payload.profileId
            ? (profileManager.getById(payload.profileId) || profileManager.getStarter())
            : profileManager.getStarter();
        if (resolved) {
            const profileDesc = `${resolved.id}-${resolved.type} | Input: ${resolved.inputMethod} (${resolved.inputMethodPct}%) | Dive: ${resolved.probabilities.dive}% | Like: ${resolved.probabilities.like}% | Follow: ${resolved.probabilities.follow}%`;
            logger.info(`[api-twitterActivity] Profile: ${profileDesc}`);
        }
        return resolved;
    };

    // Startup jitter
    const startupJitter = Math.floor(Math.random() * 10000);
    logger.info(`[api-twitterActivity] ⏳ Startup Jitter: ${startupJitter}ms...`);

    // Parallel initialization
    let taskConfig, profile;
    try {
        [taskConfig, profile] = await Promise.all([
            loadAiTwitterActivityConfig(payload),
            Promise.resolve().then(resolveProfile),
            api.wait(startupJitter)
        ]);

        if (taskConfig.system.debugMode) {
            logger.info(`[api-twitterActivity] Config: ${taskConfig.session.cycles} cycles, reply=${taskConfig.engagement.probabilities.reply}`);
        }
    } catch (initError) {
        logger.error(`[api-twitterActivity] Initialization failed: ${initError.message}`);
        throw new Error(`Task initialization failed: ${initError.message}`);
    }

    // Set persona
    if (profile) {
        await api.setPersona(profile.persona || 'casual');
        logger.info(`[api-twitterActivity] Persona: ${api.getPersonaName()}`);
    }

    let agent;
    let hasAgent = false;
    let agentState = { follows: 0, likes: 0, retweets: 0, tweets: 0 };
    let getAIStats = () => null;
    let getQueueStats = () => null;
    let getEngagementProgress = () => null;
    let sessionStart;
    let popupCloser;
    let hasPopupCloser = false;
    let stopPopupCloser = () => {};
    const abortController = new AbortController();
    const abortSignal = abortController.signal;

    const throwIfAborted = () => {
        if (abortSignal.aborted) {
            const reason = abortSignal.reason instanceof Error ? abortSignal.reason : new Error('Aborted');
            throw reason;
        }
    };

    try {
        const hardTimeoutMs = payload.taskTimeoutMs || Math.max(
            DEFAULT_MIN_DURATION * 1000,
            DEFAULT_MAX_DURATION * 1000
        );
        let timeoutId;

        try {
            await Promise.race([
                (async () => {
                    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
                        try {
                            throwIfAborted();

                            if (attempt > 0) {
                                const delay = Math.pow(2, attempt) * 1000;
                                logger.info(`[api-twitterActivity] Retry ${attempt}/${MAX_RETRIES} in ${delay}ms...`);
                                await api.wait(delay);
                            }

                            throwIfAborted();

                            // Initialize agent
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

                            const withPageLock = agent.diveQueue.add.bind(agent.diveQueue);

                            if (taskConfig.system.debugMode) {
                                logger.info(`[api-twitterActivity] AITwitterAgent initialized`);
                            }

                            // Set theme using page directly (api doesn't have emulateMedia)
                            const theme = profile?.theme || 'dark';
                            logger.info(`[api-twitterActivity] Enforcing theme: ${theme}`);
                            await withPageLock(async () => page.emulateMedia({ colorScheme: theme }));

                            // Apply humanization patch
                            await withPageLock(async () => api.patch.apply());

                            // Popup closer
                            if (!popupCloser) {
                                popupCloser = new PopupCloser(page, logger, {
                                    lock: withPageLock,
                                    signal: abortSignal
                                });
                                stopPopupCloser = async () => {
                                    try {
                                        await popupCloser.stop();
                                    } catch (error) {
                                        logger.warn(`[api-twitterActivity] Popup closer stop failed: ${error.message}`);
                                    }
                                };
                                hasPopupCloser = true;
                                await popupCloser.start();
                            }

                            // Warmup
                            const wakeUp = humanTiming.getWarmupDelay({
                                min: taskConfig.timing.warmup.min,
                                max: taskConfig.timing.warmup.max
                            });
                            logger.info(`[api-twitterActivity] Warm-up ${humanTiming.formatDuration(wakeUp)}...`);
                            await api.wait(wakeUp);

                            throwIfAborted();

                            // Referrer engine
                            const referrerEngine = new ReferrerEngine({ addUTM: true });
                            const ctx = referrerEngine.generateContext(TARGET_URL);

                            await withPageLock(async () => page.setExtraHTTPHeaders({
                                ...ctx.headers,
                                'Sec-Fetch-Site': 'none',
                                'Sec-Fetch-Mode': 'navigate'
                            }));

                            // Navigation with api
                            const entryUrl = selectEntryPoint();
                            const entryName = entryUrl.replace('https://x.com/', '').replace('https://x.com', '') || 'home';
                            logger.info(`[api-twitterActivity] 🎲 Entry: ${entryName} → ${entryUrl}`);

                            await api.goto(entryUrl, {
                                warmup: false,
                                waitUntil: WAIT_UNTIL,
                                timeout: PAGE_TIMEOUT_MS
                            });

                            // Wait for page load
                            const xLoaded = await Promise.race([
                                api.waitVisible('[data-testid="AppTabBar_Home_Link"]').then(() => 'home').catch(() => null),
                                api.waitVisible('[data-testid="loginButton"]').then(() => 'login').catch(() => null),
                                api.waitVisible('[role="main"]').then(() => 'main').catch(() => null),
                                api.wait(TWITTER_TIMEOUTS.NAVIGATION).then(() => null)
                            ]);

                            logger.info(`[api-twitterActivity] X.com loaded (${xLoaded || 'partial'})`);

                            // Network idle wait
                            const idleTimeout = xLoaded ? 12000 : 20000;
                            logger.info(`[api-twitterActivity] Waiting for network (${idleTimeout}ms)...`);

                            try {
                                await withPageLock(async () => page.waitForLoadState('networkidle', { timeout: idleTimeout }));
                                logger.info(`[api-twitterActivity] Network idle reached.`);
                            } catch (_e) {
                                logger.info(`[api-twitterActivity] Network active, proceeding...`);
                            }

                            throwIfAborted();

                            // Reading simulation if not on home
                            const currentUrl = page.url();
                            const onHome = currentUrl.includes('/home') || currentUrl === 'https://x.com/' || currentUrl === 'https://x.com';
                            if (!onHome) {
                                const scrollDuration = mathUtils.randomInRange(10000, 20000);
                                const scrollDurationSec = (scrollDuration / 1000).toFixed(2);
                                logger.info(`[api-twitterActivity] 📖 Reading on ${entryName} for ${scrollDurationSec}s...`);

                                const scrollStartTime = Date.now();
                                while (Date.now() - scrollStartTime < scrollDuration) {
                                    const delta = mathUtils.randomInRange(200, 600);
                                    await page.mouse.wheel(0, delta);
                                    await api.wait(mathUtils.randomInRange(200, 500));
                                }

                                logger.info(`[api-twitterActivity] ✅ Navigating to home...`);
                                await withPageLock(async () => agent.navigateHome());
                            }

                            throwIfAborted();

                            // Login check with loops
                            logger.info(`[api-twitterActivity] Checking login state...`);
                            let loginCheckDelay = LOGIN_CHECK_DELAY;
                            for (let i = 0; i < LOGIN_CHECK_LOOPS; i++) {
                                throwIfAborted();
                                const loggedIn = await withPageLock(async () => agent.checkLoginState());
                                if (loggedIn) {
                                    logger.info(`[api-twitterActivity] ✅ Logged in (check ${i + 1}/${LOGIN_CHECK_LOOPS})`);
                                    break;
                                }
                                if (i < LOGIN_CHECK_LOOPS - 1) {
                                    logger.info(`[api-twitterActivity] Not logged in, waiting ${loginCheckDelay}ms...`);
                                    await api.wait(loginCheckDelay);
                                    loginCheckDelay = Math.min(loginCheckDelay + 1000, 5000);
                                }
                            }

                            throwIfAborted();

                            // Run session
                            const cycles = typeof payload.cycles === 'number' ? payload.cycles : DEFAULT_CYCLES;
                            const minDuration = typeof payload.minDuration === 'number' ? payload.minDuration : DEFAULT_MIN_DURATION;
                            const maxDuration = typeof payload.maxDuration === 'number' ? payload.maxDuration : DEFAULT_MAX_DURATION;

                            logger.info(`[api-twitterActivity] Starting session (${cycles} cycles, ${minDuration}-${maxDuration}s)...`);

                            try {
                                await agent.runSession(cycles, minDuration, maxDuration, { abortSignal });
                                logger.info(`[api-twitterActivity] Session completed successfully`);
                            } catch (sessionError) {
                                if (abortSignal.aborted) {
                                    throw sessionError;
                                }
                                logger.warn(`[api-twitterActivity] Session error: ${sessionError.message}`);
                                try {
                                    if (agent && agent.page && !agent.page.isClosed()) {
                                        await agent.navigateHome();
                                        logger.info('[api-twitterActivity] Recovered to home');
                                    }
                                } catch (recoveryError) {
                                    logger.warn(`[api-twitterActivity] Recovery failed: ${recoveryError.message}`);
                                }
                            }

                            logger.info(`[api-twitterActivity] Session completed`);
                            return;

                        } catch (innerError) {
                            logger.warn(`[api-twitterActivity] Attempt ${attempt + 1} failed: ${innerError.message}`);
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
            if (timeoutId) clearTimeout(timeoutId);
        }
    } catch (error) {
        logger.error(`[api-twitterActivity] Error: ${error.message}`);
    } finally {
        // Stop idle
        if (api.idle.isRunning()) {
            api.idle.stop();
        }

        if (hasAgent) {
            // Record metrics
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
                logger.info(`[api-twitterActivity] Final AI Stats: ${JSON.stringify(aiStatsSnapshot)}`);
            }

            if (getQueueStats) {
                const queueStatsSnapshot = getQueueStats();
                const progressSnapshot = getEngagementProgress ? getEngagementProgress() : null;
                const sessionStartTime = sessionStart || Date.now();
                const duration = ((Date.now() - sessionStartTime) / 1000 / 60).toFixed(1);

                // Deferred logging
                setTimeout(async () => {
                    if (abortSignal.aborted) return;
                    try {
                        const logConfig = await getLoggingConfig();

                        if (queueStatsSnapshot && logConfig?.finalStats?.showQueueStatus !== false) {
                            logger.info(`[api-twitterActivity] DiveQueue: queue=${queueStatsSnapshot.queue.queueLength}, active=${queueStatsSnapshot.queue.activeCount}, util=${queueStatsSnapshot.queue.utilizationPercent}%`);
                        }

                        if (logConfig?.finalStats?.showEngagement !== false && logConfig?.engagementProgress?.enabled) {
                            const progressConfig = logConfig.engagementProgress;
                            if (progressSnapshot) {
                                const summary = formatEngagementSummary(progressSnapshot, progressConfig);
                                logger.info(`[api-twitterActivity] Engagement Progress: ${summary}`);
                            }
                        }
                    } catch (loggingError) {
                        logger.warn(`[api-twitterActivity] Deferred logging error: ${loggingError.message}`);
                    }
                }, 50);

                logger.info(`[api-twitterActivity] Task Finished. Duration: ${duration}m`);
            }

            // Shutdown agent
            if (typeof agent.shutdown === 'function') {
                await agent.shutdown();
            }
        }

        // Cleanup
        try {
            if (hasPopupCloser) {
                await stopPopupCloser();
                hasPopupCloser = false;
            }
            if (page && !page.isClosed()) {
                await page.close();
            }
        } catch (closeError) {
            logger.warn(`[api-twitterActivity] Page close warning: ${closeError.message}`);
        }

        // Clear API context
        api.clearContext();

        const duration = (Number(process.hrtime.bigint() - startTime) / 1e9).toFixed(2);
        logger.info(`[api-twitterActivity] Done in ${duration}s`);
    }
}

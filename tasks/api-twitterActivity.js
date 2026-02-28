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

const DEFAULT_CYCLES = 20;
const DEFAULT_MIN_DURATION = 360;
const DEFAULT_MAX_DURATION = 600;
const WAIT_UNTIL = 'domcontentloaded';

const MAX_RETRIES = 2;
const LOGIN_CHECK_LOOPS = 3;
const LOGIN_CHECK_DELAY = 3000;
const PAGE_TIMEOUT_MS = 60000;

const ENTRY_POINTS = [
    // Primary Entry (Remainder: 100% - 32% - 4% - 5% = 59%)
    { url: 'https://x.com/', weight: 59 },

    // 4% Weight Group (Total 32%)
    { url: 'https://x.com/i/jf/global-trending/home', weight: 4 },
    { url: 'https://x.com/explore', weight: 4 },
    { url: 'https://x.com/explore/tabs/for-you', weight: 4 },
    { url: 'https://x.com/explore/tabs/trending', weight: 4 },
    { url: 'https://x.com/i/bookmarks', weight: 4 },
    { url: 'https://x.com/notifications', weight: 4 },
    { url: 'https://x.com/notifications/mentions', weight: 4 },
    { url: 'https://x.com/i/chat/', weight: 4 },

    // 2% Weight Group (Total 4%)
    { url: 'https://x.com/i/connect_people?show_topics=false', weight: 2 },
    { url: 'https://x.com/i/connect_people?is_creator_only=true', weight: 2 },

    // Legacy/Supplementary Exploratory Points (1% each to fill entropy, Total 5%)
    { url: 'https://x.com/explore/tabs/news', weight: 1 },
    { url: 'https://x.com/explore/tabs/sports', weight: 1 },
    { url: 'https://x.com/explore/tabs/entertainment', weight: 1 },
    { url: 'https://x.com/explore/tabs/for_you', weight: 1 }, // Note: legacy underscore version
    { url: 'https://x.com/notifications', weight: 1 }        // Secondary notification hit
];

function selectEntryPoint() {
    const totalWeight = ENTRY_POINTS.reduce((sum, ep) => sum + ep.weight, 0);
    let random = Math.random() * totalWeight;

    for (const entry of ENTRY_POINTS) {
        random -= entry.weight;
        if (random <= 0) {
            return entry.url;
        }
    }

    return ENTRY_POINTS[0].url;
}

function extractProfileType(profile) {
    if (!profile) return null;
    if (typeof profile.type === 'string' && profile.type.trim().length > 0) {
        return profile.type.trim();
    }
    if (typeof profile.id === 'string') {
        const parts = profile.id.split('-');
        if (parts.length > 1) {
            return parts.slice(1).join('-').trim();
        }
    }
    if (typeof profile.description === 'string') {
        const match = profile.description.match(/Type:\s*([A-Za-z]+)/);
        if (match?.[1]) return match[1];
    }
    return null;
}

function resolvePersona(profile) {
    const available = new Set(api.listPersonas());
    const rawPersona = typeof profile?.persona === 'string' ? profile.persona.trim() : '';
    if (rawPersona && available.has(rawPersona)) return rawPersona;

    const type = extractProfileType(profile);
    const byType = {
        skimmer: 'efficient',
        balanced: 'casual',
        deepdiver: 'researcher',
        lurker: 'hesitant',
        doomscroller: 'distracted',
        newsjunkie: 'focused',
        stalker: 'focused'
    };
    const mapped = type ? byType[type.toLowerCase()] : null;
    if (mapped && available.has(mapped)) return mapped;
    return 'casual';
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
    await api.init(page, {
        logger,
        patch: true,
        humanizationPatch: true,
        autoInitNewPages: true,
        colorScheme: 'dark',
        sensors: false,
    });

    // Note: Page context is now set via orchestrator's api.withPage()
    // or use: await api.withPage(page, async () => { ... }) for standalone execution

    // Profile resolution
    const resolveProfile = () => {
        const resolved = payload.profileId
            ? (profileManager.getById(payload.profileId) || profileManager.getStarter())
            : profileManager.getStarter();
        if (resolved) {
            resolved.persona = resolvePersona(resolved);
            const profileDesc = `${resolved.id}-${resolved.type} | Input: ${resolved.inputMethod} (${resolved.inputMethodPct}%) | Dive: ${resolved.probabilities.dive}% | Like: ${resolved.probabilities.like}% | Follow: ${resolved.probabilities.follow}%`;
            logger.info(`[api-twitterActivity] Profile: ${profileDesc}`);
        }
        return resolved;
    };

    // Startup jitter
    const startupJitter = Math.floor(Math.random() * 5000); // 5 seconds
    logger.info(`[api-twitterActivity] ⏳ Startup: Running parallel initialization (Jitter: ${startupJitter}ms)...`);

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
        throw new Error(`Task initialization failed: ${initError.message}`, { cause: initError });
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
    let stopPopupCloser = () => { };
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

                            const withPageLock = async (fn, opts) => {
                                const res = await agent.diveQueue.add(fn, opts);
                                return res.success ? res.result : null;
                            };

                            if (taskConfig.system.debugMode) {
                                logger.info(`[api-twitterActivity] AITwitterAgent initialized`);
                            }

                            // Persona setup
                            if (profile) {
                                await api.setPersona(resolvePersona(profile));
                                logger.info(`[api-twitterActivity] Persona: ${api.getPersonaName()}`);

                                const persona = api.getPersona();
                                const distractionChance = typeof persona.microMoveChance === 'number'
                                    ? persona.microMoveChance
                                    : (typeof persona.idleChance === 'number' ? persona.idleChance : 0.2);

                                api.setDistractionChance(distractionChance);
                                logger.info(`[api-twitterActivity] Distraction chance: ${(distractionChance * 100).toFixed(0)}%`);
                            }

                            // Set theme using API
                            const theme = profile?.theme || 'dark';
                            logger.info(`[api-twitterActivity] Enforcing theme: ${theme}`);
                            await withPageLock(async () => api.emulateMedia({ colorScheme: theme }));

                            // Popup closer
                            if (!popupCloser) {
                                popupCloser = new PopupCloser(page, logger, {
                                    lock: withPageLock,
                                    signal: abortSignal,
                                    api
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

                            // Start idle simulation
                            const persona = api.getPersona();
                            const idleChance = typeof persona.idleChance === 'number' ? persona.idleChance : 0.02;
                            const speed = typeof persona.speed === 'number' && persona.speed > 0 ? persona.speed : 1;
                            const idleRoll = Math.random();
                            const shouldIdle = idleRoll < Math.max(0.05, Math.min(0.4, idleChance * 2));

                            if (shouldIdle) {
                                api.idle.start({
                                    wiggle: true,
                                    scroll: idleChance > 0.02,
                                    frequency: Math.min(8000, Math.max(2000, Math.round(4000 / speed))),
                                    magnitude: api.getPersonaName() === 'glitchy' ? 8 : 3
                                });
                                logger.info(`[api-twitterActivity] Idle simulation started`);
                            }

                            // Warmup
                            const wakeUp = humanTiming.getWarmupDelay({
                                min: taskConfig.timing.warmup.min,
                                max: taskConfig.timing.warmup.max
                            });
                            logger.info(`[api-twitterActivity] Warm-up ${humanTiming.formatDuration(wakeUp)}...`);
                            await api.wait(wakeUp);

                            throwIfAborted();

                            // Navigation with ReferrerEngine and API
                            const entryUrl = selectEntryPoint();
                            const entryName = entryUrl.replace('https://x.com/', '').replace('https://x.com', '') || 'home';
                            logger.info(`[api-twitterActivity] 🎲 Rolled entry point: ${entryName} → ${entryUrl}`);

                            const referrerEngine = new ReferrerEngine({ addUTM: true });
                            const ctx = referrerEngine.generateContext(entryUrl);

                            await withPageLock(async () => {
                                await api.setExtraHTTPHeaders({
                                    ...ctx.headers,
                                    'Sec-Fetch-Site': 'none',
                                    'Sec-Fetch-Mode': 'navigate'
                                });

                                await api.goto(entryUrl, {
                                    waitUntil: WAIT_UNTIL,
                                    timeout: PAGE_TIMEOUT_MS,
                                    referer: ctx.referrer || undefined
                                });
                            });

                            // Page load detection
                            const xLoaded = await withPageLock(async () => Promise.race([
                                api.waitVisible('[data-testid="AppTabBar_Home_Link"]', { timeout: TWITTER_TIMEOUTS.ELEMENT_VISIBLE }).then(() => 'home').catch(() => { }),
                                api.waitVisible('[data-testid="loginButton"]', { timeout: TWITTER_TIMEOUTS.ELEMENT_VISIBLE }).then(() => 'login').catch(() => { }),
                                api.waitVisible('[role="main"]', { timeout: TWITTER_TIMEOUTS.ELEMENT_VISIBLE }).then(() => 'main').catch(() => { }),
                                api.wait(TWITTER_TIMEOUTS.NAVIGATION).then(() => { throw new Error('X.com load timeout'); }).catch(() => { })
                            ])).catch(() => null);

                            logger.info(`[api-twitterActivity] X.com loaded (${xLoaded || 'partial'})`);

                            const idleTimeout = xLoaded ? 4000 : 12000;
                            logger.info(`[api-twitterActivity] Waiting for network settlement (${idleTimeout}ms)...`);

                            try {
                                await withPageLock(async () => api.waitForLoadState('networkidle', { timeout: idleTimeout }));
                                logger.info(`[api-twitterActivity] Network idle reached.`);
                            } catch (_e) {
                                logger.info(`[api-twitterActivity] Network active, proceeding after ${idleTimeout}ms...`);
                            }

                            throwIfAborted();

                            const currentUrl = await api.getCurrentUrl();
                            const onHome = currentUrl.includes('/home') || currentUrl === 'https://x.com/' || currentUrl === 'https://x.com';
                            if (!onHome) {
                                const scrollDuration = mathUtils.randomInRange(10000, 20000);
                                const scrollDurationSec = (scrollDuration / 1000).toFixed(2);
                                logger.info(`[api-twitterActivity] 📖 Simulating reading on ${entryName} for ${scrollDurationSec}s...`);

                                const scrollStart = Date.now();
                                while (Date.now() - scrollStart < scrollDuration) {
                                    await withPageLock(async () => api.scroll.read(null, {
                                        pauses: 1,
                                        scrollAmount: mathUtils.randomInRange(200, 600)
                                    }));
                                    await api.wait(mathUtils.randomInRange(200, 500));
                                }
                                logger.info(`[api-twitterActivity] ✅ Finished reading, navigating to home...`);
                                await withPageLock(async () => agent.navigateHome());
                            }

                            throwIfAborted();
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
                                    logger.info(`[api-twitterActivity] Not logged in yet, waiting ${loginCheckDelay}ms...`);
                                    await api.wait(loginCheckDelay);
                                    loginCheckDelay = Math.min(loginCheckDelay + 1000, 5000);
                                }
                            }

                            throwIfAborted();
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
                                        await withPageLock(async () => agent.navigateHome());
                                        logger.info('[api-twitterActivity] Recovered to home page');
                                    }
                                } catch (recoveryError) {
                                    logger.warn(`[api-twitterActivity] Recovery attempt failed: ${recoveryError.message}`);
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
        if (api.idle.isRunning()) {
            api.idle.stop();
        }

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
                logger.info(`[api-twitterActivity] Final AI Stats: ${JSON.stringify(aiStatsSnapshot)}`);
            }

            if (getQueueStats) {
                const queueStatsSnapshot = getQueueStats();
                const progressSnapshot = getEngagementProgress ? getEngagementProgress() : null;
                const sessionStartTime = sessionStart || Date.now();
                const duration = ((Date.now() - sessionStartTime) / 1000 / 60).toFixed(1);

                setTimeout(async () => {
                    if (abortSignal.aborted) return;
                    try {
                        const logConfig = await getLoggingConfig();

                        if (queueStatsSnapshot && logConfig?.finalStats?.showQueueStatus !== false) {
                            logger.info(`[api-twitterActivity] DiveQueue: queue=${queueStatsSnapshot.queue.queueLength}, active=${queueStatsSnapshot.queue.activeCount}, utilization=${queueStatsSnapshot.queue.utilizationPercent}%`);
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

            if (typeof agent.shutdown === 'function') {
                await agent.shutdown();
            }
        }

        try {
            if (hasPopupCloser) {
                await stopPopupCloser();
                hasPopupCloser = false;
            }
        } catch (closeError) {
            logger.warn(`[api-twitterActivity] Cleanup warning: ${closeError.message}`);
        }

        api.clearContext();
        const duration = (Number(process.hrtime.bigint() - startTime) / 1e9).toFixed(2);
        logger.info(`[api-twitterActivity] Done in ${duration}s`);
    }
}

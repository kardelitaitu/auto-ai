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
    logger.info(`[api-twitterActivity] Step 1: Starting api.init()...`);

    await api.init(page, {
        logger,
        patch: true,
        humanizationPatch: true,
        autoInitNewPages: true,
        colorScheme: 'dark',
        sensors: false, // Temporarily disable sensor spoofing to isolate hanging issue
    });

    logger.info(`[api-twitterActivity] Step 2: api.init() completed, setting page...`);
    api.setPage(page);
    logger.info(`[api-twitterActivity] Step 3: Page set successfully`);

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
    const startupJitter = Math.floor(Math.random() * 1000); // Max 1 second
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
        throw new Error(`Task initialization failed: ${initError.message}`, { cause: initError });
    }

    const apiMigration = taskConfig.system?.apiMigration ?? {};
    const useUnifiedApiInTask = apiMigration.useUnifiedApiInTask === true;

    // Set persona and attention patterns
    if (profile) {
        await api.setPersona(resolvePersona(profile));
        logger.info(`[api-twitterActivity] Persona: ${api.getPersonaName()}`);
        
        const persona = api.getPersona();
        const distractionChance = typeof persona.idleChance === 'number' ? persona.idleChance : 0.2;
        api.setDistractionChance(distractionChance);
        logger.info(`[api-twitterActivity] Distraction chance: ${(distractionChance * 100).toFixed(0)}%`);
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

    const navigateHomePreferBack = async (withPageLock, reason = 'navigateHome') => {
        const preferBack = Math.random() < 0.9;

        if (preferBack) {
            try {
                const canGoBack = await withPageLock(async () => {
                    if (useUnifiedApiInTask) {
                        return await api.back({ timeout: TWITTER_TIMEOUTS.NAVIGATION });
                    }
                    const response = await page.goBack({
                        timeout: TWITTER_TIMEOUTS.NAVIGATION,
                        waitUntil: WAIT_UNTIL
                    }).catch(() => null);
                    return Boolean(response);
                });

                if (canGoBack) {
                    logger.info(`[api-twitterActivity] ${reason}: trying api.back()...`);

                    const xLoaded = await Promise.race([
                        api.waitVisible('[data-testid="AppTabBar_Home_Link"]').then(() => 'home').catch(() => null),
                        api.waitVisible('[role="main"]').then(() => 'main').catch(() => null),
                        api.wait(TWITTER_TIMEOUTS.NAVIGATION).then(() => null)
                    ]);

                    if (xLoaded) {
                        logger.info(`[api-twitterActivity] ${reason}: api.back() landed (${xLoaded})`);
                        return;
                    }

                    logger.info(`[api-twitterActivity] ${reason}: api.back() did not resolve, falling back...`);
                } else if (useUnifiedApiInTask) {
                    await withPageLock(async () => api.goBack());
                }
            } catch (backError) {
                logger.warn(`[api-twitterActivity] ${reason}: api.back() failed: ${backError.message}`);
            }
        }

        await withPageLock(async () => agent.navigateHome());
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
                                config: taskConfig,
                                useUnifiedApiInAgent: apiMigration.useUnifiedApiInAgent === true
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
                            await withPageLock(async () => api.emulateMedia({ colorScheme: theme }));

                            // Popup closer
                            if (!popupCloser) {
                                popupCloser = new PopupCloser(page, logger, {
                                    lock: withPageLock,
                                    signal: abortSignal,
                                    api,
                                    useUnifiedApiInUtilities: apiMigration.useUnifiedApiInUtilities === true
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

                            // Start idle simulation for human-like presence
                            const personaName = api.getPersonaName();
                            api.idle.start({
                                wiggle: true,
                                scroll: true,
                                frequency: 4000,
                                magnitude: personaName === 'glitchy' ? 8 : 3
                            });
                            logger.info(`[api-twitterActivity] Idle simulation started`);

                            // Warmup
                            const wakeUp = humanTiming.getWarmupDelay({
                                min: taskConfig.timing.warmup.min,
                                max: taskConfig.timing.warmup.max
                            });
                            logger.info(`[api-twitterActivity] Warm-up ${humanTiming.formatDuration(wakeUp)}...`);
                            await api.wait(wakeUp);

                            throwIfAborted();

                            // Referrer engine
                            const entryUrl = selectEntryPoint();
                            const entryName = entryUrl.replace('https://x.com/', '').replace('https://x.com', '') || 'home';
                            logger.info(`[api-twitterActivity] 🎲 Entry: ${entryName} → ${entryUrl}`);
                            logger.info(`[api-twitterActivity] Step 10: Starting simplified navigation...`);
                            const useUnifiedApiInUtilities = apiMigration.useUnifiedApiInUtilities === true;
                            const referrerEngine = new ReferrerEngine({
                                addUTM: true,
                                api,
                                useUnifiedApiInUtilities
                            });
                            const ctx = referrerEngine.generateContext(entryUrl);

                            if (useUnifiedApiInUtilities) {
                                await referrerEngine.navigate(page, entryUrl, ctx);
                            } else {
                                if (useUnifiedApiInTask) {
                                    await withPageLock(async () => api.setExtraHTTPHeaders({
                                        ...ctx.headers,
                                        'Sec-Fetch-Site': 'none',
                                        'Sec-Fetch-Mode': 'navigate'
                                    }));
                                } else {
                                    await withPageLock(async () => page.setExtraHTTPHeaders({
                                        ...ctx.headers,
                                        'Sec-Fetch-Site': 'none',
                                        'Sec-Fetch-Mode': 'navigate'
                                    }));
                                }

                                if (useUnifiedApiInTask) {
                                    await api.goto(entryUrl, {
                                        waitUntil: WAIT_UNTIL,
                                        timeout: PAGE_TIMEOUT_MS,
                                        resolveOnSelector: '[data-testid="AppTabBar_Home_Link"]',
                                        warmup: true,
                                        warmupMouse: true,
                                        warmupFakeRead: false,
                                        warmupPause: true
                                    });
                                } else {
                                    await page.goto(entryUrl, {
                                        waitUntil: WAIT_UNTIL,
                                        timeout: PAGE_TIMEOUT_MS
                                    });
                                }
                            }
                            logger.info(`[api-twitterActivity] Step 15: page.goto completed, starting page load detection...`);

                            // Simplified page load detection to isolate hanging issue
                            let xLoaded = null;
                            try {
                                logger.info(`[api-twitterActivity] Step 16: Starting basic element detection...`);
                                if (useUnifiedApiInTask) {
                                    const existsQuick = await Promise.race([
                                        api.exists('[data-testid="AppTabBar_Home_Link"]').then((exists) => exists ? 'home' : null),
                                        api.exists('[data-testid="loginButton"]').then((exists) => exists ? 'login' : null),
                                        api.exists('[role="main"]').then((exists) => exists ? 'main' : null),
                                        api.wait(500).then(() => null)
                                    ]);
                                    xLoaded = existsQuick || await Promise.race([
                                        api.waitVisible('[data-testid="AppTabBar_Home_Link"]', { timeout: 3000 }).then(() => 'home').catch(() => null),
                                        api.waitVisible('[data-testid="loginButton"]', { timeout: 3000 }).then(() => 'login').catch(() => null),
                                        api.waitVisible('[role="main"]', { timeout: 3000 }).then(() => 'main').catch(() => null),
                                        api.wait(5000).then(() => 'timeout')
                                    ]);
                                } else {
                                    xLoaded = await Promise.race([
                                        page.waitForSelector('[data-testid="AppTabBar_Home_Link"]', { state: 'visible', timeout: 3000 }).then(() => 'home').catch(() => null),
                                        page.waitForSelector('[data-testid="loginButton"]', { state: 'visible', timeout: 3000 }).then(() => 'login').catch(() => null),
                                        page.waitForSelector('[role="main"]', { state: 'visible', timeout: 3000 }).then(() => 'main').catch(() => null),
                                        page.waitForTimeout(5000).then(() => 'timeout')
                                    ]);
                                }
                                logger.info(`[api-twitterActivity] Step 17: Element detection completed: ${xLoaded}`);
                            } catch (raceError) {
                                logger.warn(`[api-twitterActivity] Page load detection failed: ${raceError.message}`);
                                xLoaded = 'error';
                            }

                            logger.info(`[api-twitterActivity] X.com loaded (${xLoaded || 'partial'})`);

                            // Network idle wait - reduced timeout for faster activity start
                            const idleTimeout = xLoaded && xLoaded !== 'timeout' && xLoaded !== 'error' ? 1000 : 3000;
                            logger.info(`[api-twitterActivity] Waiting for network (${idleTimeout}ms)...`);

                            try {
                                if (useUnifiedApiInTask) {
                                    await api.waitForLoadState('networkidle', { timeout: idleTimeout });
                                } else {
                                    await withPageLock(async () => page.waitForLoadState('networkidle', { timeout: idleTimeout }));
                                }
                                logger.info(`[api-twitterActivity] Network idle reached.`);
                            } catch (idleError) {
                                logger.warn(`[api-twitterActivity] Network idle timeout: ${idleError.message}`);
                                // Continue anyway - Twitter might still be loading but we can proceed
                            }

                            throwIfAborted();

                            // Reading simulation if not on home (with error handling)
                            let currentUrl;
                            try {
                                currentUrl = await api.getCurrentUrl();
                            } catch (urlError) {
                                logger.warn(`[api-twitterActivity] Failed to get current URL: ${urlError.message}`);
                                currentUrl = 'https://x.com/'; // Assume home
                            }
                            
                            const onHome = currentUrl.includes('/home') || currentUrl === 'https://x.com/' || currentUrl === 'https://x.com';
                            if (!onHome) {
                                const scrollDuration = mathUtils.randomInRange(5000, 10000);
                                const scrollDurationSec = (scrollDuration / 1000).toFixed(2);
                                logger.info(`[api-twitterActivity] 📖 Reading on ${entryName} for ${scrollDurationSec}s...`);

                                const scrollStartTime = Date.now();
                                while (Date.now() - scrollStartTime < scrollDuration) {
                                    if (useUnifiedApiInTask) {
                                        await api.scroll.read(null, {
                                            pauses: 1,
                                            scrollAmount: mathUtils.randomInRange(200, 600)
                                        });
                                    } else {
                                        const delta = mathUtils.randomInRange(200, 600);
                                        try {
                                            await page.mouse.wheel(0, delta);
                                        } catch (wheelError) {
                                            logger.warn(`[api-twitterActivity] CDP wheel failed: ${wheelError.message}, using JS scrollBy`);
                                            try {
                                                await page.evaluate((dy) => window.scrollBy(0, dy), delta);
                                            } catch (scrollError) {
                                                logger.warn(`[api-twitterActivity] JS scrollBy failed: ${scrollError.message}`);
                                            }
                                        }
                                    }
                                    
                                    // Add attention distractions during reading (with error handling)
                                    try {
                                        await api.maybeDistract(['[data-testid="sidebarColumn"] a', '[data-testid="trend"]', '[aria-label*="timeline"]']);
                                    } catch (distractError) {
                                        // Silently ignore distraction errors
                                    }
                                    await api.wait(mathUtils.randomInRange(200, 500));
                                }

                                logger.info(`[api-twitterActivity] ✅ Navigating to home...`);
                                try {
                                    await navigateHomePreferBack(withPageLock, 'entryReturnHome');
                                } catch (navError) {
                                    logger.warn(`[api-twitterActivity] Navigate home failed: ${navError.message}`);
                                    // Try direct navigation as fallback
                                    try {
                                        if (useUnifiedApiInTask) {
                                            await api.goto('https://x.com/home', { waitUntil: 'domcontentloaded' });
                                        } else {
                                            await withPageLock(async () => page.goto('https://x.com/home', { waitUntil: 'domcontentloaded' }));
                                        }
                                    } catch (fallbackError) {
                                        logger.warn(`[api-twitterActivity] Fallback navigation failed: ${fallbackError.message}`);
                                    }
                                }
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
                                        await navigateHomePreferBack(withPageLock, 'sessionRecoveryHome');
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
        } catch (closeError) {
            logger.warn(`[api-twitterActivity] Page close warning: ${closeError.message}`);
        }

        // Clear API context
        api.clearContext();

        const duration = (Number(process.hrtime.bigint() - startTime) / 1e9).toFixed(2);
        logger.info(`[api-twitterActivity] Done in ${duration}s`);
    }
}

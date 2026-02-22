/**
 * AI-Enhanced Twitter Activity Task using Unified API
 * Uses the new api/ modules for humanized interactions
 * @module tasks/api-twitterActivity
 */

import { api } from '../api/index.js';
import { AITwitterAgent } from '../utils/ai-twitterAgent.js';
import { profileManager } from '../utils/profileManager.js';
import { mathUtils } from '../utils/mathUtils.js';
import { ReferrerEngine } from '../utils/urlReferrer.js';
import metricsCollector from '../utils/metrics.js';
import { createLogger } from '../utils/logger.js';
import { loadAiTwitterActivityConfig } from '../utils/task-config-loader.js';
import PopupCloser from '../utils/popup-closer.js';

const TARGET_URL = 'https://x.com';
const DEFAULT_CYCLES = 20;
const DEFAULT_MIN_DURATION = 360;
const DEFAULT_MAX_DURATION = 600;

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
 * Uses unified api for all browser interactions
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

    // Set persona based on profile
    const resolveProfile = () => {
        const resolved = payload.profileId
            ? (profileManager.getById(payload.profileId) || profileManager.getStarter())
            : profileManager.getStarter();
        return resolved;
    };

    const profile = resolveProfile();
    if (profile) {
        await api.setPersona(profile.persona || 'casual');
        logger.info(`[api-twitterActivity] Persona: ${api.getPersonaName()}`);
    }

    // Load config
    let taskConfig;
    try {
        taskConfig = await loadAiTwitterActivityConfig(payload);
    } catch (initError) {
        logger.error(`[api-twitterActivity] Config load failed: ${initError.message}`);
        throw new Error(`Task initialization failed: ${initError.message}`);
    }

    // Start idle simulation
    api.idle.start({ wiggle: true, scroll: false, frequency: 5000 });

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
            Math.min(DEFAULT_MAX_DURATION * 1000, DEFAULT_MAX_DURATION * 1000)
        );

        await Promise.race([
            (async () => {
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

                // Set theme
                const theme = profile?.theme || 'dark';
                await withPageLock(async () => page.emulateMedia({ colorScheme: theme }));

                throwIfAborted();

                // Warmup before navigation using api
                logger.info(`[api-twitterActivity] Running warmup...`);
                await api.beforeNavigate(TARGET_URL, {
                    mouse: true,
                    fakeRead: Math.random() > 0.5,
                    pause: true
                });

                // Navigate using api
                const entryUrl = selectEntryPoint();
                const entryName = entryUrl.replace('https://x.com/', '').replace('https://x.com', '') || 'home';
                logger.info(`[api-twitterActivity] 🎲 Entry: ${entryName}`);

                await api.goto(entryUrl, {
                    warmup: false, // Already did warmup above
                    waitUntil: 'domcontentloaded'
                });

                // Wait for content using api
                await api.waitFor('[data-testid="AppTabBar_Home_Link"]').catch(() => {});
                await api.wait(3000);

                // Reading simulation using api
                const currentUrl = page.url();
                const onHome = currentUrl.includes('/home') || currentUrl === 'https://x.com/' || currentUrl === 'https://x.com';
                if (!onHome) {
                    logger.info(`[api-twitterActivity] 📖 Simulating reading...`);
                    await api.scroll.read('.article, [role="article"], [data-testid="cellInnerDiv"]', {
                        pauses: mathUtils.randomInRange(2, 4),
                        scrollAmount: mathUtils.randomInRange(200, 400)
                    });
                    await api.goto('https://x.com/home', { warmup: false });
                }

                throwIfAborted();

                // Check login using api
                logger.info(`[api-twitterActivity] Checking login...`);
                const isLoggedIn = await api.exists('[data-testid="AppTabBar_Home_Link"]');
                
                if (!isLoggedIn) {
                    logger.warn(`[api-twitterActivity] Not logged in, attempting recovery...`);
                    await api.recover();
                }

                // Run session
                const cycles = typeof payload.cycles === 'number' ? payload.cycles : DEFAULT_CYCLES;
                const minDuration = typeof payload.minDuration === 'number' ? payload.minDuration : DEFAULT_MIN_DURATION;
                const maxDuration = typeof payload.maxDuration === 'number' ? payload.maxDuration : DEFAULT_MAX_DURATION;

                logger.info(`[api-twitterActivity] Starting session (${cycles} cycles)...`);

                try {
                    await agent.runSession(cycles, minDuration, maxDuration, { abortSignal });
                } catch (sessionError) {
                    if (!abortSignal.aborted) {
                        logger.warn(`[api-twitterActivity] Session error: ${sessionError.message}`);
                        await api.recover();
                    }
                }

                logger.info(`[api-twitterActivity] Session completed`);

            })(),
            new Promise((_, reject) => {
                setTimeout(() => {
                    abortController.abort(new Error('Timeout'));
                    reject(new Error('Task timeout'));
                }, hardTimeoutMs);
            })
        ]);

    } catch (error) {
        logger.error(`[api-twitterActivity] Error: ${error.message}`);
    } finally {
        // Stop idle simulation
        api.idle.stop();

        if (hasAgent) {
            // Record metrics
            if (agentState.follows > 0) metricsCollector.recordSocialAction('follow', agentState.follows);
            if (agentState.likes > 0) metricsCollector.recordSocialAction('like', agentState.likes);
            if (agentState.retweets > 0) metricsCollector.recordSocialAction('retweet', agentState.retweets);
            if (agentState.tweets > 0) metricsCollector.recordSocialAction('tweet', agentState.tweets);

            const aiStats = getAIStats();
            if (aiStats) {
                logger.info(`[api-twitterActivity] AI Stats: ${JSON.stringify(aiStats)}`);
            }

            // Shutdown agent
            if (typeof agent.shutdown === 'function') {
                await agent.shutdown();
            }
        }

        // Cleanup
        try {
            if (page && !page.isClosed()) {
                await page.close();
            }
        } catch (closeError) {
            logger.warn(`[api-twitterActivity] Close warning: ${closeError.message}`);
        }

        api.clearContext();

        const duration = (Number(process.hrtime.bigint() - startTime) / 1e9).toFixed(2);
        logger.info(`[api-twitterActivity] Done in ${duration}s`);
    }
}

/**
 * @fileoverview Twitter Follow Task
 * @module tasks/twitterFollow.js
 */
import { createLogger } from '../utils/utils.js';
import { TwitterAgent } from '../utils/twitterAgent.js';
import { profileManager } from '../utils/profileManager.js';
import { mathUtils } from '../utils/mathUtils.js';
import { ReferrerEngine } from '../utils/urlReferrer.js';
import metricsCollector from '../utils/metrics.js';
import { api } from '../api/index.js';
import { takeScreenshot } from '../utils/screenshot.js';

// Helper: Extract username from tweet URL
function extractUsername(tweetUrl) {
    try {
        const url = new URL(tweetUrl);
        const pathParts = url.pathname.split('/').filter(p => p.length > 0);
        // URL format: /username/status/tweet_id
        if (pathParts.length >= 1) {
            return '@' + pathParts[0];
        }
    } catch (_e) {
        return '(unknown)';
    }
    return '(unknown)';
}

/**
 * Executes the Follow Task.
 * @param {object} page - The Playwright page instance.
 * @param {any} payload
 */
export default async function twitterFollowTask(page, payload) {
    // const startTime = process.hrtime.bigint();
    const browserInfo = payload.browserInfo || "unknown_profile";
    const logger = createLogger(`twitterFollowTask [${browserInfo}]`);
    const DEFAULT_TASK_TIMEOUT_MS = 3 * 60 * 1000;
    const taskTimeoutMs = payload.taskTimeoutMs || DEFAULT_TASK_TIMEOUT_MS;
    const TARGET_TWEET_URL = 'https://x.com/_nadiku/status/1998218314703852013';

    logger.info(`[twitterFollow] Initializing Entropy Agent... (Timeout: ${(taskTimeoutMs / 1000 / 60).toFixed(1)}m)`);

    let agent;
    let sessionStart;

    try {
        // Wrap execution in a Promise.race to enforce hard time limit
        await Promise.race([
            (async () => {
                // 1. Initialize Agent
                // Allow manual profile override if passed in payload, else use starter
                let profile;
                if (payload.profileId) {
                    try {
                        profile = profileManager.getById(payload.profileId);
                    } catch (_e) {
                        profile = profileManager.getStarter();
                    }
                } else {
                    profile = profileManager.getStarter();
                }

                agent = new TwitterAgent(page, profile, logger);
                sessionStart = agent.sessionStart;

                // Enforce Theme
                if (profile.theme) {
                    await api.emulateMedia({ colorScheme: profile.theme });
                }

                // 2. WARM-UP JITTER (Decouple browser launch from action)
                const wakeUpTime = mathUtils.randomInRange(2000, 8000);
                logger.info(`[Startup] Warming up (Human Jitter) for ${(wakeUpTime / 1000).toFixed(1)}s...`);
                await api.wait(wakeUpTime);


                // 3. Navigation with Advanced Referrer Engine
                logger.info(`[twitterFollow] Initializing Referrer Engine...`);

                const targetUrl = payload.targetUrl || payload.url || TARGET_TWEET_URL;

                if (!targetUrl || targetUrl.length < 5) {
                    logger.error(`[twitterFollow] No targetUrl provided in payload and TARGET_TWEET_URL is invalid.`);
                    return;
                }

                const engine = new ReferrerEngine({ addUTM: false });
                const ctx = engine.generateContext(targetUrl);
                logger.info(`[twitterFollow][Anti-Sybil] Engine Strategy: ${ctx.strategy}`);
                logger.info(`[twitterFollow][Anti-Sybil] Referrer: ${ctx.referrer || '(Direct Traffic - No Referrer)'}`);

                // Set Headers (Referer + Sec-Fetch-*)
                await api.setExtraHTTPHeaders(ctx.headers);

                // Navigate to target
                logger.info(`[twitterFollow] Navigating to Target Tweet: ${targetUrl}`);
                try {
                    await api.goto(ctx.targetWithParams, { waitUntil: 'domcontentloaded', timeout: 90000 });
                } catch (navError) {
                    logger.warn(`[twitterFollow] Navigation failed: ${navError.message}`);
                    if (navError.message.includes('ERR_TOO_MANY_REDIRECTS')) {
                        logger.error(`[twitterFollow] 🛑 Fatal: Infinite redirect loop detected on ${targetUrl}. Aborting task.`);
                        throw new Error('Fatal: ERR_TOO_MANY_REDIRECTS', { cause: navError });
                    }
                    logger.warn(`[twitterFollow] Retrying navigation without referrer headers...`);
                    await api.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
                }

                // Explicitly wait for the tweet to be visible
                try {
                    logger.info(`[twitterFollow] Waiting for tweet content to load...`);
                    await api.waitVisible('article[data-testid="tweet"]', { timeout: 60000 });
                } catch (e) {
                    logger.warn(`[twitterFollow] Timed out waiting for tweet selector. Page might be incomplete.`);
                    throw new Error('Fatal: Tweet selector timeout - likely stuck or no internet', { cause: e });
                }

                // 4. Simulate Reading (Tweet Thread)
                const originalProbs = { ...agent.config.probabilities };
                agent.config.probabilities = {
                    refresh: 0, profileDive: 0, tweetDive: 0, idle: 0.8,
                    likeTweetAfterDive: 0, bookmarkAfterDive: 0, followOnProfile: 0
                };

                const tweetReadTime = mathUtils.randomInRange(5000, 10000);
                logger.info(`[twitterFollow] Reading Tweet for ${(tweetReadTime / 1000).toFixed(1)}s...`);

                agent.config.timings.readingPhase = { mean: tweetReadTime, deviation: 1000 };
                await agent.simulateReading();

                // Restore config
                agent.config.probabilities = originalProbs;

                // 5. Click on Profile
                logger.info(`[twitterFollow] Finding and clicking profile...`);

                const targetUsername = extractUsername(targetUrl).toLowerCase();
                const safeUsername = targetUsername.replace('@', '');

                const handleSelector = `article[data-testid="tweet"] a[href="/${safeUsername}"]`;
                const avatarSelector = `article[data-testid="tweet"] [data-testid="Tweet-User-Avatar"]`;
                const fallbackSelector = 'article[data-testid="tweet"] div[data-testid="User-Name"] a[href^="/"]';

                let targetEl = page.locator(handleSelector).first();
                if (!await api.count(handleSelector)) {
                    targetEl = page.locator(fallbackSelector).first();
                }

                if (await api.visible(handleSelector) || await api.visible(fallbackSelector)) {
                    await agent.humanClick(targetEl, 'Profile Link (Handle/Name)');
                    await api.wait(3000); 
                }

                // Verification & Retry
                const currentUrl = await api.getCurrentUrl();
                if (currentUrl.includes('/status/')) {
                    logger.warn(`[twitterFollow] ⚠️ Navigation check: Still on status page. Retrying with Avatar...`);

                    const avatarEl = page.locator(avatarSelector).first();
                    if (await api.visible(avatarSelector)) {
                        await agent.humanClick(avatarEl, 'Profile Avatar');
                        await api.wait(3000);
                    }
                }

                // Final Verify
                const finalUrl = await api.getCurrentUrl();
                if (!finalUrl.includes('/status/')) {
                    await api.waitForLoadState('domcontentloaded');
                } else {
                    logger.warn(`[twitterFollow] 🛑 Failed to navigate to profile. Still on status page: ${finalUrl}`);
                }

                // 6. Simulate Reading on Profile
                logger.info(`[twitterFollow] Reading Profile...`);

                const probsBeforeProfile = { ...agent.config.probabilities };
                agent.config.probabilities = {
                    ...probsBeforeProfile,
                    refresh: 0, profileDive: 0, tweetDive: 0,
                    idle: 0.8
                };

                agent.config.timings.readingPhase = { mean: 15000, deviation: 5000 };
                await agent.simulateReading();

                // Restore
                agent.config.probabilities = probsBeforeProfile;


                // 7. Follow
                logger.info(`[twitterFollow] Executing follow action...`);
                const profileUrl = `https://x.com/${safeUsername}`;
                const followResult = await agent.robustFollow('[twitterFollow]', profileUrl);

                if (followResult.success && followResult.attempts > 0) {
                    const username = extractUsername(targetUrl);
                    logger.info(`[twitterFollow] ✅✅✅ Followed '\x1b[94m${username}\x1b[0m' Successfully ✅✅✅`);

                    metricsCollector.recordSocialAction('follow', 1);

                    const postFollowDelay = mathUtils.randomInRange(2000, 4000);
                    logger.info(`[twitterFollow] Lingering on profile for ${(postFollowDelay / 1000).toFixed(1)}s...`);
                    await api.wait(postFollowDelay);
                    
                    await takeScreenshot(page, `Follow-${username}`);
                } else if (followResult.fatal) {
                    throw new Error(`Fatal: Follow failed with critical error: ${followResult.reason}`);
                }


                // 8. Return Home & "Cool Down" Reading
                logger.info(`[twitterFollow] Navigating Home for cool-down...`);
                await agent.navigateHome();

                if (!await agent.checkLoginState()) {
                    logger.warn('[twitterFollow] ⚠️ Potential logout detected after task completion.');
                }

                agent.config.timings.readingPhase = { mean: 90000, deviation: 30000 };
                agent.config.probabilities.tweetDive = 0.1;

                await agent.simulateReading();

                logger.info(`[twitterFollow] Task completed.`);
            })(),
            new Promise((_, reject) => setTimeout(() => reject(new Error(`Strict Task Time Limit Exceeded (${(taskTimeoutMs / 1000).toFixed(0)}s)`)), taskTimeoutMs))
        ]);

    } catch (error) {
        if (error.message.includes('Target page, context or browser has been closed')) {
            logger.warn(`[twitterFollow] Task interrupted: Browser/Page closed (likely Ctrl+C).`);
        } else {
            logger.error(`[twitterFollow] Error: ${error.message}`, error);
        }
    } finally {
        if (sessionStart) {
            const duration = ((Date.now() - sessionStart) / 1000 / 60).toFixed(1);
            logger.info(`[Metrics] Task Finished. Duration: ${duration}m`);
        }

        try {
            if (page && !page.isClosed()) await page.close();
        } catch (closeError) {
            logger.warn(`[twitterFollow] Failed to close page: ${closeError.message}`);
        }
    }
}

/**
 * Applies anti-detect and humanization patches.
 * @param {object} page - The Playwright page instance. 
 * @param {object} logger 
 */
async function _applyHumanizationPatch(page, logger) {
    const { applyHumanizationPatch: sharedPatch } = await import('../utils/browserPatch.js');
    await sharedPatch(page, logger);
}

/**
 * @fileoverview Twitter Follow Task
 * @module tasks/twitterFollow.js
 */
import { takeScreenshot } from '../utils/screenshot.js';
// --- CONFIGURATION ---
const DEFAULT_TASK_TIMEOUT_MS = 3 * 60 * 1000; // 4 Minutes Hard Limit
const TARGET_TWEET_URL = 'https://x.com/_nadiku/status/1998218314703852013';

// Manual Referrer Override (optional, for testing specific sources)
// Set to '' to disable. When set, has 20% chance to be used instead of dynamic engine.
const MANUAL_REFERRER = ''; // Example: 'https://www.reddit.com/r/technology/'

import { createLogger } from '../utils/utils.js';
import { TwitterAgent } from '../utils/twitterAgent.js';
import { profileManager } from '../utils/profileManager.js';
import { mathUtils } from '../utils/mathUtils.js';
import { ReferrerEngine } from '../utils/urlReferrer.js';
import metricsCollector from '../utils/metrics.js';

// Helper: Extract username from tweet URL
function extractUsername(tweetUrl) {
    try {
        const url = new URL(tweetUrl);
        const pathParts = url.pathname.split('/').filter(p => p.length > 0);
        // URL format: /username/status/tweet_id
        if (pathParts.length >= 1) {
            return '@' + pathParts[0];
        }
    } catch (e) {
        return '(unknown)';
    }
    return '(unknown)';
}

/**
 * Executes the Follow Task.
 * @param {import('playwright').Page} page
 * @param {object} payload
 * @param {string} payload.browserInfo
 */
export default async function twitterFollowTask(page, payload) {
    const startTime = process.hrtime.bigint();
    const browserInfo = payload.browserInfo || "unknown_profile";
    const logger = createLogger(`twitterFollowTask [${browserInfo}]`);
    const taskTimeoutMs = payload.taskTimeoutMs || DEFAULT_TASK_TIMEOUT_MS;

    logger.info(`[twitterFollow] Initializing Entropy Agent... (Timeout: ${(taskTimeoutMs / 1000 / 60).toFixed(1)}m)`);

    let agent = null;

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
                    } catch (e) {
                        profile = profileManager.getStarter();
                    }
                } else {
                    profile = profileManager.getStarter();
                }

                agent = new TwitterAgent(page, profile, logger);

                // Enforce Theme
                if (profile.theme) {
                    await page.emulateMedia({ colorScheme: profile.theme });
                }

                // 2. Apply Humanization
                await applyHumanizationPatch(page, logger);

                // 3. WARM-UP JITTER (Decouple browser launch from action)
                const wakeUpTime = mathUtils.randomInRange(2000, 8000);
                logger.info(`[Startup] Warming up (Human Jitter) for ${(wakeUpTime / 1000).toFixed(1)}s...`);
                await page.waitForTimeout(wakeUpTime);


                // 4. Initial Login Check - SKIPPED to preserve Referrer Mechanism
                // We rely on the target page navigation to handle auth states naturally


                // 5. Navigation with Advanced Referrer Engine
                logger.info(`[twitterFollow] Initializing Referrer Engine...`);

                const targetUrl = payload.targetUrl || TARGET_TWEET_URL;

                if (!targetUrl || targetUrl.length < 5) {
                    logger.error(`[twitterFollow] No targetUrl provided in payload and TARGET_TWEET_URL is invalid.`);
                    return;
                }

                const engine = new ReferrerEngine({ addUTM: false });
                let ctx;

                // Manual Override Logic: 20% chance to use MANUAL_REFERRER if set
                if (MANUAL_REFERRER && MANUAL_REFERRER.length > 0 && Math.random() < 0.20) {
                    logger.info(`[twitterFollow][Anti-Sybil] Using Manual Referrer (20% chance): ${MANUAL_REFERRER}`);
                    ctx = {
                        strategy: 'manual_override',
                        referrer: MANUAL_REFERRER,
                        headers: {
                            'Referer': MANUAL_REFERRER,
                            'Sec-Fetch-Site': 'cross-site',
                            'Sec-Fetch-Mode': 'navigate',
                            'Sec-Fetch-User': '?1',
                            'Sec-Fetch-Dest': 'document'
                        },
                        targetWithParams: targetUrl
                    };
                } else {
                    // Use Dynamic Engine
                    ctx = engine.generateContext(targetUrl);
                    logger.info(`[twitterFollow][Anti-Sybil] Engine Strategy: ${ctx.strategy}`);
                    logger.info(`[twitterFollow][Anti-Sybil] Referrer: ${ctx.referrer || '(Direct Traffic - No Referrer)'}`);
                }

                // Set Headers (Referer + Sec-Fetch-*)
                await page.setExtraHTTPHeaders(ctx.headers);

                // Navigate to target
                logger.info(`[twitterFollow] Navigating to Target Tweet: ${targetUrl}`);
                try {
                    await page.goto(ctx.targetWithParams, { waitUntil: 'domcontentloaded', timeout: 90000 });
                } catch (navError) {
                    logger.warn(`[twitterFollow] Navigation failed: ${navError.message}`);
                    if (navError.message.includes('ERR_TOO_MANY_REDIRECTS')) {
                        logger.error(`[twitterFollow] 🛑 Fatal: Infinite redirect loop detected on ${targetUrl}. Aborting task.`);
                        throw new Error('Fatal: ERR_TOO_MANY_REDIRECTS');
                    }
                    // For other errors, maybe retry once or let general catch handle it?
                    // Let's try a fallback to direct goto without params if headers failed us
                    logger.warn(`[twitterFollow] Retrying navigation without referrer headers...`);
                    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
                }

                // Explicitly wait for the tweet to be visible
                try {
                    logger.info(`[twitterFollow] Waiting for tweet content to load...`);
                    await page.waitForSelector('article[data-testid="tweet"]', { state: 'visible', timeout: 60000 });
                } catch (e) {
                    logger.warn(`[twitterFollow] Timed out waiting for tweet selector. Page might be incomplete.`);
                    throw new Error('Fatal: Tweet selector timeout - likely stuck or no internet');
                }

                // 6. Simulate Reading (Tweet Thread)
                // Use agent.simulateReading() but force it to be purely reading (disable diving) by overriding probabilities temporarily
                const originalProbs = { ...agent.config.probabilities };
                agent.config.probabilities = {
                    refresh: 0, profileDive: 0, tweetDive: 0, idle: 0.8,
                    likeTweetAfterDive: 0, bookmarkAfterDive: 0, followOnProfile: 0
                };

                const tweetReadTime = mathUtils.randomInRange(5000, 10000);
                logger.info(`[twitterFollow] Reading Tweet for ${(tweetReadTime / 1000).toFixed(1)}s...`);

                // Manually trigger a read phase (hack: overwrite config timings slightly to match desired duration)
                agent.config.timings.readingPhase = { mean: tweetReadTime, deviation: 1000 };
                await agent.simulateReading();

                // Restore config
                agent.config.probabilities = originalProbs;

                // 7. Click on Profile
                logger.info(`[twitterFollow] Finding and clicking profile...`);

                // Extract names used for targeting
                const targetUsername = extractUsername(targetUrl).toLowerCase();
                const safeUsername = targetUsername.replace('@', '');

                // Potential Selectors
                const handleSelector = `article[data-testid="tweet"] a[href="/${safeUsername}"]`;
                const avatarSelector = `article[data-testid="tweet"] [data-testid="Tweet-User-Avatar"]`;
                const fallbackSelector = 'article[data-testid="tweet"] div[data-testid="User-Name"] a[href^="/"]';

                let navSuccess = false;

                // Attempt 1: Click specific Handle/Name link
                let targetEl = page.locator(handleSelector).first();
                if (!await targetEl.count()) {
                    targetEl = page.locator(fallbackSelector).first();
                }

                if (await targetEl.isVisible()) {
                    await agent.humanClick(targetEl, 'Profile Link (Handle/Name)');
                    await page.waitForTimeout(3000); // Wait for nav
                }

                // Verification & Retry
                if (page.url().includes('/status/')) {
                    logger.warn(`[twitterFollow] ⚠️ Navigation check: Still on status page. Retrying with Avatar...`);

                    // Attempt 2: Click Avatar
                    const avatarEl = page.locator(avatarSelector).first();
                    if (await avatarEl.isVisible()) {
                        await agent.humanClick(avatarEl, 'Profile Avatar');
                        await page.waitForTimeout(3000);
                    }
                }

                // Final Verify
                if (!page.url().includes('/status/')) {
                    // We likely navigated!
                    await page.waitForLoadState('domcontentloaded');
                    navSuccess = true;
                } else {
                    logger.warn(`[twitterFollow] 🛑 Failed to navigate to profile. Still on status page: ${page.url()}`);
                    // Depending on strictness, we might want to return here.
                    // But for now, let's see if the logic below can handle it (maybe we are already on profile?)
                    // Actually, if we are on status page, checking 'Already Following' might yield false positives from the tweet itself.
                    // But the user wants to proceed, so we continue but log heavily.
                }

                // 8. Simulate Reading on Profile
                logger.info(`[twitterFollow] Reading Profile...`);

                // Disable diving while reading profile to avoid navigating away
                const probsBeforeProfile = { ...agent.config.probabilities };
                agent.config.probabilities = {
                    ...probsBeforeProfile,
                    refresh: 0, profileDive: 0, tweetDive: 0,
                    idle: 0.8
                };

                agent.config.timings.readingPhase = { mean: 15000, deviation: 5000 }; // 15s avg
                await agent.simulateReading();

                // Restore
                agent.config.probabilities = probsBeforeProfile;


                // 9. Follow (Using Robust Follow from TwitterAgent)
                logger.info(`[twitterFollow] Executing follow action...`);
                // Construct explicit profile URL for robust reloads
                const profileUrl = `https://x.com/${safeUsername}`;
                const followResult = await agent.robustFollow('[twitterFollow]', profileUrl);

                if (followResult.success && followResult.attempts > 0) {
                    const username = extractUsername(targetUrl);
                    logger.info(`[twitterFollow] ✅✅✅ Followed '\x1b[94m${username}\x1b[0m' Successfully ✅✅✅`);

                    // Report follow to global metrics (safe: validates internally)
                    metricsCollector.recordSocialAction('follow', 1);

                    // Post-follow delay: Human "satisfaction" reaction time before leaving
                    const postFollowDelay = mathUtils.randomInRange(2000, 4000);
                    logger.info(`[twitterFollow] Lingering on profile for ${(postFollowDelay / 1000).toFixed(1)}s...`);
                    await page.waitForTimeout(postFollowDelay);
                    
                    await takeScreenshot(page, `Follow-${username}`);
                } else if (followResult.fatal) {
                    throw new Error(`Fatal: Follow failed with critical error: ${followResult.reason}`);
                }


                // 10. Return Home & "Cool Down" Reading
                logger.info(`[twitterFollow] Navigating Home for cool-down...`);
                await agent.navigateHome();

                // Check login state here as requested (verifying session health at end)
                if (!await agent.checkLoginState()) {
                    logger.warn('[twitterFollow] ⚠️ Potential logout detected after task completion.');
                }

                // Read feed for a bit (1-2 mins)
                agent.config.timings.readingPhase = { mean: 90000, deviation: 30000 };
                // Allow mild interaction (likes/retweets) during cool down
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
        if (agent && agent.sessionStart) {
            const duration = ((Date.now() - agent.sessionStart) / 1000 / 60).toFixed(1);
            logger.info(`[Metrics] Task Finished. Duration: ${duration}m`);
        }

        // Proper page closing
        try {
            if (page && !page.isClosed()) await page.close();
        } catch (closeError) {
            logger.warn(`[twitterFollow] Failed to close page: ${closeError.message}`);
        }
    }
}

/**
 * Applies anti-detect and humanization patches.
 * @param {import('playwright').Page} page 
 * @param {object} logger 
 */
async function applyHumanizationPatch(page, logger) {
    const { applyHumanizationPatch: sharedPatch } = await import('../utils/browserPatch.js');
    await sharedPatch(page, logger);
}

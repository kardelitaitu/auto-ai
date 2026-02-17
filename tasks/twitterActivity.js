/**
 * @fileoverview Stochastic Twitter Agent Task
 * @module tasks/twitterActivity.js
 */

import { createLogger } from '../utils/logger.js';
import { AITwitterAgent } from '../utils/ai-twitterAgent.js';
import { profileManager } from '../utils/profileManager.js';
import { mathUtils } from '../utils/mathUtils.js';
import { scrollRandom } from '../utils/scroll-helper.js';
import fs from 'fs';
import path from 'path';
import { ReferrerEngine } from '../utils/urlReferrer.js';
import metricsCollector from '../utils/metrics.js';
import { applyHumanizationPatch } from '../utils/browserPatch.js';

// Helper to extract username
const extractUsername = (url) => {
    try {
        const u = new URL(url);
        const parts = u.pathname.split('/').filter(Boolean);
        return parts[0];
    } catch { return 'unknown'; }
};

// Configuration
const CONFIG = {
    TWEET: {
        PROBABILITY: 0.10,
        HESITATION_MIN: 4000,
        HESITATION_MAX: 10000
    },
    FOLLOW: {
        PROBABILITY: 0.20
    },
    TIMINGS: {
        WARMUP_MIN: 2000,
        WARMUP_MAX: 15000,
        READ_ENTRY_MIN: 10000,
        READ_ENTRY_MAX: 20000,
        SCROLL_MIN: 300,
        SCROLL_MAX: 700,
        SCROLL_PAUSE_MIN: 1500,
        SCROLL_PAUSE_MAX: 4000
    }
};

/**
 * Executes the Activity Agent.
 * @param {object} page - The Playwright page instance.
 * @param {object} payload
 * @param {string} payload.browserInfo
 * @param {number} [payload.cycles=10] - Number of cycles to run
 * @param {string} [payload.profileId]
 * @param {number} [payload.minDuration]
 * @param {number} [payload.maxDuration]
 * @param {number} [payload.taskTimeoutMs]
 */
export default async function twitterActivityTask(page, payload) {
    const startTime = process.hrtime.bigint();
    const browserInfo = payload.browserInfo || "unknown_profile";
    const logger = createLogger(`twitterActivity.js [${browserInfo}]`);

    logger.info(`[twitterActivity.js] Initializing Entropy Agent...`);

    let profile = null;
    let agent = null;
    let finalResult;

    const startupJitter = Math.floor(Math.random() * 10000);
    logger.info(`[twitterActivity.js] Warming up for ${startupJitter}ms...`);
    await page.waitForTimeout(startupJitter);

    try {
        // Wrap execution in a Promise.race to enforce hard time limit
        // Default to 12 minutes if not specified, since activity tasks are long-running
        const DEFAULT_ACTIVITY_TIMEOUT = 12 * 60 * 1000;
        const hardTimeoutMs = payload.taskTimeoutMs || DEFAULT_ACTIVITY_TIMEOUT;

        await Promise.race([
            (async () => {
                const MAX_RETRIES = 2; // Total attempts: 1 initial + 2 retries
                let lastError = null;

                for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
                    try {
                        if (attempt > 0) {
                            logger.info(`[twitterActivity] 🔄 Retry Attempt ${attempt}/${MAX_RETRIES} starting in 5s...`);
                            await page.waitForTimeout(5000);
                            logger.info(`[twitterActivity] 🔄 Retrying now...`);
                        }

                        // 1. Assign Personality
                        if (payload.profileId) {
                            logger.info(`[twitterActivity.js] Manual profile override requested: ${payload.profileId}`);
                            try {
                                profile = profileManager.getById(payload.profileId);
                                logger.info(`[twitterActivity.js] Successfully loaded profile: ${payload.profileId}`);
                            } catch (error) {
                                logger.error(`[twitterActivity.js] Failed to load profile "${payload.profileId}": ${error.message}`);
                                logger.info(`[twitterActivity.js] Falling back to random starter profile.`);
                                profile = profileManager.getStarter();
                            }
                        } else {
                            profile = profileManager.getStarter();
                        }

                        // 2. Initialize Agent with Logger injection
                        agent = new AITwitterAgent(page, profile, logger);

                        // Enforce Theme early (before navigation)
                        const theme = profile.theme || 'dark';
                        if (theme) {
                            logger.info(`[Agent:${profile.id}] Enforcing theme: ${theme}`);
                            await page.emulateMedia({ colorScheme: theme });
                        }

                        // 3. Navigate & Organic Entry
                        await applyHumanizationPatch(page, logger);

                        // WARM-UP JITTER: Randomize start time to decouple Browser Launch from Nav Request
                        const wakeUpTime = mathUtils.randomInRange(CONFIG.TIMINGS.WARMUP_MIN, CONFIG.TIMINGS.WARMUP_MAX);
                        logger.info(`[Startup] Warming up (Human Jitter) for ${(wakeUpTime / 1000).toFixed(1)}s...`);
                        await page.waitForTimeout(wakeUpTime);

                        // ORGANIC ENTRY with Referrer & Conditional Follow
                        logger.info(`[twitterActivity] Configuring Organic Application Entry...`);

                        // Load URLs from file
                        let targetUrls = [];
                        try {
                            const urlPath = path.resolve('tasks/twitterActivityURL.txt');
                            if (fs.existsSync(urlPath)) {
                                targetUrls = fs.readFileSync(urlPath, 'utf8')
                                    .split('\n')
                                    .map(l => l.trim())
                                    .filter(l => l && !l.startsWith('#') && l.startsWith('http'));
                            }
                        } catch (e) {
                            logger.warn(`[twitterActivity] Failed to load URL list: ${e.message}`);
                        }

                        // Fallback if list is empty or missing
                        if (targetUrls.length === 0) {
                            logger.warn(`[twitterActivity] No valid URLs found in settings. Using default home fallback.`);
                            targetUrls = ['https://x.com/home', 'https://x.com/explore'];
                        }

                        const targetUrl = mathUtils.sample(targetUrls);
                        const username = extractUsername(targetUrl);

                        // Initialize Referrer Engine
                        const referrerEngine = new ReferrerEngine({ addUTM: true });
                        const ctx = referrerEngine.generateContext(targetUrl);

                        logger.info(`[twitterActivity] Entry Target: ${targetUrl}`);
                        logger.info(`[twitterActivity][referrerEngine] Strategy: ${ctx.strategy} | Referrer: ${ctx.referrer || '(Direct)'}`);

                        // Execute Navigation
                        await page.setExtraHTTPHeaders(ctx.headers);
                        try {
                            if (ctx.referrer && ctx.strategy !== 'direct') {
                                await referrerEngine.navigate(page, targetUrl, ctx);
                            } else {
                                await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
                            }
                        } catch (e) {
                            logger.warn(`[twitterActivity] Navigation failed: ${e.message}. Fallback to direct goto.`);
                            await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
                        }

                        // Only enforce 'For You' if we actually landed on a timeline that supports it
                        if (targetUrl.includes('home') || targetUrl.includes('explore') || targetUrl === 'https://x.com/') {
                            await agent.ensureForYouTab();
                        } else {
                            // Simulate Reading (10-20s) - STRICTLY SCROLL ONLY
                            const readTime = mathUtils.randomInRange(CONFIG.TIMINGS.READ_ENTRY_MIN, CONFIG.TIMINGS.READ_ENTRY_MAX);
                            logger.info(`[twitterActivity] Reading Entry Page for ${(readTime / 1000).toFixed(1)}s (Scroll Only)...`);

                            const startTimeRead = Date.now();
                            while (Date.now() - startTimeRead < readTime) {
                                // Random Scroll Down
                                const distance = mathUtils.randomInRange(CONFIG.TIMINGS.SCROLL_MIN, CONFIG.TIMINGS.SCROLL_MAX);
                                await scrollRandom(page, distance, distance);

                                // Random Pause
                                const pause = mathUtils.randomInRange(CONFIG.TIMINGS.SCROLL_PAUSE_MIN, CONFIG.TIMINGS.SCROLL_PAUSE_MAX);
                                await page.waitForTimeout(pause);
                            }

                            // Quick Scroll Top for Follow visibility
                            logger.info(`[twitterActivity] Reading done. Scrolling to top for actions...`);
                            await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
                            await page.waitForTimeout(mathUtils.randomInRange(1000, 2000));

                            // Conditional Follow (20% Chance)
                            if (mathUtils.roll(CONFIG.FOLLOW.PROBABILITY)) {
                                logger.info(`[twitterActivity] 🎲 Opportunity: Decided to follow @${username} (${(CONFIG.FOLLOW.PROBABILITY * 100).toFixed(0)}% chance)`);
                                logger.info(`[twitterActivity] Checking Follow status for @${username}...`);

                                const unfollowBtnSelector = '[data-testid$="-unfollow"]';
                                const followBtnSelector = '[data-testid$="-follow"]';

                                // Check 1: Already Following?
                                const unfollowBtn = page.locator(unfollowBtnSelector).first();
                                if (await unfollowBtn.isVisible()) {
                                    logger.info(`[twitterActivity] ✅ Already followed @${username}`);
                                } else {
                                    // Check 2: Try to find Follow button
                                    const followBtn = page.locator(followBtnSelector).first();
                                    if (await followBtn.isVisible()) {
                                        const btnText = (await followBtn.textContent()).toLowerCase();

                                        if (btnText.includes('following')) {
                                            logger.info(`[twitterActivity] ✅ Already followed @${username} (Text Check)`);
                                        } else if (btnText.includes('follow')) {
                                            // Action: Follow
                                            logger.info(`[twitterActivity] Clicking Follow button for @${username}...`);
                                            try {
                                                await agent.humanClick(followBtn, 'Follow Button');
                                                await page.waitForTimeout(mathUtils.randomInRange(2000, 5000));

                                                // Verify
                                                const isNowFollowing = (await unfollowBtn.isVisible().catch(() => false)) ||
                                                    (await followBtn.textContent().catch(() => '')).toLowerCase().includes('following');

                                                if (isNowFollowing) {
                                                    agent.state.follows++;
                                                    logger.info(`[twitterActivity] ✅ Success following @${username}`);
                                                } else {
                                                    logger.warn(`[twitterActivity] Follow click registered but status didn't update.`);
                                                }
                                            } catch (e) {
                                                logger.warn(`[twitterActivity] Follow interaction failed: ${e.message}`);
                                            }
                                        }
                                    } else {
                                        logger.info(`[twitterActivity] Follow button not found on this page.`);
                                    }
                                }
                            } else {
                                logger.info(`[twitterActivity] Skipping follow (Rolled > ${(CONFIG.FOLLOW.PROBABILITY * 100).toFixed(0)}%).`);
                            }

                            // Move to Home Feed
                            logger.info(`[twitterActivity] Entry phase complete. Proceeding to Home Feed...`);
                            await agent.navigateHome();
                        }

                        // Hesitation before decision
                        const hesitation = mathUtils.randomInRange(CONFIG.TWEET.HESITATION_MIN, CONFIG.TWEET.HESITATION_MAX);
                        logger.info(`[twitterActivity] 🤔 Hesitating for ${(hesitation / 1000).toFixed(1)}s before tweet decision...`);
                        await page.waitForTimeout(hesitation);

                        if (mathUtils.roll(CONFIG.TWEET.PROBABILITY)) {
                            logger.info(`[twitterActivity] 🎲 Opportunity: Decided to post a tweet (${(CONFIG.TWEET.PROBABILITY * 100).toFixed(0)}% chance)`);

                            let tweetLines = [];
                            const tweetPath = path.resolve('tasks/twitterActivityTweet.txt');
                            try {
                                if (fs.existsSync(tweetPath)) {
                                    tweetLines = fs.readFileSync(tweetPath, 'utf8')
                                        .split('\n')
                                        .map(l => l.trim())
                                        .filter(l => l && !l.startsWith('#'));
                                }
                            } catch (e) {
                                logger.warn(`[twitterActivity] Failed to load tweet list: ${e.message}`);
                            }

                            if (tweetLines.length > 0) {
                                const tweetContent = mathUtils.sample(tweetLines);

                                // CONSUME TWEET: Remove from file immediately (Compact Delete)
                                try {
                                    const remainingLines = tweetLines.filter(line => line.trim() !== tweetContent.trim());
                                    fs.writeFileSync(tweetPath, remainingLines.join('\n'), 'utf8');
                                    logger.info(`[twitterActivity] 🗑️ Consumed tweet: Removed from source file.`);
                                } catch (writeErr) {
                                    logger.warn(`[twitterActivity] Failed to remove tweet from file: ${writeErr.message}`);
                                }

                                // Add a space to prevent hashtag UI issues
                                await agent.postTweet(tweetContent + " ");
                            } else {
                                logger.warn(`[twitterActivity] No tweet content available.`);
                            }
                        } else {
                            logger.info(`[twitterActivity][postTweet] 🎲 Skipping tweet post (Rolled > ${(CONFIG.TWEET.PROBABILITY * 100).toFixed(0)}%).`);
                        }

                        // 4. Run Session (Respects internal soft timeouts min/max)
                        const cycles = typeof payload.cycles === 'number' ? payload.cycles : Math.floor(Math.random() * 16) + 10;
                        const minDuration = typeof payload.minDuration === 'number' ? payload.minDuration : 600;
                        const maxDuration = typeof payload.maxDuration === 'number' ? payload.maxDuration : 900;

                        await agent.runSession(cycles, minDuration, maxDuration);

                        logger.info(`[twitterActivity] Task completed successfully`);
                        return; // SUCCESS - Exit function (and loop)

                    } catch (innerError) {
                        lastError = innerError;
                        logger.warn(`[twitterActivity] ⚠️ Attempt ${attempt + 1} failed: ${innerError.message}`);

                        // If it's the last attempt, don't swallow the error here (it will be thrown after loop)
                        if (attempt === MAX_RETRIES) {
                            logger.error(`[twitterActivity] ❌ All ${MAX_RETRIES + 1} attempts failed.`);
                        }
                    }
                }

                // If we got here, all retries failed
                if (lastError) {
                    throw lastError;
                }
            })(),
            new Promise((_, reject) => setTimeout(() => reject(new Error(`Strict Task Time Limit Exceeded (${(hardTimeoutMs / 1000 / 60).toFixed(1)}m)`)), hardTimeoutMs))
        ]);

    } catch (error) {
        if (error.message.includes('Target page, context or browser has been closed')) {
            logger.warn(`[twitterActivity] Task interrupted: Browser/Page closed (likely Ctrl+C).`);
        } else {
            logger.error(`[twitterActivity] ### CRITICAL ERROR: ${error?.message || error}`, error);
        }
    } finally {
        // Report all social actions to global metrics (safe: validates internally)
        if (agent) {
            const s = (agent && typeof agent === 'object' && agent['state']) ? agent['state'] : {};
            if ((s.follows || 0) > 0) metricsCollector.recordSocialAction('follow', s.follows || 0);
            if ((s.likes || 0) > 0) metricsCollector.recordSocialAction('like', s.likes || 0);
            if ((s.retweets || 0) > 0) metricsCollector.recordSocialAction('retweet', s.retweets || 0);
            if ((s.tweets || 0) > 0) metricsCollector.recordSocialAction('tweet', s.tweets || 0);

            const sessionStart = (agent && typeof agent === 'object' && agent['sessionStart']) ? agent['sessionStart'] : Date.now();
            const duration = ((Date.now() - sessionStart) / 1000 / 60).toFixed(1);
            logger.info(`[Metrics] Task Finished. Duration: ${duration}m`);
            logger.info(`[Metrics] Engagements: Likes=${s.likes || 0} | Follows=${s.follows || 0} | Retweets=${s.retweets || 0} | Tweets=${s.tweets || 0} | Errors=${s.consecutiveLoginFailures || 0}`);
        }
        logger.info(`[twitterActivity] --- Reached FINALLY block ---`);
        
        try {
            if (!page) {
                logger.debug(`[twitterActivity.js] Page object is null/undefined. Nothing to close.`);
            } else {
                try {
                    const isClosed = page.isClosed();
                    if (!isClosed) {
                        logger.debug(`[twitterActivity.js] Attempting page.close()...`);
                        await page.close();
                        logger.debug(`[twitterActivity.js] page.close() completed successfully.`);
                    }
                } catch (checkError) {
                    logger.debug(`[twitterActivity.js] Page state check failed: ${checkError.message}`);
                }
            }
        } catch (closeError) {
            const errorMsg = closeError?.message || String(closeError);
            if (!errorMsg.includes('Target closed') && !errorMsg.includes('Protocol error')) {
                logger.error(`[twitterActivity.js] Unexpected error closing page: ${errorMsg}`);
            }
        }

        const endTime = process.hrtime.bigint();
        const durationInSeconds = (Number(endTime - startTime) / 1_000_000_000).toFixed(2);
        logger.info(`[twitterActivity.js] Finished task. Task duration: ${durationInSeconds} seconds.`);

        const m = (agent && typeof agent === 'object' && agent['state']) ? agent['state'] : {};
        const profileIdValue = (profile && typeof profile === 'object' && profile['id']) ? profile['id'] : 'unknown';
        finalResult = {
            status: 'success',
            profileId: profileIdValue,
            durationSeconds: parseFloat(durationInSeconds),
            metrics: {
                likes: m.likes || 0,
                follows: m.follows || 0,
                retweets: m.retweets || 0,
                engagements: m.engagements || 0
            }
        };
    }
    return finalResult;
}

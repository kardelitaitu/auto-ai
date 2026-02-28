/**
 * @fileoverview Twitter Tweet Task
 * @module tasks/twitterTweet.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createLogger } from '../utils/utils.js';
import { TwitterAgent } from '../utils/twitterAgent.js';
import { profileManager } from '../utils/profileManager.js';
import { mathUtils } from '../utils/mathUtils.js';
import metricsCollector from '../utils/metrics.js';
import { api } from '../api/index.js';
import { takeScreenshot } from '../utils/screenshot.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- CONFIGURATION ---
const TWEET_SOURCE_FILE = path.join(__dirname, 'twitterTweet.txt');
const DEFAULT_TASK_TIMEOUT_MS = 6 * 60 * 1000; // 6 Minutes (Robustness takes time)

/**
 * Executes the Tweet Task.
 * @param {object} page - The Playwright page instance.
 * @param {object} payload
 * @param {string} payload.browserInfo
 * @param {string} [payload.profileId]
 * @param {number} [payload.taskTimeoutMs]
 */
export default async function twitterTweetTask(page, payload) {
    const _startTime = process.hrtime.bigint();
    const browserInfo = payload.browserInfo || "unknown_profile";
    const logger = createLogger(`twitterTweet [${browserInfo}]`);
    const taskTimeoutMs = payload.taskTimeoutMs || DEFAULT_TASK_TIMEOUT_MS;

    logger.info(`[twitterTweet] Initializing Entropy Agent... (Timeout: ${(taskTimeoutMs / 1000 / 60).toFixed(1)}m)`);

    let agent = null;

    try {
        await Promise.race([
            (async () => {
                // 1. Initialize Agent
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

                if (profile.theme) {
                    await api.emulateMedia({ colorScheme: profile.theme });
                }

                // 2. Apply Humanization
                await applyHumanizationPatch(page, logger);

                // 3. Navigate Home
                logger.info(`[twitterTweet] Navigating Home...`);
                await agent.navigateHome();

                // 4. Warm-up Reading (30-45s)
                logger.info(`[twitterTweet] Warm-up reading (30-45s)...`);
                agent.config.timings.readingPhase = { mean: 37500, deviation: 5000 }; // ~37.5s

                // Override probs to ensure just reading/idle
                const originalProbs = { ...agent.config.probabilities };
                agent.config.probabilities = {
                    refresh: 0.1, profileDive: 0.1, tweetDive: 0.1, idle: 0.7,
                    likeTweetAfterDive: 0, bookmarkAfterDive: 0, followOnProfile: 0
                };

                await agent.simulateReading();

                agent.config.probabilities = originalProbs; // Restore

                // 5. Prepare Tweet Content
                logger.info(`[twitterTweet] Reading tweet content...`);
                let tweetLine;
                try {
                    if (!fs.existsSync(TWEET_SOURCE_FILE)) {
                        throw new Error(`Source file not found: ${TWEET_SOURCE_FILE}`);
                    }
                    const content = fs.readFileSync(TWEET_SOURCE_FILE, 'utf-8');
                    const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);

                    if (lines.length === 0) {
                        throw new Error(`Source file is empty: ${TWEET_SOURCE_FILE}`);
                    }

                    tweetLine = lines[0]; // Pick first line
                    const remainingLines = lines.slice(1);

                    // Decode multi-line tweets (convert \\n to actual newlines)
                    const originalLine = tweetLine;
                    tweetLine = tweetLine.replace(/\\n/g, '\n');
                    const lineBreaks = (tweetLine.match(/\n/g) || []).length;

                    if (lineBreaks > 0) {
                        logger.info(`[twitterTweet] Decoded multi-line tweet with ${lineBreaks} line break(s).`);
                    }

                    // Write back remaining
                    fs.writeFileSync(TWEET_SOURCE_FILE, remainingLines.join('\n'), 'utf-8');
                    logger.info(`[twitterTweet] Picked tweet: "${originalLine.substring(0, 30)}..." (Remaining: ${remainingLines.length})`);

                } catch (_e) {
                    logger.error(`[twitterTweet] Failed to read/write tweet file: ${_e.message}`);
                    throw _e;
                }

                // Safety Check before composing
                await agent.checkAndHandleSoftError();

                // 6. Open Composer (Robust Retry Loop)
                logger.info(`[twitterTweet] Opening Tweet Composer...`);

                // Selectors
                const sideNavTweetBtn = 'a[data-testid="SideNav_NewTweet_Button"]';
                const inlineComposeInput = 'div[data-testid="tweetTextarea_0"]'; // Output area
                const postBtn = 'button[data-testid="tweetButton"]';

                let composerOpen = false;
                const COMPOSER_RETRIES = 3;

                for (let i = 1; i <= COMPOSER_RETRIES; i++) {
                    logger.info(`[twitterTweet] Attempt ${i}/${COMPOSER_RETRIES} to open composer...`);

                    // A. Check failure state (Soft Error)
                    if (await agent.checkAndHandleSoftError()) {
                        await page.waitForTimeout(3000); // Wait for potential reload
                    }

                    // B. Attempt to Open
                    // Strategy 1: Side Nav Button
                    // We re-query the button each loop in case of page reload/DOM refresh
                    const composeBtn = page.locator(sideNavTweetBtn).first();
                    if (await composeBtn.isVisible()) {
                        await agent.humanClick(composeBtn, 'SideNav Tweet Button');
                    } else {
                        // Strategy 2: Keyboard Shortcut
                        logger.info(`[twitterTweet] Side button not found. Using shortcut 'n'...`);
                        await page.keyboard.press('n');
                    }

                    // C. Verify Open (Wait for Editor)
                    try {
                        const editor = page.locator(inlineComposeInput).first();
                        // Wait up to 8s for it to appear
                        await editor.waitFor({ state: 'visible', timeout: 8000 });

                        // Extra verification: Is it truly visible/interactive?
                        if (await editor.isVisible()) {
                            logger.info(`[twitterTweet] Composer verified open.`);
                            composerOpen = true;
                            break;
                        }
                    } catch (_e) {
                        logger.warn(`[twitterTweet] Composer did not open on attempt ${i}. Retrying...`);
                    }

                    // Backoff before retry
                    await page.waitForTimeout(2000);
                }

                if (!composerOpen) {
                    throw new Error('Fatal: Failed to open tweet composer after multiple attempts.');
                }

                // 7. Type Tweet (Strict)
                logger.info(`[twitterTweet] Typing tweet...`);
                const editor = page.locator(inlineComposeInput).first();

                // Final sanity check before typing
                if (!await editor.isVisible()) {
                    throw new Error('Strict Check: Editor visibility lost before typing.');
                }

                await agent.humanClick(editor, 'Tweet Editor'); // Focus
                await page.waitForTimeout(500);

                // Type with human speed
                await page.keyboard.type(tweetLine, { delay: mathUtils.randomInRange(50, 150) });

                // Add Space
                await page.keyboard.type(' ', { delay: mathUtils.randomInRange(100, 200) });

                await page.waitForTimeout(mathUtils.randomInRange(1000, 3000)); // Review pause

                // 8. Click Post (Robust Retry Loop)
                logger.info(`[twitterTweet] Posting...`);
                let posted = false;

                for (let attempt = 1; attempt <= 3; attempt++) {
                    // Check for soft error *before* clicking post
                    await agent.checkAndHandleSoftError();

                    const btn = page.locator(postBtn).first();
                    if (await btn.isVisible()) {
                        // WAITING FOR ENABLED STATE
                        // Sometimes button stays disabled for a split second while validation runs
                        if (await btn.isDisabled()) {
                            logger.info(`[twitterTweet] Post button disabled. Waiting for validation...`);
                            // Wait up to 5s for it to become enabled
                            try {
                                await page.waitForSelector(postBtn, { timeout: 5000 }).catch((_e) => null);
                            } catch (_e) { void _e; }

                            // If still disabled, maybe content issue?
                            if (await btn.isDisabled()) {
                                logger.warn(`[twitterTweet] Post button stuck disabled. Tweaking content...`);
                                await page.keyboard.type('.');
                                await page.waitForTimeout(1000);
                            }
                        }

                        // Use Human Click (which handles scrolling/focus)
                        if (await btn.isEnabled()) {
                            await agent.humanClick(btn, 'Post Button');

                            // Wait for potential error or success
                            await page.waitForTimeout(2000);

                            // Check soft error *immediately* after click
                            if (await agent.checkAndHandleSoftError()) {
                                logger.error(`[twitterTweet] Soft error happened during post click.`);
                                throw new Error('Soft error interrupted posting.');
                            }

                            // If button is gone, we likely succeeded
                            if (!await btn.isVisible()) {
                                metricsCollector.recordSocialAction('tweet', 1); // Record Metric
                                logger.info(`[twitterTweet] ✅ Tweet Posted! (Button disappeared)`);
                                await takeScreenshot(page, `Tweet-Posted`);
                                posted = true;
                                break;
                            } else {
                                logger.warn(`[twitterTweet] Post button still visible after click. Retrying...`);
                            }
                        } else {
                            logger.warn(`[twitterTweet] Post button still disabled on attempt ${attempt}.`);
                        }
                    } else {
                        if (attempt === 1) logger.warn('Post button not visible initially.');
                    }

                    await page.waitForTimeout(2000);
                }

                if (!posted) {
                    logger.warn(`[twitterTweet] ⚠️ Failed to verify post. Button might be stuck or network lag.`);
                    // We don't throw to allow cool-down to proceed, but we don't record metric.
                }

                // Wait for modal to close / tweet to post
                await page.waitForTimeout(mathUtils.randomInRange(3000, 5000));

                // 9. Cool-down Reading (1-2 mins)
                logger.info(`[twitterTweet] Cool-down reading (1-2 mins)...`);
                agent.config.timings.readingPhase = { mean: 90000, deviation: 20000 }; // ~1.5m
                await agent.simulateReading();

                logger.info(`[twitterTweet] Task completed.`);

            })(),
            new Promise((_, reject) => setTimeout(() => reject(new Error(`Strict Task Time Limit Exceeded (${(taskTimeoutMs / 1000).toFixed(0)}s)`)), taskTimeoutMs))
        ]);

    } catch (error) {
        if (error.message.includes('Target page, context or browser has been closed')) {
            logger.warn(`[twitterTweet] Task interrupted: Browser/Page closed (likely Ctrl+C).`);
        } else {
            logger.error(`[twitterTweet] Error: ${error.message}`, error);
        }
    } finally {
        const sessionStart = (agent && typeof agent === 'object' && agent['sessionStart']) ? agent['sessionStart'] : null;
        if (sessionStart) {
            const duration = ((Date.now() - sessionStart) / 1000 / 60).toFixed(1);
            logger.info(`[Metrics] Task Finished. Duration: ${duration}m`);
        }
        try {
            if (page && !page.isClosed()) await page.close();
        } catch (closeError) {
            logger.warn(`[twitterTweet] Failed to close page: ${closeError.message}`);
        }
    }
}

/**
 * Applies anti-detect and humanization patches.
 * @param {object} page - The Playwright page instance. 
 * @param {object} logger 
 */
async function applyHumanizationPatch(page, logger) {
    const { applyHumanizationPatch: sharedPatch } = await import('../utils/browserPatch.js');
    await sharedPatch(page, logger);
}

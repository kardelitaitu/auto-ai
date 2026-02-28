/**
 * @fileoverview Twitter Follow Task using Unified API
 * @module tasks/api-twitterFollow
 */

import { api } from '../api/index.js';
import { profileManager } from '../utils/profileManager.js';
import { mathUtils } from '../utils/mathUtils.js';
import metricsCollector from '../utils/metrics.js';
import { createLogger } from '../utils/logger.js';
import { takeScreenshot } from '../utils/screenshot.js';

// --- CONFIGURATION ---
const DEFAULT_TASK_TIMEOUT_MS = 6 * 60 * 1000; // 6 Minutes Hard Limit
const TARGET_TWEET_URL = 'https://x.com/_nadiku/status/1998242442490511816';

/**
 * Extract username from tweet URL or profile URL.
 */
function extractUsername(urlStr) {
    try {
        const url = new URL(urlStr);
        const pathParts = url.pathname.split('/').filter(p => p.length > 0);
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
 * @param {object} payload
 */
export default async function apiTwitterFollowTask(page, payload) {
    const browserInfo = payload.browserInfo || "unknown_profile";
    const logger = createLogger(`api-twitterFollow [${browserInfo}]`);
    const taskTimeoutMs = payload.taskTimeoutMs || DEFAULT_TASK_TIMEOUT_MS;

    const targetUrl = payload.targetUrl || payload.url || TARGET_TWEET_URL;
    const username = extractUsername(targetUrl);

    logger.info(`[api-twitterFollow] Starting Unified API Follow Task for ${username}...`);

    try {
        await Promise.race([
            (async () => {
                // 1. Initialize API Context
                await api.init(page, { logger });
                // Note: Page context should be set via orchestrator's api.withPage()
                // or use: await api.withPage(page, async () => { ... }) for standalone

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

                const personaName = profile.persona || 'casual';
                await api.setPersona(personaName);
                logger.info(`[api-twitterFollow] Using persona: ${personaName}`);

                if (profile.theme) {
                    await api.emulateMedia({ colorScheme: profile.theme });
                }

                // 2. Navigation with Warmup
                logger.info(`[api-twitterFollow] Navigating to target: ${targetUrl}`);
                await api.goto(targetUrl, {
                    waitUntil: 'domcontentloaded',
                    warmup: true,
                    warmupMouse: true,
                    warmupPause: true
                });

                // 3. Warm-up Reading (15-30s)
                logger.info(`[api-twitterFollow] Warm-up reading...`);
                const warmupTime = mathUtils.randomInRange(15000, 30000);
                const startTime = Date.now();
                while (Date.now() - startTime < warmupTime) {
                    await api.scroll.read('body', { pauses: 1 });
                    await api.think(mathUtils.randomInRange(2000, 5000));
                }

                // 4. Robust Follow Logic
                const followBtnSelector = 'div[data-testid="placementTracking"] [data-testid$="-follow"], div[role="button"][data-testid$="-follow"]';
                const unfollowBtnSelector = '[data-testid$="-unfollow"]';

                let success = false;
                const maxAttempts = 3;

                for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                    logger.info(`[api-twitterFollow] Attempt ${attempt}/${maxAttempts}...`);

                    // Pre-check: Already following?
                    if (await api.visible(unfollowBtnSelector)) {
                        logger.info(`[api-twitterFollow] ✅ Already following ${username}.`);
                        success = true;
                        break;
                    }

                    // Pre-check: Button text
                    const followBtn = page.locator(followBtnSelector).first();
                    if (await followBtn.isVisible()) {
                        const text = (await followBtn.textContent() || '').toLowerCase();
                        if (text.includes('following') || text.includes('pending')) {
                            logger.info(`[api-twitterFollow] ✅ Already following ${username} (state: ${text}).`);
                            success = true;
                            break;
                        }
                    }

                    // Click Follow
                    logger.info(`[api-twitterFollow] Clicking Follow button...`);
                    const clickResult = await api.click(followBtnSelector, {
                        recovery: true,
                        hoverBeforeClick: true
                    });

                    if (clickResult.success) {
                        // Polling verification
                        logger.info(`[api-twitterFollow] Verifying state change...`);
                        let verified = false;
                        for (let p = 0; p < 5; p++) {
                            await api.think(2000);
                            if (await api.visible(unfollowBtnSelector)) {
                                verified = true;
                                break;
                            }
                            const text = (await followBtn.textContent().catch(() => '') || '').toLowerCase();
                            if (text.includes('following') || text.includes('pending')) {
                                verified = true;
                                break;
                            }
                        }

                        if (verified) {
                            logger.info(`[api-twitterFollow] ✅ Successfully followed ${username}!`);
                            metricsCollector.recordSocialAction('follow', 1);
                            await takeScreenshot(page, `api-follow-success-${username}`);
                            success = true;
                            break;
                        } else {
                            logger.warn(`[api-twitterFollow] Verification failed on attempt ${attempt}.`);
                        }
                    } else {
                        logger.warn(`[api-twitterFollow] Click failed on attempt ${attempt}.`);
                    }

                    // Backoff before retry or reload
                    if (attempt < maxAttempts) {
                        if (attempt === 2) {
                            logger.info(`[api-twitterFollow] 🔄 Reloading page...`);
                            await api.reload({ waitUntil: 'domcontentloaded' });
                            await api.think(mathUtils.randomInRange(5000, 10000));
                        } else {
                            await api.think(mathUtils.randomInRange(3000, 8000));
                        }
                    }
                }

                if (!success) {
                    throw new Error(`Failed to follow ${username} after ${maxAttempts} attempts.`);
                }

                // 5. Cool-down Reading (1 min)
                logger.info(`[api-twitterFollow] Cool-down reading...`);
                const cooldownTime = 60000;
                const cdStart = Date.now();
                while (Date.now() - cdStart < cooldownTime) {
                    await api.scroll.read('body', { pauses: 1 });
                    await api.think(mathUtils.randomInRange(3000, 8000));
                }

                logger.info(`[api-twitterFollow] Task finished successfully.`);
            })(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Global Task Timeout')), taskTimeoutMs))
        ]);
    } catch (error) {
        logger.error(`[api-twitterFollow] Fatal Task Error: ${error.message}`);
    } finally {
        try {
            if (page && !page.isClosed()) await page.close();
        } catch (_ce) {
            void _ce;
        }
    }
}

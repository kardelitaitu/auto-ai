/**
 * @fileoverview Twitter Follow+Like+Retweet Task (Unified API)
 * @module tasks/api-twitterFollowLikeRetweet.js
 *
 * Flow:
 *  1. Open tweet URL
 *  2. api.retweetWithAPI() + 50% chance api.likeWithAPI()
 *  3. Click profile link matching @username from tweet article
 *  4. Read profile ~15s
 *  5. Scroll to top, focus follow button
 *  6. api.followWithAPI() with verification
 *  7. api.agent.screenshot()
 */

// --- CONFIGURATION ---
const DEFAULT_TASK_TIMEOUT_MS = 6 * 60 * 1000; // 6 Minutes Hard Limit
const TARGET_TWEET_URL = 'https://x.com/_nadiku/status/1998218314703852013';
const MANUAL_REFERRER = ''; // e.g. 'https://www.reddit.com/r/technology/'

import { api } from '../api/index.js';
import { createLogger } from '../api/utils/logger.js';
import { profileManager } from '../api/utils/profileManager.js';
import { mathUtils } from '../api/utils/math.js';
import { ReferrerEngine } from '../api/utils/urlReferrer.js';
import metricsCollector from '../api/utils/metrics.js';

// Extract @username from tweet URL
function extractUsername(tweetUrl) {
    try {
        const parts = new URL(tweetUrl).pathname.split('/').filter(Boolean);
        if (parts.length >= 1) return parts[0];
    } catch (_e) { }
    return null;
}

// Entry points — mirrors api-twitterActivity.js
const ENTRY_POINTS = [
    { url: 'https://x.com/', weight: 59 },
    { url: 'https://x.com/i/jf/global-trending/home', weight: 4 },
    { url: 'https://x.com/explore', weight: 4 },
    { url: 'https://x.com/explore/tabs/for-you', weight: 4 },
    { url: 'https://x.com/explore/tabs/trending', weight: 4 },
    { url: 'https://x.com/i/bookmarks', weight: 4 },
    { url: 'https://x.com/notifications', weight: 4 },
    { url: 'https://x.com/notifications/mentions', weight: 4 },
    { url: 'https://x.com/i/connect_people?show_topics=false', weight: 2 },
    { url: 'https://x.com/i/connect_people?is_creator_only=true', weight: 2 },
    { url: 'https://x.com/explore/tabs/news', weight: 1 },
    { url: 'https://x.com/explore/tabs/sports', weight: 1 },
    { url: 'https://x.com/explore/tabs/entertainment', weight: 1 },
];

function selectEntryPoint() {
    const total = ENTRY_POINTS.reduce((s, e) => s + e.weight, 0);
    let r = Math.random() * total;
    for (const entry of ENTRY_POINTS) {
        r -= entry.weight;
        if (r <= 0) return entry.url;
    }
    return ENTRY_POINTS[0].url;
}

/**
 * @param {object} page - Playwright page instance
 * @param {object} payload
 */
export default async function apiTwitterFollowLikeRetweetTask(page, payload) {
    const browserInfo = payload.browserInfo || 'unknown_profile';
    const logger = createLogger(`api-twitterFollowLikeRetweet [${browserInfo}]`);
    const taskTimeoutMs = payload.taskTimeoutMs || DEFAULT_TASK_TIMEOUT_MS;

    logger.info(`[api-twitterFollowLikeRetweet] Starting...`);

    try {
        await api.withPage(page, async () => {
            await Promise.race([
                (async () => {

                    // ── Init ────────────────────────────────────────────────
                    await api.init(page, { logger, patch: true, humanizationPatch: true });

                    let profile;
                    try {
                        profile = payload.profileId
                            ? profileManager.getById(payload.profileId)
                            : profileManager.getStarter();
                    } catch (_e) {
                        profile = profileManager.getStarter();
                    }

                    await api.setPersona(profile.persona || 'casual');
                    logger.info(`[api-twitterFollowLikeRetweet] Persona: ${api.getPersonaName()}`);

                    if (profile.theme) {
                        await api.emulateMedia({ colorScheme: profile.theme });
                    }

                    // ── Startup jitter ──────────────────────────────────────
                    const jitter = mathUtils.randomInRange(2000, 8000);
                    logger.info(`[api-twitterFollowLikeRetweet] Startup jitter: ${(jitter / 1000).toFixed(1)}s`);
                    await api.think(jitter);

                    // ── Target URL + username ───────────────────────────────
                    const targetUrl = payload.targetUrl || payload.url || TARGET_TWEET_URL;
                    if (!targetUrl || targetUrl.length < 5) {
                        logger.error(`[api-twitterFollowLikeRetweet] No valid targetUrl.`);
                        return;
                    }

                    const safeUsername = extractUsername(targetUrl);
                    if (!safeUsername) {
                        logger.error(`[api-twitterFollowLikeRetweet] Could not extract username from URL.`);
                        return;
                    }
                    logger.info(`[api-twitterFollowLikeRetweet] Target: @${safeUsername}`);

                    // ── STEP 1: Entry point navigation ──────────────────────
                    const entryUrl = selectEntryPoint();
                    const entryName = entryUrl.replace('https://x.com/', '').replace('https://x.com', '') || 'home';
                    logger.info(`[api-twitterFollowLikeRetweet] 🎲 Entry point: ${entryName}`);

                    const entryEngine = new ReferrerEngine({ addUTM: true });
                    const entryCtx = entryEngine.generateContext(entryUrl);

                    await api.setExtraHTTPHeaders({
                        ...entryCtx.headers,
                        'Sec-Fetch-Site': 'none',
                        'Sec-Fetch-Mode': 'navigate'
                    });
                    await api.goto(entryUrl, {
                        waitUntil: 'domcontentloaded',
                        timeout: 60000,
                        referer: entryCtx.referrer || undefined
                    });

                    // Brief organic read on entry point (10-15s)
                    const entryReadMs = mathUtils.randomInRange(10000, 15000);
                    logger.info(`[api-twitterFollowLikeRetweet] Reading entry point for ${(entryReadMs / 1000).toFixed(1)}s...`);
                    const entryReadStart = Date.now();
                    while (Date.now() - entryReadStart < entryReadMs) {
                        await api.scroll.read('body', { pauses: 1 }).catch(() => { });
                        await api.think(mathUtils.randomInRange(1500, 3000));
                    }

                    // ── STEP 2: Navigate to tweet ───────────────────────────
                    const engine = new ReferrerEngine({ addUTM: false });
                    let ctx;

                    if (MANUAL_REFERRER && Math.random() < 0.20) {
                        logger.info(`[api-twitterFollowLikeRetweet][Referrer] Manual: ${MANUAL_REFERRER}`);
                        ctx = {
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
                        ctx = engine.generateContext(targetUrl);
                        logger.info(`[api-twitterFollowLikeRetweet][Referrer] ${ctx.strategy} | ${ctx.referrer || '(direct)'}`);
                    }

                    await api.setExtraHTTPHeaders(ctx.headers);
                    logger.info(`[api-twitterFollowLikeRetweet] Navigating to tweet: ${targetUrl}`);
                    await api.goto(ctx.targetWithParams, {
                        waitUntil: 'domcontentloaded',
                        timeout: 60000,
                        warmup: false
                    });

                    // Wait for tweet to load
                    try {
                        await api.waitVisible('article[data-testid="tweet"]', { timeout: 60000 });
                        logger.info(`[api-twitterFollowLikeRetweet] Tweet loaded.`);
                    } catch (_e) {
                        throw new Error('Tweet did not load in time.');
                    }

                    // Brief read before acting
                    await api.think(mathUtils.randomInRange(2000, 4000));

                    // ── STEP 2: Retweet ─────────────────────────────────────
                    logger.info(`[api-twitterFollowLikeRetweet] Retweeting...`);
                    const tweetArticle = page.locator('article[data-testid="tweet"]').first();

                    try {
                        await api.scroll.focus('article[data-testid="tweet"]');
                    } catch (_e) { }

                    const retweetResult = await api.retweetWithAPI({ tweetElement: tweetArticle });

                    if (retweetResult.success) {
                        logger.info(`[api-twitterFollowLikeRetweet] ✅ Retweeted (${retweetResult.reason})`);
                        metricsCollector.recordSocialAction('retweet', 1);
                    } else {
                        logger.warn(`[api-twitterFollowLikeRetweet] ⚠️ Retweet: ${retweetResult.reason}`);
                    }

                    await api.think(mathUtils.randomInRange(1000, 2500));

                    // ── STEP 2b: Like (30% chance) ──────────────────────────
                    if (Math.random() < 0.3) {
                        logger.info(`[api-twitterFollowLikeRetweet] Liking (30% roll hit)...`);
                        const likeResult = await api.likeWithAPI({ tweetElement: tweetArticle });

                        if (likeResult.success) {
                            logger.info(`[api-twitterFollowLikeRetweet] ✅ Liked (${likeResult.reason})`);
                            metricsCollector.recordSocialAction('like', 1);
                        } else {
                            logger.warn(`[api-twitterFollowLikeRetweet] ⚠️ Like: ${likeResult.reason}`);
                        }
                        await api.think(mathUtils.randomInRange(800, 2000));
                    } else {
                        logger.info(`[api-twitterFollowLikeRetweet] Like skipped (50% roll miss).`);
                    }

                    // ── STEP 3: Click profile link from tweet article ───────
                    // Matches the @username anchor inside the tweet article:
                    // <a href="/bts_bighit" role="link" ...><span>@bts_bighit</span></a>
                    logger.info(`[api-twitterFollowLikeRetweet] Clicking profile link @${safeUsername}...`);

                    const profileLinkSel = `article[data-testid="tweet"] a[href="/${safeUsername}"]`;
                    const fallbackLinkSel = `article[data-testid="tweet"] [data-testid="User-Name"] a[href^="/"]`;

                    let navigatedToProfile = false;

                    // Attempt 1: exact href match
                    const profileLinkCount = await page.locator(profileLinkSel).count();
                    if (profileLinkCount > 0) {
                        await api.click(profileLinkSel, { recovery: false }).catch(() => { });
                        await api.think(3000);
                        navigatedToProfile = !page.url().includes('/status/');
                    }

                    // Attempt 2: fallback User-Name link
                    if (!navigatedToProfile) {
                        logger.warn(`[api-twitterFollowLikeRetweet] Exact link not found, trying fallback...`);
                        await api.click(fallbackLinkSel, { recovery: false }).catch(() => { });
                        await api.think(3000);
                        navigatedToProfile = !page.url().includes('/status/');
                    }

                    // Attempt 3: navigate directly
                    if (!navigatedToProfile) {
                        logger.warn(`[api-twitterFollowLikeRetweet] Click failed, navigating directly to profile...`);
                        await api.goto(`https://x.com/${safeUsername}`, {
                            waitUntil: 'domcontentloaded',
                            warmup: false
                        });
                        navigatedToProfile = true;
                    }

                    await api.waitForLoadState('domcontentloaded');
                    logger.info(`[api-twitterFollowLikeRetweet] On profile: ${page.url()}`);

                    // ── STEP 4: Read profile ~10-15s ─────────────────────────
                    logger.info(`[api-twitterFollowLikeRetweet] Reading profile for ~10-15s...`);
                    const profileReadMs = mathUtils.randomInRange(10000, 15000);
                    const readStart = Date.now();
                    while (Date.now() - readStart < profileReadMs) {
                        await api.scroll.read('body', { pauses: 1 }).catch(() => { });
                        await api.think(mathUtils.randomInRange(2000, 4000));
                    }

                    // ── STEP 5: Scroll to top → focus follow button ─────────
                    logger.info(`[api-twitterFollowLikeRetweet] Scrolling to top to find follow button...`);
                    await api.scroll.toTop().catch(() => { });
                    await api.think(mathUtils.randomInRange(800, 1500));

                    // Focus the follow button into view
                    const followBtnSel = '[data-testid$="-follow"]:not([data-testid$="-unfollow"])';
                    try {
                        await api.scroll.focus(followBtnSel);
                    } catch (_e) {
                        logger.warn(`[api-twitterFollowLikeRetweet] scroll.focus on follow btn failed: ${_e.message}`);
                    }
                    await api.think(mathUtils.randomInRange(500, 1200));

                    // ── STEP 6: Follow with verification ───────────────────
                    logger.info(`[api-twitterFollowLikeRetweet] Following @${safeUsername}...`);
                    const followResult = await api.followWithAPI({ username: safeUsername });

                    if (followResult.success) {
                        logger.info(`[api-twitterFollowLikeRetweet] ✅ Followed @${safeUsername} (${followResult.reason})`);
                        metricsCollector.recordSocialAction('follow', 1);
                        await api.think(mathUtils.randomInRange(1500, 3000));
                    } else {
                        logger.warn(`[api-twitterFollowLikeRetweet] ⚠️ Follow: ${followResult.reason}`);
                    }

                    // ── STEP 7: Screenshot ──────────────────────────────────
                    logger.info(`[api-twitterFollowLikeRetweet] Taking screenshot...`);
                    try {
                        const { mkdir } = await import('fs/promises');
                        await mkdir('./screenshot', { recursive: true });
                        const ts = new Date().toISOString().replace(/[:.]/g, '-');
                        const filename = `followlikeretweet-${safeUsername}-${ts}.png`;
                        await page.screenshot({ path: `./screenshot/${filename}` });
                        logger.info(`[api-twitterFollowLikeRetweet] 📸 Screenshot saved: ./screenshot/${filename}`);
                    } catch (_e) {
                        logger.warn(`[api-twitterFollowLikeRetweet] Screenshot failed: ${_e.message}`);
                    }


                    // ── STEP 8: Go home + cool-down read (10-15s) ──────────
                    logger.info(`[api-twitterFollowLikeRetweet] Navigating home for cool-down...`);
                    await api.goto('https://x.com/home', { waitUntil: 'domcontentloaded', warmup: false });

                    const cooldownMs = mathUtils.randomInRange(10000, 15000);
                    logger.info(`[api-twitterFollowLikeRetweet] Cool-down reading for ${(cooldownMs / 1000).toFixed(1)}s...`);
                    const cooldownStart = Date.now();
                    while (Date.now() - cooldownStart < cooldownMs) {
                        await api.scroll.read('body', { pauses: 1 }).catch(() => { });
                        await api.think(mathUtils.randomInRange(2000, 4000));
                    }

                    logger.info(`[api-twitterFollowLikeRetweet] ✅ Task completed.`);

                })(),
                new Promise((_, reject) => setTimeout(
                    () => reject(new Error(`Task timeout (${(taskTimeoutMs / 1000).toFixed(0)}s)`)),
                    taskTimeoutMs
                ))
            ]);
        });

    } catch (error) {
        if (error.message.includes('Target page, context or browser has been closed')) {
            logger.warn(`[api-twitterFollowLikeRetweet] Interrupted: Browser closed.`);
        } else {
            logger.error(`[api-twitterFollowLikeRetweet] Error: ${error.message}`);
        }
    } finally {
        try {
            if (page && !page.isClosed()) await page.close();
        } catch (_e) { }
    }
}

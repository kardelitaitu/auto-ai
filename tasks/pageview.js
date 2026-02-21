/**
 * @fileoverview Pageview task - Simulates human browsing behavior
 * Opens a URL and simulates reading with random scrolling and cursor movements
 * 
 * Usage:
 *   node main.js pageview                    # Use random URL from pageview.txt
 *   node main.js pageview=www.example.com    # Use specified URL
 * 
 * @module tasks/pageview
 */

import { createLogger } from '../utils/logger.js';
import { scrollDown, scrollUp } from '../utils/scroll-helper.js';
import { GhostCursor } from '../utils/ghostCursor.js';
import { mathUtils } from '../utils/mathUtils.js';
import { profileManager } from '../utils/profileManager.js';
import { ReferrerEngine } from '../utils/urlReferrer.js';
import fs from 'fs/promises';

const URL_FILE = './tasks/pageview.txt';

// ===========================================
// CONFIGURATION
// ===========================================
const CONFIG = {
    // Reading duration (seconds)
    READING_MIN: 30,
    READING_MAX: 50,
    
    // Scroll distance (pixels, 40px increments)
    SCROLL_MIN: 60,
    SCROLL_MAX: 300,
    SCROLL_INCREMENT: 60,
    
    // Scroll direction ratio (95% down, 5% up)
    SCROLL_DOWN_RATIO: 0.95,
    
    // Cursor movement
    CURSOR_MOVE_CHANCE: 0.5,        // 50% chance after each scroll
    
    // Short pause (adjusting position)
    SHORT_PAUSE_MIN: 100,
    SHORT_PAUSE_MAX: 300,
    SHORT_PAUSE_CHANCE: 0.8,      // 70% chance
    
    // Reading pause (simulating read) - defaults, override via payload
    READING_PAUSE_MIN: 2000,
    READING_PAUSE_MAX: 4000,
    // (30% chance for reading pause)
    
    // Cursor movement duration (ms)
    CURSOR_DURATION_MIN: 300,
    CURSOR_DURATION_MAX: 900,
};

/**
 * Load URLs from the text file
 * @returns {Promise<string[]>} Array of URLs
 */
async function loadUrls() {
    try {
        const content = await fs.readFile(URL_FILE, 'utf-8');
        const urls = content
            .split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#'));
        return urls;
    } catch (_error) {
        return [];
    }
}

/**
 * Get a random URL from the file
 * @returns {Promise<string>} Random URL
 */
async function getRandomUrl() {
    const urls = await loadUrls();
    if (urls.length === 0) {
        throw new Error(`No URLs found in ${URL_FILE}`);
    }
    const randomIndex = Math.floor(Math.random() * urls.length);
    return urls[randomIndex];
}

/**
 * Ensure URL has proper protocol
 * @param {string} url - The URL to process
 * @returns {string} URL with protocol
 */
function ensureProtocol(url) {
    url = url.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
    }
    return url;
}

/**
 * Move cursor to random position on page
 * @param {GhostCursor} ghost - GhostCursor instance
 * @param {object} page - Playwright page
 * @param {number} scrollPauseMean - Profile scroll pause mean for cursor duration
 * @param {number} scrollPauseDev - Profile scroll pause deviation
 */
async function randomCursorMove(ghost, page, scrollPauseMean = 800, scrollPauseDev = 300) {
    try {
        const viewport = page.viewportSize();
        if (!viewport) return;
        
        const x = mathUtils.randomInRange(100, viewport.width - 100);
        const y = mathUtils.randomInRange(100, viewport.height - 100);
        
        // Cursor duration based on profile timing
        const cursorDuration = mathUtils.randomInRange(
            Math.max(100, scrollPauseMean - scrollPauseDev),
            scrollPauseMean + scrollPauseDev
        );
        
        ghost.logger.info(`[pageview] Moving cursor to (${Math.round(x)}, ${Math.round(y)}) over ${cursorDuration.toFixed(0)}ms`);
        await ghost.move(x, y, cursorDuration);
    } catch (_error) {
        // Silently ignore cursor movement errors
    }
}

/**
 * Simulate reading behavior with scrolling and cursor movements
 * Uses profile timings for human-like behavior
 * @param {object} page - Playwright page
 * @param {GhostCursor} ghost - GhostCursor instance
 * @param {number} durationSeconds - How long to simulate reading
 * @param {object} profile - Profile for timing customization
 * @param {object} payload - Payload for overrides (readingPauseMin, readingPauseMax)
 */
async function simulateReading(page, ghost, durationSeconds, profile, payload = {}) {
    const logger = ghost.logger;
    const startTime = Date.now();
    const endTime = startTime + (durationSeconds * 1000);
    
    // Get scroll pause timing from profile
    const scrollPauseMean = profile?.timings?.scrollPause?.mean || 800;
    const scrollPauseDev = profile?.timings?.scrollPause?.deviation || 300;
    
    // Reading pause - allow CLI override
    const readingPauseMin = payload.readingPauseMin || CONFIG.READING_PAUSE_MIN;
    const readingPauseMax = payload.readingPauseMax || CONFIG.READING_PAUSE_MAX;
    
    logger.info(`[pageview] Simulating reading for ${durationSeconds.toFixed(1)} seconds...`);
    logger.info(`[pageview] Using profile scroll pause: ${scrollPauseMean}ms (±${scrollPauseDev}ms)`);
    logger.info(`[pageview] Reading pause range: ${readingPauseMin}ms - ${readingPauseMax}ms`);
    
    let scrollCount = 0;
    let cursorMoveCount = 0;
    
    logger.info(`[pageview] Starting scroll loop ...`);
    
    while (Date.now() < endTime) {
        // Random scroll direction - use profile inputMethods if available
        const wheelDownRatio = profile?.inputMethods?.wheelDown || CONFIG.SCROLL_DOWN_RATIO;
        const scrollDirection = Math.random() > (1 - wheelDownRatio) ? 'down' : 'up';
        
        // Scroll distance: configurable increments
        const scrollMultiplier = Math.floor(Math.random() * (CONFIG.SCROLL_MAX / CONFIG.SCROLL_INCREMENT)) + 1;
        const scrollAmount = scrollMultiplier * CONFIG.SCROLL_INCREMENT;
        
        if (scrollDirection === 'down') {
            await scrollDown(page, scrollAmount);
        } else {
            await scrollUp(page, scrollAmount);
        }
        
        scrollCount++;
        logger.info(`[pageview] Scroll #${scrollCount}: ${scrollDirection} ${scrollAmount}px`);
        
        // Random cursor movement
        if (Math.random() < CONFIG.CURSOR_MOVE_CHANCE) {
            logger.info(`[pageview] Cursor move triggered (${cursorMoveCount + 1})`);
            await randomCursorMove(ghost, page, scrollPauseMean, scrollPauseDev);
            cursorMoveCount++;
        }
        
        // Two types of pause - use profile-based timing with CLI override
        if (Math.random() < CONFIG.SHORT_PAUSE_CHANCE) {
            // Short pause - adjusting position
            const shortPause = mathUtils.randomInRange(CONFIG.SHORT_PAUSE_MIN, CONFIG.SHORT_PAUSE_MAX);
            logger.info(`[pageview] Short pause ${shortPause}ms (adjusting position)...`);
            await new Promise(resolve => setTimeout(resolve, shortPause));
        } else {
            // Reading pause - use config values with override
            const readingPause = mathUtils.randomInRange(readingPauseMin, readingPauseMax);
            logger.info(`[pageview] Reading pause ${readingPause.toFixed(0)}ms...`);
            await new Promise(resolve => setTimeout(resolve, readingPause));
        }
    }
    
    logger.info(`[pageview] Completed ${scrollCount} scroll actions, ${cursorMoveCount} cursor moves`);
}

/**
 * Main pageview task
 * @param {object} page - Playwright page object
 * @param {object} payload - Task payload
 * @param {string} payload.browserInfo - Browser identifier
 * @param {string} payload.url - Optional URL override
 */
export default async function pageview(page, payload) {
    const startTime = process.hrtime.bigint();
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const browserInfo = payload.browserInfo || 'unknown_profile';
    const logger = createLogger(`pageview.js [${browserInfo}]`);
    
    logger.info('[pageview] Starting pageview task...');
    
    // Get profile for themed scrolling behavior
    let profile;
    try {
        profile = profileManager.getStarter();
        logger.info(`[pageview] Using profile: ${profile.id} (scrollPause: ${profile.timings.scrollPause.mean}ms)`);
    } catch (e) {
        logger.warn(`[pageview] Failed to load profile: ${e.message}, using defaults`);
        profile = { 
            theme: 'dark', 
            timings: { 
                scrollPause: { mean: 800, deviation: 300 },
                readingPhase: { mean: 40000, deviation: 10000 }
            } 
        };
    }
    
    // Determine URL
    let targetUrl;
    if (payload.url) {
        targetUrl = ensureProtocol(payload.url);
        logger.info(`[pageview] Using URL from argument: ${targetUrl}`);
    } else {
        targetUrl = await getRandomUrl();
        logger.info(`[pageview] Using random URL from file: ${targetUrl}`);
    }
    
    // Apply humanization patch
    const { applyHumanizationPatch } = await import('../utils/browserPatch.js');
    await applyHumanizationPatch(page, logger);
    
    // Initialize GhostCursor for human-like movements
    const ghost = new GhostCursor(page, logger);
    
    // Enforce theme from profile
    const theme = profile.theme || 'dark';
    logger.info(`[pageview] Enforcing theme: ${theme}`);
    await page.emulateMedia({ colorScheme: theme });
    
    // Hard cap timeout - 60 seconds max
    const HARD_TIMEOUT_MS = 60000;
    const hardTimeout = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Task timeout (60s exceeded)')), HARD_TIMEOUT_MS);
    });
    
    const taskPromise = (async () => {
        // 1. Warmup jitter - decouple browser launch from action
        const wakeUpTime = mathUtils.randomInRange(2000, 8000);
        logger.info(`[pageview] Warming up (Human Jitter) for ${(wakeUpTime / 1000).toFixed(1)}s...`);
        await page.waitForTimeout(wakeUpTime);
        
        // 2. Generate referrer context
        const engine = new ReferrerEngine({ addUTM: false });
        const ctx = engine.generateContext(targetUrl);
        await page.setExtraHTTPHeaders(ctx.headers);
        logger.info(`[pageview] Referrer: ${ctx.referrer || '(Direct)'}`);
        
        // 3. Navigate to URL
        logger.info(`[pageview] Navigating to ${targetUrl}...`);
        await page.goto(targetUrl, {
            waitUntil: 'domcontentloaded',
            timeout: 30000
        });
        
        // Wait for page to settle
        await delay(mathUtils.randomInRange(1000, 2000));
        
        // 4. Calculate reading duration from profile (cap at 60s max)
        const profileReadingMs = profile.timings.readingPhase.mean + (Math.random() * profile.timings.readingPhase.deviation - profile.timings.readingPhase.deviation / 2);
        const readingDuration = Math.min(Math.max(profileReadingMs / 1000, 30), 50); // 30-50s from profile, capped
        logger.info(`[pageview] Reading duration: ${readingDuration.toFixed(1)} seconds (profile-based)`);
        
        // 5. Simulate reading with profile-based timings
        await simulateReading(page, ghost, readingDuration, profile, payload);
        
        // Final pause before closing
        await delay(mathUtils.randomInRange(1000, 3000));
        
    })();
    
    try {
        await Promise.race([taskPromise, hardTimeout]);
    } catch (error) {
        if (error.message.includes('timeout')) {
            logger.warn(`[pageview] ${error.message}, forcing task end`);
        } else {
            logger.error(`[pageview] Error: ${error.message}`);
        }
    } finally {
        logger.info('[pageview] Task completed, closing page...');
        
        try {
            if (!page.isClosed()) {
                await page.close();
            }
        } catch (closeError) {
            logger.error('[pageview] Error closing page:', closeError.message);
        }
        
        const endTime = process.hrtime.bigint();
        const durationInSeconds = (Number(endTime - startTime) / 1_000_000_000).toFixed(2);
        logger.info(`[pageview] Total task duration: ${durationInSeconds} seconds`);
    }
}

/**
 * @fileoverview Scroll Operations — Golden View & Generic
 * Implements the Golden View principle: center element in viewport with entropy,
 * then move cursor to target before any kinetic action.
 * Includes scroll reading simulation for human-like behavior.
 * Usage:
 * await api.scroll.read('.article');
 * await api.scroll.read(500);
 * await api.scroll.read(500, { pauses: 10, scrollAmount: 1000, variableSpeed: false, backScroll: true });
 * await api.scroll.toTop(3000); // scroll to top in 3s
 * 
 * @module api/scroll
 */

import { getPage, getCursor } from '../core/context.js';
import { getPersona } from '../behaviors/persona.js';
import { mathUtils } from '../utils/math.js';
import { createLogger } from '../core/logger.js';
import { getSettings } from '../utils/config.js';
import { getLocator } from '../utils/locator.js';

const logger = createLogger('api/scroll.js');

let _scrollMultiplierCache = null;
async function _getScrollMultiplier() {
    if (_scrollMultiplierCache === null) {
        const settings = await getSettings();
        _scrollMultiplierCache = settings?.twitter?.timing?.globalScrollMultiplier || 1.0;
    }
    return _scrollMultiplierCache;
}

/**
 * Scroll reading simulation — stop-and-read pattern.
 * Scrolls through content with pauses to simulate reading.
 * @param {string|number|import('playwright').Locator} [target] - CSS selector, Locator, or pixel distance
 * @param {object} [options]
 * @param {number} [options.pauses=3] - Number of scroll+pause cycles
 * @param {number} [options.scrollAmount=300] - Pixels per scroll
 * @param {boolean} [options.variableSpeed=true] - Vary scroll speed
 * @param {boolean} [options.backScroll=false] - Occasional back-scroll
 * @returns {Promise<void>}
 */
export async function read(target, options = {}) {
    const page = getPage();
    const persona = getPersona();

    const isLocatorInput = typeof target === 'string' || (target && typeof target === 'object' && !Array.isArray(target) && target.waitFor);
    const {
        pauses = mathUtils.randomInRange(2, 5),
        scrollAmount = mathUtils.randomInRange(400, 800),
        variableSpeed = true,
        backScroll = Math.random() > 0.7
    } = options;

    // If target provided, scroll to it first
    if (isLocatorInput && target) {
        try {
            await getLocator(target).waitFor({ state: 'attached', timeout: 3000 });
        } catch {
            // Target not found, continue with blind scroll
        }
    }

    const scrollMultiplier = await _getScrollMultiplier();
    for (let i = 0; i < pauses; i++) {
        // Variable speed scroll with global multiplier
        const amount = (variableSpeed
            ? scrollAmount * (0.7 + Math.random() * 0.6)
            : scrollAmount) * scrollMultiplier;

        // Weighted sub-steps: 70% chance for 1 fluid flick, 30% for 2-3 smaller flicks
        const subSteps = Math.random() < 0.7 ? 1 : mathUtils.randomInRange(2, 3);

        for (let s = 0; s < subSteps; s++) {
            const stepAmount = amount / subSteps;

            // Phase 3: "Muscle Prep" - subtle pre-flick engagement jitter
            if (stepAmount > 200 && s === 0) {
                await _microDrift(page, 150, 5); // 150ms prep with 5px limit
            }

            try {
                // Slightly faster flicks for sub-steps to simulate quick finger motions
                const burstDuration = mathUtils.randomInRange(300, 600) / (persona.scrollSpeed || 1);
                await _smoothScroll(page, stepAmount, burstDuration, 'expo');
            } catch (_e) {
                await page.evaluate((a) => window.scrollBy(0, a), stepAmount);
            }

            // Tiny pause between human-like multi-flicks
            if (subSteps > 1 && s < subSteps - 1) {
                await new Promise(r => setTimeout(r, mathUtils.randomInRange(100, 250)));
            }
        }

        // Phase 3: Content-Aware Pause Weighting
        const density = await _getViewportDensity(page);
        let pauseMultiplier = 1.0;
        if (density.textLength > 800 || density.pCount > 8) pauseMultiplier = 1.6; // Text heavy
        else if (density.imgCount > 1) pauseMultiplier = 1.3; // Visual content
        else if (density.textLength < 100) pauseMultiplier = 0.5; // Navigation zones

        // Reading pause
        const readTime = mathUtils.randomInRange(1000, 3000) * pauseMultiplier;

        // Phase 3: Reading Anchor (Eye Focus)
        if (Math.random() < 0.3) {
            const cursor = getCursor();
            const viewport = await page.evaluate(() => ({ w: window.innerWidth, h: window.innerHeight }));
            // Focus on 40% of viewport (off-center towards top-left)
            await cursor.move(
                viewport.w * 0.4 + (Math.random() - 0.5) * 50,
                viewport.h * 0.4 + (Math.random() - 0.5) * 50
            );
        }

        await new Promise(r => setTimeout(r, readTime));

        // Occasional back-scroll to re-read (2% chance)
        if (backScroll && i < pauses - 1 && Math.random() > 0.98) {
            const backAmount = mathUtils.randomInRange(300, 600);
            try {
                await _smoothScroll(page, -backAmount, 450, 'expo');
            } catch (_e) {
                await page.evaluate((a) => window.scrollBy(0, -a), backAmount);
            }
            // Significant re-reading pause with micro-jitter (human settling back)
            const reReadTime = mathUtils.randomInRange(2000, 5000);
            const driftPromise = _microDrift(page, reReadTime);
            await new Promise(r => setTimeout(r, reReadTime));
            await driftPromise.catch(() => { });
        }
    }
}

/**
 * Scroll back / up slightly — simulates re-reading or adjusting view.
 * @param {number} [distance=100] - Pixels to scroll up
 * @returns {Promise<void>}
 */
export async function back(distance = 100) {
    const page = getPage();
    const persona = getPersona();
    const scrollSpeed = persona.scrollSpeed || 1;

    const steps = mathUtils.randomInRange(2, 3);
    const multiplier = await _getScrollMultiplier();
    const scaledDistance = distance * multiplier;

    for (let i = 0; i < steps; i++) {
        try {
            await _smoothScroll(page, -scaledDistance / steps, 200 / scrollSpeed);
        } catch (_e) {
            await page.evaluate((d) => window.scrollBy(0, -d), scaledDistance / steps);
        }
        const pause = mathUtils.randomInRange(30, 60) / scrollSpeed;
        await new Promise(r => setTimeout(r, pause));
    }
}

/**
 * Golden View Focus — scroll element to center of viewport with ±10% randomness,
 * then move cursor to the element.
 * @param {string|import('playwright').Locator} selector - CSS selector or Locator to focus
 * @param {object} [options]
 * @param {number} [options.randomness=0.1] - Y-offset randomness factor
 * @param {number} [options.timeout=5000] - Max time to wait for selector attachment
 * @returns {Promise<void>}
 */
export async function focus(selector, options = {}) {
    const page = getPage();
    const cursor = getCursor();
    const persona = getPersona();
    const { randomness = 0.1, timeout = 5000 } = options;

    const locator = getLocator(selector).first();

    // Wait for element to exist in DOM
    await locator.waitFor({ state: 'attached', timeout });

    const getClientRect = async () => {
        if (typeof locator.evaluate === 'function') {
            return await locator.evaluate((el) => {
                const rect = el.getBoundingClientRect();
                return {
                    x: rect.left,
                    y: rect.top,
                    width: rect.width,
                    height: rect.height,
                };
            }).catch(() => null);
        }
        return null;
    };

    let box = await getClientRect();
    if (!box) {
        await new Promise(r => setTimeout(r, mathUtils.randomInRange(50, 150)));
        box = await getClientRect();
    }
    if (!box) {
        logger.warn(`[focus] No bounding box for target`);
        return;
    }

    // Get viewport size - use evaluate as fallback since viewportSize() can return null
    let viewport = page.viewportSize();
    if (!viewport) {
        viewport = await page.evaluate(() => ({
            width: window.innerWidth,
            height: window.innerHeight
        }));
    }

    if (!viewport) {
        logger.warn(`[focus] Could not get viewport size`);
        return;
    }

    // Golden View math: center element vertically with entropy
    const yOffset = (viewport.height * randomness * (Math.random() - 0.5));

    // box.y is viewport-relative (client rect). Convert to document scroll target.
    const currentScrollY = await page.evaluate(() => window.scrollY);
    const targetScrollY = currentScrollY + box.y - (viewport.height / 2) + (box.height / 2) + yOffset;
    const deltaY = targetScrollY - currentScrollY;

    // Calculate distance and determine scroll strategy
    const distance = Math.abs(deltaY);
    const isFarScroll = distance > 500; // Far = needs fast scroll

    // Skip if already comfortably in view
    const isCurrentlyVisible = box.y > 20 && (box.y + box.height) < (viewport.height - 20);
    if (isCurrentlyVisible && Math.abs(deltaY) < 150) {
        await _moveCursorToBox(cursor, box);
        return;
    }

    // Multi-step humanized scroll
    const steps = isFarScroll ? mathUtils.randomInRange(3, 5) : mathUtils.randomInRange(3, 6);
    const scrollSpeed = persona.scrollSpeed || 1.0;

    for (let i = 0; i < steps; i++) {
        const progress = (i + 1) / steps;
        const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
        const stepDelta = (deltaY * eased) - (i > 0 ? deltaY * (1 - Math.pow(1 - (i / steps), 3)) : 0);

        const duration = isFarScroll
            ? mathUtils.randomInRange(500, 1000)
            : mathUtils.randomInRange(30, 100) / scrollSpeed;

        try {
            await _smoothScroll(page, stepDelta, duration);
        } catch (_wheelError) {
            try {
                await page.evaluate((delta) => window.scrollBy(0, delta), stepDelta);
            } catch (scrollError) {
                console.warn(`[api/scroll] Smooth scroll evaluate failed: ${scrollError.message}`);
            }
        }

        // Add tiny realistic mouse pause between continuous drags if multi-step
        if (steps > 1 && i < steps - 1) {
            await new Promise(r => setTimeout(r, mathUtils.randomInRange(20, 50)));
        }
    }

    // Brief settle time
    await new Promise(r => setTimeout(r, mathUtils.randomInRange(100, 300)));

    // Refresh bounding box after scroll and move cursor
    const newBox = await getClientRect();
    if (newBox) {
        await _moveCursorToBox(cursor, newBox);
    }
}

/**
 * Blind vertical scroll by raw pixels.
 * @param {number} distance - Pixels to scroll (positive = down, negative = up)
 * @returns {Promise<void>}
 */
export async function scroll(distance) {
    const page = getPage();
    const persona = getPersona();
    const scrollSpeed = persona.scrollSpeed || 1.0;
    const multiplier = await _getScrollMultiplier();
    const scaledDistance = distance * multiplier;

    const duration = mathUtils.randomInRange(400, 700) / scrollSpeed;
    try {
        await _smoothScroll(page, scaledDistance, duration, 'expo');
    } catch (_e) {
        await page.evaluate((d) => window.scrollBy(0, d), scaledDistance);
    }
    await new Promise(r => setTimeout(r, mathUtils.randomInRange(100, 200)));
}

/**
 * Scroll to top of page.
 * @param {number} [duration] - Optional duration in ms
 * @returns {Promise<void>}
 */
export async function toTop(duration) {
    const page = getPage();
    const finalDuration = duration || mathUtils.randomInRange(800, 1500);
    await _smoothScrollToY(page, 0, finalDuration);
    await new Promise(r => setTimeout(r, mathUtils.randomInRange(300, 600)));
}

/**
 * Scroll to bottom of page.
 * @returns {Promise<void>}
 */
export async function toBottom() {
    const page = getPage();
    const bottom = await page.evaluate(() => document.body.scrollHeight);
    await _smoothScrollToY(page, bottom, mathUtils.randomInRange(800, 1500));
    await new Promise(r => setTimeout(r, mathUtils.randomInRange(300, 600)));
}

// ─── Internal ────────────────────────────────────────────────────────────────

/**
 * Move cursor to a Gaussian-distributed point within a bounding box.
 * @param {import('../utils/ghostCursor.js').GhostCursor} cursor
 * @param {object} box - { x, y, width, height }
 */
async function _moveCursorToBox(cursor, box) {
    const targetX = mathUtils.gaussian(
        box.x + box.width / 2,
        box.width / 6,
        box.x + box.width * 0.15,
        box.x + box.width * 0.85
    );
    const targetY = mathUtils.gaussian(
        box.y + box.height / 2,
        box.height / 6,
        box.y + box.height * 0.15,
        box.y + box.height * 0.85
    );
    await cursor.move(targetX, targetY);
}

/**
 * Execute a fluid RAF-based scroll by a relative pixel amount.
 * @param {import('playwright').Page} page
 * @param {number} deltaY
 * @param {number} duration
 * @param {'quart'|'expo'} [easing='quart']
 */
async function _smoothScroll(page, deltaY, duration, easing = 'quart') {
    if (deltaY === 0) return;
    return page.evaluate(async ({ deltaY, duration, easing }) => {
        const startY = window.scrollY;
        const startX = window.scrollX;
        const targetY = startY + deltaY;
        const startTime = performance.now();
        // Phase 3: Lateral Sway factor
        const lateralSway = (Math.random() - 0.5) * 5;

        return new Promise(resolve => {
            function step(currentTime) {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                // Easing selection
                let eased;
                if (easing === 'expo') {
                    // easeOutExpo
                    eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
                } else {
                    // easeOutQuart
                    eased = 1 - Math.pow(1 - progress, 4);
                }

                // Phase 3: XY Scroll with Lateral Sway
                const currentSway = Math.sin(progress * Math.PI) * lateralSway;
                window.scrollTo(startX + currentSway, startY + (deltaY * eased));

                // Random micro-stutter (hesitation) during long scrolls
                if (Math.abs(deltaY) > 500 && Math.random() > 0.99) {
                    setTimeout(() => window.requestAnimationFrame(step), 20 + Math.random() * 30);
                    return;
                }

                if (progress < 1) {
                    window.requestAnimationFrame(step);
                } else {
                    resolve();
                }
            }
            window.requestAnimationFrame(step);

            // Fallback timeout in case RAF is severely throttled
            setTimeout(() => {
                window.scrollTo(0, targetY);
                resolve();
            }, duration + 500);
        });
    }, { deltaY, duration: Math.max(duration, 50), easing });
}

/**
 * Execute a fluid RAF-based scroll to an absolute Y position.
 * @param {import('playwright').Page} page
 * @param {number} targetY
 * @param {number} duration
 * @param {'quart'|'expo'} [easing='quart']
 */
async function _smoothScrollToY(page, targetY, duration, easing = 'quart') {
    return page.evaluate(async ({ targetY, duration, easing }) => {
        const startY = window.scrollY;
        const deltaY = targetY - startY;
        if (deltaY === 0) return;

        const startTime = performance.now();
        const startX = window.scrollX;
        // Phase 3: Lateral Sway factor
        const lateralSway = (Math.random() - 0.5) * 5;

        return new Promise(resolve => {
            function step(currentTime) {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                // Easing selection
                let eased;
                if (easing === 'expo') {
                    eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
                } else {
                    eased = 1 - Math.pow(1 - progress, 4);
                }

                // Phase 3: XY Scroll with Lateral Sway
                const currentSway = Math.sin(progress * Math.PI) * lateralSway;
                window.scrollTo(startX + currentSway, startY + (deltaY * eased));

                // Random micro-stutter (hesitation) during long scrolls
                if (Math.abs(deltaY) > 500 && Math.random() > 0.99) {
                    setTimeout(() => window.requestAnimationFrame(step), 20 + Math.random() * 30);
                    return;
                }

                if (progress < 1) {
                    window.requestAnimationFrame(step);
                } else {
                    resolve();
                }
            }
            window.requestAnimationFrame(step);

            // Fallback timeout in case RAF is severely throttled
            setTimeout(() => {
                window.scrollTo(0, targetY);
                resolve();
            }, duration + 500);
        });
    }, { targetY, duration: Math.max(duration, 50), easing });
}

/**
 * Execute a subtle "micro-drift" simulation during a pause.
 * Moves the page by a few pixels very slowly to simulate hand tremors.
 * @param {import('playwright').Page} page
 * @param {number} duration
 * @param {number} [limit=10] - Max drift in pixels
 */
async function _microDrift(page, duration, limit = 10) {
    if (duration < 100) return;
    return page.evaluate(async ({ duration, limit }) => {
        const driftAmount = (Math.random() - 0.5) * (limit * 2);
        if (Math.abs(driftAmount) < 0.5) return;

        const startY = window.scrollY;
        const startTime = performance.now();

        return new Promise(resolve => {
            function step(currentTime) {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);

                // Sinusoidal drift for "breathing" feel
                const eased = Math.sin((progress * Math.PI) / 2);
                window.scrollTo(0, startY + (driftAmount * eased));

                if (progress < 1) {
                    window.requestAnimationFrame(step);
                } else {
                    resolve();
                }
            }
            window.requestAnimationFrame(step);
            setTimeout(resolve, duration + 100);
        });
    }, { duration, limit });
}

/**
 * Quantify content in current viewport for adaptive reading.
 * @param {import('playwright').Page} page
 * @returns {Promise<{pCount: number, imgCount: number, textLength: number}>}
 */
async function _getViewportDensity(page) {
    return await page.evaluate(() => {
        const vH = window.innerHeight;
        const paragraphs = Array.from(document.querySelectorAll('p, h1, h2, h3, h4, h5, li, span, code')).filter(el => {
            const rect = el.getBoundingClientRect();
            return rect.top >= 0 && rect.top <= vH;
        });
        const images = Array.from(document.querySelectorAll('img, video, iframe, canvas')).filter(el => {
            const rect = el.getBoundingClientRect();
            return rect.top >= 0 && rect.top <= vH;
        });
        const textLength = paragraphs.reduce((sum, el) => sum + (el.innerText?.length || 0), 0);
        return { pCount: paragraphs.length, imgCount: images.length, textLength };
    });
}

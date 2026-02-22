/**
 * @fileoverview Scroll Operations — Golden View & Generic
 * Implements the Golden View principle: center element in viewport with entropy,
 * then move cursor to target before any kinetic action.
 * Includes scroll reading simulation for human-like behavior.
 * 
 * @module api/scroll
 */

import { getPage, getCursor } from './context.js';
import { getPersona } from './persona.js';
import { mathUtils } from '../utils/mathUtils.js';

/**
 * Scroll reading simulation — stop-and-read pattern.
 * Scrolls through content with pauses to simulate reading.
 * @param {string|number} [target] - CSS selector or pixel distance
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
    
    // Handle both: api.scroll.read('.article') and api.scroll.read(500)
    const isSelector = typeof target === 'string';
    const {
        pauses = mathUtils.randomInRange(2, 5),
        scrollAmount = mathUtils.randomInRange(200, 400),
        variableSpeed = true,
        backScroll = Math.random() > 0.7
    } = options;
    
    // If selector provided, scroll to it first
    if (isSelector && target) {
        try {
            await page.waitForSelector(target, { state: 'attached', timeout: 3000 });
        } catch {
            // Selector not found, continue with blind scroll
        }
    }
    
    for (let i = 0; i < pauses; i++) {
        // Variable speed scroll
        const amount = variableSpeed 
            ? scrollAmount * (0.7 + Math.random() * 0.6) 
            : scrollAmount;
        
        const steps = mathUtils.randomInRange(2, 4);
        for (let s = 0; s < steps; s++) {
            await page.mouse.wheel(0, amount / steps);
            const pause = mathUtils.randomInRange(20, 50) / (persona.scrollSpeed || 1);
            await new Promise(r => setTimeout(r, pause));
        }
        
        // Reading pause - longer after each scroll
        const readTime = mathUtils.randomInRange(500, 2000);
        await new Promise(r => setTimeout(r, readTime));
        
        // Occasional back-scroll to re-read (30% chance)
        if (backScroll && i < pauses - 1 && Math.random() > 0.7) {
            const backAmount = mathUtils.randomInRange(50, 150);
            await page.mouse.wheel(0, -backAmount);
            await new Promise(r => setTimeout(r, mathUtils.randomInRange(300, 800)));
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
    for (let i = 0; i < steps; i++) {
        await page.mouse.wheel(0, -distance / steps);
        const pause = mathUtils.randomInRange(30, 60) / scrollSpeed;
        await new Promise(r => setTimeout(r, pause));
    }
}

/**
 * Golden View Focus — scroll element to center of viewport with ±10% randomness,
 * then move cursor to the element.
 * @param {string} selector - CSS selector to focus
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

    // Wait for element to exist in DOM
    await page.waitForSelector(selector, { state: 'attached', timeout });

    const locator = page.locator(selector).first();
    const box = await locator.boundingBox();
    if (!box) return;

    const viewport = page.viewportSize();
    if (!viewport) return;

    // Golden View math: center element vertically with entropy
    const yOffset = (viewport.height * randomness * (Math.random() - 0.5));
    const targetScrollY = box.y - (viewport.height / 2) + (box.height / 2) + yOffset;

    // Get current scroll position
    const currentScrollY = await page.evaluate(() => window.scrollY);
    const deltaY = targetScrollY - currentScrollY;

    // Skip if already roughly centered
    if (Math.abs(deltaY) < 50) {
        await _moveCursorToBox(cursor, box);
        return;
    }

    // Multi-step humanized scroll
    const steps = mathUtils.randomInRange(3, 6);
    const scrollSpeed = persona.scrollSpeed || 1.0;

    for (let i = 0; i < steps; i++) {
        const progress = (i + 1) / steps;
        const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
        const stepDelta = (deltaY * eased) - (i > 0 ? deltaY * (1 - Math.pow(1 - (i / steps), 3)) : 0);

        await page.mouse.wheel(0, stepDelta);

        // Inter-step pause (persona-scaled)
        const pause = mathUtils.randomInRange(30, 80) / scrollSpeed;
        await new Promise(r => setTimeout(r, pause));
    }

    // Brief settle time
    await new Promise(r => setTimeout(r, mathUtils.randomInRange(100, 300)));

    // Refresh bounding box after scroll and move cursor
    const newBox = await locator.boundingBox();
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

    // Multi-step for realism
    const steps = mathUtils.randomInRange(2, 4);
    for (let i = 0; i < steps; i++) {
        const stepAmount = distance / steps;
        await page.mouse.wheel(0, stepAmount);
        const pause = mathUtils.randomInRange(20, 60) / scrollSpeed;
        await new Promise(r => setTimeout(r, pause));
    }
}

/**
 * Scroll to top of page.
 * @returns {Promise<void>}
 */
export async function toTop() {
    const page = getPage();
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await new Promise(r => setTimeout(r, mathUtils.randomInRange(300, 600)));
}

/**
 * Scroll to bottom of page.
 * @returns {Promise<void>}
 */
export async function toBottom() {
    const page = getPage();
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }));
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

/**
 * @fileoverview High-Level Kinetic Actions
 * Each action auto-invokes scroll.focus() → cursor move → execute.
 * All behaviors are persona-aware.
 * 
 * @module api/actions
 */

import { getPage, getCursor } from './context.js';
import { focus } from './scroll.js';
import { getPersona } from './persona.js';
import { mathUtils } from '../utils/mathUtils.js';

/**
 * Human-like click on a DOM element.
 * Automatically scrolls to Golden View, moves cursor, and clicks.
 * @param {string} selector - CSS selector to click
 * @param {object} [options]
 * @param {boolean} [options.recovery=false] - Scroll and retry on failure
 * @param {number} [options.maxRetries=2] - Max retry attempts
 * @param {boolean} [options.hoverBeforeClick=false] - Hover with drift before clicking
 * @param {string} [options.precision='normal'] - 'normal' or 'high'
 * @param {string} [options.button='left'] - Mouse button
 * @returns {Promise<{success: boolean, usedFallback: boolean}>}
 */
export async function click(selector, options = {}) {
    const page = getPage();
    const cursor = getCursor();
    const persona = getPersona();
    const {
        recovery = false,
        maxRetries = 2,
        hoverBeforeClick = false,
        precision = 'normal',
        button = 'left',
    } = options;

    // Golden View: scroll + cursor to element
    await focus(selector, { timeout: 5000 }).catch(() => { });

    const locator = page.locator(selector).first();

    // Delegate to GhostCursor's click with persona-calibrated options
    const result = await cursor.click(locator, {
        allowNativeFallback: true,
        hoverBeforeClick,
        hoverMinMs: persona.hoverMin,
        hoverMaxMs: persona.hoverMax,
        precision,
        button,
    });

    // Recovery: scroll and retry if element wasn't found
    if (!result.success && recovery) {
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            await new Promise(r => setTimeout(r, mathUtils.randomInRange(500, 1500)));
            await focus(selector).catch(() => { });
            const retry = await cursor.click(locator, {
                allowNativeFallback: true,
                hoverBeforeClick,
                precision,
                button,
            });
            if (retry.success) return retry;
        }
    }

    return result;
}

/**
 * Human-like typing into a DOM element.
 * Scrolls to Golden View, focuses element, types character-by-character
 * with persona-driven typo injection and correction.
 * @param {string} selector - CSS selector of the input/textarea
 * @param {string} text - Text to type
 * @param {object} [options]
 * @param {number} [options.typoRate] - Override persona typo rate
 * @param {number} [options.correctionRate] - Override persona correction rate
 * @param {boolean} [options.clearFirst=false] - Clear field before typing
 * @returns {Promise<void>}
 */
export async function type(selector, text, options = {}) {
    const page = getPage();
    const persona = getPersona();
    const {
        typoRate = persona.typoRate,
        correctionRate = persona.correctionRate,
        clearFirst = false,
    } = options;

    // Golden View: scroll + cursor to element
    await focus(selector).catch(() => { });

    const locator = page.locator(selector).first();

    // Focus the element
    await locator.click({ timeout: 3000 }).catch(() => { });

    // Clear if requested
    if (clearFirst) {
        await page.keyboard.press('Control+A');
        await page.keyboard.press('Backspace');
        await new Promise(r => setTimeout(r, mathUtils.randomInRange(100, 300)));
    }

    // Type character by character with humanization
    const baseDelay = Math.round(100 / persona.speed); // ms per character

    for (let i = 0; i < text.length; i++) {
        const char = text[i];

        // Typo injection
        if (mathUtils.roll(typoRate)) {
            // Type wrong character
            const wrongChar = _getAdjacentKey(char);
            await page.keyboard.type(wrongChar, { delay: 0 });
            await new Promise(r => setTimeout(r, mathUtils.randomInRange(50, 200)));

            // Maybe correct the typo
            if (mathUtils.roll(correctionRate)) {
                await page.keyboard.press('Backspace');
                await new Promise(r => setTimeout(r, mathUtils.randomInRange(80, 250)));
                await page.keyboard.type(char, { delay: 0 });
            }
        } else {
            await page.keyboard.type(char, { delay: 0 });
        }

        // Inter-character delay with Gaussian distribution
        let charDelay = mathUtils.gaussian(baseDelay, baseDelay * 0.3, 30, baseDelay * 3);

        // Punctuation pause
        if ('.!?,;:'.includes(char)) {
            charDelay += mathUtils.randomInRange(100, 300);
        }

        // Hesitation (persona-driven)
        if (mathUtils.roll(persona.hesitation * 0.5)) {
            charDelay += mathUtils.randomInRange(200, persona.hesitationDelay);
        }

        await new Promise(r => setTimeout(r, charDelay));
    }
}

/**
 * Human-like hover on a DOM element.
 * Scrolls to Golden View, moves cursor, and drifts.
 * @param {string} selector - CSS selector to hover
 * @param {object} [options]
 * @param {number} [options.duration] - Override hover duration
 * @returns {Promise<void>}
 */
export async function hover(selector, options = {}) {
    const page = getPage();
    const cursor = getCursor();
    const persona = getPersona();

    await focus(selector).catch(() => { });

    const locator = page.locator(selector).first();
    const box = await locator.boundingBox();
    if (!box) return;

    const targetX = mathUtils.gaussian(box.x + box.width / 2, box.width / 6);
    const targetY = mathUtils.gaussian(box.y + box.height / 2, box.height / 6);

    const hoverDuration = options.duration || mathUtils.randomInRange(persona.hoverMin, persona.hoverMax);
    await cursor.hoverWithDrift(targetX, targetY, hoverDuration, hoverDuration + 200);
}

/**
 * Right-click on a DOM element.
 * @param {string} selector - CSS selector
 * @param {object} [options] - Same as click() options
 * @returns {Promise<{success: boolean, usedFallback: boolean}>}
 */
export async function rightClick(selector, options = {}) {
    return click(selector, { ...options, button: 'right' });
}

// ─── Internal ────────────────────────────────────────────────────────────────

/** QWERTY keyboard adjacency map for typo simulation */
const ADJACENT_KEYS = {
    a: 'sq', b: 'vn', c: 'xv', d: 'sf', e: 'wr', f: 'dg', g: 'fh',
    h: 'gj', i: 'uo', j: 'hk', k: 'jl', l: 'k;', m: 'n,', n: 'bm',
    o: 'ip', p: 'o[', q: 'wa', r: 'et', s: 'ad', t: 'ry', u: 'yi',
    v: 'cb', w: 'qe', x: 'zc', y: 'tu', z: 'xs',
};

/**
 * Get a random adjacent key for typo simulation.
 * @param {string} char
 * @returns {string}
 */
function _getAdjacentKey(char) {
    const lower = char.toLowerCase();
    const adjacents = ADJACENT_KEYS[lower];
    if (!adjacents) return char;
    const picked = adjacents[Math.floor(Math.random() * adjacents.length)];
    return char === char.toUpperCase() ? picked.toUpperCase() : picked;
}

/**
 * @fileoverview Attention Modeling
 * Simulates human attention and focus patterns - gaze, distractions, exit intent.
 * 
 * @module api/attention
 */

import { getPage, getCursor } from './context.js';
import { getPersona } from './persona.js';
import { think, delay, randomInRange } from './timing.js';
import { scroll } from './scroll.js';
import { mathUtils } from '../utils/mathUtils.js';

// Distraction configuration
let distractionChance = 0.2; // 20% default

/**
 * Set probability of distraction.
 * @param {number} chance - 0.0 to 1.0
 */
export function setDistractionChance(chance) {
    distractionChance = Math.max(0, Math.min(1, chance));
}

/**
 * Get current distraction chance.
 * @returns {number}
 */
export function getDistractionChance() {
    return distractionChance;
}

/**
 * Gaze - move mouse to area and "look" before acting.
 * Simulates human attention: look at area first, then proceed.
 * @param {string} selector - CSS selector to gaze at
 * @param {object} [options]
 * @param {number} [options.duration=1500] - How long to gaze in ms
 * @returns {Promise<void>}
 */
export async function gaze(selector, options = {}) {
    const page = getPage();
    const cursor = getCursor();
    const persona = getPersona();
    const { duration = randomInRange(1000, 2000) } = options;
    
    // Move cursor to element (but don't click)
    const locator = page.locator(selector).first();
    const box = await locator.boundingBox();
    if (!box) return;
    
    const targetX = box.x + box.width / 2;
    const targetY = box.y + box.height / 2;
    
    // Move to target
    await cursor.move(targetX, targetY);
    
    // Gaze duration - "looking at" the element
    const adjustedDuration = duration / persona.speed;
    await think(adjustedDuration);
}

/**
 * Attention - gaze at element, then optionally perform action.
 * This is the main entry point that combines gaze with optional action.
 * @param {string} selector - CSS selector
 * @param {object} [options]
 * @param {number} [options.duration=1500] - Gaze duration
 * @param {boolean} [options.act=true] - Whether to perform action after gaze
 * @returns {Promise<void>}
 */
export async function attention(selector, options = {}) {
    const { duration = randomInRange(1000, 2000), act = true } = options;
    
    // First gaze at the area
    await gaze(selector, { duration });
    
    // Optionally perform action (caller will do this)
    // This is here for API completeness
}

/**
 * Move to random element on page - simulates distraction.
 * @param {string[]} [selectors] - Array of possible selectors to look at
 * @returns {Promise<void>}
 */
export async function distraction(selectors = []) {
    const page = getPage();
    const cursor = getCursor();
    const viewport = page.viewportSize();
    
    if (!viewport) return;
    
    if (selectors.length > 0) {
        // Pick random selector from list
        const selector = selectors[Math.floor(Math.random() * selectors.length)];
        try {
            const locator = page.locator(selector).first();
            const box = await locator.boundingBox();
            if (box) {
                await cursor.move(box.x + box.width / 2, box.y + box.height / 2);
                await think(randomInRange(500, 1500));
                return;
            }
        } catch {
            // Selector not found, continue to random position
        }
    }
    
    // Fallback: random position on page
    const randomX = randomInRange(0, viewport.width);
    const randomY = randomInRange(0, viewport.height);
    await cursor.move(randomX, randomY);
    await think(randomInRange(500, 1500));
}

/**
 * Exit intent - move to navigation area before leaving.
 * Simulates user moving to menu/top bar before closing or navigating away.
 * @param {object} [options]
 * @param {boolean} [options.moveToTop=true] - Move cursor to top of page
 * @param {boolean} [options.pause=true] - Pause at top
 * @returns {Promise<void>}
 */
export async function beforeLeave(options = {}) {
    const page = getPage();
    const cursor = getCursor();
    const { moveToTop = true, pause = true } = options;
    
    if (moveToTop) {
        // Move to top of page (navigation area)
        const viewport = page.viewportSize();
        if (viewport) {
            await cursor.move(viewport.width / 2, 50); // Top center
        }
    }
    
    // Pause to simulate "deciding to leave"
    if (pause) {
        await think(randomInRange(1000, 3000));
    }
}

/**
 * Focus shift - click something else before main target.
 * Simulates human behavior of clicking nearby element first.
 * @param {string} mainSelector - Main target selector
 * @param {string} [shiftSelector] - Optional shift target (nearby element)
 * @returns {Promise<void>}
 */
export async function focusShift(mainSelector, shiftSelector = null) {
    const page = getPage();
    const cursor = getCursor();
    
    // If shiftSelector provided, click it first
    if (shiftSelector) {
        try {
            await page.locator(shiftSelector).first().click();
            await think(randomInRange(300, 800));
        } catch {
            // Shift click failed, continue
        }
    } else {
        // Click near main element (shift focus)
        const locator = page.locator(mainSelector).first();
        const box = await locator.boundingBox();
        if (box) {
            // Click slightly offset from main target
            const offsetX = box.width * 0.3 * (Math.random() > 0.5 ? 1 : -1);
            const targetX = box.x + box.width / 2 + offsetX;
            const targetY = box.y + box.height / 2;
            
            await cursor.move(targetX, targetY);
            await delay(100);
            await page.mouse.click(targetX, targetY);
            await think(randomInRange(200, 600));
        }
    }
}

/**
 * Randomly decide whether to get distracted.
 * Checks persona and distraction chance.
 * @param {string[]} [selectors] - Optional selectors to potentially look at
 * @returns {Promise<boolean>} - True if distraction occurred
 */
export async function maybeDistract(selectors = []) {
    const persona = getPersona();
    const chance = distractionChance + (persona.idleChance || 0);
    
    if (Math.random() < chance) {
        await distraction(selectors);
        return true;
    }
    
    return false;
}

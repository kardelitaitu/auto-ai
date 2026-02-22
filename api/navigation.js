/**
 * @fileoverview Page Navigation (State Transitions)
 * 
 * @module api/navigation
 */

import { getPage } from './context.js';
import { beforeNavigate, randomMouse, fakeRead, pause } from './warmup.js';
import { think, delay, randomInRange } from './timing.js';

export { beforeNavigate, randomMouse, fakeRead, pause };

/**
 * Navigate to a URL.
 * Automatically triggers warmup.beforeNavigate first.
 * @param {string} url - Target URL
 * @param {object} [options]
 * @param {string} [options.waitUntil='domcontentloaded'] - Load event to wait for
 * @param {number} [options.timeout=30000] - Navigation timeout
 * @param {boolean} [options.warmup=true] - Enable pre-navigation warmup
 * @param {boolean} [options.warmupMouse=true] - Warmup: random mouse
 * @param {boolean} [options.warmupFakeRead=false] - Warmup: fake reading
 * @param {boolean} [options.warmupPause=true] - Warmup: decision pause
 * @returns {Promise<void>}
 */
export async function goto(url, options = {}) {
    const page = getPage();
    const { 
        waitUntil = 'domcontentloaded', 
        timeout = 30000,
        warmup = true,
        warmupMouse = true,
        warmupFakeRead = false,
        warmupPause = true
    } = options;
    
    // Auto-warmup before navigation
    if (warmup) {
        await beforeNavigate(url, {
            mouse: warmupMouse,
            fakeRead: warmupFakeRead,
            pause: warmupPause,
        });
    }
    
    // Navigate to URL
    await page.goto(url, { waitUntil, timeout });
    
    // Post-navigation: initial scroll to center
    await delay(randomInRange(500, 1500));
    await page.mouse.wheel(0, randomInRange(100, 300));
}

/**
 * Reload the current page.
 * @returns {Promise<void>}
 */
export async function reload() {
    const page = getPage();
    await page.reload();
}

/**
 * Go back in browser history.
 * @returns {Promise<void>}
 */
export async function back() {
    const page = getPage();
    await page.goBack();
}

/**
 * Go forward in browser history.
 * @returns {Promise<void>}
 */
export async function forward() {
    const page = getPage();
    await page.goForward();
}

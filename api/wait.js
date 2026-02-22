/**
 * @fileoverview Synchronization Helpers
 * Wait for time, selectors, visibility, and hidden states.
 * 
 * @module api/wait
 */

import { getPage } from './context.js';
import { mathUtils } from '../utils/mathUtils.js';

/**
 * Wait for a duration with Gaussian jitter (±15%).
 * @param {number} ms - Base duration in milliseconds
 * @returns {Promise<void>}
 */
export async function wait(ms) {
    const jitter = ms * 0.15 * (Math.random() - 0.5) * 2;
    await new Promise(r => setTimeout(r, Math.max(0, Math.round(ms + jitter))));
}

/**
 * Wait for a selector to be attached to the DOM.
 * @param {string} selector - CSS selector
 * @param {object} [options]
 * @param {number} [options.timeout=10000] - Max wait time in ms
 * @returns {Promise<void>}
 */
export async function waitFor(selector, options = {}) {
    const page = getPage();
    const { timeout = 10000 } = options;
    await page.waitForSelector(selector, { state: 'attached', timeout });
}

/**
 * Wait for a selector to become visible.
 * @param {string} selector - CSS selector
 * @param {object} [options]
 * @param {number} [options.timeout=10000] - Max wait time in ms
 * @returns {Promise<void>}
 */
export async function waitVisible(selector, options = {}) {
    const page = getPage();
    const { timeout = 10000 } = options;
    await page.waitForSelector(selector, { state: 'visible', timeout });
}

/**
 * Wait for a selector to become hidden or detached.
 * @param {string} selector - CSS selector
 * @param {object} [options]
 * @param {number} [options.timeout=10000] - Max wait time in ms
 * @returns {Promise<void>}
 */
export async function waitHidden(selector, options = {}) {
    const page = getPage();
    const { timeout = 10000 } = options;
    await page.waitForSelector(selector, { state: 'hidden', timeout });
}

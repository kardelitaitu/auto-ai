/**
 * @fileoverview Synchronization Helpers
 * Wait for time, selectors, visibility, and hidden states.
 * 
 * @module api/wait
 */

import { getPage } from '../core/context.js';
import { getLocator } from '../utils/locator.js';

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
 * @param {string|import('playwright').Locator} selector - CSS selector or Locator
 * @param {object} [options]
 * @param {number} [options.timeout=10000] - Max wait time in ms
 * @returns {Promise<void>}
 */
export async function waitFor(selector, options = {}) {
    const { timeout = 10000, state = 'attached' } = options;
    const locator = getLocator(selector);
    await locator.waitFor({ state, timeout });
}

/**
 * Wait for a selector to become visible.
 * @param {string|import('playwright').Locator} selector - CSS selector or Locator
 * @param {object} [options]
 * @param {number} [options.timeout=10000] - Max wait time in ms
 * @returns {Promise<void>}
 */
export async function waitVisible(selector, options = {}) {
    const { timeout = 10000 } = options;
    const locator = getLocator(selector).first();
    await locator.waitFor({ state: 'visible', timeout });
}

/**
 * Wait for a selector to become hidden or detached.
 * @param {string|import('playwright').Locator} selector - CSS selector or Locator
 * @param {object} [options]
 * @param {number} [options.timeout=10000] - Max wait time in ms
 * @returns {Promise<void>}
 */
export async function waitHidden(selector, options = {}) {
    const { timeout = 10000 } = options;
    const locator = getLocator(selector).first();
    await locator.waitFor({ state: 'hidden', timeout });
}

export async function waitForLoadState(state = 'networkidle', options = {}) {
    const page = getPage();
    const { timeout = 10000 } = options;
    await page.waitForLoadState(state, { timeout });
}

export async function waitForURL(urlOrPredicate, options = {}) {
    const page = getPage();
    const { timeout = 10000, waitUntil } = options;
    await page.waitForURL(urlOrPredicate, { timeout, waitUntil });
}

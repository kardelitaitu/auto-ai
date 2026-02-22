/**
 * @fileoverview Page Navigation (State Transitions)
 * 
 * @module api/navigation
 */

import { getPage } from './context.js';

/**
 * Navigate to a URL.
 * @param {string} url - Target URL
 * @param {object} [options]
 * @param {string} [options.waitUntil='domcontentloaded'] - Load event to wait for
 * @param {number} [options.timeout=30000] - Navigation timeout
 * @returns {Promise<void>}
 */
export async function goto(url, options = {}) {
    const page = getPage();
    const { waitUntil = 'domcontentloaded', timeout = 30000 } = options;
    await page.goto(url, { waitUntil, timeout });
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

/**
 * @fileoverview Read-Only DOM Queries
 * Simple extraction functions with zero humanization or entropy.
 * 
 * @module api/queries
 */

import { getPage } from './context.js';

/**
 * Extract innerText from an element.
 * @param {string} selector - CSS selector
 * @returns {Promise<string>}
 */
export async function text(selector) {
    const page = getPage();
    return page.locator(selector).first().innerText();
}

/**
 * Extract a DOM attribute value.
 * @param {string} selector - CSS selector
 * @param {string} name - Attribute name
 * @returns {Promise<string|null>}
 */
export async function attr(selector, name) {
    const page = getPage();
    return page.locator(selector).first().getAttribute(name);
}

/**
 * Check if an element is visible in the layout.
 * @param {string} selector - CSS selector
 * @returns {Promise<boolean>}
 */
export async function visible(selector) {
    const page = getPage();
    return page.locator(selector).first().isVisible().catch(() => false);
}

/**
 * Count matching elements.
 * @param {string} selector - CSS selector
 * @returns {Promise<number>}
 */
export async function count(selector) {
    const page = getPage();
    return page.locator(selector).count();
}

/**
 * Check if at least one matching element exists in the DOM.
 * @param {string} selector - CSS selector
 * @returns {Promise<boolean>}
 */
export async function exists(selector) {
    return (await count(selector)) > 0;
}

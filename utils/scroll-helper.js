/**
 * @fileoverview Scroll Helper - Drop-in replacement for page.mouse.wheel()
 * Applies global scroll multiplier automatically
 * 
 * Usage:
 *   // OLD: await page.mouse.wheel(0, 300);
 *   // NEW: await scrollWheel(page, 300);
 * 
 *   // OLD: await page.mouse.wheel(0, mathUtils.randomInRange(150, 300));
 *   // NEW: await scrollWheelRandom(page, 150, 300);
 * 
 * @module utils/scroll-helper
 */

import { globalScroll } from './global-scroll-controller.js';

/**
 * Wrapper for page.mouse.wheel() with global multiplier
 * @param {object} page - Playwright page
 * @param {number} deltaY - Vertical scroll amount (positive=down, negative=up)
 * @param {object} options - { delay: number }
 */
export async function scrollWheel(page, deltaY, options = {}) {
  await globalScroll.scrollBy(page, deltaY, options);
}

/**
 * Scroll down with multiplier
 * @param {object} page - Playwright page  
 * @param {number} amount - Pixels to scroll down
 * @param {object} options - { delay: number }
 */
export async function scrollDown(page, amount, options = {}) {
  await globalScroll.scrollDown(page, amount, options);
}

/**
 * Scroll up with multiplier
 * @param {object} page - Playwright page
 * @param {number} amount - Pixels to scroll up
 * @param {object} options - { delay: number }
 */
export async function scrollUp(page, amount, options = {}) {
  await globalScroll.scrollUp(page, amount, options);
}

/**
 * Random scroll with multiplier
 * @param {object} page - Playwright page
 * @param {number} min - Minimum scroll amount
 * @param {number} max - Maximum scroll amount
 * @param {object} options - { delay: number }
 */
export async function scrollRandom(page, min, max, options = {}) {
  await globalScroll.scrollRandom(page, min, max, options);
}

/**
 * Scroll to top of page
 * @param {object} page - Playwright page
 * @param {object} options - { behavior: 'auto'|'smooth' }
 */
export async function scrollToTop(page, options = {}) {
  await globalScroll.scrollToTop(page, options);
}

/**
 * Scroll to bottom of page
 * @param {object} page - Playwright page
 * @param {object} options - { behavior: 'auto'|'smooth' }
 */
export async function scrollToBottom(page, options = {}) {
  await globalScroll.scrollToBottom(page, options);
}

/**
 * Quick scroll helper - handles both positive and negative
 * Use this for one-liners: await scroll(page, 300);
 * @param {object} page - Playwright page
 * @param {number} amount - Scroll amount (positive=down, negative=up)
 */
export async function scroll(page, amount) {
  await globalScroll.scrollBy(page, amount);
}

/**
 * Get current scroll multiplier
 * @returns {number} Current multiplier (e.g., 1.5 for 50% faster)
 */
export function getScrollMultiplier() {
  return globalScroll.getMultiplier();
}

// Re-export the controller for advanced usage
export { globalScroll } from './global-scroll-controller.js';

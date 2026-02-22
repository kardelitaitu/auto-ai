/**
 * @fileoverview Error Recovery Behavior
 * Human-like error handling and recovery for automation actions.
 * 
 * @module api/recover
 */

import { getPage } from './context.js';
import { think, delay, randomInRange } from './timing.js';
import { scroll, focus } from './scroll.js';

/**
 * Recover from unexpected navigation.
 * If URL changed after an action, go back to restore previous state.
 * @returns {Promise<boolean>} - True if recovery was needed and performed
 */
export async function recover() {
    const page = getPage();
    const currentUrl = page.url();
    
    // This would be called after an action to check if unintended navigation occurred
    // Implementation depends on storing previous URL before actions
    // For now, just a placeholder that returns false
    return false;
}

/**
 * Check if URL changed unexpectedly after an action.
 * @param {string} previousUrl - URL before action
 * @returns {Promise<boolean>}
 */
export async function urlChanged(previousUrl) {
    const page = getPage();
    const currentUrl = page.url();
    return currentUrl !== previousUrl;
}

/**
 * Go back in history - used when wrong click caused navigation.
 * @returns {Promise<void>}
 */
export async function goBack() {
    const page = getPage();
    await think(randomInRange(500, 1500)); // Brief "confusion" pause
    await page.goBack();
    await delay(randomInRange(1000, 2000)); // Wait for page to load
}

/**
 * Find element by scrolling and searching.
 * Used when element is not immediately visible.
 * @param {string} selector - CSS selector to find
 * @param {object} [options]
 * @param {number} [options.maxRetries=3] - Maximum scroll/search cycles
 * @param {boolean} [options.scrollOnFail=true] - Scroll when not found
 * @returns {Promise<boolean>} - True if element found
 */
export async function findElement(selector, options = {}) {
    const page = getPage();
    const { maxRetries = 3, scrollOnFail = true } = options;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        // Check if element exists
        const count = await page.locator(selector).count();
        if (count > 0) {
            const isVisible = await page.locator(selector).first().isVisible().catch(() => false);
            if (isVisible) {
                return true;
            }
        }
        
        // Scroll down to look for element
        if (scrollOnFail && attempt < maxRetries - 1) {
            await scroll(randomInRange(300, 600));
            await delay(randomInRange(500, 1000));
        }
    }
    
    return false;
}

/**
 * Smart click with error recovery.
 * @param {string} selector - CSS selector
 * @param {object} [options]
 * @param {boolean} [options.recovery=true] - Enable error recovery
 * @param {number} [options.maxRetries=3] - Max retry attempts
 * @param {boolean} [options.scrollOnFail=true] - Scroll and try again if not found
 * @returns {Promise<{success: boolean, recovered: boolean}>}
 */
export async function smartClick(selector, options = {}) {
    const page = getPage();
    const { 
        recovery = true, 
        maxRetries = 3, 
        scrollOnFail = true 
    } = options;
    
    const previousUrl = page.url();
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            // Try to find and click element
            const locator = page.locator(selector).first();
            const isVisible = await locator.isVisible().catch(() => false);
            
            if (!isVisible) {
                if (scrollOnFail && attempt < maxRetries - 1) {
                    await scroll(randomInRange(200, 400));
                    continue;
                }
                continue;
            }
            
            // Perform click
            await locator.click();
            
            // Check if URL changed unexpectedly
            if (recovery) {
                const changed = await urlChanged(previousUrl);
                if (changed) {
                    // Wrong click - recover
                    await think(randomInRange(500, 1500)); // Frustration pause
                    await goBack();
                    return { success: false, recovered: true };
                }
            }
            
            return { success: true, recovered: false };
            
        } catch (error) {
            // Action failed - pause and retry
            if (attempt < maxRetries - 1) {
                const pauseTime = Math.pow(2, attempt) * 1000; // Exponential backoff
                await think(pauseTime);
            }
        }
    }
    
    return { success: false, recovered: false };
}

/**
 * Undo last action if possible.
 * Currently supports going back in history.
 * @returns {Promise<boolean>} - True if undo was performed
 */
export async function undo() {
    const page = getPage();
    // Note: page.history() may not be available in all Playwright versions
    // This is a simplified implementation
    await goBack();
    return true;
}

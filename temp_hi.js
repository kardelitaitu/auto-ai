/**
 * Human Interaction Utilities
 * Provides human-like behavior patterns for automation
 * @module utils/human-interaction
 */

import { createLogger } from './logger.js';
import { mathUtils } from './mathUtils.js';
import { entropy as _entropy } from './entropyController.js';
import { GhostCursor } from './ghostCursor.js';

const logger = createLogger('human-interaction.js');

export class HumanInteraction {
    constructor(page = null) {
        this.debugMode = process.env.HUMAN_DEBUG === 'true';
        this.page = page;
        this.ghost = null;
        if (page) {
            this.ghost = new GhostCursor(page);
        }
    }

    /**
     * Set page reference and initialize GhostCursor
     * Call this before using human-like clicking methods
     */
    setPage(page) {
        this.page = page;
        this.ghost = new GhostCursor(page);
    }

    /**
     * Human-like click using GhostCursor simulated mouse
     * Includes: scroll into view, fixation delay, micro-movements, and ghost click
     */
    async humanClick(element, description = 'Target') {
        if (!this.page || !this.ghost) {
            this.logWarn(`[humanClick] No page/ghost initialized`);
            throw new Error('ghost_not_initialized');
        }

        this.logDebug(`[humanClick] Starting human-like click on ${description}`);
        
        try {
            await element.evaluate(el => el.scrollIntoView({ block: 'center', inline: 'center' }));
            await new Promise(resolve => setTimeout(resolve, mathUtils.randomInRange(300, 600)));
            const ghostResult = await this.ghost.click(element, {
                label: description,
                hoverBeforeClick: true
            });
            if (!ghostResult?.success) {
                throw new Error('ghost_click_failed');
            }
            this.logDebug(`[humanClick] Successfully clicked ${description}`);
        } catch (e) {
            this.logDebug(`[humanClick] Failed on ${description}: ${e.message}`);
            throw e;
        }
    }

    /**
     * Safe human-like click with retry logic
     * Wraps humanClick with automatic retry on failure
     * @param {Object} element - Playwright locator or element handle
     * @param {string} description - Description for logging
     * @param {number} retries - Number of retry attempts (default: 3)
     * @returns {Promise<boolean>} - True if successful, false if all retries failed
     */
    async safeHumanClick(element, description = 'Target', retries = 3) {
        const attemptLogs = [];
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                await this.humanClick(element, description);
                this.logDebug(`[safeHumanClick] [${description}] Success on attempt ${attempt}/${retries}`);
                return true;
            } catch (error) {
                attemptLogs.push(`Attempt ${attempt}: ${error.message}`);
                this.logWarn(`[safeHumanClick] [${description}] Attempt ${attempt}/${retries} failed: ${error.message}`);
                if (attempt === retries) {
                    this.logWarn(`[safeHumanClick] [${description}] All retries exhausted. Errors: ${attemptLogs.join('; ')}`);
                    return false;
                }
                // Exponential backoff: 1s, 2s, 3s...
                const delay = 1000 * attempt;
                this.logDebug(`[safeHumanClick] [${description}] Waiting ${delay}ms before retry ${attempt + 1}...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        return false;
    }

    /**
     * Get random method based on weights
     */
    selectMethod(methods) {
        const roll = Math.random() * 100;
        let cumulative = 0;

        for (const method of methods) {
            cumulative += method.weight;
            if (roll <= cumulative) {
                this.logDebug(`[MethodSelect] Selected: ${method.name} (roll: ${roll.toFixed(1)}, threshold: ${cumulative.toFixed(1)})`);
                return method;
            }
        }

        return methods[0];
    }

    /**
     * Human-like pre-action delay
     */
    async hesitation(min = 300, max = 1500) {
        const delay = mathUtils.randomInRange(min, max);
        this.logDebug(`[Hesitation] Waiting ${delay}ms before action...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return delay;
    }

    /**
     * Human-like reading delay
     */
    async readingTime(min = 5000, max = 15000) {
        const time = mathUtils.randomInRange(min, max);
        this.logDebug(`[Reading] Reading for ${time}ms...`);
        await new Promise(resolve => setTimeout(resolve, time));
        return time;
    }

    /**
     * Random scroll during reading (30% probability)
     */
    async maybeScroll(page, min = 100, max = 300) {
        if (Math.random() < 0.3) {
            const scrollAmount = mathUtils.randomInRange(min, max);
            const direction = Math.random() < 0.5 ? scrollAmount : -scrollAmount;
            this.logDebug(`[Scroll] Random scroll: ${direction}px`);
            await page.evaluate((y) => window.scrollBy(0, y), direction);
            return true;
        }
        return false;
    }

    /**
     * Micro mouse movement
     */
    async microMove(page, range = 20) {
        const x = mathUtils.randomInRange(-range, range);
        const y = mathUtils.randomInRange(-range, range);
        this.logDebug(`[MicroMove] Mouse: ${x}, ${y}`);
        await page.mouse.move(x, y);
    }

    /**
     * Target fixation (pause before clicking)
     */
    async fixation(min = 200, max = 800) {
        const time = mathUtils.randomInRange(min, max);
        this.logDebug(`[Fixation] Fixating for ${time}ms...`);
        await new Promise(resolve => setTimeout(resolve, time));
        return time;
    }

    /**
     * Find element with multiple selectors
     * @returns {Promise<any>}
     */
    async findElement(page, selectors, options = {}) {
        const { visibleOnly = true, timeout = 5000 } = options;
        const startTime = Date.now();

        for (const selector of selectors) {
            const elapsed = Date.now() - startTime;
            if (elapsed > timeout) {
                this.logDebug(`[FindElement] Timeout reached`);
                break;
            }

            try {
                const elements = await page.locator(selector).all();
                this.logDebug(`[FindElement] Selector "${selector}": ${elements.length} elements`);

                for (let i = 0; i < elements.length; i++) {
                    try {
                        const el = elements[i];
                        if (visibleOnly) {
                            if (await el.isVisible()) {
                                this.logDebug(`[FindElement] Found visible element at index ${i}`);
                                return { element: el, selector, index: i };
                            }
                        } else {
                            return { element: el, selector, index: i };
                        }
                    } catch (e) {
                        this.logDebug(`[FindElement] Element ${i} error: ${e.message}`);
                    }
                }
            } catch (e) {
                this.logDebug(`[FindElement] Selector "${selector}" error: ${e.message}`);
            }
        }

        return { element: null, selector: null, index: -1 };
    }

    /**
     * Verify composer is open and get the best textarea locator
     */
    async verifyComposerOpen(page) {
        const composerSelectors = [
            '[data-testid="tweetTextarea_0"]',
            '[contenteditable="true"][role="textbox"]',
            '[data-testid="tweetTextarea"]',
            '[class*="composer"] textarea',
            'textarea[placeholder*="Post your reply"]',
            'textarea[placeholder*="What\'s happening"]',
            '[role="textbox"][contenteditable="true"]'
        ];

        this.logDebug(`[Verify] Checking if composer is open...`);

        // First, try to find the most reliable selector
        for (const selector of composerSelectors) {
            try {
                const el = page.locator(selector).first();
                if (await el.count() > 0) {
                    const isVisible = await el.isVisible();
                    const box = await el.boundingBox();
                    
                    this.logDebug(`[Verify] Selector "${selector}": visible=${isVisible}, box=${box ? 'found' : 'none'}`);
                    
                    if (isVisible && box && box.width > 50 && box.height > 20) {
                        this.logDebug(`[Verify] Composer open with: ${selector}`);
                        
                        // Double check it's not a stale element
                        const textContent = await el.inputValue().catch(() => '');
                        this.logDebug(`[Verify] Element has value: ${textContent.length > 0 ? 'yes' : 'empty'}`);
                        
                        return { open: true, selector, locator: el };
                    }
                }
            } catch (e) {
                this.logDebug(`[Verify] Selector "${selector}" error: ${e.message}`);
            }
        }

        // Try one more time with longer wait
        await new Promise(resolve => setTimeout(resolve, 500));
        
        for (const selector of composerSelectors) {
            try {
                const el = page.locator(selector).first();
                if (await el.count() > 0 && await el.isVisible()) {
                    this.logDebug(`[Verify] Late detection: ${selector}`);
                    return { open: true, selector, locator: el };
                }
            } catch {
                // Ignore error, continue to typing
            }
        }

        this.logDebug(`[Verify] Composer not open`);
        return { open: false, selector: null, locator: null };
    }

    /**
     * Verify post was sent (composer closed or confirmation shown)
     */
    async verifyPostSent(page) {
        const checks = [
            { selector: '[data-testid="toast"]', label: 'toast notification' },
            { selector: '[aria-label*="Post"]', label: 'post aria' },
            { selector: '[data-testid="tweetTextarea_0"]', label: 'composer closed', invert: true }
        ];

        this.logDebug(`[Verify] Checking if post was sent...`);

        for (const check of checks) {
            try {
                const el = page.locator(check.selector).first();
                const count = await el.count();

                if (check.invert) {
                    if (count === 0) {
                        this.logDebug(`[Verify] ${check.label}: confirmed`);
                        return { sent: true, method: check.label };
                    }
                } else {
                    if (count > 0) {
                        const text = await el.innerText().catch(() => '');
                        this.logDebug(`[Verify] ${check.label}: found (${text.substring(0, 30)})`);
                        return { sent: true, method: check.label };
                    }
                }
            } catch (_e) {
                // Ignore error, continue to next check
            }
        }

        // Check URL changed back
        const url = page.url();
        if (!url.includes('compose')) {
            this.logDebug(`[Verify] URL no longer has compose: confirmed`);
            return { sent: true, method: 'url_change' };
        }

        // Additional verification: wait a bit and check again if not confirmed
        this.logDebug(`[Verify] Post not immediately confirmed, waiting...`);
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Final check: composer should be closed
        const composerVisible = await page.locator('[data-testid="tweetTextarea_0"]').isVisible().catch(() => false);
        if (!composerVisible) {
            this.logDebug(`[Verify] Composer closed after wait: confirmed`);
            return { sent: true, method: 'composer_closed' };
        }

        // Last resort: check if we're back on the timeline
        const finalUrl = page.url();
        if (!finalUrl.includes('compose') && (finalUrl.includes('twitter.com') || finalUrl.includes('x.com'))) {
            this.logDebug(`[Verify] Back on timeline: confirmed`);
            return { sent: true, method: 'timeline_return' };
        }

        return { sent: false, method: null };
    }

    /**
     * Type text with human-like delays and robust focus handling
     */
    async typeText(page, text, inputEl) {
        // Ensure we have page reference for ghost cursor
        if (!this.page || this.page !== page) {
            this.setPage(page);
        }

        // Step 1: Clear any existing text first using human-like click
        try {
            await this.humanClick(inputEl, 'Text Input - Clear');
            await page.keyboard.press('Control+a');
            await new Promise(resolve => setTimeout(resolve, 200));
        } catch (e) {
            this.logDebug(`[Type] Clear text failed: ${e.message}`);
        }

        // Step 2: Multiple focus strategies
        const focused = await this.ensureFocus(page, inputEl);
        if (!focused) {
            this.logWarn(`[Type] Could not focus element, trying alternative approach...`);
            // Fallback: use keyboard to focus
            await page.keyboard.press('Tab');
            await new Promise(resolve => setTimeout(resolve, 300));
        }

        // Step 3: Verify we're focused by checking active element
        const activeCheck = await page.evaluate(() => {
            const el = document.activeElement;
            return {
                tagName: el?.tagName,
                isContentEditable: el?.getAttribute('contenteditable') === 'true',
                hasFocus: el === document.querySelector('[data-testid="tweetTextarea_0"]') || 
                          el === document.querySelector('[contenteditable="true"]')
            };
        });
        
        this.logDebug(`[Type] Active element: ${activeCheck.tagName}, contentEditable: ${activeCheck.isContentEditable}`);

        // If still not focused, try force clicking as last resort
        if (!activeCheck.isContentEditable && !activeCheck.tagName?.toLowerCase().includes('textarea')) {
            this.logDebug(`[Type] Not focused correctly, trying force click fallback...`);
            try {
                await inputEl.click({ force: true });
                await new Promise(resolve => setTimeout(resolve, 200));
            } catch (_e) {
                // Ignore error
            }
        }

        // Human-like typing with variations
        const baseDelay = mathUtils.randomInRange(80, 150);
        const punctuationPause = mathUtils.randomInRange(200, 400);
        const spacePause = mathUtils.randomInRange(100, 200);
        
        // Pre-create Set for O(1) lookup instead of O(n) Array.includes()
        const punctuationSet = new Set(['.', '!', '?', ',', ';', ':']);

        this.logDebug(`[Type] Starting to type ${text.length} chars...`);

        for (let i = 0; i < text.length; i++) {
            const char = text[i];

            if (char === ' ') {
                await new Promise(resolve => setTimeout(resolve, spacePause));
            } else if (punctuationSet.has(char)) {
                await new Promise(resolve => setTimeout(resolve, punctuationPause));
            } else {
                await new Promise(resolve => setTimeout(resolve, baseDelay));
            }

            // Occasional longer pause (thinking)
            if (Math.random() < 0.05 && i < text.length - 1) {
                const pause = mathUtils.randomInRange(300, 800);
                this.logDebug(`[Type] Thinking pause: ${pause}ms`);
                await new Promise(resolve => setTimeout(resolve, pause));
            }

            await page.keyboard.type(char);
        }

        const duration = mathUtils.randomInRange(500, 1000);
        this.logDebug(`[Type] Finished typing`);
        await new Promise(resolve => setTimeout(resolve, duration));
    }

    /**
     * Ensure element is focused with multiple strategies
     * Uses human-like clicking with GhostCursor
     */
    async ensureFocus(page, element) {
        // Ensure we have page reference
        if (!this.page || this.page !== page) {
            this.setPage(page);
        }

        const focusStrategies = [
            // Strategy 1: Human-like click with GhostCursor
            async () => {
                try {
                    await this.humanClick(element, 'Focus Target');
                    await new Promise(resolve => setTimeout(resolve, 200));
                    return true;
                } catch {
                    return false;
                }
            },
            // Strategy 2: Focus method (no click needed)
            async () => {
                try {
                    await element.focus();
                    await new Promise(resolve => setTimeout(resolve, 200));
                    return true;
                } catch {
                    return false;
                }
            },
        ];

        for (let i = 0; i < focusStrategies.length; i++) {
            try {
                const result = await focusStrategies[i]();
                if (result) {
                    // Verify focus worked
                    const isFocused = await page.evaluate(() => {
                        const el = document.activeElement;
                        return (el?.getAttribute('contenteditable') === 'true') || 
                               el?.tagName === 'TEXTAREA' || 
                               el?.tagName === 'INPUT';
                    });
                    
                    if (isFocused) {
                        this.logDebug(`[EnsureFocus] Strategy ${i + 1} succeeded`);
                        return true;
                    }
                }
            } catch (e) {
                this.logDebug(`[EnsureFocus] Strategy ${i + 1} failed: ${e.message}`);
            }
        }

        this.logDebug(`[EnsureFocus] All strategies failed`);
        return false;
    }

    /**
     * Post with Ctrl+Enter or fallback
     */
    async postTweet(page) {
        this.logDebug(`[Post] Attempting to post...`);

        // Try Ctrl+Enter first
        await page.keyboard.press('Control+Enter');
        await new Promise(resolve => setTimeout(resolve, 500));

        // Verify
        const result = await this.verifyPostSent(page);
        if (result.sent) {
            this.logDebug(`[Post] Success via ${result.method}`);
            return { success: true, method: 'ctrl_enter' };
        }

        // Fallback: Click button
        const postSelectors = [
            '[data-testid="tweetButton"]',
            '[data-testid="sendTweets"]',
            '[aria-label="Post"]',
            '[class*="post"]',
            'button[type="submit"]'
        ];

        for (const selector of postSelectors) {
            try {
                const btn = page.locator(selector).first();
                if (await btn.count() > 0 && await btn.isVisible()) {
                    this.logDebug(`[Post] Clicking: ${selector}`);
                    await this.humanClick(btn, 'Post Button');
                    await new Promise(resolve => setTimeout(resolve, 500));

                    const result2 = await this.verifyPostSent(page);
                    if (result2.sent) {
                        this.logDebug(`[Post] Success via button: ${selector}`);
                        return { success: true, method: 'button_click' };
                    }
                }
            } catch (e) {
                this.logDebug(`[Post] Button "${selector}" error: ${e.message}`);
            }
        }

        this.logDebug(`[Post] Failed - no method worked`);
        return { success: false, reason: 'post_failed' };
    }

    // =========================================================================
    // SELECTOR FALLBACK METHODS - Reduces element not found errors
    // =========================================================================

    /**
     * Find element with fallback selectors chain
     * Reduces element not found errors by trying multiple selectors
     * @param {string[]} selectors - Array of selectors to try (ordered by priority)
     * @param {object} options - Options for visibility check
     * @returns {Promise<object|null>} - Found element info or null
     */
    async findWithFallback(selectors, options = {}) {
        const { visible = true, timeout = 5000, logLevel: _logLevel = 'debug' } = options;
        
        const startTime = Date.now();
        
        for (let i = 0; i < selectors.length; i++) {
            const selector = selectors[i];
            const elapsed = Date.now() - startTime;
            
            if (elapsed >= timeout) {
                this.logWarn(`[Fallback] Timeout reached after ${elapsed}ms, stopping search`);
                break;
            }
            
            try {
                const element = this.page.locator(selector).first();
                
                // Check if element exists
                const count = await element.count();
                if (count === 0) {
                    this.logDebug(`[Fallback] Selector ${i + 1}/${selectors.length} not found: ${selector}`);
                    continue;
                }
                
                // Check visibility if required
                if (visible) {
                    const isVisible = await element.isVisible().catch(() => false);
                    if (!isVisible) {
                        this.logDebug(`[Fallback] Selector ${i + 1}/${selectors.length} not visible: ${selector}`);
                        continue;
                    }
                }
                
                this.logDebug(`[Fallback] Found element with selector ${i + 1}/${selectors.length}: ${selector}`);
                return { element, selector, index: i };
            } catch (error) {
                this.logDebug(`[Fallback] Error with selector ${i + 1}/${selectors.length} (${selector}): ${error.message}`);
                continue;
            }
        }
        
        this.logWarn(`[Fallback] All ${selectors.length} selectors failed`);
        return null;
    }

    /**
     * Find multiple elements with fallback selectors
     * @param {string[]} selectors - Array of selectors to try
     * @param {object} options - Options
     * @returns {Promise<object[]>} - Array of element locators
     */
    async findAllWithFallback(selectors, options = {}) {
        const { visible = true, limit = 20 } = options;
        
        for (const selector of selectors) {
            try {
                const elements = this.page.locator(selector);
                const count = await elements.count();
                
                if (count > 0) {
                    const results = [];
                    const actualLimit = Math.min(count, limit);
                    
                    for (let i = 0; i < actualLimit; i++) {
                        const el = elements.nth(i);
                        
                        if (visible) {
                            if (await el.isVisible().catch(() => false)) {
                                results.push(el);
                            }
                        } else {
                            results.push(el);
                        }
                    }
                    
                    if (results.length > 0) {
                        this.logDebug(`[Fallback] Found ${results.length} visible elements with: ${selector}`);
                        return results;
                    }
                }
            } catch (error) {
                this.logDebug(`[Fallback] Error with selector (${selector}): ${error.message}`);
                continue;
            }
        }
        
        return [];
    }

    /**
     * Click element with automatic fallback selector chain
     * Tries multiple selectors if primary fails
     * @param {string[]} selectors - Array of selectors to try
     * @param {string} description - Description for logging
     * @param {object} options - Click options
     * @returns {Promise<boolean>} - True if successful
     */
    async clickWithFallback(selectors, description = 'Element', options = {}) {
        for (let i = 0; i < selectors.length; i++) {
            const selector = selectors[i];
            
            try {
                const element = this.page.locator(selector).first();
                const count = await element.count();
                
                if (count === 0) {
                    this.logDebug(`[ClickFallback] Selector ${i + 1}/${selectors.length} not found: ${selector}`);
                    continue;
                }
                
                if (!await element.isVisible().catch(() => false)) {
                    this.logDebug(`[ClickFallback] Selector ${i + 1}/${selectors.length} not visible: ${selector}`);
                    continue;
                }
                
                this.logDebug(`[ClickFallback] Clicking ${description} with: ${selector}`);
                await this.humanClick(element, description);
                return true;
            } catch (error) {
                this.logDebug(`[ClickFallback] Error with selector ${i + 1}/${selectors.length} (${selector}): ${error.message}`);
                continue;
            }
        }
        
        this.logWarn(`[ClickFallback] All selectors failed for: ${description}`);
        return false;
    }

    /**
     * Wait for element with multiple selector fallbacks
     * @param {string[]} selectors - Array of selectors
     * @param {object} options - Wait options
     * @returns {Promise<object|null>} - Element info or null
     */
    async waitForWithFallback(selectors, options = {}) {
        const { visible = true, timeout = 5000, state = 'visible' } = options;
        
        for (const selector of selectors) {
            try {
                const element = this.page.locator(selector);
                
                await element.first().waitFor({ state, timeout: Math.min(timeout, 10000) });
                
                if (visible) {
                    if (await element.first().isVisible().catch(() => false)) {
                        this.logDebug(`[WaitFallback] Found: ${selector}`);
                        return { element: element.first(), selector };
                    }
                } else {
                    this.logDebug(`[WaitFallback] Found: ${selector}`);
                    return { element: element.first(), selector };
                }
            } catch (_error) {
                this.logDebug(`[WaitFallback] Not found within timeout: ${selector}`);
                continue;
            }
        }
        
        return null;
    }

    // =========================================================================
    // LOGGING HELPERS
    // =========================================================================

    /**
     * Debug logging helper
     */
    logDebug(message) {
        if (this.debugMode) {
            logger.debug(message);
        }
    }

    /**
     * Warning logging helper
     */
    logWarn(message) {
        logger.warn(message);
    }

    /**
     * Log step in a sequence
     */
    logStep(stepName, details = '') {
        logger.debug(`[STEP] ${stepName}${details ? ': ' + details : ''}`);
    }
}

export default HumanInteraction;

/**
 * @fileoverview Action Engine - Executes JSON actions on the Browser (Safe Layer)
 * Merged from local-agent/core/actionEngine.js
 * @module api/agent/actionEngine
 */

import { createLogger } from '../core/logger.js';

const logger = createLogger('api/agent/actionEngine.js');

/**
 * @typedef {Object} ActionResult
 * @property {boolean} success - Whether the action succeeded
 * @property {boolean} done - Whether the agent task is complete
 * @property {string} error - Error message if failed
 */

/**
 * @typedef {Object} Action
 * @property {string} action - Action type: click, type, press, scroll, navigate, wait, done, screenshot
 * @property {string} [selector] - Element selector
 * @property {string} [value] - Value for type/navigate/scroll/wait
 * @property {string} [key] - Key for press action
 */

class ActionEngine {
    /**
     * Executes a single JSON action on the page
     * @param {object} page - The Playwright page instance.
     * @param {Action} action - { action: "click|type|press|scroll|navigate|wait|done", selector?, value?, key? }
     * @param {string} [sessionId='unknown']
     * @returns {Promise<ActionResult>}
     */
    async execute(page, action, sessionId = 'unknown') {
        if (!action || !action.action) {
            return { success: false, done: false, error: "No action specified" };
        }

        try { await page.bringToFront(); } catch (_e) { /* ignore if already closed */ }

        let target = action.selector;
        if (!target) {
            if (action.action === 'done') target = 'Task Completion';
            else if (action.action === 'navigate' || action.action === 'goto') target = 'Page URL';
            else if (action.action === 'wait' || action.action === 'delay') target = 'Timer';
            else if (action.action === 'press') target = 'Keyboard';
            else if (action.action === 'scroll') target = 'Window';
            else target = 'N/A';
        }
        logger.info(`Executing Action: ${action.action} on ${target}`);

        try {
            switch (action.action) {
                case 'click':
                    await this.performClick(page, action.selector);
                    break;
                case 'type':
                    await this.performType(page, action.selector, action.value);
                    break;
                case 'press':
                    await this.performPress(page, action.key || action.value);
                    break;
                case 'scroll':
                    await this.performScroll(page, action.value);
                    break;
                case 'navigate':
                case 'goto':
                    await this.performNavigate(page, action.value);
                    break;
                case 'wait':
                case 'delay':
                    await this.performWait(page, action.value);
                    break;
                case 'screenshot':
                    await this.performScreenshot(page, sessionId);
                    break;
                case 'done':
                    logger.info('Agent indicates task completion.');
                    return { done: true, success: true, error: "" };
                default:
                    return { success: false, done: false, error: `Unknown action: ${action.action}` };
            }
            return { success: true, done: false, error: "" };
        } catch (e) {
            logger.error(`Action Execution Failed: ${e.message}`);
            return { success: false, done: false, error: e.message };
        }
    }

    /**
     * Resolve a locator from a string selector
     * @param {object} page - Playwright page
     * @param {string} selector - Selector string
     * @returns {object} Playwright locator
     */
    getLocator(page, selector) {
        if (typeof selector !== 'string') throw new Error('Selector must be a string');

        if (selector.startsWith('role=')) {
            const parts = selector.split(',').map(s => s.trim());
            const rolePart = parts.find(p => p.startsWith('role='));
            const namePart = parts.find(p => p.startsWith('name='));

            if (rolePart) {
                const role = rolePart.split('=')[1];
                const options = {};
                if (namePart) {
                    let name = namePart.split('=')[1];
                    if ((name.startsWith('"') && name.endsWith('"')) || (name.startsWith("'") && name.endsWith("'"))) {
                        name = name.slice(1, -1);
                    }
                    options.name = name;
                }
                return page.getByRole(role, options).first();
            }
        }

        if (selector.startsWith('text=')) {
            const text = selector.substring(5);
            return page.getByText(text).first();
        }

        return page.locator(selector).first();
    }

    /**
     * Click an element
     * @param {object} page - Playwright page
     * @param {string} selector - Element selector
     */
    async performClick(page, selector) {
        const locator = this.getLocator(page, selector);
        await locator.waitFor({ state: 'visible', timeout: 5000 });
        await locator.click();
    }

    /**
     * Type into an element
     * @param {object} page - Playwright page
     * @param {string} selector - Element selector
     * @param {string} value - Text to type
     */
    async performType(page, selector, value) {
        const locator = this.getLocator(page, selector);
        await locator.waitFor({ state: 'visible', timeout: 5000 });
        await locator.click();
        await locator.fill(value);
    }

    /**
     * Press a key
     * @param {object} page - Playwright page
     * @param {string} key - Key to press
     */
    async performPress(page, key) {
        if (!key) throw new Error("Key is required for press action");
        logger.info(`Pressing key: ${key}`);
        await page.keyboard.press(key);
    }

    /**
     * Scroll the page
     * @param {object} page - Playwright page
     * @param {string} directionOrValue - Direction: up, down, top, bottom or pixel value
     */
    async performScroll(page, directionOrValue) {
        if (directionOrValue === 'down') {
            await page.evaluate(() => window.scrollBy(0, 500));
        } else if (directionOrValue === 'up') {
            await page.evaluate(() => window.scrollBy(0, -500));
        } else if (directionOrValue === 'bottom') {
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        } else if (directionOrValue === 'top') {
            await page.evaluate(() => window.scrollTo(0, 0));
        } else if (directionOrValue === 'done') {
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        }
    }

    /**
     * Navigate to a URL
     * @param {object} page - Playwright page
     * @param {string} url - URL to navigate to
     */
    async performNavigate(page, url) {
        if (!url) throw new Error("URL is required for navigate action");

        if (!/^https?:\/\//i.test(url)) {
            url = 'https://' + url;
        }

        logger.info(`Navigating to: ${url}`);
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    }

    /**
     * Wait for a specified time
     * @param {object} page - Playwright page
     * @param {string} value - Wait time in milliseconds
     */
    async performWait(page, value) {
        const ms = parseInt(value, 10);
        if (isNaN(ms)) {
            throw new Error(`Invalid wait time: ${value}`);
        }
        logger.info(`Waiting for ${ms}ms...`);
        await page.waitForTimeout(ms);
    }

    /**
     * Take a screenshot
     * @param {object} page - Playwright page
     * @param {string} sessionId - Session ID for filename
     */
    async performScreenshot(page, sessionId) {
        logger.info('Taking screenshot...');
        const timestamp = Date.now();
        const filename = `screenshot-${sessionId}-${timestamp}.png`;
        await page.screenshot({ path: `./screenshot/${filename}` });
    }
}

const actionEngine = new ActionEngine();

export { actionEngine };
export default actionEngine;

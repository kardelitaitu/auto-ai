/**
 * @fileoverview Executes Actions on the Browser (Safe Layer)
 * @module local-agent/core/actionEngine
 */

import { createLogger } from '../../utils/logger.js';
import { takeScreenshot } from '../../utils/screenshot.js';

const logger = createLogger('actionEngine.js');

class ActionEngine {

    /**
     * Executes a single JSON action on the page
     * @param {object} page - The Playwright page instance.
     * @param {object} action - { action: "click|type|press|scroll|navigate|wait|done", selector?, value?, key? }
     * @returns {Promise<{success: boolean, done: boolean, error: string}>}
     */
    async execute(page, action, sessionId = 'unknown') {
        if (!action || !action.action) {
            return { success: false, done: false, error: "No action specified" };
        }

        // Ensure tab is focused (critical for multi-tab concurrency)
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
     * Helper to resolve a locator from a string selector.
     */
    getLocator(page, selector) {
        if (typeof selector !== 'string') throw new Error('Selector must be a string');

        // Handle "role=..., name=..." pattern
        if (selector.startsWith('role=')) {
            const parts = selector.split(',').map(s => s.trim());
            const rolePart = parts.find(p => p.startsWith('role='));
            const namePart = parts.find(p => p.startsWith('name='));

            if (rolePart) {
                const role = rolePart.split('=')[1];
                const options = {};
                if (namePart) {
                    // Remove quotes if present
                    let name = namePart.split('=')[1];
                    if ((name.startsWith('"') && name.endsWith('"')) || (name.startsWith("'") && name.endsWith("'"))) {
                        name = name.slice(1, -1);
                    }
                    options.name = name;
                }
                return page.getByRole(role, options).first();
            }
        }

        // Handle "text=..."
        if (selector.startsWith('text=')) {
            const text = selector.substring(5);
            return page.getByText(text).first();
        }

        // Default CSS/XPath
        return page.locator(selector).first();
    }

    async performClick(page, selector) {
        const locator = this.getLocator(page, selector);
        await locator.waitFor({ state: 'visible', timeout: 5000 });
        await locator.click();
    }

    async performType(page, selector, value) {
        const locator = this.getLocator(page, selector);
        await locator.waitFor({ state: 'visible', timeout: 5000 });
        await locator.click(); // Focus
        await locator.fill(value);
    }

    async performPress(page, key) {
        if (!key) throw new Error("Key is required for press action");
        logger.info(`Pressing key: ${key}`);
        await page.keyboard.press(key);
    }

    async performScroll(page, directionOrValue) {
        // Simple scroll logic for now
        if (directionOrValue === 'down') {
            await page.evaluate(() => window.scrollBy(0, 500));
        } else if (directionOrValue === 'up') {
            await page.evaluate(() => window.scrollBy(0, -500));
        } else if (directionOrValue === 'bottom') {
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        } else if (directionOrValue === 'top') {
            await page.evaluate(() => window.scrollTo(0, 0));
        }
    }

    async performNavigate(page, url) {
        if (!url) throw new Error("URL is required for navigate action");

        // Auto-prefix protocol if missing
        if (!/^https?:\/\//i.test(url)) {
            url = 'https://' + url;
        }

        logger.info(`Navigating to: ${url}`);
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    }

    async performWait(page, value) {
        const ms = parseInt(value, 10);
        if (isNaN(ms)) {
            throw new Error(`Invalid wait time: ${value}`);
        }
        logger.info(`Waiting for ${ms}ms...`);
        await page.waitForTimeout(ms);
    }

    async performScreenshot(page, sessionId) {
        logger.info('Taking screenshot...');
        await takeScreenshot(page, sessionId);
    }
}

export default new ActionEngine();

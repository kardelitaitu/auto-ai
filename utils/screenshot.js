/**
 * @fileoverview Utility for capturing standardized screenshots.
 * Saves JPEGs with 0.5 quality to the 'screenshot' directory.
 * Naming convention: yyyy-mm-dd-hh-mm-ss-[sessionname].jpg
 */

import fs from 'fs';
import path from 'path';
import { createLogger } from './logger.js';

const logger = createLogger('screenshot.js');

/**
 * Captures a screenshot of the current page.
 * @param {object} page - The Playwright page instance.
 * @param {string} sessionName - The session identifier (e.g., 'session-1').
 * @param {string} suffix - Optional suffix to append after session name (e.g., 'Task-1').
 * @returns {Promise<string|null>} The absolute path to the screenshot, or null if failed.
 */
export async function takeScreenshot(page, sessionName = 'unknown', suffix = '') {
    try {
        const screenshotDir = path.resolve(process.cwd(), 'screenshot');

        if (!fs.existsSync(screenshotDir)) {
            fs.mkdirSync(screenshotDir, { recursive: true });
        }

        let actualSize = { width: 0, height: 0 };
        if (page && typeof page.evaluate === 'function') {
            actualSize = await page.evaluate(() => ({
                width: window.innerWidth,
                height: window.innerHeight
            }));
        }

        if (page && typeof page.setViewportSize === 'function' && actualSize.width && actualSize.height) {
            await page.setViewportSize({ width: actualSize.width, height: actualSize.height });
        }

        const now = new Date();
        const pad = (n) => n.toString().padStart(2, '0');
        const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}h-${pad(now.getMinutes())}m-${pad(now.getSeconds())}s`;

        const safeSessionName = sessionName.replace(/[:\\/<>:"|?*]/g, '-');
        const filename = suffix ? `${timestamp}-[${safeSessionName}]${suffix}.jpg` : `${timestamp}-[${safeSessionName}].jpg`;
        const filepath = path.join(screenshotDir, filename);

        await page.screenshot({
            path: filepath,
            type: 'jpeg',
            quality: 30,
            fullPage: false
        });

        logger.info(`📸 Screenshot saved: ${filename} (${actualSize.width}x${actualSize.height})`);
        return filepath;

    } catch (error) {
        logger.error(`Failed to take screenshot: ${error.message}`);
        return null;
    }
}

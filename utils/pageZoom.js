import { api } from '../api/index.js';
/**
 * Page Zoom Utilities
 * Provides keyboard and mouse-based zoom control for Playwright pages
 * @module utils/pageZoom
 */

import { createLogger } from './logger.js';
import { _mathUtils } from './mathUtils.js';

const logger = createLogger('pageZoom.js');

/**
 * Zoom in the page using keyboard shortcut or mouse wheel fallback
 * @param {Object} page - Playwright page object
 * @param {number} times - Number of zoom steps (1-5, default: 1)
 * @returns {Promise<{success: boolean, method: string}>}
 */
export async function pageZoomIn(page, times = 1) {
    times = Math.min(Math.max(times, 1), 5);
    logger.info(`[pageZoom] Zooming IN ${times} time(s)`);

    try {
        for (let i = 0; i < times; i++) {
            await page.keyboard.press('Control+=');
            await api.wait(1000);
        }
        logger.info(`[pageZoom] Zoom IN successful using keyboard (${times} steps)`);
        return { success: true, method: 'keyboard' };
    } catch (keyboardError) {
        logger.warn(`[pageZoom] Keyboard zoom failed, falling back to mouse wheel: ${keyboardError.message}`);
        
        try {
            const viewport = await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));
            const centerX = viewport.width / 2;
            const centerY = viewport.height / 2;
            
            for (let i = 0; i < times; i++) {
                await page.mouse.move(centerX, centerY);
                await page.mouse.wheel(0, -300);
                await api.wait(1000);
            }
            logger.info(`[pageZoom] Zoom IN successful using mouse wheel fallback (${times} steps)`);
            return { success: true, method: 'mouse_wheel' };
        } catch (wheelError) {
            logger.error(`[pageZoom] Mouse wheel fallback failed: ${wheelError.message}`);
            return { success: false, method: 'none', reason: wheelError.message };
        }
    }
}

/**
 * Zoom out the page using keyboard shortcut or mouse wheel fallback
 * @param {Object} page - Playwright page object
 * @param {number} times - Number of zoom steps (1-5, default: 1)
 * @returns {Promise<{success: boolean, method: string}>}
 */
export async function pageZoomOut(page, times = 1) {
    times = Math.min(Math.max(times, 1), 5);
    logger.info(`[pageZoom] Zooming OUT ${times} time(s)`);

    try {
        for (let i = 0; i < times; i++) {
            await page.keyboard.press('Control+-');
            await api.wait(1000);
        }
        logger.info(`[pageZoom] Zoom OUT successful using keyboard (${times} steps)`);
        return { success: true, method: 'keyboard' };
    } catch (keyboardError) {
        logger.warn(`[pageZoom] Keyboard zoom failed, falling back to mouse wheel: ${keyboardError.message}`);
        
        try {
            const viewport = await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));
            const centerX = viewport.width / 2;
            const centerY = viewport.height / 2;
            
            for (let i = 0; i < times; i++) {
                await page.mouse.move(centerX, centerY);
                await page.mouse.wheel(0, 300);
                await api.wait(1000);
            }
            logger.info(`[pageZoom] Zoom OUT successful using mouse wheel fallback (${times} steps)`);
            return { success: true, method: 'mouse_wheel' };
        } catch (wheelError) {
            logger.error(`[pageZoom] Mouse wheel fallback failed: ${wheelError.message}`);
            return { success: false, method: 'none', reason: wheelError.message };
        }
    }
}

/**
 * Reset page zoom to 100% using keyboard shortcut
 * @param {Object} page - Playwright page object
 * @returns {Promise<{success: boolean, method: string}>}
 */
export async function pageZoomReset(page) {
    logger.info(`[pageZoom] Resetting zoom to 100%`);

    try {
        await page.keyboard.press('Control+0');
        await api.wait(1000);
        logger.info(`[pageZoom] Zoom reset successful using keyboard`);
        return { success: true, method: 'keyboard' };
    } catch (keyboardError) {
        logger.warn(`[pageZoom] Keyboard reset failed, trying JavaScript: ${keyboardError.message}`);
        
        try {
            await page.evaluate(() => {
                document.body.style.zoom = '100%';
                document.body.style.transform = 'scale(1)';
                document.body.style.transformOrigin = 'top left';
            });
            await api.wait(1000);
            logger.info(`[pageZoom] Zoom reset successful using JavaScript`);
            return { success: true, method: 'javascript' };
        } catch (jsError) {
            logger.error(`[pageZoom] JavaScript reset failed: ${jsError.message}`);
            return { success: false, method: 'none', reason: jsError.message };
        }
    }
}

/**
 * Get current zoom level of the page
 * @param {Object} page - Playwright page object
 * @returns {Promise<number>} Current zoom level (e.g., 100 for 100%)
 */
export async function getPageZoom(page) {
    try {
        const zoom = await page.evaluate(() => {
            const style = window.getComputedStyle(document.body);
            return parseFloat(style.zoom) || 
                   parseFloat(document.body.style.zoom) || 
                   1 * 100;
        });
        return zoom;
    } catch (error) {
        logger.error(`[pageZoom] Failed to get zoom level: ${error.message}`);
        return 100;
    }
}

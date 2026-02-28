import { api } from '../api/index.js';
/**
 * Twitter Close Media Utilities
 * Provides human-like methods to close expanded media on Twitter
 * @module utils/twitterCloseMedia
 */

import { createLogger } from './logger.js';
import { _mathUtils } from './mathUtils.js';
import { GhostCursor } from './ghostCursor.js';

const logger = createLogger('twitterCloseMedia.js');

/**
 * Close expanded media on Twitter using escape or close button
 * @param {Object} page - Playwright page object
 * @param {Object} options - Optional configuration
 * @param {number} options.escapeChance - Chance to use escape key (0-1, default: 0.5)
 * @param {number} options.timeout - Timeout for URL detection in ms (default: 2000)
 * @returns {Promise<{success: boolean, method: string, reason: string}>}
 */
export async function twitterCloseMedia(page, options = {}) {
    const {
        escapeChance = 0.5,
        timeout = 2000
    } = options;

    const urlBefore = api.getCurrentUrl();
    const isMediaModalOpenBefore = await page.$('[aria-label="Close"]') !== null;
    
    logger.info(`[twitterCloseMedia] Starting close media flow (URL: ${urlBefore})`);

    if (!isMediaModalOpenBefore) {
        logger.info(`[twitterCloseMedia] No media modal detected, skipping close`);
        return { 
            success: true, 
            method: 'none', 
            reason: 'no_media_modal_open' 
        };
    }

    const useEscape = Math.random() < escapeChance;

    if (useEscape) {
        logger.info(`[twitterCloseMedia] Attempting to close with Escape key (50% chance)`);
        
        try {
            await page.keyboard.press('Escape');
            await api.wait(1000);
            
            const success = await verifyMediaClosed(page, urlBefore, timeout);
            
            if (success) {
                logger.info(`[twitterCloseMedia] Successfully closed media using Escape key`);
                return { 
                    success: true, 
                    method: 'escape', 
                    reason: 'media_closed' 
                };
            } else {
                logger.warn(`[twitterCloseMedia] Escape didn't close media, trying close button`);
                return await closeWithButton(page, urlBefore, timeout);
            }
        } catch (error) {
            logger.error(`[twitterCloseMedia] Escape key failed: ${error.message}`);
            return await closeWithButton(page, urlBefore, timeout);
        }
    } else {
        return await closeWithButton(page, urlBefore, timeout);
    }
}

/**
 * Close media using the close button with ghost click
 * @param {Object} page - Playwright page object
 * @param {string} urlBefore - URL before closing
 * @param {number} timeout - Timeout for verification
 * @returns {Promise<{success: boolean, method: string, reason: string}>}
 */
async function closeWithButton(page, urlBefore, timeout) {
    logger.info(`[twitterCloseMedia] Attempting to close with button click (ghost click)`);
    
    try {
        const ghost = new GhostCursor(page);
        
        const closeButton = await page.$('[aria-label="Close"]');
        
        if (!closeButton) {
            logger.warn(`[twitterCloseMedia] Close button not found with [aria-label="Close"]`);
            
            const alternativeSelectors = [
                '[role="button"][aria-label="Close"]',
                'button[aria-label="Close"]',
                '.css-175oi2z[aria-label="Close"]',
                'div[aria-label="Close"][role="button"]'
            ];
            
            for (const selector of alternativeSelectors) {
                const altButton = await page.$(selector);
                if (altButton) {
                    logger.info(`[twitterCloseMedia] Found close button with alternative selector: ${selector}`);
                    await ghost.click(altButton, { 
                        label: 'Close Media Button',
                        hoverBeforeClick: true,
                        forceClick: true 
                    });
                    break;
                }
            }
            
            const stillOpen = await page.$('[aria-label="Close"]');
            if (stillOpen) {
                logger.error(`[twitterCloseMedia] Could not find any close button`);
                return { 
                    success: false, 
                    method: 'button_click', 
                    reason: 'close_button_not_found' 
                };
            }
        } else {
            await ghost.click(closeButton, { 
                label: 'Close Media Button',
                hoverBeforeClick: true,
                forceClick: true 
            });
        }
        
        await api.wait(1000);
        
        const success = await verifyMediaClosed(page, urlBefore, timeout);
        
        if (success) {
            logger.info(`[twitterCloseMedia] Successfully closed media using ghost click`);
            return { 
                success: true, 
                method: 'button_click', 
                reason: 'media_closed' 
            };
        } else {
            logger.warn(`[twitterCloseMedia] Button click didn't close media`);
            return { 
                success: false, 
                method: 'button_click', 
                reason: 'media_not_closed' 
            };
        }
    } catch (error) {
        logger.error(`[twitterCloseMedia] Button click failed: ${error.message}`);
        return { 
            success: false, 
            method: 'button_click', 
            reason: error.message 
        };
    }
}

/**
 * Verify that media modal has been closed
 * @param {Object} page - Playwright page object
 * @param {string} urlBefore - URL before closing attempt
 * @param {number} timeout - Max time to wait for close
 * @returns {Promise<boolean>}
 */
async function verifyMediaClosed(page, urlBefore, timeout) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
        const urlAfter = api.getCurrentUrl();
        const closeButton = await page.$('[aria-label="Close"]');
        
        const urlChanged = urlBefore !== urlAfter;
        const modalClosed = closeButton === null;
        
        if (urlChanged || modalClosed) {
            logger.info(`[twitterCloseMedia] Verification: URL changed=${urlChanged}, Modal closed=${modalClosed}`);
            return true;
        }
        
        await api.wait(1000);
    }
    
    return false;
}

/**
 * Check if media modal is currently open
 * @param {Object} page - Playwright page object
 * @returns {Promise<boolean>}
 */
export async function isMediaModalOpen(page) {
    const closeButton = await page.$('[aria-label="Close"]');
    const mediaOverlay = await page.$('[data-testid="overlay"]');
    const mediaModal = await page.$('div[role="dialog"][aria-label]');
    
    return closeButton !== null || mediaOverlay !== null || mediaModal !== null;
}

/**
 * Wait for media modal to appear
 * @param {Object} page - Playwright page object
 * @param {number} timeout - Max time to wait in ms (default: 5000)
 * @returns {Promise<boolean>}
 */
export async function waitForMediaModal(page, timeout = 5000) {
    try {
        await page.waitForSelector('[aria-label="Close"]', { timeout });
        return true;
    } catch {
        return false;
    }
}

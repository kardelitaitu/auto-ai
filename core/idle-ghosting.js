/**
 * @fileoverview Idle Ghosting - Simulates active idle behaviors during latency.
 * Part of the Distributed Agentic Orchestration (DAO) architecture.
 * @module core/idle-ghosting
 */

import { createLogger } from '../utils/logger.js';

const logger = createLogger('idle-ghosting.js');

/**
 * @class IdleGhosting
 * @description Simulates subtle human-like behaviors during agent latency (API calls, etc.).
 * Prevents detection via stationary cursor patterns.
 */
class IdleGhosting {
    constructor() {
        /** @type {boolean} Whether ghosting is currently active */
        this.isActive = false;

        /** @type {IntervalId} Wiggle interval */
        this.wiggleInterval = null;

        /** @type {number} Wiggle frequency in ms */
        this.wiggleFrequency = 2000;

        /** @type {number} Wiggle magnitude in pixels */
        this.wiggleMagnitude = 5;

        logger.info('IdleGhosting initialized');
    }

    /**
     * Start idle ghosting behaviors on a page.
     * @param {playwright.Page} page - The Playwright page.
     * @param {object} [options={}] - Ghosting options.
     * @param {boolean} [options.wiggle=true] - Enable cursor wiggle.
     * @param {boolean} [options.scroll=false] - Enable random micro-scrolls.
     * @returns {Promise<void>}
     */
    async start(page, options = {}) {
        const { wiggle = true, scroll = false } = options;

        if (this.isActive) {
            logger.debug('[IdleGhosting] Already active, skipping start');
            return;
        }

        this.isActive = true;
        logger.debug('[IdleGhosting] Starting active idle behaviors...');

        // Start cursor wiggle
        if (wiggle) {
            await this._startCursorWiggle(page);
        }

        // Start micro-scrolls (optional)
        if (scroll) {
            await this._startMicroScroll(page);
        }
    }

    /**
     * Stop all idle ghosting behaviors.
     * @returns {Promise<void>}
     */
    async stop() {
        if (!this.isActive) {
            return;
        }

        logger.debug('[IdleGhosting] Stopping active idle behaviors');

        if (this.wiggleInterval) {
            clearInterval(this.wiggleInterval);
            this.wiggleInterval = null;
        }

        this.isActive = false;
    }

    /**
     * Start subtle cursor wiggle.
     * @param {playwright.Page} page - The Playwright page.
     * @returns {Promise<void>}
     * @private
     */
    async _startCursorWiggle(page) {
        // Initial random move
        await this._randomWiggle(page);

        // Set up interval for periodic wiggles
        this.wiggleInterval = setInterval(async () => {
            if (this.isActive) {
                try {
                    await this._randomWiggle(page);
                } catch (error) {
                    logger.warn('[IdleGhosting] Wiggle failed:', error.message);
                }
            }
        }, this.wiggleFrequency);
    }

    /**
     * Perform a single random wiggle.
     * @param {playwright.Page} page - The Playwright page.
     * @returns {Promise<void>}
     * @private
     */
    async _randomWiggle(page) {
        try {
            // Get current viewport size
            const viewport = page.viewportSize() || { width: 1920, height: 1080 };

            // Random position near center
            const centerX = viewport.width / 2;
            const centerY = viewport.height / 2;

            const offsetX = (Math.random() - 0.5) * this.wiggleMagnitude * 2;
            const offsetY = (Math.random() - 0.5) * this.wiggleMagnitude * 2;

            const x = centerX + offsetX;
            const y = centerY + offsetY;

            // Move mouse
            await page.mouse.move(x, y);

            logger.debug(`[IdleGhosting] Wiggle → (${Math.round(x)}, ${Math.round(y)})`);

        } catch (error) {
            // Silently fail if page is closed
            if (!error.message.includes('Target closed')) {
                throw error;
            }
        }
    }

    /**
     * Perform random micro-scrolls.
     * @param {playwright.Page} page - The Playwright page.
     * @returns {Promise<void>}
     * @private
     */
    async _startMicroScroll(_page) {
        // Placeholder for micro-scroll implementation
        // In production, this would occasionally scroll by small amounts (10-50px)
        logger.debug('[IdleGhosting] Micro-scroll feature not yet implemented');

        /* FUTURE IMPLEMENTATION:
        setInterval(async () => {
          if (this.isActive) {
            const scrollDelta = Math.random() > 0.5 ? 20 : -20;
            await page.evaluate((delta) => {
              window.scrollBy(0, delta);
            }, scrollDelta);
          }
        }, 5000);
        */
    }

    /**
     * Check if ghosting is active.
     * @returns {boolean} True if active.
     */
    isGhosting() {
        return this.isActive;
    }

    /**
     * Set wiggle parameters.
     * @param {number} frequency - Frequency in ms.
     * @param {number} magnitude - Magnitude in pixels.
     */
    setWiggleParams(frequency, magnitude) {
        this.wiggleFrequency = frequency;
        this.wiggleMagnitude = magnitude;
        logger.info(`[IdleGhosting] Wiggle params updated: ${frequency}ms, ${magnitude}px`);
    }

    /**
     * Get ghosting statistics.
     * @returns {object} Statistics.
     */
    getStats() {
        return {
            isActive: this.isActive,
            wiggleFrequency: this.wiggleFrequency,
            wiggleMagnitude: this.wiggleMagnitude
        };
    }
}

export default IdleGhosting;

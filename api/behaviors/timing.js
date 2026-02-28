/**
 * @fileoverview Timing & Delay Helpers
 * Persona-aware delays wrapping human-timing.js and mathUtils.js.
 * 
 * @module api/timing
 */

import { humanTiming } from '../utils/timing.js';
import { mathUtils } from '../utils/math.js';
import { getPersona } from './persona.js';
import { getPage } from '../core/context.js';
import { createLogger } from '../core/logger.js';

const _logger = createLogger('api/timing.js');

/**
 * Random "thinking" pause. Simulates cognitive decision-making.
 * If no argument: 1-5s with Gaussian distribution.
 * duration scales with page performance (impatience).
 * @param {number} [ms] - Optional center duration in ms
 * @returns {Promise<void>}
 */
export async function think(ms) {
    const page = getPage();
    const persona = getPersona();
    const base = ms || mathUtils.randomInRange(1000, 5000);

    // Performance-Aware Impatience (Ghost 3.0)
    let performanceMultiplier = 1.0;
    try {
        const stats = await page.evaluate(() => {
            const nav = performance.getEntriesByType('navigation')[0];
            const paint = performance.getEntriesByType('paint');
            const lcp = performance.getEntriesByType('largest-contentful-paint').pop();

            return {
                loadTime: nav ? nav.duration : Infinity,
                firstPaint: paint.length > 0 ? paint[0].startTime : Infinity,
                lcp: lcp ? lcp.startTime : Infinity,
                // Simple main thread lag proxy (rough)
                lag: (() => {
                    const start = Date.now();
                    for (let i = 0; i < 1e6; i++) {
                        void i;
                    }
                    return Date.now() - start;
                })()
            };
        });

        // If page feels "heavy" (LCP > 2.5s or main thread lag > 50ms), human impatient
        if (stats.lcp > 2500 || stats.lag > 50) {
            performanceMultiplier = 0.75; // 25% faster decision-making/skipping
            // logger.debug(`[Impatience] Triggered due to LCP: ${stats.lcp}ms / Lag: ${stats.lag}ms`);
        }
    } catch (_e) {
        void _e;
    }

    const adjusted = Math.round((base * performanceMultiplier) / persona.speed);
    const jittered = humanTiming.humanDelay(adjusted, { jitter: 0.2 });
    await new Promise(r => setTimeout(r, jittered));
}


/**
 * Humanized delay with Gaussian jitter.
 * @param {number} ms - Base delay in milliseconds
 * @returns {Promise<void>}
 */
export async function delay(ms) {
    const jittered = humanTiming.humanDelay(ms);
    await new Promise(r => setTimeout(r, jittered));
}

/**
 * Gaussian distribution (re-export from mathUtils).
 * @param {number} mean - Center of distribution
 * @param {number} dev - Standard deviation
 * @param {number} [min] - Optional minimum bound
 * @param {number} [max] - Optional maximum bound
 * @returns {number}
 */
export function gaussian(mean, dev, min, max) {
    return mathUtils.gaussian(mean, dev, min, max);
}

/**
 * Random integer in range (re-export from mathUtils).
 * @param {number} min - Minimum (inclusive)
 * @param {number} max - Maximum (inclusive)
 * @returns {number}
 */
export function randomInRange(min, max) {
    return mathUtils.randomInRange(min, max);
}

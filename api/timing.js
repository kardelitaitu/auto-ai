/**
 * @fileoverview Timing & Delay Helpers
 * Persona-aware delays wrapping human-timing.js and mathUtils.js.
 * 
 * @module api/timing
 */

import { humanTiming } from '../utils/human-timing.js';
import { mathUtils } from '../utils/mathUtils.js';
import { getPersona } from './persona.js';

/**
 * Random "thinking" pause. Simulates cognitive decision-making.
 * If no argument: 1-5s with Gaussian distribution.
 * If ms provided: Gaussian around that value with ±20% jitter.
 * @param {number} [ms] - Optional center duration in ms
 * @returns {Promise<void>}
 */
export async function think(ms) {
    const persona = getPersona();
    const base = ms || mathUtils.randomInRange(1000, 5000);
    const adjusted = Math.round(base / persona.speed);
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

/**
 * @fileoverview Idle Simulation
 * Simulates human presence during idle periods - mouse wiggle, occasional scrolling.
 * 
 * @module api/idle
 */

import { getPage, getCursor } from './context.js';
import { randomInRange } from './timing.js';

let idleInterval = null;
let isIdleRunning = false;

/**
 * Start idle ghosting - random micro-movements when idle.
 * @param {object} [options]
 * @param {boolean} [options.wiggle=true] - Cursor micro-movements
 * @param {boolean} [options.scroll=true] - Occasional scrolling
 * @param {number} [options.frequency=3000] - Movement interval in ms
 * @param {number} [options.magnitude=5] - Movement range in pixels
 * @returns {void}
 */
export function start(options = {}) {
    const { 
        wiggle = true, 
        scroll = true, 
        frequency = 3000, 
        magnitude = 5 
    } = options;
    
    if (isIdleRunning) {
        return; // Already running
    }
    
    isIdleRunning = true;
    
    const page = getPage();
    const cursor = getCursor();
    
    idleInterval = setInterval(async () => {
        try {
            if (wiggle) {
                // Mouse wiggle
                const currentPos = cursor.previousPos || { x: 0, y: 0 };
                const deltaX = randomInRange(-magnitude, magnitude);
                const deltaY = randomInRange(-magnitude, magnitude);
                
                await cursor.move(
                    Math.max(0, currentPos.x + deltaX),
                    Math.max(0, currentPos.y + deltaY)
                );
            }
            
            if (scroll && Math.random() > 0.7) {
                // Occasional micro-scroll (30% chance)
                const scrollAmount = randomInRange(-50, 50);
                await page.mouse.wheel(0, scrollAmount);
            }
        } catch {
            // Ignore errors during idle
        }
    }, frequency);
}

/**
 * Stop idle ghosting.
 * @returns {void}
 */
export function stop() {
    if (idleInterval) {
        clearInterval(idleInterval);
        idleInterval = null;
    }
    isIdleRunning = false;
}

/**
 * Check if idle simulation is running.
 * @returns {boolean}
 */
export function isRunning() {
    return isIdleRunning;
}

/**
 * Perform a single idle wiggle.
 * @param {number} [magnitude=5] - Movement range in pixels
 * @returns {Promise<void>}
 */
export async function wiggle(magnitude = 5) {
    const cursor = getCursor();
    const currentPos = cursor.previousPos || { x: 0, y: 0 };
    
    const deltaX = randomInRange(-magnitude, magnitude);
    const deltaY = randomInRange(-magnitude, magnitude);
    
    await cursor.move(
        Math.max(0, currentPos.x + deltaX),
        Math.max(0, currentPos.y + deltaY)
    );
}

/**
 * Perform a single idle scroll.
 * @param {number} [distance=30] - Scroll distance
 * @returns {Promise<void>}
 */
export async function idleScroll(distance = 30) {
    const page = getPage();
    const direction = Math.random() > 0.5 ? 1 : -1;
    await page.mouse.wheel(0, distance * direction);
}

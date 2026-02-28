/**
 * @fileoverview A utility for simulating random zooming on a page.
 * @module utils/randomZoom
 */

import { createLogger } from './logger.js';
import { getTimeoutValue } from './configLoader.js';

const logger = createLogger('randomZoom.js');

/**
 * Creates a promise that resolves after a specified delay.
 * @param {number} ms - The delay in milliseconds.
 * @returns {Promise<void>}
 * @private
 */
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const CHROMIUM_ZOOM_LEVELS = [
  0.5, 0.67, 0.75, 0.8, 0.9, 1.1, 1.25, 1.5
];

/**
 * Picks a random element from a given array.
 * @param {Array<any>} arr - The array to pick from.
 * @returns {any} A random element from the array.
 * @private
 */
const getRandomElement = (arr) => {
  return arr[Math.floor(Math.random() * arr.length)];
};

/**
 * @param {object} page - The Playwright page object.
 * @param {number} zoomLevel - The zoom level to apply.
 * @returns {Promise<void>}
 * @private
 */
async function setZoom(page, zoomLevel) {
  try {
    await page.evaluate((zoom) => {
      if (document.body) {
        document.body.style.zoom = zoom;
      }
    }, zoomLevel);
    logger.debug(`Set page content zoom to ${zoomLevel * 100}%`);
  } catch (error) {
    logger.error(`Failed to set page zoom: ${error.message}`);
  }
}

/**
 * Factory function that creates a random zoomer for a given Playwright page.
 * @param {object} page - The Playwright page object.
 * @returns {function(number): Promise<void>} An asynchronous function that performs random zooming.
 * @example
 * const zoomer = createRandomZoomer(page);
 * await zoomer(10); // Zooms randomly for 10 seconds.
 */
export default function createRandomZoomer(page) {
  
  /**
   * Performs random zooming on a page for a given duration.
   * @param {number} durationInSeconds - The total duration in seconds for the simulation.
   * @returns {Promise<void>}
   */
  return async function randomZooming(durationInSeconds) {
    logger.debug(`Starting random zoom simulation for ${durationInSeconds} seconds.`);
    
    const durationInMs = durationInSeconds * 1000;
    const startTime = Date.now();
    const endTime = startTime + durationInMs;

    const [minWait, maxWait] = await Promise.all([
      getTimeoutValue('automation.zoom.minWaitMs', 2000),
      getTimeoutValue('automation.zoom.maxWaitMs', 5000)
    ]);

    try {
      while (Date.now() < endTime) {
        const remainingTime = endTime - Date.now();
        if (remainingTime <= 0) break;

        const nextZoom = getRandomElement(CHROMIUM_ZOOM_LEVELS); 
        await setZoom(page, nextZoom);

        const waitDuration = Math.random() * (maxWait - minWait) + minWait;
        await delay(Math.min(waitDuration, remainingTime));
      }
    } catch (error) {
      if (page.isClosed()) {
        logger.warn('Page was closed during zoom simulation. Halting.');
      } else {
        logger.error(`Error during zoom loop: ${error.message}`);
      }
    } finally {
      if (!page.isClosed()) {
        logger.debug('Simulation finished. Setting final zoom to 75%.');
        await setZoom(page, 0.75);
      }
    }
  };
}


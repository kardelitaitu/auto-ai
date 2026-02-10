/**
 * @fileoverview A utility for simulating human-like random scrolling on a page.
 * @module utils/randomScrolling
 */

import { createLogger } from './logger.js';
import { getTimeoutValue } from './configLoader.js';
import { scrollRandom } from './scroll-helper.js';

const logger = createLogger('randomScrolling.js');

/**
 * Creates a promise that resolves after a specified delay.
 * @param {number} ms - The delay in milliseconds.
 * @returns {Promise<void>}
 * @private
 */
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Generates a random integer within a specified range.
 * @param {number} min - The minimum value (inclusive).
 * @param {number} max - The maximum value (inclusive).
 * @returns {number} A random integer.
 * @private
 */
const getRandomInt = (min, max) => {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

/**
 * Factory function that creates a human-like scroller for a given Playwright page.
 * @param {object} page - The Playwright page object to scroll.
 * @returns {function(number): Promise<void>} An asynchronous function that performs random scrolling.
 * @example
 * const scroller = createRandomScroller(page);
 * await scroller(30); // Scrolls randomly for 30 seconds.
 */
export default function createRandomScroller(page) {
  
  /**
   * Simulates human-like "reading" scrolling on a page for a given duration.
   * @param {number} durationInSeconds - The total duration in seconds to perform the scrolling simulation.
   * @returns {Promise<void>}
   */
  return async function randomScrolling(durationInSeconds) {
    logger.debug(`Starting human-like scrolling for ${durationInSeconds.toFixed(2)} seconds.`);
    
    const durationInMs = durationInSeconds * 1000;
    const startTime = Date.now();
    const endTime = startTime + durationInMs;

    const [minReadDelay, maxReadDelay, minPause, maxPause] = await Promise.all([
      getTimeoutValue('automation.scrolling.minReadDelayMs', 1000),
      getTimeoutValue('automation.scrolling.maxReadDelayMs', 3500),
      getTimeoutValue('automation.scrolling.minPauseMs', 500),
      getTimeoutValue('automation.scrolling.maxPauseMs', 1500)
    ]);

    let lastScrollDown = true;

    while (Date.now() < endTime) {
      const actionType = Math.random();
       
       try {
         if (actionType < 0.75 || !lastScrollDown) {
           const scrollAmount = getRandomInt(150, 500); 
           await scrollRandom(page, scrollAmount, scrollAmount);
           lastScrollDown = true;

         } else if (actionType < 0.90) {
           const scrollAmount = getRandomInt(50, 150); 
           await scrollRandom(page, -scrollAmount, -scrollAmount);
           lastScrollDown = false;

         } else {
          const pauseDuration = getRandomInt(minPause, maxPause);
          await delay(pauseDuration);
        }

        const remainingTime = endTime - Date.now();
        if (remainingTime <= 0) break;

        const baseDelay = getRandomInt(minReadDelay, maxReadDelay); 
        await delay(Math.min(baseDelay, remainingTime));

      } catch (error) {
        if (page.isClosed()) {
          logger.warn('Page was closed during scrolling. Halting.');
          break;
        }
        logger.error(`Error during scroll action: ${error.message}`);
      }
    }

    try {
      await page.keyboard.press('Home');
    } catch (e) {
      logger.warn(`Could not scroll to top: ${e.message}`);
    }
    
    logger.debug(`Scrolling simulation finished.`);
  };
}


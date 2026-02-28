/**
 * @fileoverview Random Scrolling - Now uses Unified API
 * Simulates human-like random scrolling on a page
 * @module utils/randomScrolling
 */

import { api } from '../api/index.js';
import { createLogger } from './logger.js';
import { mathUtils } from './mathUtils.js';

const logger = createLogger('randomScrolling.js');

/**
 * Factory function that creates a human-like scroller
 * Now uses API context - no page parameter needed
 * @returns {function(number): Promise<void>} An asynchronous function that performs random scrolling.
 * @example
 * const scroller = createRandomScroller();
 * await scroller(30); // Scrolls randomly for 30 seconds.
 */
export default function createRandomScroller() {
  
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

    const minReadDelay = 1000;
    const maxReadDelay = 3500;
    const minPause = 500;
    const maxPause = 1500;

    let lastScrollDown = true;

    while (Date.now() < endTime) {
      const actionType = Math.random();
     
     try {
       if (actionType < 0.75 || !lastScrollDown) {
         const scrollAmount = mathUtils.randomInRange(150, 500); 
         await api.scroll(scrollAmount);
         lastScrollDown = true;

       } else if (actionType < 0.90) {
         const scrollAmount = mathUtils.randomInRange(50, 150); 
         await api.scroll(-scrollAmount);
         lastScrollDown = false;

       } else {
        const pauseDuration = mathUtils.randomInRange(minPause, maxPause);
        await api.wait(pauseDuration);
      }

      const remainingTime = endTime - Date.now();
      if (remainingTime <= 0) break;

      const baseDelay = mathUtils.randomInRange(minReadDelay, maxReadDelay); 
      await api.wait(Math.min(baseDelay, remainingTime));

    } catch (error) {
      try {
        const page = api.context?.getPage?.();
        if (page?.isClosed()) {
          logger.warn('Page was closed during scrolling. Halting.');
          break;
        }
      } catch (_e) {
        // Page context might not be available
      }
      logger.error(`Error during scroll action: ${error.message}`);
    }
    }

    try {
      // Press Home key to go to top
      await api.scroll.toTop();
    } catch (_e) {
      logger.warn(`Could not scroll to top: ${_e.message}`);
    }
    
    logger.debug(`Scrolling simulation finished.`);
  };
}

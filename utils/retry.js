/**
 * @fileoverview A utility for retrying an async operation with exponential backoff.
 * @module utils/retry
 */

import { createLogger } from './logger.js';

const logger = createLogger('retry.js');

export function calculateBackoffDelay(attempt, options = {}) {
  const {
    baseDelay = 1000,
    maxDelay = 30000,
    factor = 2,
    jitterMin = 1,
    jitterMax = 1
  } = options;

  const delay = Math.min(baseDelay * Math.pow(factor, attempt), maxDelay);
  const min = Math.min(jitterMin, jitterMax);
  const max = Math.max(jitterMin, jitterMax);
  const jitterMultiplier = min === max ? min : min + Math.random() * (max - min);

  return Math.floor(delay * jitterMultiplier);
}

/**
 * Retries an async operation with exponential backoff.
 * @param {Function} operation - The async function to be executed.
 * @param {object} [options] - The options for the retry mechanism.
 * @param {number} [options.retries=3] - The maximum number of retries.
 * @param {number} [options.delay=1000] - The initial delay in milliseconds.
 * @param {number} [options.factor=2] - The factor by which the delay should increase.
 * @param {string} [options.description='operation'] - A description of the operation for logging.
 * @returns {Promise<any>} A promise that resolves with the result of the operation.
 * @throws {Error} If the operation fails after all retries.
 */
export async function withRetry(operation, options = {}) {
  const { retries = 2, delay = 1000, factor = 1, description = 'operation' } = options;
  let currentDelay = delay;

  for (let i = 0; i < retries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i < retries - 1) {
        logger.warn(`[${description}] Attempt ${i + 1} failed: ${error.message}. Retrying in ${currentDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, currentDelay));
        currentDelay *= factor;
      } else {
        logger.error(`[${description}] All ${retries} attempts failed. Last error: ${error.message}`);
        throw error;
      }
    }
  }
}

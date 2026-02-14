/**
 * @fileoverview A task that navigates to a random URL from a predefined list loaded from a file.
 * @module tasks/cookieBotRandom
 */

import { createRandomScroller, createLogger } from '../utils/utils.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITES_FILE = path.join(__dirname, '../config/popularsite.txt');

let urls = [];

// Read the list of sites from the external file when the module is first loaded.
// This is more efficient than reading the file every time the task runs.
try {
  const data = await fs.readFile(SITES_FILE, 'utf8');
  urls = data.split('\n').map(line => {
    let url = line.trim();
    if (url.startsWith('http_')) {
      url = url.replace('http_', 'http:');
    }
    if (url.startsWith('https_')) {
      url = url.replace('https_', 'https:');
    }
    return url;
  }).filter(line => line.startsWith('http'));

  if (urls.length === 0) {
    console.error('[cookieBotRandom.js] Warning: popularsite.txt was read, but it is empty or contains no valid URLs.');
  }
} catch (error) {
  console.error(`[cookieBotRandom.js] CRITICAL: Failed to read site list from ${SITES_FILE}. The task will not be able to run. Error: ${error.message}`);
}

/**
 * An automation task that navigates to a random URL.
 * @param {object} page - The Playwright page object.
 * @param {object} payload - The payload data for the task.
 * @param {string} payload.browserInfo - A unique identifier for the browser.
 */
export default async function cookieBotRandom(page, payload) {
  const startTime = process.hrtime.bigint();
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const browserInfo = payload.browserInfo || "unknown_profile";
  const logger = createLogger(`cookieBotRandom.js [${browserInfo}]`);
  logger.info(`Starting task...`);

  // Apply visibility spoofing
  const { applyHumanizationPatch } = await import('../utils/browserPatch.js');
  await applyHumanizationPatch(page, logger);

  if (urls.length === 0) {
    logger.error('URL list from popularsite.txt is empty or failed to load. Aborting task.');
    return;
  }

  const randomScrolling = createRandomScroller(page);

  try {
    const loopCount = Math.floor(Math.random() * (40 - 20 + 1)) + 20; // random 20-30 times
    logger.info(`[CookieBotRandom] Starting random visits loop for ${loopCount} times.`);

    for (let i = 0; i < loopCount; i++) {
      const randomUrl = urls[Math.floor(Math.random() * urls.length)];
      logger.info(`[CookieBotRandom] (${i + 1} of ${loopCount} URL) Navigating to: ${randomUrl}`);

      try {
        await page.goto(randomUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 60000 // 60 seconds for slow proxies
        });
        await delay(1000);//1 second delay 
        logger.info(`[CookieBotRandom] Random Scrolling 10-50 seconds`);
        await randomScrolling((Math.random() * 40) + 10); // 10-50 seconds

        await delay(1000);//1 second delay 
        logger.info(`[CookieBotRandom] Waiting on page for 1 second before next navigation.`);

      } catch (navError) {
        if (navError.message.includes('interrupted by another navigation') ||
          navError.message.includes('Session closed')) {
          // These are expected when moving fast or if the previous page had a late redirect
          logger.warn(`[CookieBotRandom] Navigation to ${randomUrl} was interrupted/cancelled (likely moving to next URL).`);
        } else {
          logger.error(`[CookieBotRandom] Failed to load ${randomUrl}: ${navError.message}`);
        }
        // Continue to next URL in the loop
      }
    }
  } catch (error) {
    if (error.message.includes('Target page, context or browser has been closed')) {
      logger.warn(`[CookieBotRandom] Task interrupted: Browser/Page closed (likely Ctrl+C).`);
    } else {
      logger.error(`[CookieBotRandom] ### CRITICAL ERROR in main task loop:`, error);
    }
  } finally {
    logger.info(`[CookieBotRandom] --- Reached FINALLY block ---`);
    try {
      if (page && !page.isClosed()) {
        logger.debug(`Page is open. Attempting page.close()...`);
        await page.close();
        logger.debug(`page.close() command EXECUTED.`);
      } else {
        logger.debug(`Page was already closed or not created.`);
      }
    } catch (closeError) {
      logger.error(
        `### CRITICAL ERROR trying to close page:`,
        closeError
      )
    }
    const endTime = process.hrtime.bigint();
    const durationInSeconds = (Number(endTime - startTime) / 1_000_000_000).toFixed(2);
    logger.info(`Finished task. Task duration: ${durationInSeconds} seconds.`);
  }
}

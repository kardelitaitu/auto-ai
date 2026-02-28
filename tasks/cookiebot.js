/**
 * @fileoverview A task that navigates to a random URL from a predefined list loaded from a file.
 * @module tasks/cookieBotRandom
 */

import { api } from '../api/index.js';
import { createLogger } from '../utils/logger.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITES_FILE = path.join(__dirname, '../config/popularsite.txt');

let urls = [];

// Read the list of sites from the external file when the module is first loaded.
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
  const browserInfo = payload.browserInfo || "unknown_profile";
  const logger = createLogger(`cookiebot-api.js [${browserInfo}]`);

  // logger.info(`Starting task...`);

  try {
    // Initialize context for unified API using isolated scope
    return await api.withPage(page, async () => {
      await api.init(page, {
        logger,
        lite: true,
        blockNotifications: true,
        blockDialogs: true,
        autoBanners: true,
        muteAudio: true
      });

      if (urls.length === 0) {
        logger.error('URL list from popularsite.txt is empty or failed to load. Aborting task.');
        return;
      }

      const loopCount = api.randomInRange(20, 30);
      logger.info(`Starting random visits loop for ${loopCount} times.`);

      for (let i = 0; i < loopCount; i++) {
        const randomUrl = urls[Math.floor(Math.random() * urls.length)];
        // logger.info(`(${i + 1} of ${loopCount} URL) Navigating to: ${randomUrl}`);

        try {
          // Wrap navigation and scrolling in a total timeout for the visit
          await api.withErrorHandling(async () => {
            const visitTimeout = 90000; // 90 seconds total for this URL
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), visitTimeout);

            try {
              // 1. Navigate with a shorter timeout
              await api.goto(randomUrl, {
                waitUntil: 'domcontentloaded',
                timeout: 30000 // 30 seconds for initial load
              });

              // 2. Check responsiveness
              try {
                await api.waitFor(async () => {
                  return await api.eval(() => true).catch(() => false);
                }, { timeout: 5000 });
              } catch (_e) {
                logger.warn(`Page ${randomUrl} is unresponsive after load. Skipping.`);
                return;
              }

              await api.wait(1000);

              // 3. Scroll/Read
              await api.scroll.read(null, {
                pauses: api.randomInRange(4, 8),
                scrollAmount: api.randomInRange(300, 600)
              });

              await api.wait(1000);
            } finally {
              clearTimeout(timeoutId);
            }
          });
        } catch (navError) {
          if (navError.message.includes('interrupted by another navigation') ||
            navError.message.includes('Session closed')) {
            logger.warn(`Navigation to ${randomUrl} was interrupted/cancelled.`);
          } else if (navError.message.includes('timeout') || navError.message.includes('Timeout')) {
            logger.warn(`Visit to ${randomUrl} timed out. Skipping to next.`);
          } else {
            // logger.debug(`Failed to load ${randomUrl}: ${navError.message}`);
          }
        }
      }
    });
  } catch (error) {
    if (error.message.includes('Target page, context or browser has been closed')) {
      logger.warn(`Task interrupted: Browser/Page closed.`);
    } else {
      logger.error(`### CRITICAL ERROR in main task loop:`, error);
    }
  } finally {
    // logger.info(`--- Reached FINALLY block ---`);
    try {
      if (page && !page.isClosed()) {
        logger.debug(`Page is open. Attempting page.close()...`);
        await page.close();
        logger.debug(`page.close() command EXECUTED.`);
      }
    } catch (closeError) {
      logger.error(`### CRITICAL ERROR trying to close page:`, closeError)
    }
    const endTime = process.hrtime.bigint();
    const _durationInSeconds = (Number(endTime - startTime) / 1_000_000_000).toFixed(2);
    // logger.info(`Finished task. Task duration: ${durationInSeconds} seconds.`);
  }
}

/**
 * @fileoverview A template for creating new automation tasks.
 * @module tasks/_template
 */

import { createRandomScroller, createRandomZoomer, createLogger } from '../utils/utils.js';
import { getTimeoutValue } from '../utils/configLoader.js';

/**
 * An example automation task.
 * @param {object} browser - The Playwright browser instance.
 * @param {object} payload - The payload data for the task.
 * @param {string} payload.browserInfo - A unique identifier for the browser.
 */
export default async function automationTask(page, payload) {
  const startTime = process.hrtime.bigint();
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const browserInfo = payload.browserInfo || "unknown_profile";
  const logger = createLogger(`automationTask.js [${browserInfo}]`);
  logger.info(`Starting task...`);

  // Apply visibility spoofing [Standard for all tasks]
  const { applyHumanizationPatch } = await import('../utils/browserPatch.js');
  await applyHumanizationPatch(page, logger);

  const randomScrolling = createRandomScroller(page);
  const randomZoom = createRandomZoomer(page);
  try {
    logger.info(`Navigating to https://climatecocentre.org/scroll-test/ ...`);
    await page.goto("https://climatecocentre.org/scroll-test/", {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
    await page.waitForLoadState("domcontentloaded");

    logger.info(`[template] Random delay between 1-4 seconds`);
    await delay(Math.floor(Math.random() * 2001) + 1000);

    logger.info(`[template] Random Zoom 3 seconds`);
    await randomZoom(3);

    logger.info(`[template] Random Scrolling 10 seconds`);
    await randomScrolling(10);

    logger.info(`[template] Wait 3 seconds before closing up`);
    await delay(3000);

  } catch (error) {
    logger.error(`### CRITICAL ERROR in try block: ${error.message}`);
  } finally {
    logger.info(`--- Reached FINALLY block ---`);
    try {
      if (page.isClosed()) {
        logger.debug(`Page was already closed.`);
      } else {
        logger.debug(`Page is open. Attempting page.close()...`);
        await page.close();
        logger.debug(`page.close() command EXECUTED.`);
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


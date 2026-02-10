/**
 * @fileoverview An automation task that navigates to a climate-related website and performs random scrolling and zooming.
 * @module tasks/automationTask2
 */

import { createRandomScroller, createRandomZoomer, createLogger } from '../utils/utils.js';

/**
 * The main function for the automation task.
 * @param {object} browser - The Playwright browser instance.
 * @param {object} payload - The payload data for the task.
 * @param {string} payload.browserInfo - A unique identifier for the browser.
 */
export default async function automationTask2(page, payload) {
  const startTime = process.hrtime.bigint();
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const browserInfo = payload.browserInfo || "unknown_profile";
  const logger = createLogger(`automationTask2.js [${browserInfo}]`);
  logger.info(`Starting task...`);

  // Apply visibility spoofing
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

    logger.info(`[climatecocentre.org] Random delay between 1-4 seconds`);
    await delay(Math.floor(Math.random() * 2001) + 1000);

    logger.info(`[climatecocentre.org] Random Zoom 3 seconds`);
    await randomZoom(3);

    logger.info(`[climatecocentre.org] Random Scrolling 10 seconds`);
    await randomScrolling(10);

    logger.info(`[climatecocentre.org] Wait 3 seconds before closing up`);
    await delay(3000);

  } catch (error) {
    if (error.message.includes('Target page, context or browser has been closed')) {
      logger.warn(`[climatecocentre.org] Task interrupted: Browser/Page closed (likely Ctrl+C).`);
    } else {
      logger.error(`[climatecocentre.org][Proxy Error][No Internet] ### ERROR: ${error.message}`);
    }
  } finally {
    logger.info(`[climatecocentre.org] --- Reached FINALLY block ---`);
    try {
      if (page.isClosed()) {
        logger.debug(`[climatecocentre.org] Page was already closed.`);
      } else {
        logger.debug(`[climatecocentre.org] Page is open. Attempting page.close()...`);
        await page.close();
        logger.debug(`[climatecocentre.org] page.close() command EXECUTED.`);
      }
    } catch (closeError) {
      logger.error(
        `[climatecocentre.org][Proxy Error][No Internet] ### CRITICAL ERROR trying to close page:`,
        closeError
      )
    }
    const endTime = process.hrtime.bigint();
    const durationInSeconds = (Number(endTime - startTime) / 1_000_000_000).toFixed(2);
    logger.info(`[climatecocentre.org] Finished task. Task duration: ${durationInSeconds} seconds.`);
  }
}


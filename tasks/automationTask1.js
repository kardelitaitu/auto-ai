import { createRandomScroller, createRandomZoomer, createLogger } from '../utils/utils.js';

export default async function automationTask1(page, payload) {
  const startTime = process.hrtime.bigint();
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const browserInfo = payload.browserInfo || "unknown_profile";
  const logger = createLogger(`automationTask1.js [${browserInfo}]`);
  logger.info(`Starting task...`);

  const { applyHumanizationPatch } = await import('../utils/browserPatch.js');
  await applyHumanizationPatch(page, logger);

  const randomScrolling = createRandomScroller(page);
  const randomZoom = createRandomZoomer(page);
  try {
    logger.info(`Navigating to https://www.reddit.com/r/MouseReview/comments/1475jrk/scroll_wheel_jumping_fix_for_any_mouse_this_black/ ...`);
    await page.goto("https://www.reddit.com/r/MouseReview/comments/1475jrk/scroll_wheel_jumping_fix_for_any_mouse_this_black/", {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
    await page.waitForLoadState("domcontentloaded");

    logger.info(`[reddit.com] Random delay between 1-4 seconds`);
    await delay(Math.floor(Math.random() * 2001) + 1000);

    logger.info(`[reddit.com] Random Zoom 3 seconds`);
    await randomZoom(3);

    logger.info(`[reddit.com] Random Scrolling 10 seconds`);
    await randomScrolling(10);

    logger.info(`[reddit.com] Wait 3 seconds before closing up`);
    await delay(3000);

  } catch (error) {
    if (error.message.includes('Target page, context or browser has been closed')) {
      logger.warn(`[reddit.com] Task interrupted: Browser/Page closed (likely Ctrl+C).`);
    } else {
      logger.error(`[reddit.com][Proxy Error][No Internet] ### ERROR: ${error.message}`);
    }
  } finally {
    logger.info(`[reddit.com] --- Reached FINALLY block ---`);
    try {
      if (page.isClosed()) {
        logger.debug(`[reddit.com] Page was already closed.`);
      } else {
        logger.debug(`[reddit.com] Page is open. Attempting page.close()...`);
        await page.close();
        logger.debug(`[reddit.com] page.close() command EXECUTED.`);
      }
    } catch (closeError) {
      logger.error(
        `[reddit.com][Proxy Error][No Internet] ### CRITICAL ERROR trying to close page:`,
        closeError
      )
    }
    const endTime = process.hrtime.bigint();
    const durationInSeconds = (Number(endTime - startTime) / 1_000_000_000).toFixed(2);
    logger.info(`[reddit.com] Finished task. Task duration: ${durationInSeconds} seconds.`);
  }
}

import { getPage } from '../core/context.js';
import { createLogger } from '../core/logger.js';
import { mathUtils } from '../utils/math.js';
import { wait } from '../interactions/wait.js';
import { visible } from '../interactions/queries.js';
import { click } from '../interactions/actions.js';

const logger = createLogger('api/retweet.js');

/**
 * Retweet (repost) the currently focused tweet on-page.
 *
 * Performs:
 * 1. Already-retweeted guard
 * 2. Click retweet button → confirm menu → verify
 *
 * @param {object} [options]
 * @param {object} [options.tweetElement] - Optional Playwright locator for the tweet
 * @returns {Promise<{success: boolean, reason: string, method: string}>}
 */
export async function retweetWithAPI(options = {}) {
    const page = getPage();
    const { tweetElement } = options;

    logger.info(`Starting api.retweetWithAPI()...`);

    const retweetSel = '[data-testid="retweet"]';
    const unretweetSel = '[data-testid="unretweet"]';
    const confirmSel = '[data-testid="retweetConfirm"]';

    try {
        // Already retweeted guard
        const alreadyRetweeted = tweetElement
            ? await tweetElement.locator(unretweetSel).first().isVisible().catch(() => false)
            : await visible(unretweetSel);

        if (alreadyRetweeted) {
            logger.info(`Tweet already retweeted, skipping.`);
            return { success: true, reason: 'already_retweeted', method: 'retweetAPI' };
        }

        // Scroll into view
        if (tweetElement) {
            await tweetElement.scrollIntoViewIfNeeded().catch(() => { });
        }
        await wait(mathUtils.randomInRange(300, 700));

        // Click retweet button with ghost cursor to open menu
        const retweetTarget = tweetElement ? tweetElement.locator(retweetSel).first() : retweetSel;

        logger.info(`[retweetWithAPI] Clicking retweet button (ghost cursor)...`);
        await click(retweetTarget);

        await wait(mathUtils.randomInRange(500, 1000));

        // Click confirm in menu
        const confirmVisible = await visible(confirmSel);
        if (!confirmVisible) {
            logger.warn(`Retweet confirm menu not found`);
            await page.keyboard.press('Escape').catch(() => { });
            return { success: false, reason: 'confirm_menu_not_found', method: 'retweetAPI' };
        }

        logger.info(`[retweetWithAPI] Clicking confirm retweet (ghost cursor)...`);
        await click(confirmSel);

        await wait(mathUtils.randomInRange(600, 1200));

        // Verify
        const nowUnretweetable = tweetElement
            ? await tweetElement.locator(unretweetSel).first().isVisible().catch(() => false)
            : await visible(unretweetSel);

        if (nowUnretweetable) {
            logger.info(`✅ api.retweetWithAPI successful!`);
            return { success: true, reason: 'success', method: 'retweetAPI' };
        }

        logger.warn(`❌ api.retweetWithAPI: no confirmation signal`);
        return { success: false, reason: 'verification_failed', method: 'retweetAPI' };

    } catch (error) {
        logger.error(`api.retweetWithAPI error: ${error.message}`);
        return { success: false, reason: error.message, method: 'retweetAPI' };
    }
}

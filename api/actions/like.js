import { getPage } from '../core/context.js';
import { createLogger } from '../core/logger.js';
import { mathUtils } from '../utils/math.js';
import { scroll } from '../interactions/scroll.js';
import { wait } from '../interactions/wait.js';
import { visible } from '../interactions/queries.js';
import { click } from '../interactions/actions.js';

const logger = createLogger('api/like.js');

/**
 * Like the currently focused tweet on-page.
 *
 * Performs:
 * 1. Locate like button on active tweet article
 * 2. Already-liked guard
 * 3. Human click + verification via toast or state change
 *
 * @param {object} [options]
 * @param {object} [options.tweetElement] - Optional Playwright locator for the tweet (scopes the selector)
 * @returns {Promise<{success: boolean, reason: string, method: string}>}
 */
export async function likeWithAPI(options = {}) {
    const page = getPage();
    const { tweetElement } = options;

    logger.info(`Starting api.likeWithAPI()...`);

    const likeSel = '[data-testid="like"]';
    const unlikeSel = '[data-testid="unlike"]';

    // Scope to element if provided, otherwise page-level
    const scope = tweetElement ?? page;

    try {
        // Already liked guard
        const alreadyLiked = tweetElement
            ? await tweetElement.locator(unlikeSel).first().isVisible().catch(() => false)
            : await visible(unlikeSel);

        if (alreadyLiked) {
            logger.info(`Tweet already liked, skipping.`);
            return { success: true, reason: 'already_liked', method: 'likeAPI' };
        }

        // Scroll into view
        if (tweetElement) {
            await tweetElement.scrollIntoViewIfNeeded().catch(() => { });
        }
        await wait(mathUtils.randomInRange(300, 700));

        // Click with ghost cursor
        const target = tweetElement ? tweetElement.locator(likeSel).first() : likeSel;

        logger.info(`[likeWithAPI] Clicking like button (ghost cursor)...`);
        await click(target);

        await wait(mathUtils.randomInRange(600, 1200));

        // Verify
        const toastSel = '[data-testid="toast"]';
        const toastVisible = await visible(toastSel);
        const nowUnliked = tweetElement
            ? await tweetElement.locator(unlikeSel).first().isVisible().catch(() => false)
            : await visible(unlikeSel);

        if (toastVisible || nowUnliked) {
            logger.info(`✅ api.likeWithAPI successful!`);
            return { success: true, reason: 'success', method: 'likeAPI' };
        }

        logger.warn(`❌ api.likeWithAPI: no confirmation signal detected`);
        return { success: false, reason: 'verification_failed', method: 'likeAPI' };

    } catch (error) {
        logger.error(`api.likeWithAPI error: ${error.message}`);
        return { success: false, reason: error.message, method: 'likeAPI' };
    }
}

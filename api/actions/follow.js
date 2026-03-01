import { getPage } from '../core/context.js';
import { createLogger } from '../core/logger.js';
import { mathUtils } from '../utils/math.js';
import { wait } from '../interactions/wait.js';
import { visible } from '../interactions/queries.js';
import { click } from '../interactions/actions.js';

const logger = createLogger('api/follow.js');

/**
 * Follow the author of the currently open tweet/profile page.
 *
 * Performs:
 * 1. Already-following guard (unfollow button or text state)
 * 2. Click Follow button
 * 3. Polling verification (up to 5 polls x 1.5s)
 *
 * @param {object} [options]
 * @param {string} [options.username] - For logging purposes only
 * @param {number} [options.maxAttempts=2] - How many click attempts before giving up
 * @returns {Promise<{success: boolean, reason: string, method: string}>}
 */
export async function followWithAPI(options = {}) {
    const page = getPage();
    const { username = 'unknown', maxAttempts = 2 } = options;

    logger.info(`Starting api.followWithAPI() for @${username}...`);

    // X.com selectors: follow button uses data-testid ending in "-follow"
    const followSel = 'div[data-testid="placementTracking"] [data-testid$="-follow"], div[role="button"][data-testid$="-follow"]';
    const unfollowSel = '[data-testid$="-unfollow"]';

    try {
        // Already following guard
        if (await visible(unfollowSel)) {
            logger.info(`Already following @${username}.`);
            return { success: true, reason: 'already_following', method: 'followAPI' };
        }

        const followBtn = page.locator(followSel).first();
        const btnText = (await followBtn.textContent().catch(() => '')).toLowerCase();
        if (btnText.includes('following') || btnText.includes('pending')) {
            logger.info(`Already following @${username} (state: ${btnText}).`);
            return { success: true, reason: 'already_following', method: 'followAPI' };
        }

        // Attempt clicks
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            logger.info(`[followWithAPI] Click attempt ${attempt}/${maxAttempts} (ghost cursor)...`);

            await click(followSel);

            // Poll for state change
            let verified = false;
            for (let poll = 0; poll < 5; poll++) {
                await wait(1500);
                if (await visible(unfollowSel)) { verified = true; break; }
                const txt = (await followBtn.textContent().catch(() => '')).toLowerCase();
                if (txt.includes('following') || txt.includes('pending')) { verified = true; break; }
            }

            if (verified) {
                logger.info(`✅ api.followWithAPI: successfully followed @${username}!`);
                return { success: true, reason: 'success', method: 'followAPI' };
            }

            logger.warn(`[followWithAPI] Verification failed on attempt ${attempt}.`);
            if (attempt < maxAttempts) {
                await wait(mathUtils.randomInRange(3000, 6000));
            }
        }

        logger.error(`❌ api.followWithAPI: failed after ${maxAttempts} attempts`);
        return { success: false, reason: 'verification_failed', method: 'followAPI' };

    } catch (error) {
        logger.error(`api.followWithAPI error: ${error.message}`);
        return { success: false, reason: error.message, method: 'followAPI' };
    }
}

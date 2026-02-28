/**
 * @fileoverview Twitter Interaction Methods
 * Modularized reply and quote methods for reusability
 * @module utils/twitter-interaction-methods
 */

/**
 * Reply Methods - Various strategies for posting replies
 */
import { api } from '../api/index.js';

export const replyMethods = {
    /**
     * Method A: Keyboard shortcut (R key)
     * Flow: Click tweet timestamp → Press R → Type → Submit
     */
    replyA: async (page, text, human, logger, options = {}) => {
        const maxRetries = options.maxRetries || 2;
        let composerOpened = false;
        let attempt = 0;

        logger.info(`[replyA] Starting keyboard shortcut method (R key)`);

        while (!composerOpened && attempt <= maxRetries) {
            if (attempt > 0) {
                logger.info(`[replyA] Retry ${attempt}/${maxRetries}...`);
                await api.wait(1000);
            }

            // Reset state
            await api.scroll.toTop();
            await api.wait(1000);

            // Click main tweet to focus
            logger.info(`[replyA] Focusing main tweet...`);
            const timeElement = page.locator('article time').first();
            if (await api.exists(timeElement)) {
                await human.click(timeElement, 'Tweet Timestamp', 3, { precision: 'high' });
                logger.info(`[replyA] Clicked tweet timestamp`);
            } else {
                const tweetText = page.locator('[data-testid="tweetText"]').first();
                if (await api.exists(tweetText)) {
                    await human.click(tweetText, 'Tweet Text', 3, { precision: 'high' });
                    logger.info(`[replyA] Clicked tweet text (fallback)`);
                }
            }
            await api.wait(1000);

            // Press R to open reply composer
            logger.info(`[replyA] Pressing R key...`);
            await page.keyboard.press('r');
            await api.wait(1000);

            // Verify composer opened
            const verify = await human.verifyComposerOpen(page);

            if (verify.open) {
                // composerOpened = true; // Unused assignment
                logger.info(`[replyA] Composer opened with: ${verify.selector}`);

                await human.typeText(page, text, verify.locator || page.locator(verify.selector).first());
                const postResult = await human.postTweet(page);

                if (postResult.success) {
                    logger.info(`[replyA] Reply posted successfully`);
                    return { success: true, method: 'replyA' };
                } else {
                    logger.warn(`[replyA] Post failed: ${postResult.reason}`);
                    return { success: false, method: 'replyA', reason: postResult.reason };
                }
            }

            logger.warn(`[replyA] Composer did not open on attempt ${attempt + 1}`);
            attempt++;
        }

        return { success: false, method: 'replyA', reason: 'composer_not_opened' };
    },

    /**
     * Method B: Reply button click
     * Flow: Click reply button → Type → Submit
     */
    replyB: async (page, text, human, logger, _options = {}) => {
        logger.info(`[replyB] Starting button click method`);

        await api.scroll.toTop();
        await api.wait(1000);

        // Enhanced button finding with more detailed logging
        const btnResult = await human.findElement(page,
            ['[data-testid="replyEdge"]', '[data-testid="reply"]', '[aria-label*="Reply"]', '[role="button"][data-testid="reply"]'],
            { visibleOnly: true }
        );

        if (!btnResult.element) {
            logger.warn(`[replyB] Reply button not found`);
            return { success: false, method: 'replyB', reason: 'button_not_found' };
        }

        // Get detailed element info for logging
        const elementInfo = await btnResult.element.evaluate(el => {
            return {
                tagName: el.tagName,
                text: el.innerText,
                ariaLabel: el.getAttribute('aria-label'),
                disabled: el.disabled || el.getAttribute('aria-disabled') === 'true',
                rect: el.getBoundingClientRect()
            };
        });

        const box = await btnResult.element.boundingBox();
        logger.info(`[replyB] Found button: ${btnResult.selector}`);
        logger.info(`[replyB] Button Details: Tag=${elementInfo.tagName}, Label="${elementInfo.ariaLabel}", Text="${elementInfo.text}", Disabled=${elementInfo.disabled}`);
        logger.info(`[replyB] Bounding Box: x=${box?.x}, y=${box?.y}, w=${box?.width}, h=${box?.height}`);

        if (elementInfo.disabled) {
            logger.warn(`[replyB] Reply button is disabled! Waiting...`);
            await api.wait(1000);
            const isDisabled = await btnResult.element.evaluate(el => el.disabled || el.getAttribute('aria-disabled') === 'true');
            if (isDisabled) {
                logger.warn(`[replyB] Reply button still disabled. Attempting to click anyway.`);
            } else {
                logger.info(`[replyB] Reply button became enabled.`);
            }
        }

        await btnResult.element.scrollIntoViewIfNeeded();
        await human.fixation(300, 800);
        await human.microMove(page, 20);

        // Use high precision for the small reply icon
        logger.info(`[replyB] Attempting safeHumanClick with high precision...`);
        const clickResult = await human.safeHumanClick(btnResult.element, 'Reply Button', 3, { precision: 'high' });

        if (!clickResult) {
            logger.warn(`[replyB] safeHumanClick returned false (failed). Trying force click fallback...`);
            try {
                await btnResult.element.click({ force: true });
                logger.info(`[replyB] Force click executed.`);
            } catch (e) {
                logger.error(`[replyB] Force click failed: ${e.message}`);
                return { success: false, method: 'replyB', reason: 'click_failed' };
            }
        } else {
            logger.info(`[replyB] safeHumanClick successful.`);
        }

        await api.wait(1000);

        const verify = await human.verifyComposerOpen(page);
        if (!verify.open) {
            logger.warn(`[replyB] Composer did not open after click`);
            // One retry for click?
            return { success: false, method: 'replyB', reason: 'composer_not_opened' };
        }

        logger.info(`[replyB] Composer opened with: ${verify.selector}`);

        const composer = verify.locator || page.locator(verify.selector).first();
        await human.typeText(page, text, composer);

        const postResult = await human.postTweet(page, 'reply');

        if (postResult.success) {
            logger.info(`[replyB] Reply posted successfully`);
            return { success: true, method: 'replyB' };
        } else {
            logger.warn(`[replyB] Post failed: ${postResult.reason}`);
            return { success: false, method: 'replyB', reason: postResult.reason };
        }
    },

    /**
     * Method C: Direct composer focus
     * Flow: Focus main tweet → Find reply box → Click → Type → Submit
     */
    replyC: async (page, text, human, logger, _options = {}) => {
        logger.info(`[replyC] Starting direct composer focus method`);

        await api.scroll.toTop();
        await api.wait(1000);

        // Step 1: Focus main tweet by clicking timestamp
        logger.info(`[replyC] Focusing main tweet...`);
        const timeElement = page.locator('article time').first();
        if (await api.exists(timeElement)) {
            await human.click(timeElement, 'Tweet Timestamp', 3, { precision: 'high' });
            logger.info(`[replyC] Clicked tweet timestamp`);
        }
        await api.wait(1000);

        // Step 2: Find and scroll to reply box
        logger.info(`[replyC] Looking for reply box...`);
        const replyBox = page.locator('[data-testid="tweetTextarea_0"]').first();
        let count = await replyBox.count();

        if (count === 0) {
            logger.warn(`[replyC] Reply box not visible, scrolling...`);
            await page.evaluate(async () => {
                const elements = document.querySelectorAll('[data-testid="tweetTextarea_0"]');
                for (const el of elements) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            });
            await api.wait(1000);
        }

        // Re-check after scroll
        const replyBoxAfter = page.locator('[data-testid="tweetTextarea_0"]').first();
        count = await replyBoxAfter.count();

        if (count === 0) {
            logger.warn(`[replyC] Reply box still not found`);
            return { success: false, method: 'replyC', reason: 'reply_box_not_found' };
        }

        // Verify it has "Post your reply" placeholder
        const placeholderText = await page.evaluate(() => {
            const el = document.querySelector('[data-testid="tweetTextarea_0"]');
            const placeholder = el?.querySelector('#placeholder-tb0p, .public-DraftEditorPlaceholder-inner');
            return placeholder?.textContent || '';
        });

        if (!placeholderText.includes('Post your reply')) {
            logger.warn(`[replyC] Placeholder text mismatch: "${placeholderText}"`);
        }

        logger.info(`[replyC] Found reply box (placeholder: "${placeholderText}")`);

        // Step 3: Click the reply box
        await replyBoxAfter.focus();
        logger.info(`[replyC] Focused reply box`);
        await api.wait(1000);

        await replyBoxAfter.scrollIntoViewIfNeeded();
        await api.wait(1000);

        await human.safeHumanClick(replyBoxAfter, 'Reply Box', 3, { precision: 'high' });
        logger.info(`[replyC] Clicked reply box`);
        await api.wait(1000);

        // Step 4: Type
        logger.info(`[replyC] Typing...`);
        await human.typeText(page, text, replyBoxAfter);

        // Step 5: Submit via ghost-click on the post/reply button
        logger.info(`[replyC] Submitting...`);
        const postC = await human.postTweet(page, 'reply');
        if (postC.success) {
            logger.info(`[replyC] Reply posted successfully`);
            return { success: true, method: 'replyC' };
        } else {
            logger.warn(`[replyC] Post failed: ${postC.reason}`);
            return { success: false, method: 'replyC', reason: postC.reason };
        }
    }
};

/**
 * Quote Methods - Various strategies for posting quotes
 */
export const quoteMethods = {
    /**
     * Method A: Keyboard compose (T key) + Quote option
     * Flow: Click tweet → Press T → ArrowDown → Enter → Type → Submit
     */
    quoteA: async (page, text, human, logger, _options = {}) => {
        logger.info(`[quoteA] Starting keyboard compose method`);

        await api.scroll.toTop();
        await api.wait(1000);

        // Click time element to focus tweet
        const quoteTimeElement = page.locator('article time').first();
        if (await api.exists(quoteTimeElement)) {
            await human.click(quoteTimeElement, 'Tweet Timestamp', 3, { precision: 'high' });
            logger.info(`[quoteA] Clicked tweet timestamp`);
        }
        await api.wait(1000);

        // Press T to open composer
        await page.keyboard.press('t');
        logger.info(`[quoteA] Pressed T`);
        await api.wait(1000);

        // Navigate to quote option
        await page.keyboard.press('ArrowDown');
        logger.info(`[quoteA] Pressed ArrowDown`);
        await api.wait(1000);

        // Select quote option
        await page.keyboard.press('Enter');
        logger.info(`[quoteA] Pressed Enter`);
        await api.wait(1000);

        // Verify quote composer is ready
        const verifyA = await human.verifyComposerOpen(page);
        if (!verifyA.open) {
            logger.warn(`[quoteA] Composer did not open`);
            return { success: false, method: 'quoteA', reason: 'composer_not_opened' };
        }

        logger.info(`[quoteA] Quote composer ready`);

        // Clear any existing text first
        const composerA = verifyA.locator || page.locator(verifyA.selector).first();
        await human.safeHumanClick(composerA, 'Quote Composer', 3, { precision: 'high' });
        await page.keyboard.press('Control+a');
        await page.keyboard.press('Delete');
        await api.wait(1000);

        // Type the quote text
        await human.typeText(page, text, composerA);

        // Post the quote
        const postA = await human.postTweet(page);
        if (postA.success) {
            logger.info(`[quoteA] Quote posted successfully`);
            return { success: true, method: 'quoteA' };
        } else {
            logger.warn(`[quoteA] Post failed: ${postA.reason}`);
            return { success: false, method: 'quoteA', reason: postA.reason };
        }
    },

    /**
     * Method B: Retweet menu → Quote
     * Flow: Click retweet button → Click Quote option → Type → Submit
     */
    quoteB: async (page, text, human, logger, _options = {}) => {
        logger.info(`[quoteB] Starting retweet menu method`);

        await api.scroll.toTop();
        await api.wait(1000);

        // Reset any open menus
        await page.keyboard.press('Escape');
        await api.wait(1000);

        // Find retweet button
        logger.info(`[quoteB] Looking for retweet button...`);
        const retweetSelectors = [
            '[data-testid="retweet"]',
            '[aria-label*="Repost"]',
            '[aria-label*="Retweet"]',
            'button[aria-label*="repost"]',
            'button[aria-label*="retweet"]'
        ];

        let retweetBtn = null;
        let retweetSelector = null;
        for (const selector of retweetSelectors) {
            const elements = await page.locator(selector).all();
            for (const el of elements) {
                try {
                    const isVisible = await api.visible(el);
                    if (isVisible) {
                        retweetBtn = el;
                        retweetSelector = selector;
                        break;
                    }
                } catch {
                    // Ignore element visibility check errors
                }
            }
            if (retweetBtn) break;
        }

        if (!retweetBtn) {
            logger.warn(`[quoteB] Retweet button not found`);
            return { success: false, method: 'quoteB', reason: 'retweet_button_not_found' };
        }

        // Get detailed element info for logging
        const elementInfo = await retweetBtn.evaluate(el => {
            return {
                tagName: el.tagName,
                text: el.innerText,
                ariaLabel: el.getAttribute('aria-label'),
                disabled: el.disabled || el.getAttribute('aria-disabled') === 'true',
                rect: el.getBoundingClientRect()
            };
        });

        const box = await retweetBtn.boundingBox();
        logger.info(`[quoteB] Found retweet button: ${retweetSelector}`);
        logger.info(`[quoteB] Button Details: Tag=${elementInfo.tagName}, Label="${elementInfo.ariaLabel}", Disabled=${elementInfo.disabled}`);
        logger.info(`[quoteB] Bounding Box: x=${box?.x}, y=${box?.y}, w=${box?.width}, h=${box?.height}`);

        // Click retweet button
        await retweetBtn.scrollIntoViewIfNeeded();
        await human.fixation(300, 800);
        await human.microMove(page, 20);

        logger.info(`[quoteB] Clicking Retweet button...`);
        const rtClickResult = await human.safeHumanClick(retweetBtn, 'Retweet Button', 3, { precision: 'high' });

        if (!rtClickResult) {
            logger.warn(`[quoteB] Failed to click Retweet button (safeHumanClick false). Trying force click...`);
            try {
                await retweetBtn.click({ force: true });
                logger.info(`[quoteB] Force click executed.`);
            } catch (e) {
                logger.error(`[quoteB] Force click failed: ${e.message}`);
                return { success: false, method: 'quoteB', reason: 'retweet_click_failed' };
            }
        }

        await api.wait(1000);

        // Verify menu opened (look for Quote option)
        logger.info(`[quoteB] Looking for Quote option...`);
        const quoteMenuSelectors = [
            'a[role="menuitem"][href*="/retweet"]',
            'a[role="menuitem"]:has-text("Quote")',
            '[role="menuitem"]:has-text("Quote")',
            '[data-testid="retweetQuote"]',
            'text=Quote'
        ];

        let quoteOption = null;
        let quoteSelector = null;

        // Wait a bit for menu animation
        await api.wait(1000);

        for (const selector of quoteMenuSelectors) {
            try {
                const elements = await page.locator(selector).all();
                for (const el of elements) {
                    try {
                        const isVisible = await api.visible(el);
                        const text = await el.innerText().catch(() => '');

                        if (isVisible && text.toLowerCase().includes('quote')) {
                            quoteOption = el;
                            quoteSelector = selector;
                            break;
                        }
                    } catch {
                        // Ignore element check errors
                    }
                }
                if (quoteOption) break;
            } catch {
                // Ignore selector errors
            }
        }

        if (!quoteOption) {
            logger.warn(`[quoteB] Quote option not found in menu. Menu might not have opened.`);
            // Retry clicking retweet button? For now just fail.
            return { success: false, method: 'quoteB', reason: 'quote_option_not_found' };
        }

        const quoteBox = await quoteOption.boundingBox();
        logger.info(`[quoteB] Found Quote option: ${quoteSelector} | Box: ${JSON.stringify(quoteBox)}`);

        // Click Quote option
        await human.fixation(100, 300);
        await human.microMove(page, 10);

        logger.info(`[quoteB] Clicking Quote option...`);
        const quoteClickResult = await human.safeHumanClick(quoteOption, 'Quote Menu Option', 3, { precision: 'high' });
        if (!quoteClickResult) {
            logger.warn(`[quoteB] Failed to click Quote option. Trying force click...`);
            try {
                await quoteOption.click({ force: true });
                logger.info(`[quoteB] Force click executed on Quote option.`);
            } catch (e) {
                logger.error(`[quoteB] Force click failed: ${e.message}`);
                return { success: false, method: 'quoteB', reason: 'quote_click_failed' };
            }
        }

        await api.wait(1000);

        // Verify composer is open
        const verifyB = await human.verifyComposerOpen(page);
        if (!verifyB.open) {
            logger.warn(`[quoteB] Composer did not open`);
            return { success: false, method: 'quoteB', reason: 'composer_not_opened' };
        }

        logger.info(`[quoteB] Quote composer ready with: ${verifyB.selector}`);

        // Type and post
        const composerB = verifyB.locator || page.locator(verifyB.selector).first();
        await human.safeHumanClick(composerB, 'Quote Composer', 3, { precision: 'high' });
        await page.keyboard.press('Control+a');
        await page.keyboard.press('Delete');
        await api.wait(1000);

        await human.typeText(page, text, composerB);

        const postB = await human.postTweet(page, 'quote');
        if (postB.success) {
            logger.info(`[quoteB] Quote posted successfully`);
            return { success: true, method: 'quoteB' };
        } else {
            logger.warn(`[quoteB] Post failed: ${postB.reason}`);
            return { success: false, method: 'quoteB', reason: postB.reason };
        }
    },

    /**
     * Method C: Type → New Line → Paste URL
     * Flow: Click Compose → Type comment → Enter → Paste URL → Submit
     */
    quoteC: async (page, text, human, logger, _options = {}) => {
        console.log('[DEBUG] quoteC called');
        logger.info(`[quoteC] Starting new post + paste URL method`);

        // Get current tweet URL
        const currentUrl = await api.getCurrentUrl();
        console.log('[DEBUG] currentUrl:', currentUrl);
        logger.info(`[quoteC] Current URL: ${currentUrl}`);

        // Close any open menus
        await page.keyboard.press('Escape');
        await api.wait(1000);

        // Find Compose button
        logger.info(`[quoteC] Looking for Compose button...`);
        const composeBtnSelectors = [
            '[data-testid="SideNav_NewTweet_Button"]',
            '[aria-label="Post"]',
            '[aria-label="New post"]',
            'button:has-text("Post")',
            'button:has-text("New post")'
        ];

        let composeBtn = null;
        for (const selector of composeBtnSelectors) {
            const elements = await page.locator(selector).all();
            console.log(`[DEBUG] Found ${elements.length} elements for selector ${selector}`);
            for (const el of elements) {
                try {
                    const isVisible = await api.visible(el);
                    if (isVisible) {
                        composeBtn = el;
                        logger.info(`[quoteC] Found Compose button: ${selector}`);
                        break;
                    }
                } catch {
                    // Ignore element visibility check errors
                }
            }
            if (composeBtn) break;
        }

        if (!composeBtn) {
            logger.warn(`[quoteC] Compose button not found - trying direct navigation`);
            await api.goto('https://x.com/compose/tweet');
            
            // Re-verify composer after direct nav
            const verifyNav = await human.verifyComposerOpen(page);
            if (!verifyNav.open) {
                return { success: false, method: 'quoteC', reason: 'direct_nav_failed' };
            }
            // Continue with typed text below...
        } else {
            // Click Compose
            await composeBtn.scrollIntoViewIfNeeded();
            await human.fixation(300, 800);
            await human.microMove(page, 20);
            await human.safeHumanClick(composeBtn, 'Compose Button', 3, { precision: 'high' });
            logger.info(`[quoteC] Clicked Compose button`);
            await api.wait(1000);
        }

        // Verify composer is open (if not already verified in fallback)
        const verifyC = await human.verifyComposerOpen(page);
        if (!verifyC.open) {
            logger.warn(`[quoteC] Composer did not open`);
            return { success: false, method: 'quoteC', reason: 'composer_not_opened' };
        }

        logger.info(`[quoteC] Composer opened`);

        // Type the comment FIRST
        const composerC = verifyC.locator || page.locator(verifyC.selector).first();
        logger.info(`[quoteC] Typing comment...`);
        await human.typeText(page, text, composerC);

        // Create new line for URL
        logger.info(`[quoteC] Creating new line for URL...`);
        await page.keyboard.press('Enter');
        await api.wait(1000);

        // Paste the URL
        logger.info(`[quoteC] Pasting URL: ${currentUrl}`);
        await page.evaluate((url) => {
            navigator.clipboard.writeText(url);
        }, currentUrl);
        await page.keyboard.press('Control+v');
        await api.wait(1000);

        // Submit
        const postC = await human.postTweet(page);
        if (postC.success) {
            logger.info(`[quoteC] Quote posted successfully`);
            return { success: true, method: 'quoteC' };
        } else {
            logger.warn(`[quoteC] Post failed: ${postC.reason}`);
            return { success: false, method: 'quoteC', reason: postC.reason };
        }
    }
};

/**
 * Execute a reply method by name
 * @param {string} methodName - Method name (replyA, replyB, replyC)
 * @param {object} page - Playwright page
 * @param {string} text - Text to type
 * @param {object} human - HumanInteraction instance
 * @param {object} logger - Logger instance
 * @param {object} options - Options (maxRetries, etc.)
 * @returns {Promise<object>} Result object
 */
export async function executeReplyMethod(methodName, page, text, human, logger, options = {}) {
    const normalizedName = methodName.toLowerCase();
    const method =
        replyMethods[methodName] ||
        replyMethods[normalizedName] ||
        Object.entries(replyMethods).find(([name]) => name.toLowerCase() === normalizedName)?.[1];
    if (!method) {
        logger.error(`[executeReplyMethod] Unknown method: ${methodName}`);
        return { success: false, method: methodName, reason: 'unknown_method' };
    }

    logger.info(`[executeReplyMethod] Executing ${methodName}...`);
    return await method(page, text, human, logger, options);
}

/**
 * Execute a quote method by name
 * @param {string} methodName - Method name (quoteA, quoteB, quoteC)
 * @param {object} page - Playwright page
 * @param {string} text - Text to type
 * @param {object} human - HumanInteraction instance
 * @param {object} logger - Logger instance
 * @param {object} options - Options (maxRetries, etc.)
 * @returns {Promise<object>} Result object
 */
export async function executeQuoteMethod(methodName, page, text, human, logger, options = {}) {
    const normalizedName = methodName.toLowerCase();
    const method =
        quoteMethods[methodName] ||
        quoteMethods[normalizedName] ||
        Object.entries(quoteMethods).find(([name]) => name.toLowerCase() === normalizedName)?.[1];
    if (!method) {
        logger.error(`[executeQuoteMethod] Unknown method: ${methodName}`);
        return { success: false, method: methodName, reason: 'unknown_method' };
    }

    logger.info(`[executeQuoteMethod] Executing ${methodName}...`);
    return await method(page, text, human, logger, options);
}

export default { replyMethods, quoteMethods, executeReplyMethod, executeQuoteMethod };

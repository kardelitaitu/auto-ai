/**
 * @fileoverview Twitter Interaction Methods
 * Modularized reply and quote methods for reusability
 * @module utils/twitter-interaction-methods
 */

/**
 * Reply Methods - Various strategies for posting replies
 */
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
                await page.waitForTimeout(500);
            }

            // Reset state
            await page.evaluate(() => window.scrollTo(0, 0));
            await page.waitForTimeout(500);

            // Click main tweet to focus
            logger.info(`[replyA] Focusing main tweet...`);
            const timeElement = page.locator('article time').first();
            if (await timeElement.count() > 0) {
                await human.safeHumanClick(timeElement, 'Tweet Timestamp', 3);
                logger.info(`[replyA] Clicked tweet timestamp`);
            } else {
                const tweetText = page.locator('[data-testid="tweetText"]').first();
                if (await tweetText.count() > 0) {
                    await human.safeHumanClick(tweetText, 'Tweet Text', 3);
                    logger.info(`[replyA] Clicked tweet text (fallback)`);
                }
            }
            await page.waitForTimeout(300);

            // Press R to open reply composer
            logger.info(`[replyA] Pressing R key...`);
            await page.keyboard.press('r');
            await page.waitForTimeout(2000);

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
        
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(500);

        const btnResult = await human.findElement(page, 
            ['[data-testid="replyEdge"]', '[data-testid="reply"]'], 
            { visibleOnly: true }
        );

        if (!btnResult.element) {
            logger.warn(`[replyB] Reply button not found`);
            return { success: false, method: 'replyB', reason: 'button_not_found' };
        }

        logger.info(`[replyB] Found button: ${btnResult.selector}`);
        
        await btnResult.element.scrollIntoViewIfNeeded();
        await human.fixation(300, 800);
        await human.microMove(page, 20);
        await human.safeHumanClick(btnResult.element, 'Reply Button', 3);
        
        logger.info(`[replyB] Clicked reply button`);
        await page.waitForTimeout(2000);

        const verify = await human.verifyComposerOpen(page);
        if (!verify.open) {
            logger.warn(`[replyB] Composer did not open`);
            return { success: false, method: 'replyB', reason: 'composer_not_opened' };
        }

        logger.info(`[replyB] Composer opened with: ${verify.selector}`);
        
        const composer = verify.locator || page.locator(verify.selector).first();
        await human.typeText(page, text, composer);
        
        const postResult = await human.postTweet(page);
        
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
        
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(500);

        // Step 1: Focus main tweet by clicking timestamp
        logger.info(`[replyC] Focusing main tweet...`);
        const timeElement = page.locator('article time').first();
        if (await timeElement.count() > 0) {
            await human.safeHumanClick(timeElement, 'Tweet Timestamp', 3);
            logger.info(`[replyC] Clicked tweet timestamp`);
        }
        await page.waitForTimeout(500);

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
            await page.waitForTimeout(1000);
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
        await page.waitForTimeout(300);

        await replyBoxAfter.scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);
        
        await human.safeHumanClick(replyBoxAfter, 'Reply Box', 3);
        logger.info(`[replyC] Clicked reply box`);
        await page.waitForTimeout(300);

        // Step 4: Type
        logger.info(`[replyC] Typing...`);
        await human.typeText(page, text, replyBoxAfter);

        // Step 5: Submit with Ctrl+Enter
        logger.info(`[replyC] Submitting...`);
        await page.keyboard.down('Control');
        await page.keyboard.press('Enter');
        await page.keyboard.up('Control');
        
        await page.waitForTimeout(2000);
        logger.info(`[replyC] Reply submitted`);
        
        return { success: true, method: 'replyC' };
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
        
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(500);

        // Click time element to focus tweet
        const quoteTimeElement = page.locator('article time').first();
        if (await quoteTimeElement.count() > 0) {
            await human.safeHumanClick(quoteTimeElement, 'Tweet Timestamp', 3);
            logger.info(`[quoteA] Clicked tweet timestamp`);
        }
        await page.waitForTimeout(500);

        // Press T to open composer
        await page.keyboard.press('t');
        logger.info(`[quoteA] Pressed T`);
        await page.waitForTimeout(750);

        // Navigate to quote option
        await page.keyboard.press('ArrowDown');
        logger.info(`[quoteA] Pressed ArrowDown`);
        await page.waitForTimeout(500);

        // Select quote option
        await page.keyboard.press('Enter');
        logger.info(`[quoteA] Pressed Enter`);
        await page.waitForTimeout(1500);

        // Verify quote composer is ready
        const verifyA = await human.verifyComposerOpen(page);
        if (!verifyA.open) {
            logger.warn(`[quoteA] Composer did not open`);
            return { success: false, method: 'quoteA', reason: 'composer_not_opened' };
        }

        logger.info(`[quoteA] Quote composer ready`);

        // Clear any existing text first
        const composerA = verifyA.locator || page.locator(verifyA.selector).first();
        await human.safeHumanClick(composerA, 'Quote Composer', 3);
        await page.keyboard.press('Control+a');
        await page.keyboard.press('Delete');
        await page.waitForTimeout(200);

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
        
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(500);

        // Reset any open menus
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);

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
        for (const selector of retweetSelectors) {
            const elements = await page.locator(selector).all();
            for (const el of elements) {
                try {
                    const isVisible = await el.isVisible();
                    if (isVisible) {
                        retweetBtn = el;
                        logger.info(`[quoteB] Found retweet button: ${selector}`);
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

        // Click retweet button
        await retweetBtn.scrollIntoViewIfNeeded();
        await human.fixation(300, 800);
        await human.microMove(page, 20);
        await human.safeHumanClick(retweetBtn, 'Retweet Button', 3);
        logger.info(`[quoteB] Clicked retweet button`);
        await page.waitForTimeout(1000);

        // Find Quote option in menu
        logger.info(`[quoteB] Looking for Quote option...`);
        const quoteMenuSelectors = [
            'a[role="menuitem"]:has-text("Quote")',
            '[role="menuitem"]:has-text("Quote")',
            '[data-testid="retweetQuote"]',
            'text=Quote'
        ];

        let quoteOption = null;
        for (const selector of quoteMenuSelectors) {
            try {
                const elements = await page.locator(selector).all();
                for (const el of elements) {
                    try {
                        const isVisible = await el.isVisible();
                        const text = await el.innerText().catch(() => '');
                        
                        if (isVisible && text.toLowerCase().includes('quote')) {
                            quoteOption = el;
                            logger.info(`[quoteB] Found Quote option: ${selector}`);
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
            logger.warn(`[quoteB] Quote option not found in menu`);
            return { success: false, method: 'quoteB', reason: 'quote_option_not_found' };
        }

        // Click Quote option
        await human.fixation(100, 300);
        await human.microMove(page, 10);
        await human.safeHumanClick(quoteOption, 'Quote Menu Option', 3);
        logger.info(`[quoteB] Clicked Quote option`);
        await page.waitForTimeout(1500);

        // Verify composer is open
        const verifyB = await human.verifyComposerOpen(page);
        if (!verifyB.open) {
            logger.warn(`[quoteB] Composer did not open`);
            return { success: false, method: 'quoteB', reason: 'composer_not_opened' };
        }

        logger.info(`[quoteB] Quote composer ready`);

        // Type and post
        const composerB = verifyB.locator || page.locator(verifyB.selector).first();
        await human.safeHumanClick(composerB, 'Quote Composer', 3);
        await page.keyboard.press('Control+a');
        await page.keyboard.press('Delete');
        await page.waitForTimeout(200);
        
        await human.typeText(page, text, composerB);
        
        const postB = await human.postTweet(page);
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
        logger.info(`[quoteC] Starting new post + paste URL method`);
        
        // Get current tweet URL
        const currentUrl = page.url();
        logger.info(`[quoteC] Current URL: ${currentUrl}`);
        
        // Close any open menus
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);

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
            for (const el of elements) {
                try {
                    const isVisible = await el.isVisible();
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
            logger.warn(`[quoteC] Compose button not found`);
            return { success: false, method: 'quoteC', reason: 'compose_button_not_found' };
        }

        // Click Compose
        await composeBtn.scrollIntoViewIfNeeded();
        await human.fixation(300, 800);
        await human.microMove(page, 20);
        await human.safeHumanClick(composeBtn, 'Compose Button', 3);
        logger.info(`[quoteC] Clicked Compose button`);
        await page.waitForTimeout(1500);

        // Verify composer is open
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
        await page.waitForTimeout(500);

        // Paste the URL
        logger.info(`[quoteC] Pasting URL: ${currentUrl}`);
        await page.evaluate((url) => {
            navigator.clipboard.writeText(url);
        }, currentUrl);
        await page.keyboard.press('Control+v');
        await page.waitForTimeout(500);

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

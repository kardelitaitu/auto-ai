import { BaseHandler } from './BaseHandler.js';

export class EngagementHandler extends BaseHandler {
    constructor(agent) {
        super(agent);
    }

    /**
     * Poll for follow state changes with timeout
     * @param {string} unfollowSelector - Selector for unfollow button
     * @param {string} followSelector - Selector for follow button  
     * @param {number} maxWaitMs - Maximum wait time in milliseconds
     * @returns {Promise<boolean>} true if state changed to follow, false otherwise
     */
    async pollForFollowState(unfollowSelector, followSelector, maxWaitMs = 20000) {
        const pollInterval = 2000;
        const maxPolls = Math.ceil(maxWaitMs / pollInterval);

        const unfollowBtn = this.page.locator(unfollowSelector).first();
        const followBtn = this.page.locator(followSelector).first();

        for (let i = 0; i < maxPolls; i++) {
            // Check if Unfollow button appeared (success case)
            if (await unfollowBtn.isVisible().catch(() => false)) {
                this.log('[Follow] ✅ Successfully followed (Unfollow button visible).');
                return true;
            }

            // Check if Follow button disappeared (success case)
            if (!(await followBtn.isVisible().catch(() => false))) {
                this.log('[Follow] ✅ Successfully followed (Follow button disappeared).');
                return true;
            }

            // Additional check: Look for text indicating following state
            const text = await followBtn.textContent().catch(() => '');
            if (text && text.toLowerCase().includes('following')) {
                this.log('[Follow] ✅ Successfully followed (Button text indicates following).');
                return true;
            }

            if (i < maxPolls - 1) {
                await this.page.waitForTimeout(pollInterval);
            }
        }

        this.log('[Follow] ❌ Polling timeout: Follow state did not change.');
        return false;
    }

    /**
     * Six-layer click strategy for robust element interaction
     * Uses multiple click methods with fallbacks for maximum reliability
     */
    async sixLayerClick(element, logPrefix) {
        const layers = [
            { name: 'Ghost Click (Primary)', method: async (el) => {
                try {
                    const handle = await el.elementHandle();
                    if (handle) {
                        await this.page.evaluate(el => {
                            el.scrollIntoView({ block: 'center', inline: 'center' });
                        }, handle);
                        await this.page.waitForTimeout(this.mathUtils.randomInRange(300, 600));
                        return await this.ghost.click(handle, { allowNativeFallback: false });
                    }
                } catch (e) {
                    return { success: false, error: e.message };
                }
            }},
            { name: 'Ghost Click (Fallback)', method: async (el) => {
                try {
                    return await this.ghost.click(el, { allowNativeFallback: true });
                } catch (e) {
                    return { success: false, error: e.message };
                }
            }},
            { name: 'Human Click', method: async (el) => {
                try {
                    await this.humanClick(el, 'SixLayer Human');
                    return { success: true };
                } catch (e) {
                    return { success: false, error: e.message };
                }
            }},
            { name: 'Safe Human Click', method: async (el) => {
                try {
                    await this.safeHumanClick(el, 'SixLayer SafeHuman', 2);
                    return { success: true };
                } catch (e) {
                    return { success: false, error: e.message };
                }
            }},
            { name: 'Native Click (Element)', method: async (el) => {
                try {
                    await el.click();
                    return { success: true };
                } catch (e) {
                    return { success: false, error: e.message };
                }
            }},
            { name: 'JavaScript Click', method: async (el) => {
                try {
                    await el.evaluate(el => el.click());
                    return { success: true };
                } catch (e) {
                    return { success: false, error: e.message };
                }
            }}
        ];

        for (let i = 0; i < layers.length; i++) {
            const layer = layers[i];
            this.log(`${logPrefix} Trying layer ${i + 1}/${layers.length}: ${layer.name}`);

            try {
                const result = await layer.method(element);
                if (result.success) {
                    this.log(`${logPrefix} ✅ Success with layer ${i + 1}: ${layer.name}`);
                    return true;
                }
                this.log(`${logPrefix} ❌ Layer ${i + 1} failed: ${result.error || 'Unknown error'}`);
            } catch (_error) {
                // Should be unreachable
            }

            // Delay between layers (300-800ms)
            if (i < layers.length - 1) {
                await this.page.waitForTimeout(this.mathUtils.randomInRange(300, 800));
            }
        }

        this.log(`${logPrefix} ❌ All 6 click layers failed.`);
        return false;
    }

    /**
     * Robust follow functionality with multiple fallback strategies
     * Handles various Twitter follow button states and edge cases
     */
    async robustFollow(logPrefix = '[Follow]', reloadUrl = null) {
        const followBtnSelector = 'div[data-testid="placementTracking"] [data-testid$="-follow"], div[role="button"][data-testid$="-follow"]';
        const unfollowBtnSelector = 'div[data-testid="placementTracking"] [data-testid$="-unfollow"], div[role="button"][data-testid$="-unfollow"]';
        
        const MAX_ATTEMPTS = 3;
        // Always allow one extra attempt for reload/recovery
        const totalAttempts = MAX_ATTEMPTS + 1;
        let hasReloaded = false;
        
        const result = {
            success: false,
            attempts: 0,
            reloaded: false,
            error: null
        };

        // Pre-check: If already unfollowing, skip
        const preCheckUnfollow = this.page.locator(unfollowBtnSelector).first();
        if (await preCheckUnfollow.isVisible().catch(() => false)) {
            this.log(`${logPrefix} ⚠️ Already unfollowing (unfollow button visible). Skipping.`);
            result.success = true;
            result.skipped = true;
            return result;
        }

        // Pre-check: If already following with different text
        const preCheckFollow = this.page.locator(followBtnSelector).first();
        if (await preCheckFollow.isVisible().catch(() => false)) {
            const preTextRaw = await preCheckFollow.textContent().catch(() => '');
            const preText = preTextRaw.toLowerCase();
            if (preText.includes('following')) {
                this.log(`${logPrefix} ⚠️ Already following (button text: '${preTextRaw}'). Skipping.`);
                result.success = true;
                result.skipped = true;
                return result;
            }
            if (preText.includes('pending')) {
                this.log(`${logPrefix} ⚠️ Follow request pending (button text: '${preTextRaw}'). Skipping.`);
                result.success = true;
                result.skipped = true;
                return result;
            }
        }

        for (let attempt = 1; attempt <= totalAttempts; attempt++) {
            result.attempts = attempt;
            this.log(`${logPrefix} Attempt ${attempt}/${totalAttempts}...`);

            // Check if we need to reload (after MAX_ATTEMPTS failures)
            if (attempt === MAX_ATTEMPTS + 1 && !hasReloaded) {
                this.log(`${logPrefix} 🔄 All ${MAX_ATTEMPTS} attempts failed. Reloading page...`);
                try {
                    if (reloadUrl) {
                        this.log(`${logPrefix} 🔄 Force Navigating to: ${reloadUrl}`);
                        await this.page.goto(reloadUrl);
                    } else {
                        await this.page.reload();
                    }
                    await this.page.waitForTimeout(2000);
                    hasReloaded = true;
                    result.reloaded = true;
                } catch (reloadError) {
                    this.log(`${logPrefix} ❌ Reload failed: ${reloadError.message}`);
                    result.error = `Reload failed: ${reloadError.message}`;
                    break;
                }
            }

            // Health check
            const health = await this.performHealthCheck();
            if (!health.healthy) {
                this.log(`${logPrefix} 💀 CRITICAL HEALTH FAILURE: ${health.reason}. Aborting task.`);
                result.error = `Health failure: ${health.reason}`;
                break;
            }

            // Get fresh element references after potential reload
            const freshFollowBtn = this.page.locator(followBtnSelector).first();
            const freshUnfollowBtn = this.page.locator(unfollowBtnSelector).first();

            // Check if already unfollowing after reload
            if (await freshUnfollowBtn.isVisible().catch(() => false)) {
                this.log(`${logPrefix} ✅ Successfully followed (unfollow button visible after reload).`);
                result.success = true;
                break;
            }

            if (await freshFollowBtn.isVisible()) {
                const buttonTextRaw = await freshFollowBtn.textContent().catch(() => '');
                const buttonText = buttonTextRaw.toLowerCase();
                
                // Check if already in following state
                if (buttonText.includes('following') || buttonText.includes('unfollow')) {
                    this.log(`${logPrefix} ✅ Already following (button text: '${buttonTextRaw}').`);
                    result.success = true;
                    break;
                }

                // Check if in pending state
                if (buttonText.includes('follow')) {
                    try {
                        // Ensure element is actionable
                        const isActionable = await this.isElementActionable(freshFollowBtn);
                        if (!isActionable) {
                            this.log(`${logPrefix} Button not actionable (covered by overlay?). Retrying...`);
                            await this.page.waitForTimeout(1000);
                            continue;
                        }

                         // Pre-click text check
                         const preClickTextRaw = await freshFollowBtn.textContent().catch(() => '');
                         const preClickText = preClickTextRaw.toLowerCase();
                         if (preClickText.includes('following') || preClickText.includes('pending')) {
                             this.log(`${logPrefix} ⚠️ Already in following/pending state: '${preClickTextRaw}'.`);
                             if (await this.page.locator(unfollowBtnSelector).first().isVisible().catch(() => false)) {
                                 result.success = true;
                                 break;
                             }
                             // If unfollow not visible, we're in a pending state - treat as skipped
                             result.skipped = true;
                             break;
                         }

                        // Perform the click using six-layer strategy
                        const clickPerformed = await this.sixLayerClick(freshFollowBtn, logPrefix);
                        if (!clickPerformed) {
                            this.log(`${logPrefix} All 6 click layers failed.`);
                            continue;
                        }

                        // Verify follow was successful
                        await this.page.waitForTimeout(1500);
                        const verified = await this.pollForFollowState(unfollowBtnSelector, followBtnSelector, 5000);
                        if (verified) {
                            this.state.follows++;
                            this.log(`${logPrefix} ✅ Follow successful! Total follows: ${this.state.follows}`);
                            result.success = true;
                            break;
                        }

                        // Additional verification: check aria-label
                        const ariaLabel = await freshFollowBtn.getAttribute('aria-label').catch(() => null);
                        if (ariaLabel && ariaLabel.toLowerCase().includes('following')) {
                            this.state.follows++;
                            this.log(`${logPrefix} ✅ Follow successful (aria-label indicates following)! Total follows: ${this.state.follows}`);
                            result.success = true;
                            break;
                        }

                        // Final verification: poll again with longer timeout
                        const postPollTextRaw = await freshFollowBtn.textContent().catch(() => '');
                        const postPollText = postPollTextRaw.toLowerCase();
                        if (postPollText.includes('following')) {
                            this.state.follows++;
                            this.log(`${logPrefix} ✅ Follow successful (post-poll text indicates following)! Total follows: ${this.state.follows}`);
                            result.success = true;
                            break;
                        }

                    } catch (clickError) {
                        this.log(`${logPrefix} ❌ Click error: ${clickError.message}`);
                    }
                }
            }

            if (attempt < totalAttempts) {
                // Exponential backoff before retry
                const backoff = Math.min(2000 * Math.pow(2, attempt - 1), 8000);
                this.log(`${logPrefix} ⏸️ Waiting ${backoff}ms before retry...`);
                await this.page.waitForTimeout(backoff);
            }
        }

        if (!result.success) {
            this.log(`${logPrefix} ❌ All follow attempts failed.`);
            if (!result.error) {
                result.error = 'All follow attempts failed';
            }
        }

        return result;
    }

    /**
     * Dive into a tweet for engagement (like, bookmark, etc.)
     * Main engagement method for interacting with tweet content
     */
    async diveTweet() {
        this.log('[Dive] Starting tweet dive engagement...');

        // Find tweet targets
        for (let attempt = 0; attempt < 3; attempt++) {
            const tweetTargets = this.page.locator('[data-testid="tweet"], article[data-testid="tweet"], [role="article"]');
            const count = await tweetTargets.count();
            
            if (count > 0) {
                // Evaluate all visible tweets and select one
                let targetTweet = null;
                let maxScore = -1;
                
                for (let i = 0; i < Math.min(count, 10); i++) {
                    const tweet = tweetTargets.nth(i);
                    if (await tweet.isVisible()) {
                        const box = await tweet.boundingBox().catch(() => null);
                        if (box && box.height > 0 && box.y > -50 && box.y < 1000) {
                            // Score based on position (prefer center of viewport)
                            const score = 1000 - Math.abs(box.y - 400); // Center bias
                            if (score > maxScore) {
                                maxScore = score;
                                targetTweet = tweet;
                            }
                        }
                    }
                }

                if (targetTweet) {
                    try {
                        // Scroll target into view
                        await targetTweet.scrollIntoViewIfNeeded();
                        await this.page.waitForTimeout(this.mathUtils.randomInRange(800, 1500));

                        // Check for text content to ensure it's a real tweet
                        const textContent = targetTweet.locator('[data-testid="tweetText"], [lang]');
                        if (await textContent.count() > 0 && await textContent.isVisible()) {
                            this.log('[Dive] Found valid tweet target, engaging...');
                            
                            // Human-like reading behavior
                            await this.simulateReading();
                            
                            // Like engagement
                            if (this.mathUtils.roll(this.config.probabilities?.likeTweetAfterDive || 0.3)) {
                                await this.likeTweet(targetTweet);
                            }
                            
                            // Bookmark engagement
                            if (this.mathUtils.roll(this.config.probabilities?.bookmarkAfterDive || 0.1)) {
                                await this.bookmarkTweet(targetTweet);
                            }
                            
                            return true;
                        }
                    } catch (error) {
                        this.log(`[Dive] Error engaging with tweet: ${error.message}`);
                    }
                }
            }
            
            if (attempt < 2) {
                await this.page.waitForTimeout(1000);
            }
        }

        this.log('[Dive] No suitable tweets found for engagement.');
        return false;
    }

    /**
     * Like a tweet with robust error handling
     */
    async likeTweet(tweetElement) {
        try {
            const likeButton = tweetElement.locator('[data-testid="like"], [aria-label*="Like"], [aria-label*="like"]');
            if (await likeButton.count() > 0 && await likeButton.isVisible()) {
                await this.safeHumanClick(likeButton, 'Like Button');
                this.state.likes++;
                this.log(`[Like] ✅ Liked tweet! Total likes: ${this.state.likes}`);
                return true;
            }
        } catch (error) {
            this.log(`[Like] Error: ${error.message}`);
        }
        return false;
    }

    /**
     * Bookmark a tweet
     */
    async bookmarkTweet(tweetElement) {
        try {
            const bookmarkButton = tweetElement.locator('[data-testid="bookmark"], [aria-label*="Bookmark"], [aria-label*="bookmark"]');
            if (await bookmarkButton.count() > 0 && await bookmarkButton.isVisible()) {
                await this.safeHumanClick(bookmarkButton, 'Bookmark Button');
                this.log('[Bookmark] ✅ Bookmarked tweet!');
                return true;
            }
        } catch (error) {
            this.log(`[Bookmark] Error: ${error.message}`);
        }
        return false;
    }

    /**
     * Dive into user profile exploration
     */
    async diveProfile() {
        this.log('[Branch] Inspecting User Profile');
        // Broader selector to catch all links in the tweet header (Avatar, Name, Handle)
        const selector = 'article[data-testid="tweet"] a[href^="/"]';

        // Evaluate all to find valid profile links (exclude /status/, /hashtag/, etc.)
        const validIndices = await this.page.$$eval(selector, (els) => {
            const reserved = ['home', 'explore', 'notifications', 'messages', 'compose', 'settings', 'search', 'i'];
            return els.map((el, i) => {
                let href = el.getAttribute('href');
                if (!href) return -1;

                // Remove trailing slash for checking
                if (href.endsWith('/')) href = href.slice(0, -1);

                const parts = href.split('/').filter(p => p.trim() !== '');

                // Valid profile link: 1 part (e.g. /username)
                // AND not in reserved list
                // AND not containing blocked keywords like status
                if (
                    parts.length === 1 &&
                    !reserved.includes(parts[0].toLowerCase()) &&
                    !href.includes('/status/') &&
                    !href.includes('/hashtag/')
                ) {
                    return i;
                }
                return -1;
            });
        });

        // Filter out invalid indices
        const indices = validIndices.filter(i => i !== -1);

        if (indices.length > 0) {
            // Pick a random valid profile link
            const randomIndex = indices[Math.floor(Math.random() * indices.length)];
            const target = this.page.locator(selector).nth(randomIndex);
            
            try {
                this.log('[Dive] Clicking user profile...');
                await this.safeHumanClick(target, 'Profile Link');
                await this.page.waitForTimeout(this.mathUtils.randomInRange(2000, 4000));
                
                // Perform profile actions (follow, scroll, etc.)
                // TODO: Implement specific profile interactions here if needed
                
                // Return to feed
                await this.page.goBack();
                await this.page.waitForTimeout(1000);
                return true;
            } catch (e) {
                this.log(`[Dive] Profile interaction failed: ${e.message}`);
            }
        } else {
            this.log('[Dive] No valid profile links found in tweets.');
        }
        return false;
    }
}

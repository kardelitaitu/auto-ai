import fs from 'fs';
import path from 'path';

const filePath = path.resolve('c:/My Script/auto-ai/utils/human-interaction.js');
let code = fs.readFileSync(filePath, 'utf8');

// The original basic postTweet at git HEAD is:
// async postTweet(page) { ... return { success: false, reason: 'post_failed' }; }
// We will replace it entirely, and also replace verifyPostSent, AND inject twitterVerifyReply/Quote.

const verifyMethods = `
    /**
     * Verify post was sent (composer closed or confirmation shown)
     */
    async verifyPostSent(page) {
        // Wait a moment for UI update
        await new Promise(resolve => setTimeout(resolve, 500));

        const checks = [
            // Positive indicators (Success)
            { selector: '[data-testid="toast"]', label: 'toast notification', type: 'positive' },
            { selector: 'span:has-text("Your post was sent")', label: 'sent text', type: 'positive' },
            { selector: 'span:has-text("Your Tweet was sent")', label: 'sent text (old)', type: 'positive' },
            
            // Negative indicators (Success if GONE)
            { selector: '[data-testid="tweetTextarea_0"]', label: 'composer', type: 'negative' },
            { selector: '[data-testid="tweetButton"]', label: 'post button', type: 'negative' },
            { selector: '[data-testid="tweetButtonInline"]', label: 'inline post button', type: 'negative' }
        ];

        this.logDebug(\`[Verify] Checking if post was sent...\`);

        // Check positive indicators first
        for (const check of checks.filter(c => c.type === 'positive')) {
            try {
                const el = page.locator(check.selector).first();
                if (await el.isVisible().catch(() => false)) {
                    const text = await el.innerText().catch(() => '');
                    this.logDebug(\`[Verify] Found \${check.label}: "\${text.substring(0, 30)}"\`);
                    
                    // Verify it's not an error toast
                    if (check.label === 'toast notification') {
                        const lowerText = text.toLowerCase();
                        if (lowerText.includes('fail') || lowerText.includes('error') || lowerText.includes('wrong') || lowerText.includes('retry')) {
                            this.logWarn(\`[Verify] Toast indicates failure: "\${text}"\`);
                            continue;
                        }
                    }

                    return { sent: true, method: check.label };
                }
            } catch { /* ignore */ }
        }

        // Check negative indicators (must be GONE)
        const composer = page.locator('[data-testid="tweetTextarea_0"]');
        const isComposerVisible = await composer.isVisible().catch(() => false);
        this.logDebug(\`[Verify] Composer visible: \${isComposerVisible}\`);
        
        if (!isComposerVisible) {
             // Double check it's not just a loading glitch
             await new Promise(r => setTimeout(r, 500));
             if (!await composer.isVisible().catch(() => false)) {
                 this.logDebug(\`[Verify] Composer is no longer visible (confirmed)\`);
                 return { sent: true, method: 'composer_closed' };
             }
        }

        // Check URL changed back
        const url = page.url();
        this.logDebug(\`[Verify] Current URL: \${url}\`);
        
        if (!url.includes('/compose/') && !url.includes('/status/')) { 
            this.logDebug(\`[Verify] URL check passed (not in compose mode)\`);
        }

        // Additional verification: wait a bit and check again if not confirmed
        this.logDebug(\`[Verify] Post not immediately confirmed, waiting 1.5s...\`);
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Final check: composer should be closed
        const composerVisibleFinal = await page.locator('[data-testid="tweetTextarea_0"]').isVisible().catch(() => false);
        if (!composerVisibleFinal) {
            this.logDebug(\`[Verify] Composer closed after wait: confirmed\`);
            return { sent: true, method: 'composer_closed_delayed' };
        }
        
        // If composer is still there, check if text was cleared
        const inputValue = await composer.inputValue().catch(() => '');
        if (inputValue.length === 0) {
             this.logDebug(\`[Verify] Composer visible but empty. Treating as success.\`);
             return { sent: true, method: 'composer_cleared' };
        }
        
        this.logDebug(\`[Verify] Composer still visible with content (\${inputValue.length} chars). Post failed.\`);
        return { sent: false, method: null };
    }

    /**
     * Verify reply was sent specifically
     */
    async twitterVerifyReply(page) {
        // Wait a moment for UI update
        await new Promise(resolve => setTimeout(resolve, 500));

        const checks = [
            // Positive indicators (Success)
            { selector: '[data-testid="toast"]', label: 'toast notification', type: 'positive' },
            { selector: 'span:has-text("Your reply was sent")', label: 'sent text (reply)', type: 'positive' },
            { selector: 'span:has-text("Your post was sent")', label: 'sent text', type: 'positive' },
            
            // Negative indicators (Success if GONE)
            { selector: '[data-testid="tweetTextarea_0"]', label: 'composer', type: 'negative' },
            { selector: '[data-testid="tweetButtonInline"]', label: 'inline post button', type: 'negative' },
            { selector: '[data-testid="reply"]', label: 'reply button', type: 'negative' }
        ];

        this.logDebug(\`[Verify] Checking if REPLY was sent...\`);

        // Check positive indicators first
        for (const check of checks.filter(c => c.type === 'positive')) {
            try {
                const el = page.locator(check.selector).first();
                if (await el.isVisible().catch(() => false)) {
                    const text = await el.innerText().catch(() => '');
                    this.logDebug(\`[Verify] Found \${check.label}: "\${text.substring(0, 30)}"\`);
                    
                    // Verify it's not an error toast
                    if (check.label === 'toast notification') {
                        const lowerText = text.toLowerCase();
                        if (lowerText.includes('fail') || lowerText.includes('error') || lowerText.includes('wrong') || lowerText.includes('retry')) {
                            this.logWarn(\`[Verify] Toast indicates failure: "\${text}"\`);
                            continue;
                        }
                    }

                    return { sent: true, method: check.label };
                }
            } catch { /* ignore */ }
        }

        // Check negative indicators (must be GONE)
        const composer = page.locator('[data-testid="tweetTextarea_0"]');
        const isComposerVisible = await composer.isVisible().catch(() => false);
        this.logDebug(\`[Verify] Composer visible: \${isComposerVisible}\`);
        
        if (!isComposerVisible) {
             // Double check it's not just a loading glitch
             await new Promise(r => setTimeout(r, 500));
             if (!await composer.isVisible().catch(() => false)) {
                 this.logDebug(\`[Verify] Composer is no longer visible (confirmed)\`);
                 return { sent: true, method: 'composer_closed' };
             }
        }

        // Additional verification: wait a bit and check again if not confirmed
        this.logDebug(\`[Verify] Reply not immediately confirmed, waiting 1.5s...\`);
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Final check: composer should be closed
        const composerVisibleFinal = await page.locator('[data-testid="tweetTextarea_0"]').isVisible().catch(() => false);
        if (!composerVisibleFinal) {
            this.logDebug(\`[Verify] Composer closed after wait: confirmed\`);
            return { sent: true, method: 'composer_closed_delayed' };
        }
        
        const inputValue = await composer.inputValue().catch(() => '');
        if (inputValue.length === 0) {
             this.logDebug(\`[Verify] Composer visible but empty. Treating as success.\`);
             return { sent: true, method: 'composer_cleared' };
        }
        
        this.logDebug(\`[Verify] Composer still visible with content. Reply failed.\`);
        return { sent: false, method: null };
    }

    /**
     * Verify quote was sent specifically
     */
    async twitterVerifyQuote(page) {
        // Wait a moment for UI update
        await new Promise(resolve => setTimeout(resolve, 500));

        const checks = [
            // Positive indicators (Success)
            { selector: '[data-testid="toast"]', label: 'toast notification', type: 'positive' },
            { selector: 'span:has-text("Your post was sent")', label: 'sent text', type: 'positive' },
            
            // Negative indicators (Success if GONE)
            { selector: '[data-testid="tweetTextarea_0"]', label: 'composer', type: 'negative' },
            { selector: '[data-testid="tweetButton"]', label: 'post button', type: 'negative' }
        ];

        this.logDebug(\`[Verify] Checking if QUOTE was sent...\`);

        // Check positive indicators first
        for (const check of checks.filter(c => c.type === 'positive')) {
            try {
                const el = page.locator(check.selector).first();
                if (await el.isVisible().catch(() => false)) {
                    const text = await el.innerText().catch(() => '');
                    this.logDebug(\`[Verify] Found \${check.label}: "\${text.substring(0, 30)}"\`);
                    
                    // Verify it's not an error toast
                    if (check.label === 'toast notification') {
                        const lowerText = text.toLowerCase();
                        if (lowerText.includes('fail') || lowerText.includes('error') || lowerText.includes('wrong') || lowerText.includes('retry')) {
                            this.logWarn(\`[Verify] Toast indicates failure: "\${text}"\`);
                            continue;
                        }
                    }

                    return { sent: true, method: check.label };
                }
            } catch { /* ignore */ }
        }

        // Check negative indicators (must be GONE)
        const composer = page.locator('[data-testid="tweetTextarea_0"]');
        const isComposerVisible = await composer.isVisible().catch(() => false);
        this.logDebug(\`[Verify] Quote Composer visible: \${isComposerVisible}\`);
        
        if (!isComposerVisible) {
             // Double check it's not just a loading glitch
             await new Promise(r => setTimeout(r, 500));
             if (!await composer.isVisible().catch(() => false)) {
                 this.logDebug(\`[Verify] Quote Composer is no longer visible (confirmed)\`);
                 return { sent: true, method: 'composer_closed' };
             }
        }

        // Additional verification: wait a bit and check again if not confirmed
        this.logDebug(\`[Verify] Quote not immediately confirmed, waiting 1.5s...\`);
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Final check: composer should be closed
        const composerVisibleFinal = await page.locator('[data-testid="tweetTextarea_0"]').isVisible().catch(() => false);
        if (!composerVisibleFinal) {
            this.logDebug(\`[Verify] Quote Composer closed after wait: confirmed\`);
            return { sent: true, method: 'composer_closed_delayed' };
        }
        
        const inputValue = await composer.inputValue().catch(() => '');
        if (inputValue.length === 0) {
             this.logDebug(\`[Verify] Quote Composer visible but empty. Treating as success.\`);
             return { sent: true, method: 'composer_cleared' };
        }
        
        this.logDebug(\`[Verify] Quote Composer still visible with content. Quote failed.\`);
        return { sent: false, method: null };
    }

    /**
     * Post with Ctrl+Enter or fallback
     */
    async postTweet(page, type = 'tweet') {
        this.logDebug(\`[Post] Attempting to post (\${type})...\`);

        const verifyPost = async () => {
             if (type === 'reply') return await this.twitterVerifyReply(page);
             if (type === 'quote') return await this.twitterVerifyQuote(page);
             return await this.verifyPostSent(page);
        };

        // Method 1: Keyboard Shortcut (Ctrl+Enter)
        try {
            this.logDebug(\`[Post] Trying Ctrl+Enter...\`);
            await page.keyboard.press('Control+Enter');
            await new Promise(resolve => setTimeout(resolve, 1500)); // Increased wait for stability
            
            const result = await verifyPost();
            if (result.sent) {
                this.logDebug(\`[Post] Success via \${result.method} (Ctrl+Enter)\`);
                return { success: true, method: 'ctrl_enter' };
            }
        } catch (e) {
            this.logDebug(\`[Post] Ctrl+Enter failed: \${e.message}\`);
        }

        this.logDebug(\`[Post] Ctrl+Enter did not send, trying buttons...\`);

        // Method 2: Click "Post" or "Reply" button
        const postSelectors = [
            '[data-testid="tweetButton"]',
            '[data-testid="tweetButtonInline"]',
            '[data-testid="sendTweets"]',
            '[aria-label="Post"]',
            '[aria-label="Reply"]',
            '[role="button"][data-testid*="tweetButton"]',
            'button[type="submit"]' // Generic fallback
        ];
        
        let targetBtn = null;
        let targetSelector = null;

        for (const selector of postSelectors) {
            try {
                const btn = page.locator(selector).first();
                if (await btn.count() > 0 && await btn.isVisible()) {
                    targetBtn = btn;
                    targetSelector = selector;
                    this.logDebug(\`[Post] Found button with selector: \${selector}\`);
                    break;
                }
            } catch (e) {
                this.logDebug(\`[Post] Error checking selector "\${selector}": \${e.message}\`);
            }
        }

        if (!targetBtn) {
            this.logWarn(\`[Post] No post button found!\`);
            return { success: false, reason: 'button_not_found' };
        }

        // Handle disabled button (wait for it to enable)
        let isDisabled = await targetBtn.evaluate(e => e.disabled || e.getAttribute('aria-disabled') === 'true');
        if (isDisabled) {
            this.logDebug(\`[Post] Button is disabled, waiting for it to enable...\`);
            
            // Try to trigger input event on focused element to wake up React
            try {
                const activeEl = page.locator(':focus');
                if (await activeEl.count() > 0) {
                    this.logDebug(\`[Post] Triggering input event on focused element...\`);
                    await page.keyboard.type(' ');
                    await page.keyboard.press('Backspace');
                    await new Promise(r => setTimeout(r, 500));
                }
            } catch (e) {
                this.logDebug(\`[Post] Failed to trigger input: \${e.message}\`);
            }

            // Wait up to 3 seconds for button to enable
            const startTime = Date.now();
            while (isDisabled && Date.now() - startTime < 3000) {
                await new Promise(r => setTimeout(r, 500));
                isDisabled = await targetBtn.evaluate(e => e.disabled || e.getAttribute('aria-disabled') === 'true');
            }

            if (isDisabled) {
                this.logWarn(\`[Post] Button still disabled after wait. Attempting click anyway...\`);
            } else {
                this.logDebug(\`[Post] Button became enabled!\`);
            }
        }

        // Click the button
        this.logDebug(\`[Post] Clicking button: \${targetSelector}\`);
        try {
            await this.humanClick(targetBtn, 'Post Button', { precision: 'high' });
        } catch (e) {
            this.logWarn(\`[Post] humanClick failed: \${e.message}\`);
        }
        
        // Wait for result
        await new Promise(resolve => setTimeout(resolve, 2000));
        const result2 = await verifyPost();
        
        if (result2.sent) {
            this.logDebug(\`[Post] Success via button: \${targetSelector}\`);
            return { success: true, method: 'button_click' };
        } else {
            this.logWarn(\`[Post] Clicked \${targetSelector} but verify failed. Trying force click...\`);
            
            // Last resort: Force click (JS click)
            try {
                await targetBtn.click({ force: true });
                await new Promise(resolve => setTimeout(resolve, 2000));
                const result3 = await verifyPost();
                if (result3.sent) {
                    this.logDebug(\`[Post] Success via force click\`);
                    return { success: true, method: 'force_click' };
                }
            } catch (e) {
                this.logDebug(\`[Post] Force click failed: \${e.message}\`);
            }
        }

        this.logWarn(\`[Post] Failed - no method worked\`);
        return { success: false, reason: 'post_failed' };
    }`;

// Replace everything from `async verifyPostSent(page) {` down to the end of `async postTweet(page) { ... }` 
// (which is around `// =========================================================================\r\n    // SELECTOR FALLBACK METHODS` )

const verifyStart = code.indexOf('async verifyPostSent(page) {');
const endOfPostTweet = code.indexOf('// =========================================================================\n    // SELECTOR FALLBACK');
const endFallbackAlt = code.indexOf('// =========================================================================\r\n    // SELECTOR FALLBACK');

const endPoint = endOfPostTweet !== -1 ? endOfPostTweet : endFallbackAlt;

if (verifyStart !== -1 && endPoint !== -1) {
    const startStr = code.substring(0, verifyStart - 36); // Go back to `    /**\r\n     * Verify post`
    const endStr = code.substring(endPoint);
    fs.writeFileSync(filePath, startStr + verifyMethods + '\n\n    ' + endStr);
    console.log("SUCCESS REPLACE");
} else {
    console.log("NOT FOUND", verifyStart, endPoint);
}

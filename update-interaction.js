import fs from 'fs';
import path from 'path';

const filePath = path.resolve('c:/My Script/auto-ai/utils/human-interaction.js');
let code = fs.readFileSync(filePath, 'utf8');

const verifyReply = `
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
        
        this.logDebug(\`[Verify] Composer still visible with content (\${inputValue.length} chars). Reply failed.\`);
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
`;

// Insert after verifyPostSent ends
const insertPoint = code.indexOf('return { sent: false, method: null };');
const nextBrace = code.indexOf('}', insertPoint);
code = code.substring(0, nextBrace + 1) + '\n' + verifyReply + '\n' + code.substring(nextBrace + 1);

// Update postTweet with verifyPost closure
code = code.replace(
    /async postTweet\(page,\s*type\s*=\s*'tweet'\)\s*\{\r*\n\s*this\.logDebug\(\`\[Post\] Attempting to post \(\$\{type\}\)\.\.\.\`\);/,
    "async postTweet(page, type = 'tweet') {\n        this.logDebug(`[Post] Attempting to post (${type})...`);\n\n        const verifyPost = async () => {\n            if (type === 'reply') return await this.twitterVerifyReply(page);\n            if (type === 'quote') return await this.twitterVerifyQuote(page);\n            return await this.verifyPostSent(page);\n        };"
);

// Replace verifyPostSent calls inside postTweet block. 
const postTweetStart = code.indexOf("async postTweet(page, type = 'tweet') {");
const endOfMethods = code.indexOf("findWithFallback("); // The next method
const beforePost = code.substring(0, postTweetStart);
const duringPost = code.substring(postTweetStart, endOfMethods).replace(/this\.verifyPostSent\(page\)/g, "verifyPost()");
const afterPost = code.substring(endOfMethods);

fs.writeFileSync(filePath, beforePost + duringPost + afterPost);
console.log('Update successful');

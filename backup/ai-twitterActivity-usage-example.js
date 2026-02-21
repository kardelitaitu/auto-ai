/**
 * Example: Using Twitter Interaction Methods in ai-twitterActivity.js
 * 
 * This shows how to integrate the modularized reply/quote methods
 * into the ai-twitterActivity.js task.
 */

// ============================================================================
// STEP 1: Import the utility functions
// ============================================================================
import { executeReplyMethod, executeQuoteMethod } from '../utils/twitter-interaction-methods.js';
import { createLogger } from '../utils/logger.js';
import HumanInteraction from '../utils/human-interaction.js';

// ============================================================================
// STEP 2: Example usage in your task
// ============================================================================

/**
 * Example 1: Direct method execution with specific method
 */
async function postReplyWithMethod(page, text, human, logger, methodName = 'replyA') {
    // Execute specific reply method
    const result = await executeReplyMethod(methodName, page, text, human, logger);
    
    if (result.success) {
        logger.info(`Reply posted successfully using ${result.method}`);
        return true;
    } else {
        logger.error(`Failed to post reply: ${result.reason}`);
        return false;
    }
}

/**
 * Example 2: Try multiple methods with fallback
 */
async function postReplyWithFallback(page, text, human, logger) {
    const methodsToTry = ['replyA', 'replyB', 'replyC'];
    
    for (const method of methodsToTry) {
        logger.info(`Trying reply method: ${method}`);
        const result = await executeReplyMethod(method, page, text, human, logger);
        
        if (result.success) {
            logger.info(`Success with ${method}`);
            return true;
        }
        
        logger.warn(`${method} failed: ${result.reason}, trying next...`);
        await new Promise(r => setTimeout(r, 1000)); // Brief pause between attempts
    }
    
    logger.error('All reply methods failed');
    return false;
}

/**
 * Example 3: Random method selection
 */
async function postReplyRandom(page, text, human, logger) {
    const availableMethods = ['replyA', 'replyB', 'replyC'];
    const randomMethod = availableMethods[Math.floor(Math.random() * availableMethods.length)];
    
    logger.info(`Selected random reply method: ${randomMethod}`);
    const result = await executeReplyMethod(randomMethod, page, text, human, logger);
    
    return result.success;
}

/**
 * Example 4: Post quote with specific method
 */
async function postQuoteWithMethod(page, text, human, logger, methodName = 'quoteA') {
    // Execute specific quote method
    const result = await executeQuoteMethod(methodName, page, text, human, logger);
    
    if (result.success) {
        logger.info(`Quote posted successfully using ${result.method}`);
        return true;
    } else {
        logger.error(`Failed to post quote: ${result.reason}`);
        return false;
    }
}

/**
 * Example 5: Smart method selection based on page state
 */
async function smartReply(page, text, human, logger) {
    // Check if reply button is visible (use replyB)
    const replyButton = await page.locator('[data-testid="reply"]').first();
    const hasReplyButton = await replyButton.count() > 0 && await replyButton.isVisible();
    
    if (hasReplyButton) {
        logger.info('Reply button visible, using replyB');
        return await executeReplyMethod('replyB', page, text, human, logger);
    }
    
    // Check if composer is already open (use replyC)
    const composer = await page.locator('[data-testid="tweetTextarea_0"]').first();
    const hasComposer = await composer.count() > 0 && await composer.isVisible();
    
    if (hasComposer) {
        logger.info('Composer already open, using replyC');
        return await executeReplyMethod('replyC', page, text, human, logger);
    }
    
    // Default to replyA (keyboard shortcut)
    logger.info('Using default replyA (keyboard shortcut)');
    return await executeReplyMethod('replyA', page, text, human, logger);
}

/**
 * Example 6: Configuration-driven method selection
 * Read method from config/settings.json
 */
async function configDrivenReply(page, text, human, logger, settings) {
    // Get preferred method from settings
    const preferredMethod = settings?.twitter?.reply?.preferredMethod || 'replyA';
    const fallbackMethods = settings?.twitter?.reply?.fallbackMethods || ['replyB', 'replyC'];
    
    // Try preferred method first
    logger.info(`Trying preferred method: ${preferredMethod}`);
    let result = await executeReplyMethod(preferredMethod, page, text, human, logger);
    
    if (result.success) {
        return result;
    }
    
    // Try fallbacks
    for (const fallback of fallbackMethods) {
        logger.info(`Preferred method failed, trying fallback: ${fallback}`);
        result = await executeReplyMethod(fallback, page, text, human, logger);
        
        if (result.success) {
            return result;
        }
    }
    
    logger.error('All configured reply methods failed');
    return { success: false, reason: 'all_methods_failed' };
}

// ============================================================================
// STEP 3: Integration example in ai-twitterActivity.js
// ============================================================================

/**
 * Example integration in the main task flow
 */
export default async function aiTwitterActivityTask(page, _payload) {
    const logger = createLogger('ai-twitterActivity.js');
    const human = new HumanInteraction();
    
    // ... existing setup code ...
    
    // When you want to reply to a tweet:
    async function _handleReply(tweetText, generatedReply) {
        // Option 1: Use random method
        const result = await postReplyRandom(page, generatedReply, human, logger);
        
        // Option 2: Use specific method from config
        // const result = await configDrivenReply(page, generatedReply, human, logger, settings);
        
        // Option 3: Smart selection based on page state
        // const result = await smartReply(page, generatedReply, human, logger);
        
        if (result) {
            logger.info('Reply posted successfully');
        } else {
            logger.error('Failed to post reply');
        }
    }
    
    // When you want to quote a tweet:
    async function _handleQuote(tweetText, generatedQuote) {
        // Use quote method
        const result = await postQuoteWithMethod(page, generatedQuote, human, logger, 'quoteA');
        
        if (result) {
            logger.info('Quote posted successfully');
        } else {
            logger.error('Failed to post quote');
        }
    }
    
    // ... rest of your task code ...
}

// ============================================================================
// Configuration example (config/settings.json)
// ============================================================================

/*
{
    "twitter": {
        "reply": {
            "preferredMethod": "replyA",
            "fallbackMethods": ["replyB", "replyC"],
            "probability": 0.5
        },
        "quote": {
            "preferredMethod": "quoteA",
            "fallbackMethods": ["quoteB", "quoteC"],
            "probability": 0.3
        }
    }
}
*/

// ============================================================================
// Available Methods Reference
// ============================================================================

/*
Reply Methods:
- replyA: Keyboard shortcut (R key) - Fastest, most reliable
- replyB: Reply button click - Good for visible buttons
- replyC: Direct composer focus - For already-open composers

Quote Methods:
- quoteA: Keyboard compose (T key) → Quote option
- quoteB: Retweet menu → Quote option
- quoteC: New post + paste URL

All methods return:
{
    success: boolean,
    method: string,
    reason?: string  // Only present if success is false
}
*/

export {
    postReplyWithMethod,
    postReplyWithFallback,
    postReplyRandom,
    postQuoteWithMethod,
    smartReply,
    configDrivenReply
};

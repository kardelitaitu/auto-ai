
import { createLogger } from '../utils/logger.js';
import { AITwitterAgent } from '../utils/ai-twitterAgent.js';
import { profileManager } from '../utils/profileManager.js';

/**
 * Retweet Test Task
 * Navigates to a specific tweet/profile and executes the retweet function to verify robustness.
 */
export default async function retweetTestTask(page, _payload) {
    const logger = createLogger('retweet-test.js');
    logger.info('Starting retweet test task...');

    // 1. Navigate to a reliable target (e.g. a popular profile)
    // Using a profile URL ensures we can always find a recent tweet
    const targetUrl = 'https://x.com/6sixtoy/status/2024049944521474203';
    logger.info(`Navigating to ${targetUrl}...`);
    
    try {
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        logger.info('Navigation complete.');
        
        // Allow some time for hydration
        await page.waitForTimeout(3000);

        // 2. Initialize Agent with Keyboard Strategy Forced
        logger.info('Initializing agent...');
        const profile = profileManager.getStarter() || { id: 'test-user', type: 'test' };
        
        // Force the keyboard strategy for testing
        const options = {
            config: {
                actions: {
                    retweet: {
                        strategy: 'keyboard'
                    }
                }
            }
        };
        
        const agent = new AITwitterAgent(page, profile, logger, options);
        logger.info('Agent initialized. Locating tweet...');

        // 3. Locate the main tweet
        const tweetSelector = 'article[data-testid="tweet"]';
        logger.info(`Waiting for selector: ${tweetSelector}`);
        
        try {
            const tweetElement = page.locator(tweetSelector).first();
            await tweetElement.waitFor({ state: 'visible', timeout: 15000 });
            logger.info('Tweet element found and visible.');
            
            // Scroll to it to ensure visibility
            await tweetElement.scrollIntoViewIfNeeded();
            logger.info('Scrolled to tweet.');
            
            logger.info('Executing retweet function with Keyboard Strategy...');

            // 4. Execute Retweet
            const result = await agent.actions.retweet.handleRetweet(tweetElement);
            logger.info(`Retweet execution finished. Success: ${result.success}`);

            if (result.success) {
                logger.info(`✅ Retweet Test PASSED. Result: ${result.reason}`);
                if (result.reason !== 'retweet_keyboard_success') {
                    logger.warn(`⚠️ Warning: Expected 'retweet_keyboard_success' but got '${result.reason}'. Check strategy selection logic.`);
                }
            } else {
                logger.error(`❌ Retweet Test FAILED. Reason: ${result.reason}`);
            }
        } catch (elemError) {
            logger.error(`Failed to locate or interact with tweet: ${elemError.message}`);
            // Check if we are on login page
            const loginSelector = '[data-testid="login"]';
            if (await page.locator(loginSelector).count() > 0) {
                logger.error('It seems we are on the login page. Please log in first.');
            }
            throw elemError;
        }

        // Keep page open for a moment to observe
        logger.info('Waiting 5 seconds before finishing...');
        await page.waitForTimeout(5000);

    } catch (error) {
        logger.error(`Error during retweet test: ${error.message}`);
        // Do not throw here if we want to ensure logs are written, but Orchestrator expects throw for failure.
        throw error;
    }
}

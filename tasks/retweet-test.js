
import { createLogger } from '../utils/logger.js';
import { AITwitterAgent } from '../utils/ai-twitterAgent.js';
import { profileManager } from '../utils/profileManager.js';

/**
 * Retweet Test Task
 * Navigates to a specific tweet and executes the retweet function to verify robustness.
 */
export default async function retweetTestTask(page, payload) {
    const logger = createLogger('retweet-test.js');
    logger.info('Starting retweet test task...');

    // 1. Navigate to the target tweet
    const targetUrl = 'https://x.com/TheFigen_/status/2023160621638779352';
    logger.info(`Navigating to ${targetUrl}...`);
    
    try {
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        
        // Allow some time for hydration
        await page.waitForTimeout(3000);

        // 2. Initialize Agent
        // We use a starter profile as we don't need complex profile logic for this test
        const profile = profileManager.getStarter() || { id: 'test-user', type: 'test' };
        const agent = new AITwitterAgent(page, profile, logger);

        logger.info('Agent initialized. Locating tweet...');

        // 3. Locate the main tweet
        // On a status page, the first article is usually the main tweet
        const tweetSelector = 'article[data-testid="tweet"]';
        const tweetElement = page.locator(tweetSelector).first();
        
        // Wait for it to be visible
        await tweetElement.waitFor({ state: 'visible', timeout: 15000 });
        
        // Scroll to it to ensure visibility (handleRetweet also does this, but good to be sure)
        await tweetElement.scrollIntoViewIfNeeded();
        
        logger.info('Tweet located. Executing retweet function...');

        // 4. Execute Retweet
        // Using the handleRetweet method directly to test the specific logic we modified
        const result = await agent.actions.retweet.handleRetweet(tweetElement);

        if (result.success) {
            logger.info(`✅ Retweet Test PASSED. Result: ${result.reason}`);
        } else {
            logger.error(`❌ Retweet Test FAILED. Reason: ${result.reason}`);
        }

        // Keep page open for a moment to observe
        logger.info('Waiting 5 seconds before finishing...');
        await page.waitForTimeout(5000);

    } catch (error) {
        logger.error(`Error during retweet test: ${error.message}`);
        throw error;
    }
}

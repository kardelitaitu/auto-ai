import { createLogger } from '../utils/logger.js';
import AgentConnector from '../core/agent-connector.js';
import AIReplyEngine from '../utils/ai-reply-engine.js';

/**
 * Reply Test Task
 * Navigates to a specific tweet and executes the reply function to verify LLM generation and robustness.
 * This simulates the reply generation process using the currently configured LLM settings.
 */
export default async function replyTestTask(page, _payload) {
    const logger = createLogger('reply-test.js');
    logger.info('Starting reply test task...');

    // 1. Navigate to the target tweet
    // Using a known tweet for testing. 
    const targetUrl = 'https://x.com/historyinmemes/status/2024455675443814774'; 
    logger.info(`Navigating to ${targetUrl}...`);
    
    try {
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        
        // Allow some time for hydration and dynamic content loading
        await page.waitForTimeout(5000);

        const agentConnector = new AgentConnector();
        const replyEngine = new AIReplyEngine(agentConnector, { replyProbability: 1, maxRetries: 2 });
        logger.info('Reply engine initialized. Locating tweet...');

        // 3. Locate the main tweet
        // On a status page, the first article is usually the main tweet
        const tweetSelector = 'article[data-testid="tweet"]';
        const tweetElement = page.locator(tweetSelector).first();
        
        // Wait for it to be visible
        await tweetElement.waitFor({ state: 'visible', timeout: 15000 });
        
        // Scroll to it to ensure visibility (handleRetweet also does this, but good to be sure)
        await tweetElement.scrollIntoViewIfNeeded();
        
        // Extract basic info for context
        // Try to get text
        const tweetTextElement = tweetElement.locator('div[data-testid="tweetText"]');
        let tweetText = "No text found";
        if (await tweetTextElement.count() > 0 && await tweetTextElement.isVisible()) {
            tweetText = await tweetTextElement.innerText();
        }
        
        // Extract username from URL as fallback, or try to find it in the tweet
        // URL format: https://x.com/username/status/...
        let username = "unknown";
        const urlParts = targetUrl.split('x.com/');
        if (urlParts.length > 1) {
            username = urlParts[1].split('/')[0];
        }
        
        logger.info(`Tweet located. Text: "${tweetText.substring(0, 50)}..." Username: @${username}`);
        logger.info('Generating reply with configured LLM...');

        const context = await replyEngine.captureContext(page, targetUrl);
        const generation = await replyEngine.generateReply(tweetText, username, context);

        if (!generation.success || !generation.reply) {
            logger.error('❌ Reply Test FAILED. Reason: ai_generation_failed');
        } else {
            const postResult = await replyEngine.executeReply(page, generation.reply);
            if (postResult.success) {
                logger.info('✅ Reply Test PASSED.');
                logger.info(`Generated Reply: "${generation.reply}"`);
            } else {
                logger.error(`❌ Reply Test FAILED. Reason: ${postResult.reason || 'post_failed'}`);
            }
        }

        // Keep page open for a moment to observe
        logger.info('Waiting 10 seconds before finishing to observe result...');
        await page.waitForTimeout(10000);

    } catch (error) {
        logger.error(`Error during reply test: ${error.message}`);
        throw error;
    }
}

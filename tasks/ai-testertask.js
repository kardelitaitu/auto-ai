/**
 * @fileoverview LLM Tester Task
 * Tests AI/LLM integration by searching Google and summarizing results
 * @module tasks/ai-testertask
 */

import { createLogger } from '../utils/logger.js';
import { GhostCursor } from '../utils/ghostCursor.js';
import { mathUtils } from '../utils/mathUtils.js';
import AgentConnector from '../core/agent-connector.js';
import { applyHumanizationPatch } from '../utils/browserPatch.js';
import { entropy } from '../utils/entropyController.js';

const CONFIG = {
    TIMINGS: {
        WARMUP: 2000,
        TYPE_DELAY: 100,
        SEARCH_WAIT: 3000,
        READ_WAIT: 5000,
        POST_ACTION: 2000
    },
    RANDOM_WORDS: [
        'technology', 'future', 'artificial', 'intelligence', 'machine',
        'learning', 'robotics', 'automation', 'digital', 'innovation',
        'science', 'space', 'exploration', 'discovery', 'universe',
        'coding', 'programming', 'development', 'software', 'hardware',
        'nature', 'biology', 'chemistry', 'physics', 'mathematics'
    ]
};

/**
 * LLM Tester Task - Tests AI integration
 */
export default async function aiTesterTask(page, payload) {
    const startTime = process.hrtime.bigint();
    const browserInfo = payload.browserInfo || "unknown";
    const logger = createLogger(`ai-testertask.js [${browserInfo}]`);
    const connector = new AgentConnector();

    logger.info(`[ai-testertask] Starting LLM Integration Test...`);

    let cursor = null;
    const testResults = {
        searchTerm: '',
        searchUrl: '',
        pageTitle: '',
        pageContent: '',
        aiSummary: '',
        success: false,
        errors: []
    };

    try {
        // Initialize
        cursor = new GhostCursor(page);
        await applyHumanizationPatch(page, logger);

        // Warm-up
        logger.info(`[ai-testertask] Warming up...`);
        await page.waitForTimeout(CONFIG.TIMINGS.WARMUP);

        // Step 1: Navigate to Google
        logger.info(`[ai-testertask] Step 1: Navigating to Google...`);
        await page.goto('https://www.google.com', { waitUntil: 'domcontentloaded', timeout: 30000 });

        // Handle consent if needed
        try {
            const consentBtn = page.locator('button:has-text("I agree")').first();
            if (await consentBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                logger.info(`[ai-testertask] Accepting consent...`);
                await consentBtn.click();
                await page.waitForTimeout(1000);
            }
        } catch (e) {
            // Consent not needed
        }

        // Step 2: Find search box
        logger.info(`[ai-testertask] Step 2: Finding search box...`);
        const searchBox = page.locator('textarea[name="q"], input[name="q"]').first();

        if (!await searchBox.isVisible()) {
            throw new Error('Search box not visible');
        }

        // Step 3: Generate random word
        const randomWord = mathUtils.sample(CONFIG.RANDOM_WORDS);
        testResults.searchTerm = randomWord;
        logger.info(`[ai-testertask] Step 3: Random word selected: "${randomWord}"`);

        // Step 4: Type with human-like behavior
        logger.info(`[ai-testertask] Step 4: Typing "${randomWord}"...`);
        await cursor.twitterClick(searchBox, 'nav');
        await page.waitForTimeout(entropy.reactionTime());

        // Human typing
        for (const char of randomWord) {
            await page.keyboard.type(char, {
                delay: mathUtils.randomInRange(50, 150)
            });
        }
        logger.info(`[ai-testertask] Typing complete`);

        // Step 5: Press Enter
        logger.info(`[ai-testertask] Step 5: Submitting search...`);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(CONFIG.TIMINGS.SEARCH_WAIT);

        // Capture results
        testResults.searchUrl = page.url();
        testResults.pageTitle = await page.title();

        logger.info(`[ai-testertask] Search URL: ${testResults.searchUrl}`);
        logger.info(`[ai-testertask] Page title: ${testResults.pageTitle}`);

        // Step 6: Extract visible content
        logger.info(`[ai-testertask] Step 6: Extracting page content...`);
        const content = await page.evaluate(() => {
            // Get main content text
            const main = document.querySelector('main') || document.body;
            const text = main?.innerText || '';
            return text.substring(0, 2000); // Limit to 2000 chars
        });
        testResults.pageContent = content;

        // Step 7: AI Summarization
        logger.info(`[ai-testertask] Step 7: Sending to LLM for summarization...`);

        const summaryRequest = {
            action: 'generate_reply',
            payload: {
                systemPrompt: `You are a helpful assistant. Summarize the search results page concisely.`,
                userPrompt: `The user searched for "${randomWord}" on Google.

Page Title: ${testResults.pageTitle}

Page Content Preview:
${content.substring(0, 1500)}

Please provide a brief 1-2 sentence summary of what appears on this search results page.`,
                maxTokens: 150,
                temperature: 0.5
            }
        };

        const aiResponse = await connector.processRequest(summaryRequest);

        if (aiResponse.success) {
            testResults.aiSummary = aiResponse.content || 'No summary generated';
            logger.info(`[ai-testertask] AI Summary: ${testResults.aiSummary}`);
        } else {
            testResults.errors.push(`AI Error: ${aiResponse.error || 'Unknown error'}`);
            logger.warn(`[ai-testertask] AI summarization failed`);
        }

        testResults.success = true;

    } catch (error) {
        const errorMsg = error.message;
        testResults.errors.push(errorMsg);
        logger.error(`[ai-testertask] Error: ${errorMsg}`);
    } finally {
        // Cleanup
        try {
            if (page && !page.isClosed()) {
                await page.close();
            }
        } catch (e) {
            // Ignore close errors
        }

        // Calculate duration
        const duration = (Number(process.hrtime.bigint() - startTime) / 1_000_000_000).toFixed(2);

        // Final report
        logger.info(`[ai-testertask] === TEST RESULTS ===`);
        logger.info(`[ai-testertask] Status: ${testResults.success ? 'SUCCESS' : 'FAILED'}`);
        logger.info(`[ai-testertask] Search Term: "${testResults.searchTerm}"`);
        logger.info(`[ai-testertask] URL: ${testResults.searchUrl}`);
        logger.info(`[ai-testertask] AI Summary: ${testResults.aiSummary}`);
        logger.info(`[ai-testertask] Duration: ${duration}s`);
        if (testResults.errors.length > 0) {
            logger.warn(`[ai-testertask] Errors: ${testResults.errors.join(', ')}`);
        }
        logger.info(`[ai-testertask] ===================`);

        return {
            status: testResults.success ? 'success' : 'failed',
            testResults,
            durationSeconds: parseFloat(duration),
            timestamp: new Date().toISOString()
        };
    }
}

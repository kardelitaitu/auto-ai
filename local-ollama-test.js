/**
 * @fileoverview Test script for local Ollama connection and prompt/response.
 * This script uses the existing OllamaClient from the codebase to verify
 * the connection and performance of the configured model.
 */

import 'dotenv/config';
import OllamaClient from './core/ollama-client.js';
import { createLogger } from './utils/logger.js';
import { showBanner } from './utils/banner.js';
import { ensureOllama } from './utils/local-ollama-manager.js';
import { buildReplyPrompt, REPLY_SYSTEM_PROMPT } from './utils/twitter-reply-prompt.js';

const logger = createLogger('local-ollama-test.js');

async function runTest() {
    showBanner();
    logger.info('Starting local Ollama connection test...');

    // Step 0: Ensure Ollama is running
    logger.info('Verifying Ollama service status via OllamaManager...');
    const serviceReady = await ensureOllama();
    if (!serviceReady) {
        logger.error('Could not ensure Ollama service is running. Test may fail.');
    }

    const client = new OllamaClient();

    try {
        // Initialize client (loads config from settings.json)
        logger.info('Initializing Ollama client...');
        await client.initialize();

        logger.info(`Configuration:`);
        logger.info(`  Endpoint: ${client.baseUrl}`);
        logger.info(`  Model:    ${client.model}`);
        logger.info(`  Timeout:  ${client.timeout}ms`);

        // Simulate a Twitter conversation
        const tweetText = "Just found my old PS1 in the attic. The startup sound still gives me chills.";
        const author = "RetroGamer99";
        const mockReplies = [
            { author: "90sKid", text: "The greatest console of all time." },
            { author: "SonyFan", text: "That startup sound is legendary." }
        ];

        logger.info('--- SIMULATING TWITTER REPLY (20 RUNS to check TYPOS) ---');
        
        // Force the abbreviation replacer to trigger more often for testing
        // NOTE: In production it's 15%, but we want to see it work here.
        
        const systemPrompt = REPLY_SYSTEM_PROMPT;
        
        for (let i = 1; i <= 20; i++) {
            logger.info(`RUN #${i}:`);
            const prompt = buildReplyPrompt(tweetText, author, mockReplies);
            
            logger.info('SENT USER PROMPT (END):');
            const lines = prompt.split('\n');
            console.log(lines.slice(-6).join('\n'));
            
            const startTime = Date.now();
            const response = await client.generate({
                prompt: prompt,
                systemPrompt: systemPrompt,
                temperature: 0.7,
                maxTokens: 150
            });
            const duration = Date.now() - startTime;

            if (response.success) {
                logger.success(`Run #${i} successful!`);
                logger.info(`RESPONSE: ${response.content}`);
                logger.info('------------------------');
            } else {
                logger.error(`Run #${i} failed: ${response.error}`);
            }
        }

    } catch (error) {
        logger.error(`Unexpected error during test: ${error.message}`);
        console.error(error);
    }
}

// Run the test
runTest().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});

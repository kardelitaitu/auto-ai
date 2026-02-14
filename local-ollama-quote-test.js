import 'dotenv/config';
import OllamaClient from './core/ollama-client.js';
import { createLogger } from './utils/logger.js';
import { showBanner } from './utils/banner.js';
import { ensureOllama } from './utils/local-ollama-manager.js';
import { AIQuoteEngine, QUOTE_SYSTEM_PROMPT } from './utils/ai-quote-engine.js';

const logger = createLogger('local-ollama-quote-test.js');

async function runTest() {
    showBanner();
    logger.info('Starting local Ollama QUOTE generation test...');

    // Step 0: Ensure Ollama is running
    logger.info('Verifying Ollama service status via OllamaManager...');
    const serviceReady = await ensureOllama();
    if (!serviceReady) {
        logger.error('Could not ensure Ollama service is running. Test may fail.');
    }

    const client = new OllamaClient();
    // Instantiate with null agent as we only use helper methods
    const quoteEngine = new AIQuoteEngine(null); 
    // Mock the config if needed, or rely on defaults
    // The constructor sets defaults.

    try {
        // Initialize client
        logger.info('Initializing Ollama client...');
        await client.initialize();

        logger.info(`Configuration:`);
        logger.info(`  Endpoint: ${client.baseUrl}`);
        logger.info(`  Model:    ${client.model}`);

        // Mock Data
        const tweetText = "Just announced: We are releasing our new open source AI framework tomorrow! #AI #OpenSource";
        const author = "TechLead_Official";
        const replies = [
            { author: "DevOne", text: "Can't wait to try this out!" },
            { author: "SeniorEng", text: "Is it written in Rust?" },
            { author: "JuniorDev", text: "Docs link?" }
        ];
        const url = "https://twitter.com/TechLead_Official/status/123456789";

        // Mock Sentiment Context
        const sentimentContext = {
            engagementStyle: 'excited',
            conversationType: 'tech_announcement',
            valence: 0.8,
            sarcasm: 0
        };

        logger.info('--- SIMULATING TWITTER QUOTE (20 RUNS) ---');
        
        for (let i = 1; i <= 20; i++) {
            logger.info(`RUN #${i}:`);
            
            // 1. Build Prompt
            const promptData = quoteEngine.buildEnhancedPrompt(
                tweetText, 
                author, 
                replies, 
                url, 
                sentimentContext, 
                false, // hasImage
                'high' // engagementLevel
            );

            // 2. Generate with Ollama
            const startTime = Date.now();
            let response;
            
            if (serviceReady) {
                 response = await client.generate({
                    prompt: promptData.text,
                    systemPrompt: QUOTE_SYSTEM_PROMPT,
                    temperature: 0.7,
                    maxTokens: 100
                });
            } else {
                 logger.warn(`Skipping generation for run #${i} (Ollama not ready)`);
                 continue;
            }

            const duration = Date.now() - startTime;

            if (response.success) {
                const rawContent = response.content;
                // logger.info(`RAW CONTENT: "${rawContent.substring(0, 100)}..."`);

                // 3. Extract and Clean
                const reply = quoteEngine.extractReplyFromResponse(rawContent);
                
                if (reply) {
                    let cleaned = reply;
                    try {
                        cleaned = quoteEngine.cleanQuote(reply);
                    } catch (e) {
                         logger.warn("cleanQuote failed: " + e.message);
                    }
                    
                    const validation = quoteEngine.validateQuote(cleaned);

                    if (validation.valid) {
                        logger.success(`Run #${i} successful! (${duration}ms)`);
                        logger.info(`FINAL QUOTE: "${cleaned}"`);
                    } else {
                        logger.warn(`Run #${i} validation failed: ${validation.reason}`);
                        logger.info(`QUOTE: "${cleaned}"`);
                    }
                } else {
                    logger.error(`Run #${i} failed to extract quote from:`);
                    console.log(rawContent);
                }
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

runTest().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});

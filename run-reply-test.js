import Orchestrator from './core/orchestrator.js';
import { createLogger } from './utils/logger.js';

const logger = createLogger('run-reply-test');
const originalFetch = global.fetch;

global.fetch = async (url, options) => {
    try {
        // Handle URL input which can be string or Request object
        const urlStr = typeof url === 'string' ? url : (url.url || url.toString());
        
        // Check for Local LLM ports (Ollama: 11434, VLLM: 8000) OR common LLM paths
        // We want to intercept these to provide a simulated response
        const isLocalLLM = urlStr.includes(':11434') || 
                          urlStr.includes(':8000') || 
                          urlStr.includes('/api/tags') ||
                          urlStr.includes('/api/generate') ||
                          urlStr.includes('/api/chat') ||
                          urlStr.includes('/v1/completions');

        if (isLocalLLM) {
            logger.info(`[SIMULATION] Intercepting LLM request to: ${urlStr}`);
            
            // Create a mock successful response
            const mockResponse = {
                ok: true,
                status: 200,
                statusText: 'OK',
                headers: { get: () => 'application/json' },
                text: async () => JSON.stringify({ status: 'simulated_ok' }),
                json: async () => {
                    // Handle Ollama Tags (Health check often checks this or /)
                    if (urlStr.includes('/api/tags')) {
                        return { 
                            models: [
                                { name: 'hermes3:8b', modified_at: new Date().toISOString() }, 
                                { name: 'llama3.2-vision', modified_at: new Date().toISOString() }
                            ] 
                        };
                    }
                    // Handle Generate Endpoint
                    if (urlStr.includes('/api/generate')) {
                        return { 
                            response: "This is a simulated AI reply. The test system has successfully intercepted the generation request.", 
                            done: true,
                            context: []
                        };
                    }
                    // Handle Chat Endpoint
                    if (urlStr.includes('/api/chat')) {
                        return { 
                            message: { 
                                role: 'assistant', 
                                content: "This is a simulated AI reply. The test system has successfully intercepted the chat request." 
                            }, 
                            done: true 
                        };
                    }
                    // Handle VLLM Completions
                    if (urlStr.includes('/v1/completions') || urlStr.includes('/v1/chat/completions')) {
                         return {
                            choices: [{
                                text: "This is a simulated AI reply (VLLM).",
                                message: { content: "This is a simulated AI reply (VLLM)." }
                            }]
                         };
                    }
                    // Default / Health check
                    return { status: 'running' };
                }
            };
            return mockResponse;
        }
    } catch (err) {
        console.error(`[SIMULATION] Error in fetch interceptor: ${err.message}`);
    }
    
    // Pass through all other requests (like Twitter/X.com) to the real fetch
    return originalFetch(url, options);
};
// --- END MOCK SIMULATION ---

async function main() {
    logger.info("Starting reply test runner...");
    const orchestrator = new Orchestrator();
    
    // Start discovery to find running browsers or launch one if configured
    await orchestrator.startDiscovery();
    
    if (orchestrator.sessionManager.activeSessionsCount === 0) {
        logger.warn("No active browser sessions found. Attempting to launch a new browser instance if possible, or please ensure a browser is running with debugging enabled.");
    }
    
    // Add the task
    try {
        orchestrator.addTask('reply-test', {});
        logger.info("Task 'reply-test' added to queue.");
    } catch (e) {
        logger.error(`Failed to add task: ${e.message}`);
        process.exit(1);
    }
    
    try {
        // Process tasks
        await orchestrator.processTasks();
        
        // Wait for completion with timeout
        logger.info("Waiting for task completion...");
        
        // 5 minute timeout should be enough for a single reply test (generation takes time)
        const WAIT_TIMEOUT = 300000; 
        
        const waitPromise = orchestrator.waitForTasksToComplete();
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error("Timeout waiting for tasks")), WAIT_TIMEOUT);
        });

        await Promise.race([waitPromise, timeoutPromise]);
        
        logger.info("Test run completed successfully.");
        await orchestrator.shutdown(false);
    } catch (err) {
        logger.error(`Test execution failed or timed out: ${err.message}`);
        logger.warn("Forcing shutdown...");
        await orchestrator.shutdown(true);
        process.exit(1);
    }
}

main().catch(err => {
    console.error("Unhandled error:", err);
    process.exit(1);
});

import Orchestrator from './core/orchestrator.js';
import { createLogger } from './utils/logger.js';

const logger = createLogger('run-retweet-test');

async function main() {
    logger.info("Starting retweet test runner...");
    const orchestrator = new Orchestrator();
    
    // Start discovery to find running browsers or launch one if configured
    await orchestrator.startDiscovery();
    
    if (orchestrator.sessionManager.activeSessionsCount === 0) {
        logger.error("No active browser sessions found. Please ensure a browser is running with debugging enabled (e.g. chrome --remote-debugging-port=9222).");
        process.exit(1);
    }
    
    // Add the task
    try {
        orchestrator.addTask('retweet-test', {});
        logger.info("Task 'retweet-test' added to queue.");
    } catch (e) {
        logger.error(`Failed to add task: ${e.message}`);
        process.exit(1);
    }
    
    try {
        // Process tasks
        await orchestrator.processTasks();
        
        // Wait for completion with timeout
        logger.info("Waiting for task completion...");
        
        // 3 minute timeout should be enough for a single retweet test
        const WAIT_TIMEOUT = 180000; 
        
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

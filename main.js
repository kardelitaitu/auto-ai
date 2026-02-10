/**
 * @fileoverview The main entry point for the multi-browser automation framework.
 * This file initializes the orchestrator, discovers browsers, and runs automation tasks.
 * @module main
 */


import 'dotenv/config';
import { createLogger } from './utils/logger.js';
import { showBanner } from './utils/banner.js';
import Orchestrator from './core/orchestrator.js';
import { ensureDockerLLM } from './utils/dockerLLM.js';

const logger = createLogger('main.js');

/**
 * The main entry point of the application.
 * This is an IIFE (Immediately Invoked Function Expression) that runs asynchronously.
 * It sets up the orchestrator, discovers browsers, and runs automation tasks.
 */
(async () => {
  // Show visual banner first
  showBanner();

  logger.info("MultiBrowseAutomation - Starting up...");
  let orchestrator;

  try {
    // Step 1: Ensure Docker LLM is running (if enabled)
    logger.info("Checking Docker LLM status...");
    const dockerReady = await ensureDockerLLM();
    if (!dockerReady) {
      logger.warn("Docker LLM is not ready. Local vision processing may not work.");
      logger.warn("Continuing anyway (will fall back to cloud if needed)...");
    }

    orchestrator = new Orchestrator();

    // Parse CLI arguments for options
    const args = process.argv.slice(2);
    const browsersArg = args.find(arg => arg.startsWith('--browsers='));
    const browserList = browsersArg ? browsersArg.split('=')[1].split(',') : [];

    // Filter out known task names from args so we don't try to run "--browsers=..." as a task
    const tasksToRun = args.filter(arg => !arg.startsWith('--'));

    logger.info("Attempting to discover and connect to available browsers...");

    // Retry Loop for Discovery
    const maxRetries = 3;
    let attempt = 1;
    let connectedCount = 0;

    while (attempt <= maxRetries) {
      if (attempt > 1) logger.info(`[Discovery] Attempt ${attempt}/${maxRetries}...`);

      await orchestrator.startDiscovery({ browsers: browserList });
      connectedCount = orchestrator.sessionManager.activeSessionsCount;

      if (connectedCount > 0) {
        break; // Success!
      }

      if (attempt < maxRetries) {
        logger.warn(`[Discovery] No browsers found on attempt ${attempt}. Retrying in 5 seconds...`);
        logger.info(`[Tip] Ensure your browser (e.g. ixbrowser, brave) is OPEN and running.`);
        await new Promise(resolve => setTimeout(resolve, 5000));
        // Clear previous connectors/state if needed, though Orchestrator handles reloading logic
      }
      attempt++;
    }

    const sessionManager = orchestrator.sessionManager;

    if (sessionManager.idleSessionsCount === 0) {
      logger.warn("No browsers discovered or connected after retries. The system will continue but tasks may fail.");
    } else {
      logger.info(`Successfully connected to ${sessionManager.idleSessionsCount} browser(s). Ready for automation.`);
    }

    logger.info('Adding specified tasks to the queue...');
    logger.info('Adding specified tasks to the queue...');
    
    // Parse arguments: first arg is task, rest are key=value pairs
    let currentTask = null;
    let currentPayload = {};
    
    tasksToRun.forEach(arg => {
      // If arg contains '=', it's a key=value parameter for the current task
      if (arg.includes('=') && currentTask) {
        const parts = arg.split('=');
        const key = parts[0];
        let value = parts.slice(1).join('=');
        
        // Remove surrounding quotes if present
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        }
        
        currentPayload[key] = value;
      } else if (!arg.startsWith('--')) {
        // This is a task name
        if (currentTask) {
          // Add previous task to queue
          orchestrator.addTask(currentTask, currentPayload);
        }
        currentTask = arg;
        currentPayload = {};
      }
    });
    
    // Add the last task
    if (currentTask) {
      orchestrator.addTask(currentTask, currentPayload);
    }

    logger.info("MultiBrowseAutomation - System initialized. All tasks queued.");

    // Wait for completion
    logger.info("Waiting for all tasks to be processed...");
    await orchestrator.waitForTasksToComplete();
    logger.info("All tasks completed successfully.");

  } catch (error) {
    logger.error('An unexpected error occurred during execution:', error);
    console.error(error.stack);
  } finally {
    // Cleanup
    logger.info('MultiBrowseAutomation - Shutting down...');
    if (orchestrator) {
      await orchestrator.shutdown();
    }
    process.exit(0);
  }
})();

// Handle uncaught errors and interrupts
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error.message);
  console.error(error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('SIGINT', async () => {
  logger.info('Received SIGINT. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM. Shutting down gracefully...');
  process.exit(0);
});

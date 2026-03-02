/**
 * @fileoverview The main entry point for the multi-browser automation framework.
 * This file initializes the orchestrator, discovers browsers, and runs automation tasks.
 * @module main
 */


import 'dotenv/config';
import { createLogger } from './api/utils/logger.js';
import { showBanner } from './api/utils/banner.js';
import Orchestrator from './api/core/orchestrator.js';
import { ensureDockerLLM } from './api/utils/dockerLLM.js';
import { getSettings } from './api/utils/configLoader.js';

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

    // Start dashboard if enabled in config
    const settings = await getSettings();
    if (settings?.ui?.dashboard?.enabled) {
      await orchestrator.startDashboard(settings.ui.dashboard.port || 3001);
    }

    // Retry Loop for Discovery

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

    // Parse tasks into sequential groups separated by 'then'
    const taskGroups = [];
    let currentGroup = [];

    tasksToRun.forEach(arg => {
      if (arg.toLowerCase() === 'then') {
        if (currentGroup.length > 0) {
          taskGroups.push(currentGroup);
          currentGroup = [];
        }
      } else {
        currentGroup.push(arg);
      }
    });
    if (currentGroup.length > 0) {
      taskGroups.push(currentGroup);
    }

    if (taskGroups.length === 0) {
      logger.info("No tasks specified. System initialized in idle mode.");
    } else {
      logger.info(`MultiBrowseAutomation - Initialized. Processing ${taskGroups.length} sequential task groups.`);

      for (let i = 0; i < taskGroups.length; i++) {
        const group = taskGroups[i];
        logger.info(`[Queue] Processing Task Group ${i + 1}/${taskGroups.length}: ${JSON.stringify(group)}`);

        let currentTask = null;
        let currentPayload = {};

        group.forEach(arg => {
          const firstEqualIndex = arg.indexOf('=');

          if (firstEqualIndex > 0) {
            const key = arg.substring(0, firstEqualIndex);
            let value = arg.substring(firstEqualIndex + 1);
            if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);

            // Shorthand detection: taskName=URL
            // If the key matches the current task, or we don't have a current task,
            // assume it's a new task starting.
            const isNewTaskShorthand = currentTask && (key === currentTask);

            if (!currentTask || isNewTaskShorthand) {
              if (isNewTaskShorthand) {
                orchestrator.addTask(currentTask, currentPayload);
              }
              currentTask = key.endsWith('.js') ? key.slice(0, -3) : key;

              // Auto-prepend protocol for shorthand URL values
              let urlValue = value;
              if (urlValue && !urlValue.includes('://') && (urlValue.includes('.') || urlValue === 'localhost')) {
                urlValue = 'https://' + urlValue;
              }
              currentPayload = { url: urlValue };
            } else {
              // It's a parameter for the current task
              let paramValue = value;
              if (key === 'url' && paramValue && !paramValue.includes('://') && (paramValue.includes('.') || paramValue === 'localhost')) {
                paramValue = 'https://' + paramValue;
              }
              currentPayload[key] = paramValue;
            }
          } else {
            // No '=' - this must be a new task name (start of a new task in group)
            if (currentTask) {
              orchestrator.addTask(currentTask, currentPayload);
            }
            currentTask = arg.endsWith('.js') ? arg.slice(0, -3) : arg;
            currentPayload = {};
          }
        });

        if (currentTask) {
          orchestrator.addTask(currentTask, currentPayload);
        }

        logger.info(`[Queue] Tasks for Group ${i + 1} added. Waiting for completion...`);
        await orchestrator.waitForTasksToComplete();
        logger.info(`[Queue] Group ${i + 1} completed successfully.`);
      }
    }

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

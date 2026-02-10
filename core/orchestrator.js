/**
 * @fileoverview The main orchestrator for the multi-browser automation framework.
 * @module core/orchestrator
 */

import { EventEmitter } from 'events';
import SessionManager from './sessionManager.js';
import Discovery from './discovery.js';
import Automator from './automator.js';
import { createLogger } from '../utils/logger.js';
import { getTimeoutValue, getSettings } from '../utils/configLoader.js';
import { validateTaskExecution, validatePayload } from '../utils/validator.js';
import { isDevelopment } from '../utils/envLoader.js';
import metricsCollector from '../utils/metrics.js';

const logger = createLogger('orchestrator.js');

/**
 * @class Orchestrator
 * @extends EventEmitter
 * @description Coordinates browser discovery, session management, and task execution.
 */
class Orchestrator extends EventEmitter {
  constructor() {
    super();
    /** @type {Automator} */
    this.automator = new Automator();
    /** @type {SessionManager} */
    this.sessionManager = new SessionManager();
    /** @type {Array<{taskName: string, payload: object}>} */
    this.taskQueue = [];
    this.isProcessingTasks = false;
    this.processTimeout = null;
    /** @type {Discovery} */
    this.discovery = new Discovery();
    this.isShuttingDown = false;
  }

  /**
   * Starts the browser discovery process and adds discovered browsers to the session manager.
   * @param {object} [options={}] - Discovery options.
   * @param {string[]} [options.browsers=[]] - List of specific browsers/connectors to discover.
   * @returns {Promise<void>}
   */
  async startDiscovery(options = {}) {
    logger.info("Starting browser discovery...");

    try {
      await this.discovery.loadConnectors(options.browsers || []);

      const endpoints = await this.discovery.discoverBrowsers();

      if (endpoints.length === 0) {
        logger.warn("No browser endpoints discovered. Session manager will remain empty.");
        return;
      }

      logger.info(`Found ${endpoints.length} browser endpoints. Attempting to connect in parallel...`);

      const connectionPromises = endpoints.map(endpointData => {
        const wsEndpoint = endpointData.ws;
        const browserName = String(endpointData.windowName || endpointData.sortNum || 'Unnamed Profile');

        if (!wsEndpoint) {
          logger.warn(`Profile ${browserName} has no 'ws' endpoint. Skipping.`);
          return Promise.resolve(null);
        }

        return this.automator.connectToBrowser(wsEndpoint)
          .then(browser => ({ browser, browserName, wsEndpoint }))
          .catch(error => {
            throw new Error(`Failed to connect to browser profile ${browserName}: ${error.message}`);
          });
      });

      const results = await Promise.allSettled(connectionPromises);

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          const { browser, browserName, wsEndpoint } = result.value;

          let displayName = browserName;
          try {
            const port = new URL(wsEndpoint).port;
            if (port) {
              displayName = `${browserName}:${port}`;
            }
          } catch (e) { /* ignore URL parse error */ }

          this.sessionManager.addSession(browser, displayName);
          logger.info(`Successfully connected and added session for ${displayName}.`);
        } else if (result.status === 'rejected') {
          logger.error(result.reason.message);
        }
      }

      const connectedCount = this.sessionManager.activeSessionsCount;
      const failedCount = endpoints.length - connectedCount;

      logger.info(`Discovery completed. Connected to ${connectedCount} browsers.`);

      metricsCollector.recordBrowserDiscovery(endpoints.length, connectedCount, failedCount);

      if (connectedCount > 0) {
        this.automator.startHealthChecks();
      }
    } catch (error) {
      logger.error("Browser discovery failed:", error.message);
    }
  }

  /**
   * Adds a task to the execution queue.
   * @param {string} taskName - The name of the task (corresponds to a file in the tasks/ directory).
   * @param {object} [payload={}] - The data payload for the task.
   * @throws {Error} If the task name or payload is invalid.
   */
  addTask(taskName, payload = {}) {
    if (!taskName || typeof taskName !== 'string') {
      logger.error('Task name must be a non-empty string');
      throw new Error('Invalid task name provided');
    }

    const payloadValidation = validatePayload(payload);
    if (!payloadValidation.isValid) {
      logger.error(`Task payload validation failed for '${taskName}':`, payloadValidation.errors);
      throw new Error(`Invalid task payload: ${payloadValidation.errors.join(', ')}`);
    }

    this.taskQueue.push({ taskName, payload });
    logger.info(`Task '${taskName}' added to queue. Queue size: ${this.taskQueue.length}. Queue contents: ${this.taskQueue.map(t => t.taskName).join(', ')}`);

    if (this.processTimeout) {
      clearTimeout(this.processTimeout);
    }
    this.processTimeout = setTimeout(() => {
      this.processTasks();
    }, 50); // Debounce task processing
  }

  /**
   * Processes tasks from the queue in parallel using available idle sessions.
   * @returns {Promise<void>}
   */
  async processTasks() {
    if (this.isProcessingTasks || this.taskQueue.length === 0 || this.sessionManager.activeSessionsCount === 0) {
      return;
    }

    this.isProcessingTasks = true;
    logger.info("Starting concurrent checklist processing for all sessions...");

    const tasksToReplicate = [...this.taskQueue];
    logger.info(`Broadcasting ${tasksToReplicate.length} tasks to all sessions: ${tasksToReplicate.map(t => t.taskName).join(', ')}`);
    this.taskQueue.length = 0;

    const sessions = this.sessionManager.getAllSessions();
    const allSessionPromises = sessions.map(session =>
      this.processChecklistForSession(session, tasksToReplicate)
    );

    await Promise.allSettled(allSessionPromises);

    this.isProcessingTasks = false;
    logger.info("All sessions have completed their task checklists.");

    this.emit('tasksProcessed');

    if (this.taskQueue.length > 0) {
      logger.info("New tasks found in queue. Restarting processing...");
      this.processTasks();
    } else {
      this.emit('allTasksComplete');
    }
  }

  /**
   * Manages the concurrent execution of a checklist of tasks for a single browser session.
   * @param {object} session - The session object from the SessionManager.
   * @param {Array<object>} tasks - The array of task objects to execute.
   * @private
   */
  async processChecklistForSession(session, tasks) {
    logger.info(`[${session.id}] Starting checklist of ${tasks.length} tasks with up to ${session.workers.length} parallel tabs.`);

    const taskList = [...tasks];
    const contexts = session.browser.contexts();
    const sharedContext = contexts.length > 0 ? contexts[0] : await session.browser.newContext();

    try {
      const workerPromises = session.workers.map(async (worker) => {
        logger.debug(`[${session.id}][Worker ${worker.id}] Starting...`);

        while (true) {
          // Check for global shutdown signal
          if (this.isShuttingDown) {
            logger.debug(`[${session.id}][Worker ${worker.id}] Shutdown signal received. Exiting loop.`);
            break;
          }

          const task = taskList.shift();
          if (!task) {
            logger.debug(`[${session.id}][Worker ${worker.id}] No more tasks. Exiting.`);
            break;
          }

          this.sessionManager.findAndOccupyIdleWorker(session.id);
          let page = null;
          try {
            page = await sharedContext.newPage();
            this.sessionManager.registerPage(session.id, page);

            logger.info(`[${session.id}][Worker ${worker.id}] Starting task '${task.taskName}' in new tab.`);
            await this.executeTask(task, page, session);
          } catch (e) {
            logger.error(`[${session.id}][Worker ${worker.id}] Critical error during task '${task.taskName}':`, e);
          } finally {
            if (page) {
              await page.close().catch(() => { });
              this.sessionManager.unregisterPage(session.id, page);
            }
            this.sessionManager.releaseWorker(session.id, worker.id);
            logger.info(`[${session.id}][Worker ${worker.id}] Finished task '${task.taskName}'. Worker is now idle.`);
          }
        }
      });

      await Promise.all(workerPromises);
    } finally {
      // Only close context if we are NOT shutting down globally, 
      // because sessionManager.shutdown() handles context closing more gracefully now.
      // Or we can leave it, as double closing is usually fine.
      if (!this.isShuttingDown) {
        await sharedContext.close();
        logger.info(`[${session.id}] All tasks complete. Closed shared browser context.`);
      }
    }

    logger.info(`[${session.id}] Completed all tasks in the checklist.`);
  }

  /**
   * Waits for all tasks in the queue to be processed.
   * @returns {Promise<void>}
   */
  async waitForTasksToComplete() {
    if (this.taskQueue.length === 0 && !this.isProcessingTasks) {
      logger.info("waitForTasksToComplete: No tasks in queue and not processing. Resolving immediately.");
      return Promise.resolve();
    }

    logger.info("waitForTasksToComplete: Waiting for tasks to finish using event-driven approach...");

    return new Promise(resolve => {
      const checkCompletion = () => {
        if (this.taskQueue.length === 0 && !this.isProcessingTasks) {
          logger.info("waitForTasksToComplete: All tasks completed.");
          this.removeListener('tasksProcessed', checkCompletion);
          this.removeListener('allTasksComplete', onComplete);
          resolve();
        }
      };

      const onComplete = () => {
        logger.info("waitForTasksToComplete: Received completion event.");
        this.removeListener('tasksProcessed', checkCompletion);
        this.removeListener('allTasksComplete', onComplete);
        resolve();
      };

      this.on('tasksProcessed', checkCompletion);
      this.on('allTasksComplete', onComplete);
    });
  }

  /**
   * Loads and executes a single task.
   * @param {{taskName: string, payload: object}} task - The task object.
   * @param {playwright.Page} page - The Playwright Page object to run the task in.
   * @param {object} session - The session to use.
   * @private
   */
  async executeTask(task, page, session) {
    const startTime = Date.now();
    let success = false;
    let error = null;

    try {
      const validation = validateTaskExecution(page, task.payload);
      if (!validation.isValid) {
        throw new Error(`Task execution validation failed: ${validation.errors.join(', ')}`);
      }

      const cacheBuster = isDevelopment() ? `?v=${Date.now()}` : '';
      const taskModule = await import(`../tasks/${task.taskName}.js${cacheBuster}`);
      if (typeof taskModule.default === 'function') {
        const augmentedPayload = {
          ...task.payload,
          browserInfo: session.browserInfo || 'unknown_profile'
        };

        const payloadValidation = validatePayload(augmentedPayload);
        if (!payloadValidation.isValid) {
          throw new Error(`Augmented payload validation failed: ${payloadValidation.errors.join(', ')}`);
        }

        // The task now receives a Page object directly.
        await taskModule.default(page, augmentedPayload);
        success = true;
      } else {
        throw new Error(`Task '${task.taskName}' does not export a default function.`);
      }
    } catch (err) {
      error = err;
      success = false;
      logger.error(`Error executing task '${task.taskName}' on session ${session.id}:`, err);
    } finally {
      const duration = Date.now() - startTime;
      metricsCollector.recordTaskExecution(task.taskName, duration, success, session.id, error);
    }
  }

  /**
   * Gets the current metrics and statistics.
   * @returns {object} An object containing the current metrics.
   */
  getMetrics() {
    return metricsCollector.getStats();
  }

  /**
   * Gets the recent task history.
   * @param {number} [limit=10] - The number of recent tasks to return.
   * @returns {object[]} An array of recent task execution objects.
   */
  getRecentTasks(limit = 10) {
    return metricsCollector.getRecentTasks(limit);
  }

  /**
   * Gets task statistics grouped by task name.
   * @returns {object} An object containing statistics for each task.
   */
  getTaskBreakdown() {
    return metricsCollector.getTaskBreakdown();
  }

  /**
   * Logs the current metrics to the console.
   */
  logMetrics() {
    metricsCollector.logStats();
  }

  /**
   * Gracefully shuts down the orchestrator and all connected sessions.
   * @param {boolean} [force=false] - If true, skip waiting for tasks to complete.
   * @returns {Promise<void>}
   */
  async shutdown(force = false) {
    logger.info(`Orchestrator shutting down... (Force: ${force})`);
    this.isShuttingDown = true;

    if (!force) {
      logger.info("Waiting for task processing to complete...");
      await this.waitForTasksToComplete();
    } else {
      logger.info("Force shutdown requested. Skipping task completion wait.");
    }

    logger.info("Final system metrics:");
    metricsCollector.logStats();
    await metricsCollector.generateJsonReport();

    // CRITICAL: Call sessionManager.shutdown() to close tabs!
    if (this.sessionManager) {
      await this.sessionManager.shutdown();
    }

    await this.automator.shutdown();

    logger.info("Orchestrator shutdown completed");
  }
}

export default Orchestrator;

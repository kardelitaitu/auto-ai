/**
 * @fileoverview The main orchestrator for the multi-browser automation framework.
 * @module core/orchestrator
 */

import { EventEmitter } from 'events';
import SessionManager from './sessionManager.js';
import Discovery from './discovery.js';
import Automator from './automator.js';
import { createLogger, loggerContext } from '../utils/logger.js';
import { getSettings } from '../utils/configLoader.js';
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
  /**
   * Creates a new Orchestrator instance
   */
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
    this.maxTaskQueueSize = 500;
    this.taskDispatchMode = 'centralized';
    this.reuseSharedContext = false;
    this.workerWaitTimeoutMs = 10000;
    this.sessionFailureScores = new Map();
    /** @type {Discovery} */
    this.discovery = new Discovery();
    this.isShuttingDown = false;

    this._loadConfig();

    this.automator.onReconnect = async (wsEndpoint, newBrowser) => {
      await this.sessionManager.replaceBrowserByEndpoint(wsEndpoint, newBrowser);
    };
  }

  /**
   * Helper method for sleep/delay
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async _loadConfig() {
    try {
      const settings = await getSettings();
      this.taskDispatchMode = 'centralized';
      this.reuseSharedContext = settings?.orchestration?.reuseSharedContext || false;
      this.maxTaskQueueSize = settings?.orchestration?.maxTaskQueueSize || settings?.maxTaskQueueSize || this.maxTaskQueueSize;
      this.workerWaitTimeoutMs = settings?.orchestration?.workerWaitTimeoutMs || settings?.workerWaitTimeoutMs || this.workerWaitTimeoutMs;
    } catch (error) {
      logger.warn(`Failed to load orchestrator config: ${error.message}`);
    }
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
      await this.sessionManager.loadConfiguration();
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
          } catch (_e) { /* ignore URL parse error */ }

          this.sessionManager.addSession(browser, displayName, wsEndpoint);
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

    if (this.maxTaskQueueSize && this.taskQueue.length >= this.maxTaskQueueSize) {
      logger.warn(`Task queue full (max: ${this.maxTaskQueueSize}). Dropping task '${taskName}'.`);
      throw new Error(`Task queue full (max: ${this.maxTaskQueueSize})`);
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
    if (this.isProcessingTasks || this.taskQueue.length === 0) {
      return;
    }

    if (this.sessionManager.activeSessionsCount === 0) {
      logger.warn("No active sessions available to process tasks.");
      return;
    }

    this.isProcessingTasks = true;
    logger.info("Starting concurrent checklist processing for all sessions...");

    const sessions = this.sessionManager.getAllSessions();
    const reuseSharedContext = this.reuseSharedContext || false;

    const sharedTasks = [...this.taskQueue];
    logger.info(`Dispatching ${sharedTasks.length} tasks across sessions using centralized mode: ${sharedTasks.map(t => t.taskName).join(', ')}`);
    this.taskQueue.length = 0;

    const orderedSessions = [...sessions].sort((a, b) => this._getSessionFailureScore(a.id) - this._getSessionFailureScore(b.id));

    const allSessionPromises = orderedSessions.map(session => {
      const tasksForSession = sharedTasks.map(task => ({
        ...task,
        payload: { ...task.payload }
      }));
      return this.processSharedChecklistForSession(session, tasksForSession, { reuseSharedContext });
    });

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
  async processChecklistForSession(session, tasks, options = {}) {
    logger.info(`[${session.id}] Starting checklist of ${tasks.length} tasks with up to ${session.workers.length} parallel tabs.`);

    const taskQueue = tasks.slice();
    let taskIndex = 0;
    const retryStack = [];
    const takeTask = () => {
      if (retryStack.length > 0) {
        return retryStack.pop();
      }
      if (taskIndex >= taskQueue.length) {
        return null;
      }
      const task = taskQueue[taskIndex];
      taskIndex += 1;
      return task;
    };
    const requeueTask = (task) => {
      retryStack.push(task);
    };
    const reuseSharedContext = options.reuseSharedContext || false;
    if (reuseSharedContext && !session.sharedContext) {
      const contexts = session.browser.contexts();
      session.sharedContext = contexts.length > 0 ? contexts[0] : await session.browser.newContext();
    }
    const contexts = session.browser.contexts();
    const sharedContext = reuseSharedContext ? session.sharedContext : (contexts.length > 0 ? contexts[0] : await session.browser.newContext());

    try {
      const workerPromises = session.workers.map(async (worker) => {
        logger.debug(`[${session.id}][Worker ${worker.id}] Starting...`);

        while (true) {
          // Check for global shutdown signal
          if (this.isShuttingDown) {
            logger.debug(`[${session.id}][Worker ${worker.id}] Shutdown signal received. Exiting loop.`);
            break;
          }

          const task = takeTask();
          if (!task) {
            logger.debug(`[${session.id}][Worker ${worker.id}] No more tasks. Exiting.`);
            break;
          }

          // Use atomic worker allocation with await
          const allocatedWorker = await this.sessionManager.acquireWorker(session.id, { timeoutMs: this.workerWaitTimeoutMs });
          if (!allocatedWorker) {
            logger.warn(`[${session.id}] No idle workers available, retrying...`);
            // Put task back at the front of the list
            requeueTask(task);
            continue;
          }

          let page = null;
          try {
            page = await this.sessionManager.acquirePage(session.id, sharedContext);

            logger.info(`[${session.id}][Worker ${worker.id}] Starting task '${task.taskName}' in new tab.`);
            await this.executeTask(task, page, session);
          } catch (e) {
            logger.error(`[${session.id}][Worker ${worker.id}] Critical error during task '${task.taskName}':`, e);
          } finally {
            if (page) {
              await this.sessionManager.releasePage(session.id, page);
            }
            // Use atomic worker release with await
            await this.sessionManager.releaseWorker(session.id, allocatedWorker.id);
            logger.info(`[${session.id}][Worker ${worker.id}] Finished task '${task.taskName}'. Worker is now idle.`);
          }
        }
      });

      await Promise.all(workerPromises);
    } finally {
      // Only close context if we are NOT shutting down globally, 
      // because sessionManager.shutdown() handles context closing more gracefully now.
      // Or we can leave it, as double closing is usually fine.
      if (!this.isShuttingDown && !reuseSharedContext) {
        await sharedContext.close();
        logger.info(`[${session.id}] All tasks complete. Closed shared browser context.`);
      }
    }

    logger.info(`[${session.id}] Completed all tasks in the checklist.`);
  }

  async processSharedChecklistForSession(session, tasks, options = {}) {
    logger.info(`[${session.id}] Starting shared checklist with ${tasks.length} tasks and up to ${session.workers.length} parallel tabs.`);

    const reuseSharedContext = options.reuseSharedContext || false;
    if (reuseSharedContext && !session.sharedContext) {
      const contexts = session.browser.contexts();
      session.sharedContext = contexts.length > 0 ? contexts[0] : await session.browser.newContext();
    }
    const contexts = session.browser.contexts();
    const sharedContext = reuseSharedContext ? session.sharedContext : (contexts.length > 0 ? contexts[0] : await session.browser.newContext());

    try {
      const taskQueue = tasks.slice();
      let taskIndex = 0;
      const retryStack = [];
      const takeTask = () => {
        if (retryStack.length > 0) {
          return retryStack.pop();
        }
        if (taskIndex >= taskQueue.length) {
          return null;
        }
        const task = taskQueue[taskIndex];
        taskIndex += 1;
        return task;
      };
      const requeueTask = (task) => {
        retryStack.push(task);
      };

      const workerPromises = session.workers.map(async (worker) => {
        logger.debug(`[${session.id}][Worker ${worker.id}] Starting...`);

        while (true) {
          if (this.isShuttingDown) {
            logger.debug(`[${session.id}][Worker ${worker.id}] Shutdown signal received. Exiting loop.`);
            break;
          }

          const task = takeTask();
          if (!task) {
            logger.debug(`[${session.id}][Worker ${worker.id}] No more tasks. Exiting.`);
            break;
          }

          const allocatedWorker = await this.sessionManager.acquireWorker(session.id, { timeoutMs: this.workerWaitTimeoutMs });
          if (!allocatedWorker) {
            logger.warn(`[${session.id}] No idle workers available, retrying...`);
            requeueTask(task);
            continue;
          }

          let page = null;
          try {
            page = await this.sessionManager.acquirePage(session.id, sharedContext);

            logger.info(`[${session.id}][Worker ${worker.id}] Starting task '${task.taskName}' in new tab.`);
            await this.executeTask(task, page, session);
          } catch (e) {
            logger.error(`[${session.id}][Worker ${worker.id}] Critical error during task '${task.taskName}':`, e);
          } finally {
            if (page) {
              await this.sessionManager.releasePage(session.id, page);
            }
            await this.sessionManager.releaseWorker(session.id, allocatedWorker.id);
            logger.info(`[${session.id}][Worker ${worker.id}] Finished task '${task.taskName}'. Worker is now idle.`);
          }
        }
      });

      await Promise.all(workerPromises);
    } finally {
      if (!this.isShuttingDown && !reuseSharedContext) {
        await sharedContext.close();
        logger.info(`[${session.id}] Shared checklist complete. Closed shared browser context.`);
      }
    }

    logger.info(`[${session.id}] Completed shared checklist.`);
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
   * Starts the dashboard server if enabled in config
   * Non-intrusive: optional module, graceful degradation if missing
   * @param {number} [port=3001] - Port to start dashboard server on
   * @returns {Promise<void>}
   */
  async startDashboard(port = 3001) {
    try {
      const fs = await import('fs');
      const path = await import('path');
      const { getSettings } = await import('../utils/configLoader.js');
      const uiPath = path.join(process.cwd(), 'ui', 'electron-dashboard', 'dashboard.js');

      const settings = await getSettings();
      const broadcastIntervalMs = settings?.ui?.dashboard?.broadcastIntervalMs || 2000;

      if (fs.existsSync(uiPath)) {
        const { DashboardServer } = await import('../ui/electron-dashboard/dashboard.js');
        this.dashboardServer = new DashboardServer(port, broadcastIntervalMs);
        await this.dashboardServer.start(this);
        logger.info(`Dashboard server started on port ${port} (broadcast every ${broadcastIntervalMs}ms)`);
      } else {
        logger.info('UI folder not found, dashboard disabled');
      }
    } catch (error) {
      logger.warn('Failed to start dashboard server:', error.message);
      logger.info('Continuing without dashboard...');
    }
  }

  /**
   * Stops the dashboard server
   */
  stopDashboard() {
    if (this.dashboardServer) {
      this.dashboardServer.stop();
      this.dashboardServer = null;
    }
  }

  /**
   * Gets session metrics for dashboard
   * @returns {Array<object>} Array of session metrics
   */
  getSessionMetrics() {
    try {
      const sessions = this.sessionManager.getAllSessions() || [];
      return sessions.map(session => {
        try {
          return {
            id: session.id,
            name: session.displayName || session.id,
            status: session.browser?.isConnected() ? 'online' : 'offline',
            activeWorkers: (session.workers || []).filter(w => w?.isActive).length,
            totalWorkers: (session.workers || []).length,
            completedTasks: session.completedTaskCount || 0,
            taskName: session.currentTaskName || null,
            processing: session.currentProcessing || null,
            browserType: session.browserType || null
          };
        } catch (_sessionError) {
          return {
            id: session?.id || 'unknown',
            name: session?.displayName || 'Unknown',
            status: 'offline',
            activeWorkers: 0,
            totalWorkers: 0,
            completedTasks: 0,
            taskName: null,
            processing: null,
            browserType: null
          };
        }
      });
    } catch (error) {
      logger.error('Error getting session metrics:', error.message);
      return [];
    }
  }

  /**
   * Gets queue status for dashboard
   * @returns {object} Queue status
   */
  getQueueStatus() {
    try {
      return {
        queueLength: this.taskQueue?.length || 0,
        isProcessing: this.isProcessingTasks || false,
        maxQueueSize: this.maxTaskQueueSize || 500
      };
    } catch (error) {
      logger.error('Error getting queue status:', error.message);
      return { queueLength: 0, isProcessing: false, maxQueueSize: 500 };
    }
  }

  /**
   * Gets comprehensive metrics for dashboard
   * @returns {object} Dashboard metrics
   */
  getMetrics() {
    try {
      const stats = metricsCollector?.getStats?.() || {};
      return {
        ...stats,
        startTime: metricsCollector?.metrics?.startTime || Date.now(),
        lastResetTime: metricsCollector?.metrics?.lastResetTime || Date.now()
      };
    } catch (error) {
      logger.error('Error getting metrics:', error.message);
      return {};
    }
  }

  /**
   * Gets recent task history for dashboard
   * @param {number} [limit=10] - Number of recent tasks to return
   * @returns {Array<object>} Recent task executions
   */
  getRecentTasks(limit = 10) {
    try {
      return metricsCollector?.getRecentTasks?.(limit) || [];
    } catch (error) {
      logger.error('Error getting recent tasks:', error.message);
      return [];
    }
  }

  /**
   * Gets task statistics breakdown for dashboard
   * @returns {object} Task statistics
   */
  getTaskBreakdown() {
    try {
      return metricsCollector?.getTaskBreakdown?.() || {};
    } catch (error) {
      logger.error('Error getting task breakdown:', error.message);
      return {};
    }
  }

  /**
   * Logs current metrics for dashboard
   */
  logMetrics() {
    try {
      metricsCollector?.logStats?.();
    } catch (error) {
      logger.error('Error logging metrics:', error.message);
    }
  }

  /**
   * Gracefully shuts down the orchestrator and all connected sessions.
   * @param {boolean} [force=false] - If true, skip waiting for tasks to complete.
   * @returns {Promise<void>}
   */
  async shutdown(force = false) {
    logger.info(`Orchestrator shutting down... (Force: ${force})`);
    this.isShuttingDown = true;
    if (this.processTimeout) {
      clearTimeout(this.processTimeout);
      this.processTimeout = null;
    }

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

    // Dashboard server cleanup
    if (this.dashboardServer) {
      this.dashboardServer.stop();
      this.dashboardServer = null;
    }

    await this.automator.shutdown();

    logger.info("Orchestrator shutdown completed");
  }

  /**
   * Helper to import task modules (extracted for testing/mocking)
   * Handles case-insensitive task names (e.g., twitterfollow -> twitterFollow)
   * @param {string} taskName 
   * @returns {Promise<any>}
   * @private
   */
  async _importTaskModule(taskName) {
    const cacheBuster = isDevelopment() ? `?v=${Date.now()}` : '';
    const fs = await import('fs');
    const path = await import('path');
    const aliasMap = new Map([
      ['run-retweet-test', 'retweet-test']
    ]);
    const normalizedName = String(taskName).toLowerCase();
    const resolvedTaskName = aliasMap.get(normalizedName) || taskName;

    // Try exact match first
    if (fs.existsSync(path.join(process.cwd(), 'tasks', `${resolvedTaskName}.js`))) {
      return import(`../tasks/${resolvedTaskName}.js${cacheBuster}`);
    }

    // Case-insensitive search
    const taskFiles = fs.readdirSync(path.join(process.cwd(), 'tasks')).filter(f => f.endsWith('.js'));
    const matchedFile = taskFiles.find(f => f.replace(/\.js$/i, '').toLowerCase() === normalizedName);

    if (matchedFile) {
      const actualName = matchedFile.replace('.js', '');
      return import(`../tasks/${actualName}.js${cacheBuster}`);
    }

    // Fallback to original
    return import(`../tasks/${resolvedTaskName}.js${cacheBuster}`);
  }

  /**
   * Loads and executes a single task.
   * @param {{taskName: string, payload: object}} task - The task object.
   * @param {object} page - The Playwright Page object to run the task in.
   * @param {object} session - The session to use.
   * @private
   */
  async executeTask(task, page, session) {
    const startTime = Date.now();
    let success;
    let error = null;

    session.currentTaskName = task.taskName;
    session.currentProcessing = 'Executing task...';

    // Debug log
    logger.info(`[Orchestrator] Executing task: '${task.taskName}' with payload: ${JSON.stringify(task.payload)}`);

    try {
      const validation = validateTaskExecution(page, task.payload);
      if (!validation.isValid) {
        throw new Error(`Task execution validation failed: ${validation.errors.join(', ')}`);
      }

      const taskModule = await this._importTaskModule(task.taskName);
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
        await loggerContext.run({ taskName: task.taskName, sessionId: session.id }, async () => {
          await taskModule.default(page, augmentedPayload);
        });
        success = true;
      } else {
        throw new Error(`Task '${task.taskName}' does not export a default function.`);
      }
    } catch (err) {
      error = err;
      success = false;
      logger.error(`Error executing task '${task.taskName}' on session ${session.id}:`, err);
    } finally {
      session.currentTaskName = null;
      session.currentProcessing = null;
      const duration = Date.now() - startTime;
      const wasSuccessful = success === true;
      metricsCollector.recordTaskExecution(task.taskName, duration, wasSuccessful, session.id, error);
      this._recordSessionOutcome(session.id, wasSuccessful);
    }
  }

  _getSessionFailureScore(sessionId) {
    return this.sessionFailureScores.get(sessionId) || 0;
  }

  _recordSessionOutcome(sessionId, success) {
    const current = this.sessionFailureScores.get(sessionId) || 0;
    if (success) {
      const next = Math.max(0, current - 1);
      if (next === 0) {
        this.sessionFailureScores.delete(sessionId);
      } else {
        this.sessionFailureScores.set(sessionId, next);
      }
      return;
    }
    this.sessionFailureScores.set(sessionId, current + 1);
  }
}

export default Orchestrator;

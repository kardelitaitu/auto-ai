/**
 * @fileoverview The main orchestrator for the multi-browser automation framework.
 * @module core/orchestrator
 */

import { EventEmitter } from 'events';
import SessionManager from './sessionManager.js';
import Discovery from './discovery.js';
import Automator from './automator.js';
import { api } from '../api/index.js';
import { createLogger } from '../utils/logger.js';
import { getSettings, getTimeoutValue } from '../utils/configLoader.js';
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
    this.maxTaskQueueSize = 500;
    this.maxTaskRetries = 2; // Default retry limit
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
      const orchConfig = await getTimeoutValue('orchestration', {});

      this.taskDispatchMode = 'centralized';
      this.reuseSharedContext = orchConfig.reuseSharedContext ?? this.reuseSharedContext;
      this.maxTaskQueueSize = orchConfig.maxTaskQueueSize ?? this.maxTaskQueueSize;
      this.workerWaitTimeoutMs = orchConfig.workerWaitTimeoutMs ?? this.workerWaitTimeoutMs;
      this.defaultColorScheme = settings?.ui?.dashboard?.colorScheme || null;
    } catch (_error) {
      logger.warn(`Failed to load orchestrator config: ${_error.message}`);
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
    } catch (_error) {
      logger.error("Browser discovery failed:", _error.message);
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
    logger.info(`Task '${taskName}' added to queue. Queue size: ${this.taskQueue.length}`);

    if (this.processTimeout) {
      clearTimeout(this.processTimeout);
    }

    this.processTimeout = setTimeout(async () => {
      this.processTimeout = null;
      await this.processTasks();
    }, 50); // Debounce task processing
  }

  /**
   * Processes tasks from the queue in parallel using available idle sessions.
   * @returns {Promise<void>}
   */
  async processTasks() {
    if (this.isProcessingTasks || this.taskQueue.length === 0) {
      this.emit('tasksProcessed');
      return;
    }

    if (this.sessionManager.activeSessionsCount === 0) {
      logger.warn("No active sessions available to process tasks.");
      this.isProcessingTasks = false;
      this.emit('tasksProcessed');
      return;
    }

    this.isProcessingTasks = true;
    logger.info("Starting concurrent checklist processing for all sessions...");

    const sessions = this.sessionManager.getAllSessions();
    const reuseSharedContext = this.reuseSharedContext || false;

    const sharedTasks = [...this.taskQueue];
    logger.info(`Dispatching ${sharedTasks.length} tasks across sessions.`);
    this.taskQueue.length = 0;

    const orderedSessions = [...sessions].sort((a, b) => this._getSessionFailureScore(a.id) - this._getSessionFailureScore(b.id));

    const allSessionPromises = orderedSessions.map(session => {
      const tasksForSession = sharedTasks.map(task => ({
        ...task,
        payload: { ...task.payload }
      }));
      return this.processSharedChecklistForSession(session, tasksForSession, { reuseSharedContext });
    });

    const results = await Promise.allSettled(allSessionPromises);

    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        const sessionId = orderedSessions[index].id;
        logger.error(`[${sessionId}] Checklist processing failed with error:`, result.reason?.message || result.reason);
      }
    });

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
   * @param {object} [options={}] - Execution options.
   * @private
   */
  async processSharedChecklistForSession(session, tasks, options = {}) {
    logger.info(`[${session.id}] Starting shared checklist with ${tasks.length} tasks and up to ${session.workers.length} parallel tabs.`);

    const reuseSharedContext = options.reuseSharedContext || false;
    let sharedContext;
    let createdNewContext = false;

    if (reuseSharedContext) {
      if (!session.sharedContext) {
        const contexts = session.browser.contexts();
        session.sharedContext = contexts.length > 0 ? contexts[0] : await session.browser.newContext();
      }
      sharedContext = session.sharedContext;
    } else {
      const contexts = session.browser.contexts();
      // Prefer existing context to maintain session state (theme, cookies, etc.)
      if (contexts.length > 0) {
        sharedContext = contexts[0];
      } else {
        // Fallback to new context with dark mode forced if possible
        sharedContext = await session.browser.newContext({
          colorScheme: this.defaultColorScheme || undefined
        });
        createdNewContext = true;
      }
    }

    try {
      const taskQueue = tasks.slice();
      let taskIndex = 0;
      const retryStack = [];
      const takeTask = () => {
        if (retryStack.length > 0) return retryStack.pop();
        if (taskIndex >= taskQueue.length) return null;
        const task = taskQueue[taskIndex];
        taskIndex += 1;
        return task;
      };
      const requeueTask = (task) => retryStack.push(task);

      const workerPromises = session.workers.map(async (worker) => {
        let lastHealthCheck = 0;
        const healthCheckInterval = 300000; // 5 minutes

        while (true) {
          if (this.isShuttingDown) break;

          // Health check: Ensure browser is still connected
          if (!session.browser.isConnected()) {
            logger.error(`[${session.id}][Worker ${worker.id}] Browser disconnected. Cannot process tasks.`);
            this.sessionManager.markSessionFailed(session.id);
            break;
          }

          const task = takeTask();
          if (!task) break;

          // Proactive Health Check
          if (Date.now() - lastHealthCheck > healthCheckInterval) {
            const health = await this.automator.checkConnectionHealth(session.wsEndpoint);
            if (!health.healthy) {
              logger.warn(`[${session.id}] Unhealthy connection detected during checklist. Attempting recovery...`);
              await this.automator.recoverConnection(session.wsEndpoint);
            }
            lastHealthCheck = Date.now();
          }

          const allocatedWorker = await this.sessionManager.acquireWorker(session.id, { timeoutMs: this.workerWaitTimeoutMs });
          if (!allocatedWorker) {
            logger.warn(`[${session.id}] No idle workers available for task '${task.taskName}', retrying...`);
            requeueTask(task);
            await this._sleep(5000); // Increased delay to reduce log spam
            continue;
          }

          let page = null;
          try {
            page = await this.sessionManager.acquirePage(session.id, sharedContext);

            // Final page health check before task
            const pageHealth = await this.automator.checkPageResponsive(page);
            if (!pageHealth.healthy) {
              logger.warn(`[${session.id}] Page unresponsive before task '${task.taskName}'. Re-creating page.`);
              await page.close().catch(() => { });
              page = await this.sessionManager.acquirePage(session.id, sharedContext);
            }

            logger.info(`[${session.id}][Worker ${allocatedWorker.id}] Starting task '${task.taskName}'`);
            await this.executeTask(task, page, session);
            session.completedTaskCount = (session.completedTaskCount || 0) + 1;
          } catch (e) {
            logger.error(`[${session.id}][Worker ${allocatedWorker.id}] Error during task '${task.taskName}':`, e.message);
            this._recordSessionOutcome(session.id, false);

            if (task.retriesLeft === undefined) task.retriesLeft = this.maxTaskRetries;
            if (task.retriesLeft > 0) {
              task.retriesLeft--;
              logger.warn(`[${session.id}] Retrying task '${task.taskName}'. Retries left: ${task.retriesLeft}`);
              requeueTask(task);
            } else {
              logger.error(`[${session.id}] Task '${task.taskName}' failed after multiple retries.`);
              this.emit('taskFailed', { sessionId: session.id, task: task, error: e });
            }
          } finally {
            if (page) await this.sessionManager.releasePage(session.id, page);
            await this.sessionManager.releaseWorker(session.id, allocatedWorker.id);
          }
        }
      });

      await Promise.all(workerPromises);
    } finally {
      if (!this.isShuttingDown && createdNewContext) {
        try {
          if (sharedContext) await sharedContext.close();
        } catch (e) {
          logger.warn(`[${session.id}] Error closing temporary context:`, e.message);
        }
      }
    }
  }

  /**
   * Waits for all tasks in the queue to be processed.
   * @returns {Promise<void>}
   */
  async waitForTasksToComplete() {
    if (this.taskQueue.length === 0 && !this.isProcessingTasks) {
      logger.info('Resolving immediately as queue is empty and not processing');
      return;
    }

    return new Promise(resolve => {
      const checkCompletion = () => {
        if (this.taskQueue.length === 0 && !this.isProcessingTasks && !this.processTimeout) {
          logger.info('All tasks completed, resolving');
          this.removeListener('tasksProcessed', checkCompletion);
          this.removeListener('allTasksComplete', onComplete);
          resolve();
        }
      };

      const onComplete = () => {
        logger.info('Received completion event');
        this.removeListener('tasksProcessed', checkCompletion);
        this.removeListener('allTasksComplete', onComplete);
        resolve();
      };

      this.on('tasksProcessed', checkCompletion);
      this.on('allTasksComplete', onComplete);

      // Final check in case it completed right as we attached listeners
      checkCompletion();
    });
  }

  /**
   * Stats/Dashboard helpers
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
        logger.info(`Dashboard server started on port ${port}`);
      }
    } catch (_error) {
      logger.warn('Failed to start dashboard:', _error.message);
    }
  }

  async stopDashboard() {
    if (this.dashboardServer) {
      await this.dashboardServer.stop();
      this.dashboardServer = null;
    }
  }

  getSessionMetrics() {
    try {
      const sessions = this.sessionManager.getAllSessions() || [];
      return sessions.map(session => ({
        id: session.id,
        name: session.displayName || session.id,
        status: session.browser?.isConnected() ? 'online' : 'offline',
        activeWorkers: (session.workers || []).filter(w => w?.isActive).length,
        totalWorkers: (session.workers || []).length,
        completedTasks: session.completedTaskCount || 0,
        taskName: session.currentTaskName || null,
        processing: session.currentProcessing || null,
        browserType: session.browserType || null
      }));
    } catch (_error) {
      return [];
    }
  }

  getQueueStatus() {
    return {
      queueLength: this.taskQueue.length,
      isProcessing: this.isProcessingTasks,
      maxQueueSize: this.maxTaskQueueSize
    };
  }

  getMetrics() {
    try {
      const stats = metricsCollector.getStats() || {};
      return {
        ...stats,
        startTime: metricsCollector.metrics?.startTime,
        lastResetTime: metricsCollector.metrics?.lastResetTime
      };
    } catch (_error) {
      return {};
    }
  }

  getRecentTasks(limit = 10) {
    return metricsCollector?.getRecentTasks?.(limit) || [];
  }

  getTaskBreakdown() {
    return metricsCollector?.getTaskBreakdown?.() || {};
  }

  logMetrics() {
    metricsCollector?.logStats?.();
  }

  /**
   * Gracefully shuts down the orchestrator and all connected sessions.
   * @param {boolean} [force=false] - If true, skip waiting for tasks to complete.
   * @returns {Promise<void>}
   */
  async shutdown(force = false) {
    this.isShuttingDown = true;
    if (this.processTimeout) clearTimeout(this.processTimeout);

    if (!force) await this.waitForTasksToComplete();

    if (this.sessionManager) await this.sessionManager.shutdown();
    if (this.dashboardServer) await this.stopDashboard();
    await this.automator.shutdown();

    // Log final stats summary before exiting
    this.logMetrics();

    // Also generate the persistence report
    await metricsCollector.generateJsonReport();

    logger.info("Orchestrator shutdown completed");
  }

  async _importTaskModule(taskName) {
    const cacheBuster = isDevelopment() ? `?v=${Date.now()}` : '';
    const fs = await import('fs');
    const path = await import('path');

    if (fs.existsSync(path.join(process.cwd(), 'tasks', `${taskName}.js`))) {
      return import(`../tasks/${taskName}.js${cacheBuster}`);
    }

    const taskFiles = fs.readdirSync(path.join(process.cwd(), 'tasks')).filter(f => f.endsWith('.js'));
    const matchedFile = taskFiles.find(f => f.replace(/\.js$/i, '').toLowerCase() === taskName.toLowerCase());

    if (matchedFile) {
      const actualName = matchedFile.replace('.js', '');
      return import(`../tasks/${actualName}.js${cacheBuster}`);
    }

    return import(`../tasks/${taskName}.js${cacheBuster}`);
  }

  /**
   * Loads and executes a single task.
   * @param {{taskName: string, payload: object}} task - The task object.
   * @param {object} page - The Playwright Page object.
   * @param {object} session - The session.
   * @private
   */
  async executeTask(task, page, session) {
    const startTime = Date.now();
    let success;
    let error = null;

    session.currentTaskName = task.taskName;
    session.currentProcessing = 'Executing task...';

    try {
      const validation = validateTaskExecution(page, task.payload);
      if (!validation.isValid) throw new Error(`Validation failed: ${validation.errors.join(', ')}`);

      const taskModule = await this._importTaskModule(task.taskName);
      if (typeof taskModule.default !== 'function') throw new Error(`Task '${task.taskName}' missing default export.`);

      const augmentedPayload = {
        ...task.payload,
        browserInfo: session.browserInfo || 'unknown'
      };

      await api.withPage(page, async () => {
        await api.init(page, {
          persona: augmentedPayload.persona || 'casual',
          logger: logger,
          colorScheme: augmentedPayload.colorScheme || this.defaultColorScheme || null,
        });
        await taskModule.default(page, augmentedPayload);
      });
      success = true;
      this._recordSessionOutcome(session.id, true);
    } catch (err) {
      error = err;
      success = false;
      logger.error(`Task '${task.taskName}' error:`, err.message);
    } finally {
      session.currentTaskName = null;
      session.currentProcessing = null;
      metricsCollector.recordTaskExecution(task.taskName, Date.now() - startTime, success, session.id, error);
    }
  }

  _getSessionFailureScore(sessionId) {
    return this.sessionFailureScores.get(sessionId) || 0;
  }

  _recordSessionOutcome(sessionId, success) {
    const current = this.sessionFailureScores.get(sessionId) || 0;
    if (success) {
      const next = Math.max(0, current - 1);
      if (next === 0) this.sessionFailureScores.delete(sessionId);
      else this.sessionFailureScores.set(sessionId, next);
    } else {
      this.sessionFailureScores.set(sessionId, current + 1);
    }
  }
}

export default Orchestrator;

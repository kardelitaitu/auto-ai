/**
 * @fileoverview Manages browser sessions, including their lifecycle, status, and persistence.
 * @module core/sessionManager
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createLogger } from '../utils/logger.js';
import { getTimeoutValue, getSettings } from '../utils/configLoader.js';
import metricsCollector from '../utils/metrics.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SESSION_STATE_FILE = path.join(__dirname, '../data/sessionState.json');
const logger = createLogger('sessionManager.js');

/**
 * @class SessionManager
 * @description Manages a pool of browser sessions, including their creation, status, and cleanup.
 */
class SessionManager {
  constructor(options = {}) {
    /** @type {Array<object>} */
    this.sessions = [];
    this.nextSessionId = 1;
    this.sessionTimeoutMs = options.sessionTimeoutMs || 30 * 60 * 1000;
    this.cleanupIntervalMs = options.cleanupIntervalMs || 5 * 60 * 1000;
    this.workerLockTimeoutMs = options.workerLockTimeoutMs || 10000;
    this.workerWaitTimeoutMs = options.workerWaitTimeoutMs || 10000;
    this.workerWaiterMaxPerSession = options.workerWaiterMaxPerSession || 50;
    this.concurrencyPerBrowser = 1;
    this.pagePoolMaxPerSession = options.pagePoolMaxPerSession || null;
    this.pagePoolIdleTimeoutMs = options.pagePoolIdleTimeoutMs || 5 * 60 * 1000;
    this.pagePoolHealthCheckIntervalMs = options.pagePoolHealthCheckIntervalMs || 30000;
    this.pagePoolHealthCheckTimeoutMs = options.pagePoolHealthCheckTimeoutMs || 5000;
    this.cleanupInterval = null;
    
    // Worker allocation lock - prevents race conditions
    this.workerLocks = new Map(); // sessionId -> Promise
    this.workerOccupancy = new Map(); // Track worker occupancy for debugging
    this.workerWaiters = new Map(); // sessionId -> Array of waiters
    
    this.startCleanupTimer();
    this.loadConfiguration();
  }

  /**
   * Loads session timeout values from the configuration.
   * @private
   */
  async loadConfiguration() {
    try {
      const timeouts = await getTimeoutValue('session', {});
      this.sessionTimeoutMs = timeouts.timeoutMs || this.sessionTimeoutMs;
      this.cleanupIntervalMs = timeouts.cleanupIntervalMs || this.cleanupIntervalMs;

      const settings = await getSettings();
      this.concurrencyPerBrowser = settings.concurrencyPerBrowser || 1;
      this.pagePoolMaxPerSession = settings?.orchestration?.pagePoolMaxPerSession || settings?.pagePoolMaxPerSession || this.concurrencyPerBrowser;
      this.pagePoolIdleTimeoutMs = settings?.orchestration?.pagePoolIdleTimeoutMs || settings?.pagePoolIdleTimeoutMs || this.pagePoolIdleTimeoutMs;
      this.pagePoolHealthCheckIntervalMs = settings?.orchestration?.pagePoolHealthCheckIntervalMs || settings?.pagePoolHealthCheckIntervalMs || this.pagePoolHealthCheckIntervalMs;
      this.pagePoolHealthCheckTimeoutMs = settings?.orchestration?.pagePoolHealthCheckTimeoutMs || settings?.pagePoolHealthCheckTimeoutMs || this.pagePoolHealthCheckTimeoutMs;
      this.workerWaitTimeoutMs = settings?.orchestration?.workerWaitTimeoutMs || settings?.workerWaitTimeoutMs || this.workerWaitTimeoutMs;
      this.workerWaiterMaxPerSession = settings?.orchestration?.workerWaiterMaxPerSession || settings?.workerWaiterMaxPerSession || this.workerWaiterMaxPerSession;

      logger.info(`Loaded configuration: session=${this.sessionTimeoutMs}ms, cleanup=${this.cleanupIntervalMs}ms, concurrency=${this.concurrencyPerBrowser}`);

      if (this.cleanupInterval) {
        this.stopCleanupTimer();
        this.startCleanupTimer();
      }
    } catch (error) {
      logger.error('Failed to load timeout configuration, using defaults:', error.message);
    }
  }

  /**
   * Adds a new browser session to the manager.
   * @param {object} browser - The Playwright browser instance.
   * @param {string} [browserInfo] - A unique identifier for the browser.
   * @returns {string} The ID of the added session.
   */
  addSession(browser, browserInfo) {
    // Priority: browserInfo > generated ID
    const id = browserInfo ? browserInfo : `session-${this.nextSessionId++}`;
    const now = Date.now();

    const workers = Array.from({ length: this.concurrencyPerBrowser }, (_, i) => ({
      id: i,
      status: 'idle',
    }));

    this.sessions.push({
      id,
      browser,
      browserInfo,
      workers,
      createdAt: now,
      lastActivity: now,
      managedPages: new Set(),
      pagePool: []
    });

    if (browserInfo) {
      logger.info(`Added new session: ${id} at ${browserInfo} with ${this.concurrencyPerBrowser} worker slots.`);
    } else {
      logger.info(`Added new session: ${id} with ${this.concurrencyPerBrowser} worker slots.`);
    }

    metricsCollector.recordSessionEvent('created', this.sessions.length);

    return id;
  }

  /**
   * Registers a page as managed by this session.
   * @param {string} sessionId - The session ID.
   * @param {object} page - The Playwright page object.
   */
  registerPage(sessionId, page) {
    const session = this.sessions.find(s => s.id === sessionId);
    if (session) {
      session.managedPages.add(page);
    }
  }

  /**
   * Unregisters a page from this session.
   * @param {string} sessionId - The session ID.
   * @param {object} page - The Playwright page object.
   */
  unregisterPage(sessionId, page) {
    const session = this.sessions.find(s => s.id === sessionId);
    if (session) {
      session.managedPages.delete(page);
    }
  }

  _normalizePoolEntry(entry, now) {
    if (entry && typeof entry === 'object' && 'page' in entry) {
      return {
        page: entry.page,
        lastUsedAt: entry.lastUsedAt ?? now,
        lastHealthCheckAt: entry.lastHealthCheckAt ?? 0
      };
    }
    return {
      page: entry,
      lastUsedAt: now,
      lastHealthCheckAt: 0
    };
  }

  async _isPageHealthy(page) {
    if (!page || (typeof page.isClosed === 'function' && page.isClosed())) {
      return false;
    }
    if (typeof page.evaluate !== 'function') {
      return true;
    }

    const timeoutMs = this.pagePoolHealthCheckTimeoutMs || 5000;

    try {
      const result = await Promise.race([
        page.evaluate(() => ({
          documentReady: document.readyState,
          bodyExists: !!document.body
        })),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Page health check timeout')), timeoutMs))
      ]);

      return result?.documentReady === 'complete' || result?.documentReady === 'interactive' || result?.bodyExists === true;
    } catch (_error) {
      return false;
    }
  }

  _closePooledPage(sessionId, page) {
    if (!page) {
      return;
    }
    if (typeof page.close === 'function') {
      Promise.resolve(page.close()).catch(() => { });
    }
    this.unregisterPage(sessionId, page);
  }

  async acquirePage(sessionId, context) {
    const session = this.sessions.find(s => s.id === sessionId);
    if (!session || !context) {
      return null;
    }

    const now = Date.now();
    while (session.pagePool.length > 0) {
      const entry = this._normalizePoolEntry(session.pagePool.pop(), now);
      const pooledPage = entry.page;
      if (!pooledPage) {
        continue;
      }
      if (typeof pooledPage.isClosed === 'function' && pooledPage.isClosed()) {
        this.unregisterPage(sessionId, pooledPage);
        continue;
      }
      if (this.pagePoolIdleTimeoutMs && now - entry.lastUsedAt > this.pagePoolIdleTimeoutMs) {
        this._closePooledPage(sessionId, pooledPage);
        continue;
      }

      const shouldCheckHealth = this.pagePoolHealthCheckIntervalMs == null || now - entry.lastHealthCheckAt > this.pagePoolHealthCheckIntervalMs;
      if (shouldCheckHealth) {
        const healthy = await this._isPageHealthy(pooledPage);
        if (!healthy) {
          this._closePooledPage(sessionId, pooledPage);
          continue;
        }
      }
      return pooledPage;
    }

    const page = await context.newPage();
    this.registerPage(sessionId, page);
    return page;
  }

  async releasePage(sessionId, page) {
    const session = this.sessions.find(s => s.id === sessionId);
    if (!session || !page) {
      return;
    }

    if (typeof page.isClosed === 'function' && page.isClosed()) {
      this.unregisterPage(sessionId, page);
      return;
    }

    const maxPoolSize = this.pagePoolMaxPerSession || this.concurrencyPerBrowser || 1;
    if (session.pagePool.length >= maxPoolSize) {
      if (typeof page.close === 'function') {
        await Promise.resolve(page.close()).catch(() => { });
      }
      this.unregisterPage(sessionId, page);
      return;
    }

    const healthy = await this._isPageHealthy(page);
    if (!healthy) {
      this._closePooledPage(sessionId, page);
      return;
    }

    session.pagePool.push({
      page,
      lastUsedAt: Date.now(),
      lastHealthCheckAt: Date.now()
    });
  }

  /**
    * Finds an idle worker in a specific session, marks it as busy, and returns it.
    * Uses atomic locking to prevent race conditions.
    * @param {string} sessionId - The ID of the session to check.
    * @returns {Promise<object | null>} The worker object if found, otherwise null.
    */
  async findAndOccupyIdleWorker(sessionId) {
    // Acquire lock for this session to ensure atomicity
    if (!this.workerLocks.has(sessionId)) {
      this.workerLocks.set(sessionId, Promise.resolve());
    }
    
    const lockPromise = this.workerLocks.get(sessionId);

    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('Worker lock timeout')), this.workerLockTimeoutMs || 10000);
    });

    try {
      const result = await Promise.race([
        new Promise((resolve) => {
          lockPromise.then(() => {
            const session = this.sessions.find(s => s.id === sessionId);
            if (!session) {
              resolve(null);
              return;
            }

            const worker = session.workers.find(w => w.status === 'idle');
            if (worker) {
              if (session.workers.find(w => w.id === worker.id && w.status === 'idle')) {
                worker.status = 'busy';
                worker.occupiedAt = Date.now();
                worker.occupiedBy = this._getCurrentExecutionContext();
                
                const occupancyKey = `${sessionId}:${worker.id}`;
                this.workerOccupancy.set(occupancyKey, {
                  startTime: Date.now(),
                  context: worker.occupiedBy
                });
                
                logger.debug(`[ATOMIC] Occupied worker ${worker.id} in session ${sessionId} (context: ${worker.occupiedBy})`);
                resolve(worker);
                return;
              }
            }

            logger.debug(`[ATOMIC] No idle workers available in session ${sessionId}`);
            resolve(null);
          }).catch(() => {
            resolve(null);
          });
        }),
        timeoutPromise
      ]);
      
      return result;
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  _getWorkerWaiters(sessionId) {
    if (!this.workerWaiters.has(sessionId)) {
      this.workerWaiters.set(sessionId, []);
    }
    return this.workerWaiters.get(sessionId);
  }

  async acquireWorker(sessionId, options = {}) {
    const timeoutMs = options.timeoutMs ?? this.workerWaitTimeoutMs;
    let worker;
    try {
      worker = await this.findAndOccupyIdleWorker(sessionId);
    } catch (error) {
      logger.warn(`Worker lock failure for session ${sessionId}: ${error.message}`);
      return null;
    }
    if (worker) {
      return worker;
    }

    return new Promise(resolve => {
      const waiters = this._getWorkerWaiters(sessionId);
      if (this.workerWaiterMaxPerSession && waiters.length >= this.workerWaiterMaxPerSession) {
        resolve(null);
        return;
      }
      const entry = {
        resolve,
        timeoutId: null
      };
      entry.timeoutId = setTimeout(() => {
        const index = waiters.indexOf(entry);
        if (index !== -1) {
          waiters.splice(index, 1);
        }
        resolve(null);
      }, timeoutMs);
      waiters.push(entry);
    });
  }

  /**
    * Releases a worker in a specific session, setting its status to idle.
    * Uses atomic locking to prevent race conditions.
    * @param {string} sessionId - The ID of the session.
    * @param {number} workerId - The ID of the worker to release.
    */
  async releaseWorker(sessionId, workerId) {
    // Acquire lock for this session to ensure atomicity
    if (!this.workerLocks.has(sessionId)) {
      this.workerLocks.set(sessionId, Promise.resolve());
    }
    
    const lockPromise = this.workerLocks.get(sessionId);
    
    // Create a new promise that waits for the lock and then processes
    await new Promise((resolve) => {
      lockPromise.then(async () => {
        // We hold the lock - proceed with atomic operation
        const session = this.sessions.find(s => s.id === sessionId);
        if (session) {
          const worker = session.workers.find(w => w.id === workerId);
          if (worker) {
            // Only release if worker is busy
            if (worker.status === 'busy') {
              worker.status = 'idle';
              worker.occupiedAt = null;
              worker.occupiedBy = null;
              session.lastActivity = Date.now();
              
              // Clear occupancy tracking
              const occupancyKey = `${sessionId}:${worker.id}`;
              const occupancyInfo = this.workerOccupancy.get(occupancyKey);
              if (occupancyInfo) {
                const duration = Date.now() - occupancyInfo.startTime;
                logger.debug(`[ATOMIC] Released worker ${worker.id} in session ${sessionId} after ${duration}ms (context: ${occupancyInfo.context})`);
                this.workerOccupancy.delete(occupancyKey);
              } else {
                logger.debug(`[ATOMIC] Released worker ${worker.id} in session ${sessionId}`);
              }
            } else {
              logger.warn(`[ATOMIC] Worker ${workerId} in session ${sessionId} is not busy, cannot release`);
            }
          } else {
            logger.warn(`Worker ${workerId} not found in session ${sessionId} to release.`);
          }
        } else {
          logger.warn(`Session ${sessionId} not found to release a worker.`);
        }

        const waiters = this.workerWaiters.get(sessionId);
        if (waiters && waiters.length > 0) {
          const next = waiters.shift();
          if (next?.timeoutId) {
            clearTimeout(next.timeoutId);
          }
          const sessionForWaiter = this.sessions.find(s => s.id === sessionId);
          const idleWorker = sessionForWaiter?.workers.find(w => w.status === 'idle');
          if (idleWorker) {
            idleWorker.status = 'busy';
            idleWorker.occupiedAt = Date.now();
            idleWorker.occupiedBy = this._getCurrentExecutionContext();
            const occupancyKey = `${sessionId}:${idleWorker.id}`;
            this.workerOccupancy.set(occupancyKey, {
              startTime: Date.now(),
              context: idleWorker.occupiedBy
            });
            next.resolve(idleWorker);
          } else {
            next.resolve(null);
          }
        }
        
        resolve();
      });
    });
  }

  /**
    * Gets the current execution context for debugging.
    * @private
    */
  _getCurrentExecutionContext() {
    try {
      // Try to get stack trace info
      const stack = new Error().stack;
      if (stack) {
        // Extract useful context from stack
        const lines = stack.split('\n').slice(2, 4); // Skip Error and this function
        return lines.map(line => line.trim()).join(' | ');
      }
    } catch (_e) {
      // Fallback to basic info
    }
    return 'unknown';
  }

  /**
    * Gets occupancy information for debugging.
    * @param {string} sessionId - The session ID.
    * @returns {object} Occupancy information.
    */
  getWorkerOccupancy(sessionId) {
    const occupancy = {};
    for (const [key, info] of this.workerOccupancy) {
      if (key.startsWith(`${sessionId}:`)) {
        const workerId = key.split(':')[1];
        occupancy[workerId] = {
          duration: Date.now() - info.startTime,
          context: info.context
        };
      }
    }
    return occupancy;
  }

  /**
    * Checks if any workers are stuck (occupied for too long).
    * @param {number} thresholdMs - Threshold in milliseconds.
    * @returns {object[]} List of stuck workers.
    */
  getStuckWorkers(thresholdMs = 60000) {
    const stuck = [];
    const now = Date.now();
    
    for (const [key, info] of this.workerOccupancy) {
      const duration = now - info.startTime;
      if (duration > thresholdMs) {
        const [sessionId, workerId] = key.split(':');
        stuck.push({
          sessionId,
          workerId: parseInt(workerId),
          duration,
          context: info.context
        });
      }
    }
    
    return stuck;
  }

  _cleanupSessionMaps(sessionId) {
    this.workerLocks.delete(sessionId);
    for (const key of this.workerOccupancy.keys()) {
      if (key.startsWith(`${sessionId}:`)) {
        this.workerOccupancy.delete(key);
      }
    }
    const waiters = this.workerWaiters.get(sessionId);
    if (waiters && waiters.length > 0) {
      for (const waiter of waiters) {
        if (waiter.timeoutId) {
          clearTimeout(waiter.timeoutId);
        }
        waiter.resolve(null);
      }
    }
    this.workerWaiters.delete(sessionId);
  }

  /**
   * Removes a session from the manager.
   * @param {string} id - The ID of the session to remove.
   * @returns {boolean} True if the session was found and removed, false otherwise.
   */
  removeSession(id) {
    const initialLength = this.sessions.length;
    this.sessions = this.sessions.filter(session => session.id !== id);
    if (this.sessions.length < initialLength) {
      logger.info(`Removed session: ${id}`);
      this._cleanupSessionMaps(id);

      metricsCollector.recordSessionEvent('closed', this.sessions.length);

      return true;
    }
    logger.warn(`Session ${id} not found for removal.`);
    return false;
  }

  /**
   * Gets the number of active sessions.
   * @type {number}
   */
  get activeSessionsCount() {
    return this.sessions.length;
  }

  /**
   * Gets all sessions.
   * @returns {object[]} An array of all session objects.
   */
  getAllSessions() {
    return this.sessions;
  }

  /**
   * Starts the cleanup timer to remove timed-out sessions.
   * @private
   */
  startCleanupTimer() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cleanupInterval = setInterval(() => {
      this.cleanupTimedOutSessions();
    }, this.cleanupIntervalMs);

    logger.info(`Started cleanup timer with ${this.cleanupIntervalMs}ms interval`);
  }

  /**
   * Stops the cleanup timer.
   */
  stopCleanupTimer() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      logger.info(`Stopped cleanup timer`);
    }
  }

  /**
   * Removes sessions that have timed out.
   * @returns {number} The number of sessions that were removed.
   */
  cleanupTimedOutSessions() {
    const now = Date.now();
    const initialLength = this.sessions.length;

    this.sessions = this.sessions.filter(session => {
      const sessionAge = now - session.lastActivity;
      if (sessionAge > this.sessionTimeoutMs) {
        logger.info(`Session ${session.id} timed out after ${Math.round(sessionAge / 1000)}s. Removing...`);
        this.closeManagedPages(session);
        this.closeSessionBrowser(session);
        this._cleanupSessionMaps(session.id);
        return false;
      }
      return true;
    });

    const removedCount = initialLength - this.sessions.length;
    if (removedCount > 0) {
      logger.info(`Cleanup completed. Removed ${removedCount} timed-out sessions.`);
    }

    this.cleanupIdlePages();
    return removedCount;
  }

  cleanupIdlePages() {
    const now = Date.now();
    let closedCount = 0;

    for (const session of this.sessions) {
      if (!session.pagePool || session.pagePool.length === 0) {
        continue;
      }

      const retained = [];
      for (const entry of session.pagePool) {
        const normalized = this._normalizePoolEntry(entry, now);
        const page = normalized.page;
        if (!page) {
          continue;
        }

        if (typeof page.isClosed === 'function' && page.isClosed()) {
          this.unregisterPage(session.id, page);
          closedCount += 1;
          continue;
        }

        if (this.pagePoolIdleTimeoutMs && now - normalized.lastUsedAt > this.pagePoolIdleTimeoutMs) {
          this._closePooledPage(session.id, page);
          closedCount += 1;
          continue;
        }

        retained.push({
          page,
          lastUsedAt: normalized.lastUsedAt,
          lastHealthCheckAt: normalized.lastHealthCheckAt
        });
      }

      session.pagePool = retained;
    }

    return closedCount;
  }

  /**
   * Safely closes the browser instance for a session.
   * @param {object} session - The session object.
   * @private
   */
  async closeSessionBrowser(session) {
    try {
      if (session.browser && typeof session.browser.close === 'function') {
        await session.browser.close();
        logger.info(`Closed browser for session ${session.id}`);
      }
    } catch (error) {
      logger.error(`Error closing browser for session ${session.id}:`, error.message);
    }
  }

  /**
   * Saves the current session state to a file.
   * @returns {Promise<void>}
   */
  async saveSessionState() {
    try {
      const dataDir = path.dirname(SESSION_STATE_FILE);
      await fs.mkdir(dataDir, { recursive: true });

      const sessionData = this.sessions.map(session => ({
        id: session.id,
        browserInfo: session.browserInfo,
        workers: session.workers,
        createdAt: session.createdAt,
        lastActivity: session.lastActivity
      }));

      const state = {
        sessions: sessionData,
        nextSessionId: this.nextSessionId,
        savedAt: Date.now()
      };

      await fs.writeFile(SESSION_STATE_FILE, JSON.stringify(state, null, 2));
      logger.info(`Saved session state for ${sessionData.length} sessions`);
    } catch (error) {
      logger.error(`Failed to save session state:`, error.message);
    }
  }

  /**
   * Loads the session state from a file.
   * @returns {Promise<object | null>} A promise that resolves with the loaded state, or null if no state is found.
   */
  async loadSessionState() {
    try {
      const data = await fs.readFile(SESSION_STATE_FILE, 'utf8');
      const state = JSON.parse(data);

      logger.info(`Loaded session state with ${state.sessions?.length || 0} sessions`);

      if (state.sessions) {
        this.nextSessionId = state.nextSessionId || 1;
        logger.info(`Next session ID set to ${this.nextSessionId}`);
      }

      return state;
    } catch (error) {
      if (error.code !== 'ENOENT') {
        logger.error(`Failed to load session state:`, error.message);
      }
      return null;
    }
  }

  /**
   * Gets session metadata.
   * @returns {object[]} An array of session metadata objects.
   */
  getSessionMetadata() {
    return this.sessions.map(session => ({
      id: session.id,
      browserInfo: session.browserInfo,
      workers: session.workers,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
      age: Date.now() - session.createdAt
    }));
  }

  /**
   * Safely closes only the pages managed (created) by this session.
   * @param {object} session - The session object.
   * @private
   */
  async closeManagedPages(session) {
    try {
      if (session.managedPages && session.managedPages.size > 0) {
        logger.info(`Closing ${session.managedPages.size} managed pages for session ${session.id}...`);

        const closePromises = Array.from(session.managedPages).map(async (page, _index) => {
          try {
            await page.close();
          } catch (_e) {
            // Ignore errors if page is already closed
            logger.debug(`[${session.id}] Error closing managed page: ${_e.message}`);
          }
        });

        await Promise.all(closePromises);
        session.managedPages.clear();
      }
    } catch (error) {
      logger.error(`Error closing managed pages for session ${session.id}:`, error);
    }
  }

  /**
   * Gracefully shuts down all sessions.
   * @returns {Promise<void>}
   */
  async shutdown() {
    logger.info(`Shutting down ${this.sessions.length} sessions...`);

    this.stopCleanupTimer();

    await this.saveSessionState();

    // Close managed pages first, then the browser connection
    const closePromises = this.sessions.map(async (session) => {
      await this.closeManagedPages(session);
      await this.closeSessionBrowser(session);
    });

    await Promise.allSettled(closePromises);

    this.sessions = [];
    this.workerLocks.clear();
    this.workerOccupancy.clear();
    this.workerWaiters.clear();
    logger.info(`Shutdown completed`);
  }
}

export default SessionManager;

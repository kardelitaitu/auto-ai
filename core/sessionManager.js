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
    this.concurrencyPerBrowser = 1;
    this.cleanupInterval = null;
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
      managedPages: new Set() // Track pages created by this session
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

  /**
   * Finds an idle worker in a specific session, marks it as busy, and returns it.
   * @param {string} sessionId - The ID of the session to check.
   * @returns {object | null} The worker object if found, otherwise null.
   */
  findAndOccupyIdleWorker(sessionId) {
    const session = this.sessions.find(s => s.id === sessionId);
    if (!session) return null;

    const worker = session.workers.find(w => w.status === 'idle');
    if (worker) {
      worker.status = 'busy';
      logger.debug(`Occupied worker ${worker.id} in session ${sessionId}`);
      return worker;
    }

    return null;
  }

  /**
   * Releases a worker in a specific session, setting its status to idle.
   * @param {string} sessionId - The ID of the session.
   * @param {number} workerId - The ID of the worker to release.
   */
  releaseWorker(sessionId, workerId) {
    const session = this.sessions.find(s => s.id === sessionId);
    if (session) {
      const worker = session.workers.find(w => w.id === workerId);
      if (worker) {
        worker.status = 'idle';
        session.lastActivity = Date.now();
        logger.debug(`Released worker ${worker.id} in session ${sessionId}`);
      } else {
        logger.warn(`Worker ${workerId} not found in session ${sessionId} to release.`);
      }
    } else {
      logger.warn(`Session ${sessionId} not found to release a worker.`);
    }
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
        this.closeSessionBrowser(session);
        return false;
      }
      return true;
    });

    const removedCount = initialLength - this.sessions.length;
    if (removedCount > 0) {
      logger.info(`Cleanup completed. Removed ${removedCount} timed-out sessions.`);
    }

    return removedCount;
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

        const closePromises = Array.from(session.managedPages).map(async (page, index) => {
          try {
            await page.close();
          } catch (e) {
            // Ignore errors if page is already closed
            logger.debug(`[${session.id}] Error closing managed page: ${e.message}`);
          }
        });

        await Promise.all(closePromises);
        session.managedPages.clear();
      }
    } catch (error) {
      logger.error(`Error closing managed pages for session ${session.id}:`, error.message);
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
    logger.info(`Shutdown completed`);
  }
}

export default SessionManager;

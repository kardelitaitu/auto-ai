/**
 * @fileoverview Manages browser sessions with SQLite persistence and Semaphore concurrency.
 * @module core/sessionManager
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import { createLogger } from '../utils/logger.js';
import { getTimeoutValue, getSettings } from '../utils/configLoader.js';
import metricsCollector from '../utils/metrics.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SESSION_DB_FILE = path.join(__dirname, '../data/sessions.db');
const logger = createLogger('sessionManager.js');

/**
 * @class Semaphore
 * @description Controls access to a shared resource with a counter.
 */
class Semaphore {
  constructor(initialPermits) {
    this.permits = initialPermits;
    this.queue = [];
  }

  async acquire(timeoutMs = null) {
    if (this.permits > 0) {
      this.permits--;
      return true;
    }

    return new Promise((resolve) => {
      const entry = { resolve, timer: null };
      if (timeoutMs) {
        entry.timer = setTimeout(() => {
          const idx = this.queue.indexOf(entry);
          if (idx !== -1) {
            this.queue.splice(idx, 1);
            resolve(false);
          }
        }, timeoutMs);
      }
      this.queue.push(entry);
    });
  }

  release() {
    this.permits++;
    if (this.queue.length > 0) {
      this.permits--;
      const { resolve, timer } = this.queue.shift();
      if (timer) clearTimeout(timer);
      resolve(true);
    }
  }
}

/**
 * @class SessionManager
 * @description Manages a pool of browser sessions with SQLite persistence and Semaphore concurrency.
 */
class SessionManager {
  constructor(options = {}) {
    this.sessions = [];
    this.nextSessionId = 1;

    // Concurrency & Timeouts
    this.sessionTimeoutMs = options.sessionTimeoutMs || 30 * 60 * 1000;
    this.cleanupIntervalMs = options.cleanupIntervalMs || 5 * 60 * 1000;
    this.workerLockTimeoutMs = options.workerLockTimeoutMs || 10000;
    this.workerWaitTimeoutMs = options.workerWaitTimeoutMs || 30000;
    this.concurrencyPerBrowser = 50;

    // Page Pool Config
    this.pagePoolMaxPerSession = options.pagePoolMaxPerSession || null;
    this.pagePoolIdleTimeoutMs = options.pagePoolIdleTimeoutMs || 5 * 60 * 1000;
    this.pagePoolHealthCheckIntervalMs = options.pagePoolHealthCheckIntervalMs || 30000;
    this.pagePoolHealthCheckTimeoutMs = options.pagePoolHealthCheckTimeoutMs || 5000;

    // Internal State
    this.workerSemaphores = new Map(); // sessionId -> Semaphore
    this.workerOccupancy = new Map(); // Track worker duration
    this.cleanupInterval = null;

    this._initDatabase();
    this.startCleanupTimer();
    this.loadConfiguration();
  }

  _initDatabase() {
    try {
      const dbDir = path.dirname(SESSION_DB_FILE);
      if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

      this.db = new Database(SESSION_DB_FILE);
      this.db.pragma('journal_mode = WAL');

      this.db.exec(`
        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          browserInfo TEXT,
          wsEndpoint TEXT,
          workers TEXT,
          createdAt INTEGER,
          lastActivity INTEGER
        );
        CREATE TABLE IF NOT EXISTS metadata (
          key TEXT PRIMARY KEY,
          value TEXT
        );
      `);
      logger.info(`Session database initialized at ${SESSION_DB_FILE}`);
    } catch (error) {
      logger.error(`Database initialization failed: ${error.message}`);
    }
  }

  _getSemaphore(sessionId, permits) {
    if (!this.workerSemaphores.has(sessionId)) {
      this.workerSemaphores.set(sessionId, new Semaphore(permits || this.concurrencyPerBrowser));
    }
    return this.workerSemaphores.get(sessionId);
  }

  async loadConfiguration() {
    try {
      const timeouts = await getTimeoutValue('session', {});
      const orchConfig = await getTimeoutValue('orchestration', {});
      const settings = await getSettings();

      this.sessionTimeoutMs = timeouts.timeoutMs || this.sessionTimeoutMs;
      this.cleanupIntervalMs = timeouts.cleanupIntervalMs || this.cleanupIntervalMs;

      this.workerLockTimeoutMs = orchConfig.workerLockTimeoutMs ?? this.workerLockTimeoutMs;
      this.workerWaitTimeoutMs = orchConfig.workerWaitTimeoutMs ?? this.workerWaitTimeoutMs;
      this.pagePoolMaxPerSession = orchConfig.pagePoolMaxPerSession ?? this.pagePoolMaxPerSession;
      this.pagePoolIdleTimeoutMs = orchConfig.pagePoolIdleTimeoutMs ?? this.pagePoolIdleTimeoutMs;
      this.pagePoolHealthCheckIntervalMs = orchConfig.pagePoolHealthCheckIntervalMs ?? this.pagePoolHealthCheckIntervalMs;
      this.pagePoolHealthCheckTimeoutMs = orchConfig.pagePoolHealthCheckTimeoutMs ?? this.pagePoolHealthCheckTimeoutMs;

      this.concurrencyPerBrowser = settings.concurrencyPerBrowser || this.concurrencyPerBrowser;

      logger.info(`SessionManager configured: session=${this.sessionTimeoutMs}ms, concurrency=${this.concurrencyPerBrowser}`);
    } catch (error) {
      logger.warn('Failed to load timeout configuration, using defaults:', error.message);
    }
  }

  get activeSessionsCount() {
    return this.sessions.filter(s => s.browser && s.browser.isConnected()).length;
  }

  get idleSessionsCount() {
    return this.sessions.filter(s =>
      s.browser &&
      s.browser.isConnected() &&
      s.workers.some(w => w.status === 'idle')
    ).length;
  }

  addSession(browser, browserInfo, wsEndpoint) {
    const id = browserInfo || `session-${this.nextSessionId++}`;
    const now = Date.now();

    // Prevent duplicate sessions for the same ID/Endpoint
    const existingIndex = this.sessions.findIndex(s => s.id === id || s.wsEndpoint === wsEndpoint);
    if (existingIndex !== -1) {
      logger.info(`Session ${id} already exists. Updating browser instance.`);
      const existing = this.sessions[existingIndex];
      existing.browser = browser;
      existing.wsEndpoint = wsEndpoint || existing.wsEndpoint;
      existing.lastActivity = now;
      return id;
    }

    const workers = Array.from({ length: this.concurrencyPerBrowser }, (_, i) => ({
      id: i,
      status: 'idle',
    }));

    const session = {
      id,
      browser,
      browserInfo,
      wsEndpoint: wsEndpoint || browserInfo,
      workers,
      createdAt: now,
      lastActivity: now,
      managedPages: new Set(),
      pagePool: [],
      sharedContext: null
    };

    this.sessions.push(session);
    this._getSemaphore(id, this.concurrencyPerBrowser);

    logger.info(`Session added: ${id} with ${this.concurrencyPerBrowser} slots.`);
    this.saveSessionState();
    metricsCollector.recordSessionEvent('created', this.sessions.length);
    return id;
  }

  /**
   * Replaces the browser instance for an existing session identified by its WebSocket endpoint.
   * Useful during reconnection events.
   * @param {string} wsEndpoint - The WebSocket endpoint.
   * @param {object} newBrowser - The new Playwright browser instance.
   * @returns {Promise<boolean>}
   */
  async replaceBrowserByEndpoint(wsEndpoint, newBrowser) {
    const session = this.sessions.find(s => s.wsEndpoint === wsEndpoint);
    if (session) {
      logger.info(`Replacing browser for session ${session.id} due to reconnection.`);
      session.browser = newBrowser;
      session.lastActivity = Date.now();
      await this.saveSessionState();
      return true;
    }
    return false;
  }

  /**
   * Marks a session as failed, typically by removing it.
   * @param {string} sessionId - The session ID.
   * @returns {boolean}
   */
  markSessionFailed(sessionId) {
    logger.warn(`Session ${sessionId} marked as failed, removing...`);
    return this.removeSession(sessionId);
  }

  removeSession(sessionId) {
    const index = this.sessions.findIndex(s => s.id === sessionId);
    if (index !== -1) {
      const session = this.sessions[index];
      this.closeManagedPages(session).catch(() => { });
      this.closeSessionBrowser(session).catch(() => { });
      this.workerSemaphores.delete(session.id);
      this.sessions.splice(index, 1);
      this.saveSessionState();
      metricsCollector.recordSessionEvent('closed', this.sessions.length);
      logger.info(`Session removed: ${sessionId}`);
      return true;
    }
    return false;
  }

  registerPage(sessionId, page) {
    const session = this.sessions.find(s => s.id === sessionId);
    if (session) session.managedPages.add(page);
  }

  unregisterPage(sessionId, page) {
    const session = this.sessions.find(s => s.id === sessionId);
    if (session) session.managedPages.delete(page);
  }

  _normalizePoolEntry(entry, now) {
    if (entry && typeof entry === 'object' && 'page' in entry) return entry;
    return { page: entry, lastUsedAt: now, lastHealthCheckAt: 0 };
  }

  async _isPageHealthy(page) {
    if (!page || (typeof page.isClosed === 'function' && page.isClosed())) return false;
    try {
      const result = await Promise.race([
        page.evaluate(() => ({ ready: document.readyState === 'complete', body: !!document.body })),
        new Promise((_, r) => setTimeout(() => r(new Error('timeout')), this.pagePoolHealthCheckTimeoutMs))
      ]);
      return result?.ready || result?.body;
    } catch {
      return false;
    }
  }

  _closePooledPage(sessionId, page) {
    if (!page) return;
    if (typeof page.close === 'function') Promise.resolve(page.close()).catch(() => { });
    this.unregisterPage(sessionId, page);
  }

  async acquirePage(sessionId, context) {
    const session = this.sessions.find(s => s.id === sessionId);
    if (!session || !context) return null;

    const now = Date.now();
    while (session.pagePool.length > 0) {
      const entry = this._normalizePoolEntry(session.pagePool.pop(), now);
      if (!entry.page || (entry.page.isClosed && entry.page.isClosed())) continue;

      if (this.pagePoolIdleTimeoutMs && now - entry.lastUsedAt > this.pagePoolIdleTimeoutMs) {
        this._closePooledPage(sessionId, entry.page);
        continue;
      }

      if (now - entry.lastHealthCheckAt > this.pagePoolHealthCheckIntervalMs) {
        if (!(await this._isPageHealthy(entry.page))) {
          this._closePooledPage(sessionId, entry.page);
          continue;
        }
      }
      return entry.page;
    }

    const page = await context.newPage();
    this.registerPage(sessionId, page);
    return page;
  }

  async releasePage(sessionId, page) {
    const session = this.sessions.find(s => s.id === sessionId);
    if (!session || !page || (page.isClosed && page.isClosed())) return;

    const maxPoolSize = this.pagePoolMaxPerSession || this.concurrencyPerBrowser || 1;
    if (session.pagePool.length >= maxPoolSize) {
      Promise.resolve(page.close()).catch(() => { });
      this.unregisterPage(sessionId, page);
      return;
    }

    if (await this._isPageHealthy(page)) {
      session.pagePool.push({ page, lastUsedAt: Date.now(), lastHealthCheckAt: Date.now() });
    } else {
      this._closePooledPage(sessionId, page);
    }
  }

  async acquireWorker(sessionId, options = {}) {
    const session = this.sessions.find(s => s.id === sessionId);
    if (!session) return null;

    const sem = this._getSemaphore(sessionId);
    const timeoutMs = options.timeoutMs ?? this.workerWaitTimeoutMs;

    try {
      if (!(await sem.acquire(timeoutMs))) {
        logger.warn(`Acquire timeout for session ${sessionId}`);
        return null;
      }
    } catch (err) {
      logger.error(`Error acquiring semaphore for ${sessionId}:`, err.message);
      return null;
    }

    const worker = session.workers.find(w => w.status === 'idle');
    if (!worker) {
      sem.release();
      return null;
    }

    worker.status = 'busy';
    worker.occupiedAt = Date.now();
    this.workerOccupancy.set(`${sessionId}:${worker.id}`, { startTime: worker.occupiedAt });
    return worker;
  }

  async releaseWorker(sessionId, workerId) {
    const session = this.sessions.find(s => s.id === sessionId);
    if (!session) return;

    const worker = session.workers.find(w => w.id === workerId);
    if (worker && worker.status === 'busy') {
      worker.status = 'idle';
      const duration = Date.now() - (worker.occupiedAt || 0);
      worker.occupiedAt = null;
      session.lastActivity = Date.now();
      this.workerOccupancy.delete(`${sessionId}:${workerId}`);
      this._getSemaphore(sessionId).release();
      logger.debug(`Released worker ${workerId} in ${sessionId} (${duration}ms)`);
    }
  }

  async saveSessionState() {
    if (!this.db) return;
    try {
      const upsert = this.db.prepare(`INSERT OR REPLACE INTO sessions (id, browserInfo, wsEndpoint, workers, createdAt, lastActivity) VALUES (?, ?, ?, ?, ?, ?)`);
      const transaction = this.db.transaction((sessions) => {
        for (const s of sessions) {
          upsert.run(s.id, s.browserInfo, s.wsEndpoint, JSON.stringify(s.workers), s.createdAt, s.lastActivity);
        }
      });
      transaction(this.sessions);

      const updateMeta = this.db.prepare('INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)');
      updateMeta.run('nextSessionId', this.nextSessionId.toString());
      updateMeta.run('savedAt', Date.now().toString());
    } catch (e) {
      logger.error(`Failed to save state: ${e.message}`);
    }
  }

  async loadSessionState() {
    if (!this.db) return null;
    try {
      const rows = this.db.prepare('SELECT * FROM sessions').all();
      const meta = this.db.prepare('SELECT * FROM metadata').all().reduce((acc, row) => ({ ...acc, [row.key]: row.value }), {});

      this.nextSessionId = parseInt(meta.nextSessionId || '1');
      this.sessions = rows.map(r => ({
        ...r,
        browser: null,
        workers: JSON.parse(r.workers),
        managedPages: new Set(),
        pagePool: [],
        sharedContext: null
      }));
      for (const s of this.sessions) this._getSemaphore(s.id);
      return { sessions: this.sessions, nextSessionId: this.nextSessionId };
    } catch (_e) {
      return null;
    }
  }

  cleanupTimedOutSessions() {
    const now = Date.now();
    const initial = this.sessions.length;

    this.sessions = this.sessions.filter(session => {
      if (now - session.lastActivity > this.sessionTimeoutMs) {
        logger.info(`Session ${session.id} timed out. cleaning up...`);
        this.closeManagedPages(session).catch(() => { });
        this.closeSessionBrowser(session).catch(() => { });
        this.workerSemaphores.delete(session.id);
        return false;
      }
      return true;
    });

    if (this.sessions.length < initial) {
      this.saveSessionState();
      metricsCollector.recordSessionEvent('closed', this.sessions.length);
    }
    this.cleanupIdlePages();
    return initial - this.sessions.length;
  }

  async cleanupIdlePages() {
    const now = Date.now();
    for (const session of this.sessions) {
      if (!session.pagePool) session.pagePool = [];
      session.pagePool = session.pagePool.filter(entry => {
        const normalized = this._normalizePoolEntry(entry, now);
        if (!normalized.page || (normalized.page.isClosed && normalized.page.isClosed())) return false;
        if (this.pagePoolIdleTimeoutMs && now - normalized.lastUsedAt > this.pagePoolIdleTimeoutMs) {
          this._closePooledPage(session.id, normalized.page);
          return false;
        }
        return true;
      });
    }
  }

  async closeSessionBrowser(session) {
    if (session.browser?.close) await Promise.resolve(session.browser.close()).catch(() => { });
  }

  async closeManagedPages(session) {
    if (!session.managedPages) return;
    const promises = Array.from(session.managedPages).map(p => Promise.resolve(p.close()).catch(() => { }));
    await Promise.all(promises);
    session.managedPages.clear();
  }

  startCleanupTimer() {
    this.cleanupInterval = setInterval(() => this.cleanupTimedOutSessions(), this.cleanupIntervalMs);
  }

  stopCleanupTimer() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  async shutdown() {
    clearInterval(this.cleanupInterval);
    await this.saveSessionState();
    const promises = this.sessions.map(async s => {
      await this.closeManagedPages(s);
      await this.closeSessionBrowser(s);
    });
    await Promise.allSettled(promises);
    if (this.db) this.db.close();
    logger.info('SessionManager shutdown complete.');
  }

  getAllSessions() { return this.sessions; }
  getSessionMetadata() {
    return this.sessions.map(s => ({ ...s, age: Date.now() - s.createdAt }));
  }
}

export default SessionManager;

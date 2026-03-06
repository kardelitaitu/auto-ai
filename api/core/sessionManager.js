/**
 * @fileoverview Session Manager - Robust worker management with health monitoring.
 * @module core/sessionManager
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import { createLogger } from '../core/logger.js';
import { getTimeoutValue, getSettings } from '../utils/configLoader.js';
import metricsCollector from '../utils/metrics.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SESSION_DB_FILE = path.join(__dirname, '../../data/sessions.db');
const logger = createLogger('sessionManager.js');

export class SimpleSemaphore {
  constructor(permits) {
    this.permits = permits;
    this.maxPermits = permits;
    this.queue = [];
  }

  async acquire(timeoutMs = null) {
    if (this.permits > 0) {
      this.permits--;
      return true;
    }

    return new Promise((resolve) => {
      const entry = { resolve, timer: null, addedAt: Date.now() };

      if (timeoutMs) {
        entry.timer = setTimeout(() => {
          const idx = this.queue.indexOf(entry);
          if (idx !== -1) {
            this.queue.splice(idx, 1);
            logger.debug(`Semaphore acquire timed out after ${timeoutMs}ms`);
            resolve(false);
          }
        }, timeoutMs);
      }

      this.queue.push(entry);
    });
  }

  release() {
    if (this.queue.length > 0) {
      const { resolve, timer } = this.queue.shift();
      if (timer) clearTimeout(timer);
      resolve(true);
    } else {
      this.permits = Math.min(this.permits + 1, this.maxPermits);
    }
  }

  get availablePermits() {
    return this.permits;
  }

  get queuedCount() {
    return this.queue.length;
  }
}

class SessionManager {
  constructor(options = {}) {
    this.sessions = [];
    this.nextSessionId = 1;

    this.sessionTimeoutMs = options.sessionTimeoutMs || 30 * 60 * 1000;
    this.cleanupIntervalMs = options.cleanupIntervalMs || 5 * 60 * 1000;
    this.workerWaitTimeoutMs = options.workerWaitTimeoutMs || 30000;
    this.stuckWorkerThresholdMs = options.stuckWorkerThresholdMs || 600000;
    this.concurrencyPerBrowser = 10; // Default lowered from 50 to protect PC resources

    this.pagePoolMaxPerSession = options.pagePoolMaxPerSession || null;
    this.pagePoolIdleTimeoutMs = options.pagePoolIdleTimeoutMs || 5 * 60 * 1000;
    this.pagePoolHealthCheckIntervalMs = options.pagePoolHealthCheckIntervalMs || 30000;
    this.pagePoolHealthCheckTimeoutMs = options.pagePoolHealthCheckTimeoutMs || 5000;

    this.workerSemaphores = new Map();
    this.workerOccupancy = new Map();
    this.workerHealthCheckInterval = null;
    this.cleanupInterval = null;

    this._initDatabase();
    this._startWorkerHealthChecks();
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
      logger.info(`[SessionManager] Database initialized at ${SESSION_DB_FILE}`);
    } catch (error) {
      logger.error(`[SessionManager] Database init failed: ${error.message}`);
    }
  }

  _getSemaphore(sessionId, permits) {
    if (!this.workerSemaphores.has(sessionId)) {
      this.workerSemaphores.set(sessionId, new SimpleSemaphore(permits || this.concurrencyPerBrowser));
    }
    return this.workerSemaphores.get(sessionId);
  }

  _startWorkerHealthChecks() {
    if (this.workerHealthCheckInterval) return;

    this.workerHealthCheckInterval = setInterval(async () => {
      await this._checkStuckWorkers();
    }, 30000);
  }

  async _checkStuckWorkers() {
    const now = Date.now();
    const stuckWorkers = [];

    for (const session of this.sessions) {
      if (!session.browser?.isConnected()) continue;

      for (const worker of session.workers) {
        if (worker.status === 'busy' && worker.occupiedAt) {
          const elapsed = now - worker.occupiedAt;
          if (elapsed > this.stuckWorkerThresholdMs) {
            stuckWorkers.push({
              sessionId: session.id,
              workerId: worker.id,
              elapsed
            });
          }
        }
      }
    }

    if (stuckWorkers.length > 0) {
      logger.warn(`[SessionManager] Found ${stuckWorkers.length} stuck workers, force releasing...`);
      for (const sw of stuckWorkers) {
        await this.forceReleaseWorker(sw.sessionId, sw.workerId);
      }
    }
  }

  async loadConfiguration() {
    try {
      const timeouts = await getTimeoutValue('session', {});
      const orchConfig = await getTimeoutValue('orchestration', {});
      const settings = await getSettings();

      this.sessionTimeoutMs = timeouts.timeoutMs || this.sessionTimeoutMs;
      this.cleanupIntervalMs = timeouts.cleanupIntervalMs || this.cleanupIntervalMs;
      this.workerWaitTimeoutMs = orchConfig.workerWaitTimeoutMs ?? this.workerWaitTimeoutMs;
      this.stuckWorkerThresholdMs = orchConfig.workerStuckThresholdMs ?? this.stuckWorkerThresholdMs;
      this.pagePoolMaxPerSession = orchConfig.pagePoolMaxPerSession ?? this.pagePoolMaxPerSession;
      this.pagePoolIdleTimeoutMs = orchConfig.pagePoolIdleTimeoutMs ?? this.pagePoolIdleTimeoutMs;
      this.concurrencyPerBrowser = settings.concurrencyPerBrowser || this.concurrencyPerBrowser;

      logger.info(`[SessionManager] Configured: session=${this.sessionTimeoutMs}ms, concurrency=${this.concurrencyPerBrowser}`);
    } catch (error) {
      logger.warn('[SessionManager] Config load failed:', error.message);
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

    const existingIndex = this.sessions.findIndex(s => s.id === id || s.wsEndpoint === wsEndpoint);
    if (existingIndex !== -1) {
      logger.info(`[SessionManager] Session ${id} exists, updating browser`);
      const existing = this.sessions[existingIndex];
      existing.browser = browser;
      existing.wsEndpoint = wsEndpoint || existing.wsEndpoint;
      existing.lastActivity = now;
      return id;
    }

    const workers = Array.from({ length: this.concurrencyPerBrowser }, (_, i) => ({
      id: i,
      status: 'idle',
      occupiedAt: null,
      acquiredBy: null
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

    logger.info(`[SessionManager] Session added: ${id} (${this.concurrencyPerBrowser} workers)`);
    this.saveSessionState();
    metricsCollector.recordSessionEvent('created', this.sessions.length);
    return id;
  }

  async replaceBrowserByEndpoint(wsEndpoint, newBrowser) {
    const session = this.sessions.find(s => s.wsEndpoint === wsEndpoint);
    if (session) {
      logger.info(`[SessionManager] Replacing browser for ${session.id}`);
      session.browser = newBrowser;
      session.lastActivity = Date.now();
      await this.saveSessionState();
      return true;
    }
    return false;
  }

  markSessionFailed(sessionId) {
    logger.warn(`[SessionManager] Session ${sessionId} marked failed, removing`);
    return this.removeSession(sessionId);
  }

  removeSession(sessionId) {
    const index = this.sessions.findIndex(s => s.id === sessionId);
    if (index !== -1) {
      const session = this.sessions[index];
      this.closeManagedPages(session).catch(() => { });
      this.closeSessionBrowser(session).catch(() => { });
      this.workerSemaphores.delete(sessionId);
      this.sessions.splice(index, 1);
      this.saveSessionState();
      metricsCollector.recordSessionEvent('closed', this.sessions.length);
      logger.info(`[SessionManager] Session removed: ${sessionId}`);
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
        const healthy = await this._isPageHealthy(entry.page);
        if (!healthy) {
          this._closePooledPage(sessionId, entry.page);
          continue;
        }
        entry.lastHealthCheckAt = now;
      }

      this.registerPage(sessionId, entry.page);
      return entry.page;
    }

    const page = await context.newPage();
    this.registerPage(sessionId, page);
    return page;
  }

  async releasePage(sessionId, page) {
    const session = this.sessions.find(s => s.id === sessionId);
    if (!session) return;

    if (!page || (page.isClosed && page.isClosed())) return;

    if (this.pagePoolMaxPerSession && session.pagePool.length >= this.pagePoolMaxPerSession) {
      await page.close().catch(() => { });
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
        logger.warn(`[SessionManager] Acquire timeout for ${sessionId}`);
        return null;
      }
    } catch (err) {
      logger.error(`[SessionManager] Semaphore error for ${sessionId}:`, err.message);
      return null;
    }

    const worker = session.workers.find(w => w.status === 'idle');
    if (!worker) {
      sem.release();
      return null;
    }

    worker.status = 'busy';
    worker.occupiedAt = Date.now();
    worker.acquiredBy = `session-${Date.now()}`;
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
      worker.acquiredBy = null;
      session.lastActivity = Date.now();
      this.workerOccupancy.delete(`${sessionId}:${workerId}`);
      this._getSemaphore(sessionId).release();
      logger.debug(`[SessionManager] Released worker ${workerId} in ${sessionId} (${duration}ms)`);
    }
  }

  async forceReleaseWorker(sessionId, workerId) {
    const session = this.sessions.find(s => s.id === sessionId);
    if (!session) return false;

    const worker = session.workers.find(w => w.id === workerId);
    if (worker) {
      worker.status = 'idle';
      worker.occupiedAt = null;
      worker.acquiredBy = null;
      this.workerOccupancy.delete(`${sessionId}:${workerId}`);
      this._getSemaphore(sessionId).release();
      logger.warn(`[SessionManager] Force released worker ${workerId} in ${sessionId}`);
      return true;
    }
    return false;
  }

  getWorkerHealth(sessionId) {
    const session = this.sessions.find(s => s.id === sessionId);
    if (!session) return null;

    const now = Date.now();
    const workers = session.workers.map(w => ({
      id: w.id,
      status: w.status,
      occupiedAt: w.occupiedAt,
      elapsed: w.occupiedAt ? now - w.occupiedAt : 0,
      isStuck: w.status === 'busy' && w.occupiedAt && (now - w.occupiedAt) > this.stuckWorkerThresholdMs
    }));

    return {
      sessionId,
      total: workers.length,
      busy: workers.filter(w => w.status === 'busy').length,
      idle: workers.filter(w => w.status === 'idle').length,
      stuck: workers.filter(w => w.isStuck).length,
      workers
    };
  }

  getAllWorkerHealth() {
    return this.sessions.map(s => this.getWorkerHealth(s.id)).filter(Boolean);
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
      logger.error(`[SessionManager] Save state failed: ${e.message}`);
    }
  }

  async loadSessionState() {
    if (!this.db) return null;
    try {
      const rows = this.db.prepare('SELECT * FROM sessions').all();
      const meta = this.db.prepare('SELECT * FROM metadata').all().reduce((acc, row) => ({ ...acc, [row.key]: row.value }), {});
      logger.info(`[SessionManager] Loaded ${rows.length} sessions from DB`);
      return { rows, meta };
    } catch (e) {
      logger.error(`[SessionManager] Load state failed: ${e.message}`);
      return null;
    }
  }

  async closeManagedPages(session) {
    if (!session?.managedPages) return;
    for (const page of session.managedPages) {
      try { await page.close(); } catch (_e) { /* ignore close error */ }
    }
    session.managedPages.clear();
  }

  async closeSessionBrowser(session) {
    if (session?.browser) {
      try { await session.browser.close(); } catch (_e) { /* ignore close error */ }
    }
  }

  /**
   * Stop the cleanup timer (for test cleanup)
   */
  stopCleanupTimer() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Clean up timed out sessions
   * @returns {Promise<number>} Number of sessions removed
   */
  async cleanupTimedOutSessions() {
    const now = Date.now();
    const initialCount = this.sessions.length;
    this.sessions = this.sessions.filter(s =>
      now - s.lastActivity < this.sessionTimeoutMs
    );
    return initialCount - this.sessions.length;
  }

  async shutdown() {
    logger.info('[SessionManager] SessionManager shutting down...');

    if (this.workerHealthCheckInterval) {
      clearInterval(this.workerHealthCheckInterval);
      this.workerHealthCheckInterval = null;
    }

    for (const session of this.sessions) {
      await this.closeManagedPages(session);
      await this.closeSessionBrowser(session);
    }

    this.sessions = [];
    this.workerSemaphores.clear();
    this.workerOccupancy.clear();

    if (this.db) {
      this.db.close();
      this.db = null;
    }

    logger.info('[SessionManager] SessionManager shutdown complete');
  }

  getAllSessions() {
    return this.sessions;
  }

  getSession(sessionId) {
    return this.sessions.find(s => s.id === sessionId);
  }
}

export default SessionManager;

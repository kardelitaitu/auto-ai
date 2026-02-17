import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SessionManager from '../../core/sessionManager.js';
import fs from 'fs/promises';
import path from 'path';
import * as configLoader from '../../utils/configLoader.js';

// Mocks
const { mockLoggerInstance } = vi.hoisted(() => ({
  mockLoggerInstance: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

vi.mock('fs/promises');
vi.mock('../../utils/logger.js', () => ({
  createLogger: vi.fn(() => mockLoggerInstance)
}));
vi.mock('../../utils/configLoader.js', () => ({
  getTimeoutValue: vi.fn(),
  getSettings: vi.fn()
}));
vi.mock('../../utils/metrics.js', () => ({
  default: {
    recordSessionEvent: vi.fn()
  }
}));

describe('SessionManager', () => {
  let sessionManager;
  let mockLogger;
  let mockConfigLoader;
  let mockMetrics;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockLogger = mockLoggerInstance;
    
    // Setup default mock returns
    const configLoader = await import('../../utils/configLoader.js');
    configLoader.getTimeoutValue.mockResolvedValue({ timeoutMs: 30000, cleanupIntervalMs: 5000 });
    configLoader.getSettings.mockResolvedValue({ concurrencyPerBrowser: 2 });
    
    mockMetrics = (await import('../../utils/metrics.js')).default;
    
    sessionManager = new SessionManager();
    await sessionManager.loadConfiguration();
  });

  afterEach(() => {
    sessionManager.stopCleanupTimer();
  });

  describe('Initialization', () => {
    it('should initialize with default values', () => {
      expect(sessionManager.sessions).toEqual([]);
      expect(sessionManager.nextSessionId).toBe(1);
      expect(sessionManager.cleanupInterval).toBeDefined();
    });

    it('should load configuration during init', async () => {
      expect(sessionManager.sessionTimeoutMs).toBe(30000);
      expect(sessionManager.cleanupIntervalMs).toBe(5000);
      expect(sessionManager.concurrencyPerBrowser).toBe(2);
    });

    it('should handle configuration load failure', async () => {
      // This test requires a fresh instance to test an initial configuration failure,
      // separate from the successfully configured instance in `beforeEach`.
      sessionManager.stopCleanupTimer(); // Clean up the `beforeEach` instance's timer.

      const configLoader = await import('../../utils/configLoader.js');
      configLoader.getTimeoutValue.mockRejectedValue(new Error('Config Error'));
      
      const newSessionManager = new SessionManager();
      await newSessionManager.loadConfiguration();

      // Should fall back to defaults, not throw
      expect(newSessionManager.sessionTimeoutMs).toBeDefined();
    });
  });

  describe('Session Management', () => {
    let mockBrowser;

    beforeEach(() => {
      mockBrowser = {
        close: vi.fn(),
        contexts: vi.fn().mockReturnValue([])
      };
    });

    it('should add a session', () => {
      const id = sessionManager.addSession(mockBrowser, 'profile1');
      expect(id).toBe('profile1');
      expect(sessionManager.sessions).toHaveLength(1);
      expect(sessionManager.sessions[0].workers).toHaveLength(2); // Default is 1 before init loaded 2
      expect(mockMetrics.recordSessionEvent).toHaveBeenCalledWith('created', 1);
    });

    it('should generate session ID if no browserInfo provided', () => {
      const id = sessionManager.addSession(mockBrowser);
      expect(id).toMatch(/^session-\d+$/);
    });

    it('should remove a session', () => {
      const id = sessionManager.addSession(mockBrowser);
      const removed = sessionManager.removeSession(id);
      expect(removed).toBe(true);
      expect(sessionManager.sessions).toHaveLength(0);
      expect(mockMetrics.recordSessionEvent).toHaveBeenCalledWith('closed', 0);
    });

    it('should return false when removing non-existent session', () => {
      const removed = sessionManager.removeSession('non-existent');
      expect(removed).toBe(false);
    });
    
    it('should get active sessions count', () => {
      sessionManager.addSession(mockBrowser);
      sessionManager.addSession(mockBrowser);
      expect(sessionManager.activeSessionsCount).toBe(2);
    });
    
    it('should get all sessions', () => {
      sessionManager.addSession(mockBrowser);
      expect(sessionManager.getAllSessions()).toHaveLength(1);
    });
  });

  describe('Worker Allocation', () => {
    let sessionId;
    let mockBrowser;

    beforeEach(async () => {
      mockBrowser = { close: vi.fn() };
      // Ensure concurrency is 1 for deterministic testing unless updated
      sessionManager.concurrencyPerBrowser = 1;
      sessionId = sessionManager.addSession(mockBrowser);
    });

    it('should find and occupy an idle worker', async () => {
      const worker = await sessionManager.findAndOccupyIdleWorker(sessionId);
      expect(worker).toBeDefined();
      expect(worker.status).toBe('busy');
      expect(worker.occupiedAt).toBeDefined();
    });

    it('should return null if no idle workers', async () => {
      // Occupy the only worker
      await sessionManager.findAndOccupyIdleWorker(sessionId);
      
      // Try to occupy again
      const worker = await sessionManager.findAndOccupyIdleWorker(sessionId);
      expect(worker).toBeNull();
    });

    it('should handle non-existent session for worker allocation', async () => {
      const worker = await sessionManager.findAndOccupyIdleWorker('invalid-id');
      expect(worker).toBeNull();
    });

    it('should release a worker', async () => {
      const worker = await sessionManager.findAndOccupyIdleWorker(sessionId);
      expect(worker.status).toBe('busy');

      await sessionManager.releaseWorker(sessionId, worker.id);
      expect(worker.status).toBe('idle');
      expect(worker.occupiedAt).toBeNull();
    });

    it('should handle releasing non-existent worker or session', async () => {
      await sessionManager.releaseWorker('invalid-id', 0);
      // Should not throw
      
      await sessionManager.releaseWorker(sessionId, 999);
      // Should not throw
    });
    
    it('should handle worker lock timeout', async () => {
      // Occupy the worker so the next call will wait for the lock
      await sessionManager.findAndOccupyIdleWorker(sessionId);

      // Reduce the timeout for this specific test
      sessionManager.workerLockTimeoutMs = 10;

      // Replace the lock promise with a promise that never resolves
      sessionManager.workerLocks.set(sessionId, new Promise(() => {}));

      await expect(sessionManager.findAndOccupyIdleWorker(sessionId))
        .rejects.toThrow('Worker lock timeout');

      // Restore the original timeout
      sessionManager.workerLockTimeoutMs = 10000;
    }, 200);
  });

  describe('Page Management', () => {
    let sessionId;
    let mockBrowser;
    let mockPage;

    beforeEach(() => {
      mockBrowser = { close: vi.fn() };
      sessionId = sessionManager.addSession(mockBrowser);
      mockPage = { close: vi.fn() };
    });

    it('should register and unregister a page', () => {
      sessionManager.registerPage(sessionId, mockPage);
      expect(sessionManager.sessions[0].managedPages.has(mockPage)).toBe(true);

      sessionManager.unregisterPage(sessionId, mockPage);
      expect(sessionManager.sessions[0].managedPages.has(mockPage)).toBe(false);
    });

    it('should handle register/unregister for non-existent session', () => {
      sessionManager.registerPage('invalid', mockPage);
      sessionManager.unregisterPage('invalid', mockPage);
      // Should not throw
    });
  });

  describe('Cleanup', () => {
    let mockBrowser;
    let sessionId;

    beforeEach(() => {
      mockBrowser = { close: vi.fn() };
      sessionId = sessionManager.addSession(mockBrowser);
      sessionManager.sessionTimeoutMs = 1000; // 1 second
    });

    it('should cleanup timed out sessions', async () => {
      const session = sessionManager.sessions[0];
      session.lastActivity = Date.now() - 2000; // Timed out

      const count = await sessionManager.cleanupTimedOutSessions();
      expect(count).toBe(1);
      expect(mockBrowser.close).toHaveBeenCalled();
      expect(sessionManager.sessions).toHaveLength(0);
    });

    it('should not cleanup active sessions', async () => {
      const session = sessionManager.sessions[0];
      session.lastActivity = Date.now(); // Active

      const count = await sessionManager.cleanupTimedOutSessions();
      expect(count).toBe(0);
      expect(mockBrowser.close).not.toHaveBeenCalled();
      expect(sessionManager.sessions).toHaveLength(1);
    });
    
    it('should close managed pages during cleanup', async () => {
      const session = sessionManager.sessions[0];
      session.lastActivity = 0; // Force timeout
      
      const mockPage = { close: vi.fn() };
      session.managedPages.add(mockPage);
      
      await sessionManager.cleanupTimedOutSessions();
      
      expect(mockPage.close).toHaveBeenCalled();
    });
    
    it('should handle error during page close', async () => {
       const session = sessionManager.sessions[0];
       session.lastActivity = Date.now() - 2000;
       
       const mockPage = { close: vi.fn().mockRejectedValue(new Error('Close Error')) };
       session.managedPages.add(mockPage);
       
       await sessionManager.cleanupTimedOutSessions();
       // Should not throw
    });
    
    it('should handle error during browser close', async () => {
       const session = sessionManager.sessions[0];
       session.lastActivity = Date.now() - 2000;
       mockBrowser.close.mockRejectedValue(new Error('Browser Close Error'));
       
       await sessionManager.cleanupTimedOutSessions();
       // Should not throw
    });
  });

  describe('Persistence', () => {
    it('should save session state', async () => {
      await sessionManager.saveSessionState();
      expect(fs.mkdir).toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should handle error saving state', async () => {
      fs.writeFile.mockRejectedValue(new Error('Write Error'));
      await sessionManager.saveSessionState();
      // Should not throw
    });

    it('should load session state', async () => {
      const mockState = {
        sessions: [],
        nextSessionId: 5
      };
      fs.readFile.mockResolvedValue(JSON.stringify(mockState));

      const state = await sessionManager.loadSessionState();
      expect(state).toEqual(mockState);
      expect(sessionManager.nextSessionId).toBe(5);
    });

    it('should handle missing state file', async () => {
      const error = new Error('ENOENT');
      error.code = 'ENOENT';
      fs.readFile.mockRejectedValue(error);

      const state = await sessionManager.loadSessionState();
      expect(state).toBeNull();
    });

    it('should handle corrupted state file', async () => {
      fs.readFile.mockResolvedValue('invalid json');
      
      const state = await sessionManager.loadSessionState();
      expect(state).toBeNull();
    });
  });

  describe('Shutdown', () => {
    it('should shutdown gracefully', async () => {
      const mockBrowser = { close: vi.fn() };
      sessionManager.addSession(mockBrowser);
      
      vi.spyOn(sessionManager, 'saveSessionState').mockResolvedValue();
      
      await sessionManager.shutdown();
      
      expect(sessionManager.sessions).toHaveLength(0);
      expect(mockBrowser.close).toHaveBeenCalled();
      expect(sessionManager.cleanupInterval).toBeNull();
    });
  });
  
  describe('Diagnostics', () => {
    it('should get session metadata', () => {
       const mockBrowser = { close: vi.fn() };
       sessionManager.addSession(mockBrowser);
       
       const metadata = sessionManager.getSessionMetadata();
       expect(metadata).toHaveLength(1);
       expect(metadata[0]).toHaveProperty('age');
    });
    
    it('should get stuck workers', async () => {
       const mockBrowser = { close: vi.fn() };
       const id = sessionManager.addSession(mockBrowser);
       const worker = await sessionManager.findAndOccupyIdleWorker(id);
       
       // Manually adjust start time in occupancy map
       const key = `${id}:${worker.id}`;
       const info = sessionManager.workerOccupancy.get(key);
       info.startTime = Date.now() - 61000; // > 60s
       
       const stuck = sessionManager.getStuckWorkers(60000);
       expect(stuck).toHaveLength(1);
       expect(stuck[0].workerId).toBe(worker.id);
    });
    
    it('should get worker occupancy', async () => {
       const mockBrowser = { close: vi.fn() };
       const id = sessionManager.addSession(mockBrowser);
       await sessionManager.findAndOccupyIdleWorker(id);
       
       const occupancy = sessionManager.getWorkerOccupancy(id);
       expect(Object.keys(occupancy)).toHaveLength(1);
    });

    it('should return unknown if stack trace unavailable', () => {
      const originalError = global.Error;
      const MockError = class {
        constructor(message) {
            this.message = message;
            this.stack = null;
        }
      };
      vi.stubGlobal('Error', MockError);
      
      const context = sessionManager._getCurrentExecutionContext();
      expect(context).toBe('unknown');
      
      vi.stubGlobal('Error', originalError);
    });

    it('should handle error when accessing stack trace', () => {
      const originalError = global.Error;
      const MockError = class {
        constructor(message) {
            this.message = message;
            Object.defineProperty(this, 'stack', {
                get: () => { throw new Error('Stack access error'); }
            });
        }
      };
      vi.stubGlobal('Error', MockError);
      
      const context = sessionManager._getCurrentExecutionContext();
      expect(context).toBe('unknown');
      
      vi.stubGlobal('Error', originalError);
    });

    it('should trigger cleanupTimedOutSessions on interval', () => {
      vi.useFakeTimers();
      const spy = vi.spyOn(sessionManager, 'cleanupTimedOutSessions');
      sessionManager.startCleanupTimer();
      
      vi.advanceTimersByTime(sessionManager.cleanupIntervalMs + 100);
      expect(spy).toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('should handle outer error in closeManagedPages', async () => {
       const mockBrowser = { close: vi.fn() };
       sessionManager.addSession(mockBrowser);
       const session = sessionManager.sessions[0];
       // Make managedPages iterable throw
       Object.defineProperty(session, 'managedPages', {
           get: () => ({
               size: 1,
               [Symbol.iterator]: () => { throw new Error('Iteration Error'); }
           })
       });
       
       session.lastActivity = 0; // force cleanup
       await sessionManager.cleanupTimedOutSessions();
       
       expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Error closing managed pages'), expect.any(Error));
    });

    it('should return stuck workers if duration exceeds threshold', () => {
      const now = Date.now();
      sessionManager.workerOccupancy.set('session-1:0', {
        startTime: now - 5000,
        context: 'test'
      });
      
      const stuck = sessionManager.getStuckWorkers(1000);
      expect(stuck).toHaveLength(1);
      expect(stuck[0].workerId).toBe(0);
    });
  });

  describe('Coverage Gaps', () => {
    it('should handle session.browser without close method in closeSessionBrowser', async () => {
      const session = {
        id: 'session-invalid-browser',
        browser: { notClose: true } // No close method
      };
      
      await sessionManager.closeSessionBrowser(session);
      // Should not throw and should not log error (since try/catch wraps it, but the if check prevents the call)
      // Actually, if check prevents call, so no error log.
      expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('Closed browser'));
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should update nextSessionId from state in loadSessionState', async () => {
      const state = {
        sessions: [],
        nextSessionId: 999,
        savedAt: Date.now()
      };
      
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(state));
      
      await sessionManager.loadSessionState();
      
      expect(sessionManager.nextSessionId).toBe(999);
      expect(mockLogger.info).toHaveBeenCalledWith('Next session ID set to 999');
    });

    it('should use existing values if configuration is missing properties', async () => {
      // Setup initial values
      sessionManager.sessionTimeoutMs = 5000;
      sessionManager.cleanupIntervalMs = 1000;
      sessionManager.concurrencyPerBrowser = 5;

      // Mock config loader to return empty objects
      vi.mocked(configLoader.getTimeoutValue).mockResolvedValue({});
      vi.mocked(configLoader.getSettings).mockResolvedValue({});

      await sessionManager.loadConfiguration();

      expect(sessionManager.sessionTimeoutMs).toBe(5000);
      expect(sessionManager.cleanupIntervalMs).toBe(1000);
      // concurrencyPerBrowser resets to 1 if missing in settings (line 59)
      expect(sessionManager.concurrencyPerBrowser).toBe(1);
    });

    it('should filter worker occupancy by session ID', () => {
      sessionManager.workerOccupancy.set('session-1:0', { startTime: Date.now(), context: 'ctx1' });
      sessionManager.workerOccupancy.set('session-2:0', { startTime: Date.now(), context: 'ctx2' });
      
      const occupancy = sessionManager.getWorkerOccupancy('session-1');
      expect(Object.keys(occupancy)).toHaveLength(1);
      expect(occupancy['0']).toBeDefined();
    });

    it('should not include non-stuck workers', () => {
      const now = Date.now();
      sessionManager.workerOccupancy.set('session-1:0', { startTime: now, context: 'fresh' }); // Duration 0
      
      const stuck = sessionManager.getStuckWorkers(1000);
      expect(stuck).toHaveLength(0);
    });

    it('should default nextSessionId to 1 if missing in state', async () => {
       const state = {
          sessions: [],
          // nextSessionId missing
          savedAt: Date.now()
        };
        
        vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(state));
        
        await sessionManager.loadSessionState();
        
        expect(sessionManager.nextSessionId).toBe(1);
    });
  });

  describe('Page Pool Management', () => {
    let sessionId;
    let mockBrowser;
    let mockContext;
    let mockPage;

    beforeEach(() => {
      mockBrowser = { close: vi.fn() };
      mockPage = { 
        close: vi.fn(),
        isClosed: vi.fn().mockReturnValue(false),
        evaluate: vi.fn().mockResolvedValue({ documentReady: 'complete', bodyExists: true })
      };
      mockContext = {
        newPage: vi.fn().mockResolvedValue(mockPage)
      };
      sessionId = sessionManager.addSession(mockBrowser);
    });

    it('should acquire a new page when pool is empty', async () => {
      const page = await sessionManager.acquirePage(sessionId, mockContext);
      expect(page).toBeDefined();
      expect(mockContext.newPage).toHaveBeenCalled();
    });

    it('should return null for invalid session in acquirePage', async () => {
      const page = await sessionManager.acquirePage('invalid-session', mockContext);
      expect(page).toBeNull();
    });

    it('should return null when context is missing', async () => {
      const page = await sessionManager.acquirePage(sessionId, null);
      expect(page).toBeNull();
    });

    it('should reuse pooled page', async () => {
      const page1 = await sessionManager.acquirePage(sessionId, mockContext);
      await sessionManager.releasePage(sessionId, page1);
      const page2 = await sessionManager.acquirePage(sessionId, mockContext);
      expect(page2).toBeDefined();
      expect(mockContext.newPage).toHaveBeenCalledTimes(1);
    });

    it('should not reuse closed pooled pages', async () => {
      const closedPage = { 
        close: vi.fn(), 
        isClosed: vi.fn().mockReturnValue(true) 
      };
      sessionManager.sessions[0].pagePool.push(closedPage);
      const page = await sessionManager.acquirePage(sessionId, mockContext);
      expect(page).toBeDefined();
      expect(mockContext.newPage).toHaveBeenCalled();
    });

    it('should close unhealthy pooled page on acquire', async () => {
      const unhealthyPage = {
        close: vi.fn(),
        isClosed: vi.fn().mockReturnValue(false),
        evaluate: vi.fn().mockRejectedValue(new Error('Health check failed'))
      };
      sessionManager.sessions[0].pagePool.push(unhealthyPage);
      const page = await sessionManager.acquirePage(sessionId, mockContext);
      expect(page).toBeDefined();
    });

    it('should close unhealthy page on release', async () => {
      const unhealthyPage = {
        close: vi.fn(),
        isClosed: vi.fn().mockReturnValue(false),
        evaluate: vi.fn().mockRejectedValue(new Error('Health check failed'))
      };
      await sessionManager.releasePage(sessionId, unhealthyPage);
      expect(unhealthyPage.close).toHaveBeenCalled();
    });

    it('should not release closed page', async () => {
      mockPage.isClosed = vi.fn().mockReturnValue(true);
      await sessionManager.releasePage(sessionId, mockPage);
      expect(mockPage.close).not.toHaveBeenCalled();
    });

    it('should close pooled page if idle timeout exceeded', async () => {
      const oldPage = {
        close: vi.fn(),
        isClosed: vi.fn().mockReturnValue(false)
      };
      sessionManager.sessions[0].pagePool.push({
        page: oldPage,
        lastUsedAt: Date.now() - (sessionManager.pagePoolIdleTimeoutMs + 1000),
        lastHealthCheckAt: 0
      });
      await sessionManager.cleanupIdlePages();
      expect(oldPage.close).toHaveBeenCalled();
    });
  });

  describe('Worker Waiter', () => {
    let sessionId;
    let mockBrowser;

    beforeEach(() => {
      mockBrowser = { close: vi.fn() };
      sessionManager.workerWaiterMaxPerSession = 3;
    });

    it('should return null when waiter limit exceeded', async () => {
      sessionManager.concurrencyPerBrowser = 1;
      sessionManager.workerWaiterMaxPerSession = 1;
      sessionId = sessionManager.addSession(mockBrowser);
      await sessionManager.findAndOccupyIdleWorker(sessionId);
      const worker = await sessionManager.acquireWorker(sessionId, { timeoutMs: 50 });
      expect(worker).toBeNull();
    }, 200);

    it('should handle waiter timeout', async () => {
      sessionManager.concurrencyPerBrowser = 1;
      sessionManager.workerWaiterMaxPerSession = 5;
      sessionId = sessionManager.addSession(mockBrowser);
      await sessionManager.findAndOccupyIdleWorker(sessionId);
      const worker = await sessionManager.acquireWorker(sessionId, { timeoutMs: 50 });
      expect(worker).toBeNull();
    }, 200);

    it('should get worker when available', async () => {
      sessionManager.concurrencyPerBrowser = 2;
      sessionManager.workerWaiterMaxPerSession = 5;
      sessionId = sessionManager.addSession(mockBrowser);
      const worker = await sessionManager.acquireWorker(sessionId);
      expect(worker).toBeDefined();
      expect(worker.status).toBe('busy');
    });
  });

  describe('_normalizePoolEntry', () => {
    let mockBrowser;

    beforeEach(() => {
      mockBrowser = { close: vi.fn() };
    });

    it('should normalize pool entry with page property', () => {
      const entry = { page: {}, lastUsedAt: 1000 };
      const now = Date.now();
      const result = sessionManager._normalizePoolEntry(entry, now);
      expect(result.page).toBeDefined();
      expect(result.lastUsedAt).toBe(1000);
    });

    it('should normalize pool entry without page property', () => {
      const page = {};
      const now = Date.now();
      const result = sessionManager._normalizePoolEntry(page, now);
      expect(result.page).toBe(page);
      expect(result.lastUsedAt).toBe(now);
      expect(result.lastHealthCheckAt).toBe(0);
    });
  });

  describe('_isPageHealthy', () => {
    let mockBrowser;

    beforeEach(() => {
      mockBrowser = { close: vi.fn() };
    });

    it('should return false for closed page', async () => {
      const closedPage = { isClosed: vi.fn().mockReturnValue(true) };
      const result = await sessionManager._isPageHealthy(closedPage);
      expect(result).toBe(false);
    });

    it('should return false for null page', async () => {
      const result = await sessionManager._isPageHealthy(null);
      expect(result).toBe(false);
    });

    it('should return true for page without isClosed method', async () => {
      const page = {};
      const result = await sessionManager._isPageHealthy(page);
      expect(result).toBe(true);
    });

    it('should return false for unhealthy page', async () => {
      const unhealthyPage = {
        isClosed: vi.fn().mockReturnValue(false),
        evaluate: vi.fn().mockResolvedValue({ documentReady: 'loading', bodyExists: false })
      };
      const result = await sessionManager._isPageHealthy(unhealthyPage);
      expect(result).toBe(false);
    });

    it('should return true for healthy page with complete state', async () => {
      const healthyPage = {
        isClosed: vi.fn().mockReturnValue(false),
        evaluate: vi.fn().mockResolvedValue({ documentReady: 'complete', bodyExists: true })
      };
      const result = await sessionManager._isPageHealthy(healthyPage);
      expect(result).toBe(true);
    });

    it('should return true for healthy page with interactive state', async () => {
      const healthyPage = {
        isClosed: vi.fn().mockReturnValue(false),
        evaluate: vi.fn().mockResolvedValue({ documentReady: 'interactive', bodyExists: true })
      };
      const result = await sessionManager._isPageHealthy(healthyPage);
      expect(result).toBe(true);
    });

    it('should return false when evaluate throws', async () => {
      const badPage = {
        isClosed: vi.fn().mockReturnValue(false),
        evaluate: vi.fn().mockRejectedValue(new Error('Evaluate failed'))
      };
      const result = await sessionManager._isPageHealthy(badPage);
      expect(result).toBe(false);
    });
  });
});

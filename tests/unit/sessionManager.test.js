import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SessionManager from '../../core/sessionManager.js';
import fs from 'fs/promises';
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
      const mutex = { acquire: vi.fn().mockResolvedValue(false) };
      vi.spyOn(sessionManager, '_getMutex').mockReturnValue(mutex);

      const result = await sessionManager.findAndOccupyIdleWorker(sessionId);

      expect(mutex.acquire).toHaveBeenCalled();
      expect(result).toBeNull();
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

    beforeEach(() => {
      mockBrowser = { close: vi.fn() };
      sessionManager.addSession(mockBrowser);
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

  describe('replaceBrowserByEndpoint', () => {
    let mockBrowser;

    beforeEach(() => {
      mockBrowser = { 
        close: vi.fn(),
        contexts: vi.fn().mockReturnValue([])
      };
    });

    it('should return early when wsEndpoint is missing', async () => {
      const newBrowser = { close: vi.fn() };
      await sessionManager.replaceBrowserByEndpoint(null, newBrowser);
      expect(mockLogger.warn).toHaveBeenCalledWith('[sessionManager.js] replaceBrowserByEndpoint missing wsEndpoint or browser');
    });

    it('should return early when newBrowser is missing', async () => {
      await sessionManager.replaceBrowserByEndpoint('ws://test', null);
      expect(mockLogger.warn).toHaveBeenCalledWith('[sessionManager.js] replaceBrowserByEndpoint missing wsEndpoint or browser');
    });

    it('should return early when wsEndpoint is empty string', async () => {
      const newBrowser = { close: vi.fn() };
      await sessionManager.replaceBrowserByEndpoint('', newBrowser);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should return early when no sessions match wsEndpoint', async () => {
      const newBrowser = { close: vi.fn() };
      sessionManager.addSession(mockBrowser, 'profile1', 'ws://other-endpoint');
      
      await sessionManager.replaceBrowserByEndpoint('ws://nonexistent', newBrowser);
      
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('No session found'));
    });

    it('should successfully replace browser and close sharedContext', async () => {
      const oldBrowser = { close: vi.fn() };
      const newBrowser = { close: vi.fn() };
      sessionManager.addSession(oldBrowser, 'profile1', 'ws://test-endpoint');
      
      const session = sessionManager.sessions.find(s => s.wsEndpoint === 'ws://test-endpoint');
      session.sharedContext = {
        close: vi.fn().mockResolvedValue(undefined)
      };
      
      await sessionManager.replaceBrowserByEndpoint('ws://test-endpoint', newBrowser);
      
      const updatedSession = sessionManager.sessions.find(s => s.wsEndpoint === 'ws://test-endpoint');
      expect(updatedSession.sharedContext).toBeNull();
      expect(updatedSession.browser).toBe(newBrowser);
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Replaced browser'));
    });

    it('should close old browser when replacing', async () => {
      const oldBrowser = { 
        close: vi.fn().mockResolvedValue(undefined),
        contexts: vi.fn().mockReturnValue([])
      };
      const newBrowser = { close: vi.fn() };
      sessionManager.addSession(oldBrowser, 'profile1', 'ws://test-endpoint');
      
      await sessionManager.replaceBrowserByEndpoint('ws://test-endpoint', newBrowser);
      
      expect(oldBrowser.close).toHaveBeenCalled();
      const updatedSession = sessionManager.sessions.find(s => s.wsEndpoint === 'ws://test-endpoint');
      expect(updatedSession.browser).toBe(newBrowser);
    });

    it('should handle error when closing sharedContext', async () => {
      const oldBrowser = { close: vi.fn() };
      const newBrowser = { close: vi.fn() };
      sessionManager.addSession(oldBrowser, 'profile1', 'ws://test-endpoint');
      
      const session = sessionManager.sessions.find(s => s.wsEndpoint === 'ws://test-endpoint');
      session.sharedContext = {
        close: vi.fn().mockRejectedValue(new Error('Context close error'))
      };
      
      await sessionManager.replaceBrowserByEndpoint('ws://test-endpoint', newBrowser);
      
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Error closing shared context'));
      const updatedSession = sessionManager.sessions.find(s => s.wsEndpoint === 'ws://test-endpoint');
      expect(updatedSession.sharedContext).toBeNull();
    });

    it('should handle error when closing old browser', async () => {
      const oldBrowser = { 
        close: vi.fn().mockRejectedValue(new Error('Browser close error')),
        contexts: vi.fn().mockReturnValue([])
      };
      const newBrowser = { close: vi.fn() };
      sessionManager.addSession(oldBrowser, 'profile1', 'ws://test-endpoint');
      
      await sessionManager.replaceBrowserByEndpoint('ws://test-endpoint', newBrowser);
      
      // closeSessionBrowser catches the error and logs via logger.error
      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Error closing browser'), expect.any(String));
      const updatedSession = sessionManager.sessions.find(s => s.wsEndpoint === 'ws://test-endpoint');
      expect(updatedSession.browser).toBe(newBrowser);
    });

    it('should clear pagePool and managedPages during replacement', async () => {
      const oldBrowser = { close: vi.fn() };
      const newBrowser = { close: vi.fn() };
      sessionManager.addSession(oldBrowser, 'profile1', 'ws://test-endpoint');
      
      const session = sessionManager.sessions.find(s => s.wsEndpoint === 'ws://test-endpoint');
      session.pagePool = [{ page: { close: vi.fn() }, lastUsedAt: Date.now() }];
      session.managedPages = new Set([{ close: vi.fn() }]);
      
      await sessionManager.replaceBrowserByEndpoint('ws://test-endpoint', newBrowser);
      
      const updatedSession = sessionManager.sessions.find(s => s.wsEndpoint === 'ws://test-endpoint');
      expect(updatedSession.pagePool).toEqual([]);
      expect(updatedSession.managedPages.size).toBe(0);
    });
  });

  describe('cleanupIdlePages', () => {
    let mockBrowser;

    beforeEach(() => {
      mockBrowser = { close: vi.fn() };
      sessionManager.addSession(mockBrowser);
      sessionManager.pagePoolIdleTimeoutMs = 1000;
    });

    it('should handle session with empty pagePool', async () => {
      const result = sessionManager.cleanupIdlePages();
      expect(result).toBe(0);
    });

    it('should handle session without pagePool property', async () => {
      sessionManager.sessions[0].pagePool = undefined;
      const result = sessionManager.cleanupIdlePages();
      expect(result).toBe(0);
    });

    it('should close page that is already closed', async () => {
      const closedPage = { 
        isClosed: vi.fn().mockReturnValue(true),
        close: vi.fn()
      };
      sessionManager.sessions[0].pagePool.push({
        page: closedPage,
        lastUsedAt: Date.now()
      });
      
      const result = sessionManager.cleanupIdlePages();
      
      expect(result).toBe(1);
      expect(sessionManager.sessions[0].pagePool).toHaveLength(0);
    });

    it('should retain page that is within idle timeout', async () => {
      const activePage = { 
        isClosed: vi.fn().mockReturnValue(false),
        close: vi.fn()
      };
      sessionManager.sessions[0].pagePool.push({
        page: activePage,
        lastUsedAt: Date.now() - 500 // Within 1000ms timeout
      });
      
      const result = sessionManager.cleanupIdlePages();
      
      expect(result).toBe(0);
      expect(sessionManager.sessions[0].pagePool).toHaveLength(1);
    });

    it('should close page that exceeds idle timeout', async () => {
      const oldPage = { 
        isClosed: vi.fn().mockReturnValue(false),
        close: vi.fn()
      };
      sessionManager.sessions[0].pagePool.push({
        page: oldPage,
        lastUsedAt: Date.now() - 2000 // Exceeds 1000ms timeout
      });
      
      const result = sessionManager.cleanupIdlePages();
      
      expect(result).toBe(1);
      expect(oldPage.close).toHaveBeenCalled();
      expect(sessionManager.sessions[0].pagePool).toHaveLength(0);
    });

    it('should retain multiple pages with mixed idle times', async () => {
      const oldPage = { 
        isClosed: vi.fn().mockReturnValue(false),
        close: vi.fn()
      };
      const newPage = { 
        isClosed: vi.fn().mockReturnValue(false),
        close: vi.fn()
      };
      
      sessionManager.sessions[0].pagePool = [
        { page: oldPage, lastUsedAt: Date.now() - 2000 },
        { page: newPage, lastUsedAt: Date.now() - 500 }
      ];
      
      const result = sessionManager.cleanupIdlePages();
      
      expect(result).toBe(1);
      expect(sessionManager.sessions[0].pagePool).toHaveLength(1);
      expect(sessionManager.sessions[0].pagePool[0].page).toBe(newPage);
    });

    it('should handle entry without page property', async () => {
      sessionManager.sessions[0].pagePool = [
        { lastUsedAt: Date.now() }, // No page property
        { page: null, lastUsedAt: Date.now() }
      ];
      
      const result = sessionManager.cleanupIdlePages();
      
      expect(result).toBe(0);
    });

    it('should skip closing page when pagePoolIdleTimeoutMs is null', async () => {
      sessionManager.pagePoolIdleTimeoutMs = null;
      const oldPage = { 
        isClosed: vi.fn().mockReturnValue(false),
        close: vi.fn()
      };
      sessionManager.sessions[0].pagePool.push({
        page: oldPage,
        lastUsedAt: Date.now() - 1000000
      });
      
      const result = sessionManager.cleanupIdlePages();
      
      expect(result).toBe(0);
      expect(oldPage.close).not.toHaveBeenCalled();
    });
  });

  describe('_closePooledPage', () => {
    let mockBrowser;
    let sessionId;

    beforeEach(() => {
      mockBrowser = { close: vi.fn() };
      sessionId = sessionManager.addSession(mockBrowser);
    });

    it('should handle null page gracefully', () => {
      expect(() => {
        sessionManager._closePooledPage(sessionId, null);
      }).not.toThrow();
    });

    it('should close page and unregister it', () => {
      const page = { close: vi.fn() };
      sessionManager.sessions[0].managedPages.add(page);
      
      sessionManager._closePooledPage(sessionId, page);
      
      expect(page.close).toHaveBeenCalled();
      expect(sessionManager.sessions[0].managedPages.has(page)).toBe(false);
    });

    it('should handle error when page.close throws', () => {
      const page = { 
        close: vi.fn().mockRejectedValue(new Error('Close failed'))
      };
      sessionManager.sessions[0].managedPages.add(page);
      
      expect(() => {
        sessionManager._closePooledPage(sessionId, page);
      }).not.toThrow();
    });
  });

  describe('Page Pool - additional edge cases', () => {
    let mockBrowser;
    let sessionId;
    let mockContext;

    beforeEach(() => {
      mockBrowser = { close: vi.fn() };
      mockContext = {
        newPage: vi.fn().mockResolvedValue({
          close: vi.fn(),
          isClosed: vi.fn().mockReturnValue(false),
          evaluate: vi.fn().mockResolvedValue({ documentReady: 'complete', bodyExists: true })
        })
      };
      sessionId = sessionManager.addSession(mockBrowser);
    });

    it('should acquire page when page.evaluate does not exist', async () => {
      const pageWithoutEvaluate = {
        close: vi.fn(),
        isClosed: vi.fn().mockReturnValue(false)
        // No evaluate method
      };
      mockContext.newPage = vi.fn().mockResolvedValue(pageWithoutEvaluate);
      
      const page = await sessionManager.acquirePage(sessionId, mockContext);
      
      expect(page).toBeDefined();
    });

    it('should not release page to pool when pool is full', async () => {
      sessionManager.pagePoolMaxPerSession = 2;
      const page1 = { 
        close: vi.fn(),
        isClosed: vi.fn().mockReturnValue(false),
        evaluate: vi.fn().mockResolvedValue({ documentReady: 'complete', bodyExists: true })
      };
      const page2 = { 
        close: vi.fn(),
        isClosed: vi.fn().mockReturnValue(false),
        evaluate: vi.fn().mockResolvedValue({ documentReady: 'complete', bodyExists: true })
      };
      const page3 = { 
        close: vi.fn(),
        isClosed: vi.fn().mockReturnValue(false),
        evaluate: vi.fn().mockResolvedValue({ documentReady: 'complete', bodyExists: true })
      };
      
      sessionManager.sessions[0].pagePool = [
        { page: page1, lastUsedAt: Date.now() },
        { page: page2, lastUsedAt: Date.now() }
      ];
      
      await sessionManager.releasePage(sessionId, page3);
      
      expect(page3.close).toHaveBeenCalled();
      expect(sessionManager.sessions[0].pagePool).toHaveLength(2);
    });

    it('should not release unhealthy page to pool', async () => {
      const unhealthyPage = {
        close: vi.fn(),
        isClosed: vi.fn().mockReturnValue(false),
        evaluate: vi.fn().mockRejectedValue(new Error('Health check failed'))
      };
      
      await sessionManager.releasePage(sessionId, unhealthyPage);
      
      expect(unhealthyPage.close).toHaveBeenCalled();
    });

    it('should release healthy page to pool', async () => {
      const healthyPage = {
        close: vi.fn(),
        isClosed: vi.fn().mockReturnValue(false),
        evaluate: vi.fn().mockResolvedValue({ documentReady: 'complete', bodyExists: true })
      };
      
      await sessionManager.releasePage(sessionId, healthyPage);
      
      expect(healthyPage.close).not.toHaveBeenCalled();
      expect(sessionManager.sessions[0].pagePool).toHaveLength(1);
    });
  });

  describe('Worker Mutex - additional edge cases', () => {
    let mockBrowser;
    let sessionId;

    beforeEach(() => {
      mockBrowser = { close: vi.fn() };
      sessionManager.concurrencyPerBrowser = 1;
    });

    it('should handle mutex acquire with zero timeout', async () => {
      sessionId = sessionManager.addSession(mockBrowser);
      const mutex = sessionManager._getMutex(sessionId);
      
      const result = await mutex.acquire(0);
      expect(result).toBe(true);
      
      mutex.release();
    });

    it('should handle mutex acquire with negative timeout', async () => {
      sessionId = sessionManager.addSession(mockBrowser);
      const mutex = sessionManager._getMutex(sessionId);
      
      const result = await mutex.acquire(-1);
      expect(result).toBe(true);
      
      mutex.release();
    });

    it('should queue mutex requests and resolve in order', async () => {
      sessionId = sessionManager.addSession(mockBrowser);
      const mutex = sessionManager._getMutex(sessionId);
      
      const results = [];
      
      // First acquire
      const firstAcquired = await mutex.acquire(1000);
      results.push(firstAcquired);
      
      // Second acquire should queue
      const secondAcquirePromise = mutex.acquire(100).then(result => {
        results.push(result);
        return result;
      });
      
      // Release first - should allow second through
      mutex.release();
      
      const secondAcquired = await secondAcquirePromise;
      results.push(secondAcquired);
      
      expect(results).toEqual([true, true, true]);
    });
  });

  describe('acquireWorker - additional scenarios', () => {
    let mockBrowser;
    let sessionId;

    beforeEach(() => {
      mockBrowser = { close: vi.fn() };
      sessionManager.workerWaitTimeoutMs = 5000;
    });

    it('should release worker after waiter resolves', async () => {
      sessionManager.concurrencyPerBrowser = 1;
      sessionManager.workerWaiterMaxPerSession = 5;
      sessionId = sessionManager.addSession(mockBrowser);
      
      const worker = await sessionManager.acquireWorker(sessionId);
      expect(worker.status).toBe('busy');
      
      await sessionManager.releaseWorker(sessionId, worker.id);
      expect(worker.status).toBe('idle');
    });

    it('should handle waiter timeout and return null', async () => {
      sessionManager.concurrencyPerBrowser = 1;
      sessionManager.workerWaiterMaxPerSession = 5;
      sessionId = sessionManager.addSession(mockBrowser);
      
      // Occupy the worker
      await sessionManager.findAndOccupyIdleWorker(sessionId);
      
      // Try to acquire with very short timeout
      const worker = await sessionManager.acquireWorker(sessionId, { timeoutMs: 10 });
      
      // Wait for the waiter to timeout
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(worker).toBeNull();
    });
  });

  describe('_normalizePoolEntry - additional scenarios', () => {
    it('should handle entry with all properties', () => {
      const now = Date.now();
      const entry = { 
        page: { test: true }, 
        lastUsedAt: now - 1000,
        lastHealthCheckAt: now - 500
      };
      
      const result = sessionManager._normalizePoolEntry(entry, now);
      
      expect(result.page).toEqual({ test: true });
      expect(result.lastUsedAt).toBe(now - 1000);
      expect(result.lastHealthCheckAt).toBe(now - 500);
    });

    it('should default lastHealthCheckAt to 0 when missing', () => {
      const entry = { page: {}, lastUsedAt: 1000 };
      const now = Date.now();
      
      const result = sessionManager._normalizePoolEntry(entry, now);
      
      expect(result.lastHealthCheckAt).toBe(0);
    });
  });

  describe('Page pool max per session', () => {
    let mockBrowser;
    let sessionId;

    beforeEach(() => {
      mockBrowser = { close: vi.fn() };
      sessionId = sessionManager.addSession(mockBrowser);
      sessionManager.pagePoolMaxPerSession = 3;
    });

    it('should respect pagePoolMaxPerSession limit when releasing', async () => {
      const pages = Array.from({ length: 4 }, (_, i) => ({
        close: vi.fn(),
        isClosed: vi.fn().mockReturnValue(false),
        evaluate: vi.fn().mockResolvedValue({ documentReady: 'complete', bodyExists: true }),
        id: i
      }));
      
      // Add 3 pages to pool
      sessionManager.sessions[0].pagePool = pages.slice(0, 3).map(p => ({
        page: p,
        lastUsedAt: Date.now()
      }));
      
      // Try to release 4th page - should close it (not add to pool)
      await sessionManager.releasePage(sessionId, pages[3]);
      
      expect(pages[3].close).toHaveBeenCalled();
      expect(sessionManager.sessions[0].pagePool).toHaveLength(3);
    });

    it('should not limit pool when pagePoolMaxPerSession is null', async () => {
      sessionManager.pagePoolMaxPerSession = null;
      
      const page = {
        close: vi.fn(),
        isClosed: vi.fn().mockReturnValue(false),
        evaluate: vi.fn().mockResolvedValue({ documentReady: 'complete', bodyExists: true })
      };
      
      await sessionManager.releasePage(sessionId, page);
      
      expect(page.close).not.toHaveBeenCalled();
      expect(sessionManager.sessions[0].pagePool).toHaveLength(1);
    });
  });

  describe('Close page pool edge cases', () => {
    let mockBrowser;

    beforeEach(() => {
      mockBrowser = { close: vi.fn() };
      sessionManager.addSession(mockBrowser);
    });

    it('should handle empty page pool', () => {
      sessionManager.sessions[0].pagePool = [];
      expect(() => {
        sessionManager._closePagePool(sessionManager.sessions[0]);
      }).not.toThrow();
    });

    it('should handle null pagePool', () => {
      sessionManager.sessions[0].pagePool = null;
      expect(() => {
        sessionManager._closePagePool(sessionManager.sessions[0]);
      }).not.toThrow();
    });

    it('should close all pages in pool', () => {
      const page1 = { close: vi.fn() };
      const page2 = { close: vi.fn() };
      sessionManager.sessions[0].pagePool = [
        { page: page1, lastUsedAt: Date.now() },
        { page: page2, lastUsedAt: Date.now() }
      ];
      
      sessionManager._closePagePool(sessionManager.sessions[0]);
      
      expect(page1.close).toHaveBeenCalled();
      expect(page2.close).toHaveBeenCalled();
      expect(sessionManager.sessions[0].pagePool).toHaveLength(0);
    });

    it('should handle null page in pool entry', () => {
      sessionManager.sessions[0].pagePool = [
        { page: null, lastUsedAt: Date.now() }
      ];
      
      expect(() => {
        sessionManager._closePagePool(sessionManager.sessions[0]);
      }).not.toThrow();
    });
  });

  describe('_cleanupSessionMaps', () => {
    let mockBrowser;
    let sessionId;

    beforeEach(() => {
      mockBrowser = { close: vi.fn() };
      sessionId = sessionManager.addSession(mockBrowser);
      sessionManager.concurrencyPerBrowser = 1;
    });

    it('should clean up mutexes for session', () => {
      sessionManager._getMutex(sessionId);
      expect(sessionManager.workerMutexes.has(sessionId)).toBe(true);
      
      sessionManager._cleanupSessionMaps(sessionId);
      
      expect(sessionManager.workerMutexes.has(sessionId)).toBe(false);
    });

    it('should clear occupancy for session', () => {
      sessionManager.workerOccupancy.set(`${sessionId}:0`, { startTime: Date.now(), context: 'test' });
      expect(sessionManager.workerOccupancy.has(`${sessionId}:0`)).toBe(true);
      
      sessionManager._cleanupSessionMaps(sessionId);
      
      expect(sessionManager.workerOccupancy.has(`${sessionId}:0`)).toBe(false);
    });

    it('should resolve waiter promises on cleanup', () => {
      sessionManager._getWorkerWaiters(sessionId);
      const waiters = sessionManager.workerWaiters.get(sessionId);
      
      const resolver = vi.fn();
      const entry = { resolve: resolver, timeoutId: null };
      waiters.push(entry);
      
      sessionManager._cleanupSessionMaps(sessionId);
      
      expect(resolver).toHaveBeenCalledWith(null);
      expect(sessionManager.workerWaiters.has(sessionId)).toBe(false);
    });

    it('should clear waiters array and delete from map', () => {
      sessionManager._getWorkerWaiters(sessionId);
      expect(sessionManager.workerWaiters.has(sessionId)).toBe(true);
      
      sessionManager._cleanupSessionMaps(sessionId);
      
      expect(sessionManager.workerWaiters.has(sessionId)).toBe(false);
    });

    it('should clear timeout when cleaning up waiters', () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
      sessionManager._getWorkerWaiters(sessionId);
      const waiters = sessionManager.workerWaiters.get(sessionId);
      
      const entry = { resolve: vi.fn(), timeoutId: 123 };
      waiters.push(entry);
      
      sessionManager._cleanupSessionMaps(sessionId);
      
      expect(clearTimeoutSpy).toHaveBeenCalledWith(123);
    });
  });

  describe('Worker waiter queue scenarios', () => {
    let mockBrowser;
    let sessionId;

    beforeEach(() => {
      mockBrowser = { close: vi.fn() };
      sessionManager.concurrencyPerBrowser = 1;
      sessionManager.workerWaiterMaxPerSession = 3;
    });

    it('should reject waiter when max waiters reached', async () => {
      sessionId = sessionManager.addSession(mockBrowser);
      
      await sessionManager.findAndOccupyIdleWorker(sessionId);
      
      const waiter1 = sessionManager.acquireWorker(sessionId, { timeoutMs: 100 });
      const waiter2 = sessionManager.acquireWorker(sessionId, { timeoutMs: 100 });
      const waiter3 = sessionManager.acquireWorker(sessionId, { timeoutMs: 100 });
      const waiter4 = sessionManager.acquireWorker(sessionId, { timeoutMs: 100 });
      
      const results = await Promise.all([waiter1, waiter2, waiter3, waiter4]);
      
      const nullCount = results.filter(r => r === null).length;
      expect(nullCount).toBeGreaterThanOrEqual(3);
    });

    it('should resolve waiter when worker becomes available', async () => {
      sessionId = sessionManager.addSession(mockBrowser);
      
      const worker1 = await sessionManager.acquireWorker(sessionId);
      expect(worker1).toBeDefined();
      
      const worker2Promise = sessionManager.acquireWorker(sessionId);
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      await sessionManager.releaseWorker(sessionId, worker1.id);
      
      const worker2 = await worker2Promise;
      expect(worker2).toBeDefined();
      expect(worker2.status).toBe('busy');
    });

    it('should resolve null when no idle worker for waiter', async () => {
      sessionId = sessionManager.addSession(mockBrowser);
      await sessionManager.findAndOccupyIdleWorker(sessionId);
      
      const session = sessionManager.sessions.find(s => s.id === sessionId);
      session.workers = [];
      
      const result = await sessionManager.acquireWorker(sessionId, { timeoutMs: 50 });
      expect(result).toBeNull();
    }, 200);
  });

  describe('Page pool health check interval', () => {
    let mockBrowser;
    let sessionId;
    let mockContext;

    beforeEach(() => {
      mockBrowser = { close: vi.fn() };
      mockContext = {
        newPage: vi.fn().mockResolvedValue({
          close: vi.fn(),
          isClosed: vi.fn().mockReturnValue(false),
          evaluate: vi.fn().mockResolvedValue({ documentReady: 'complete', bodyExists: true })
        })
      };
      sessionId = sessionManager.addSession(mockBrowser);
    });

    it('should skip health check when interval is null', async () => {
      sessionManager.pagePoolHealthCheckIntervalMs = null;
      sessionManager.pagePoolIdleTimeoutMs = null;
      
      const healthyPage = {
        isClosed: vi.fn().mockReturnValue(false),
        evaluate: vi.fn().mockResolvedValue({ documentReady: 'complete', bodyExists: true })
      };
      
      sessionManager.sessions[0].pagePool = [{
        page: healthyPage,
        lastUsedAt: Date.now(),
        lastHealthCheckAt: 0
      }];
      
      const page = await sessionManager.acquirePage(sessionId, mockContext);
      expect(page).toBeDefined();
    });

    it('should perform health check when last check exceeds interval', async () => {
      sessionManager.pagePoolHealthCheckIntervalMs = 1000;
      sessionManager.pagePoolIdleTimeoutMs = null;
      
      const healthyPage = {
        isClosed: vi.fn().mockReturnValue(false),
        evaluate: vi.fn().mockResolvedValue({ documentReady: 'complete', bodyExists: true })
      };
      
      sessionManager.sessions[0].pagePool = [{
        page: healthyPage,
        lastUsedAt: Date.now(),
        lastHealthCheckAt: Date.now() - 2000
      }];
      
      const page = await sessionManager.acquirePage(sessionId, mockContext);
      expect(page).toBeDefined();
      expect(healthyPage.evaluate).toHaveBeenCalled();
    });

    it('should skip health check when recent', async () => {
      sessionManager.pagePoolHealthCheckIntervalMs = 1000;
      sessionManager.pagePoolIdleTimeoutMs = null;
      
      const healthyPage = {
        isClosed: vi.fn().mockReturnValue(false),
        evaluate: vi.fn().mockResolvedValue({ documentReady: 'complete', bodyExists: true })
      };
      
      sessionManager.sessions[0].pagePool = [{
        page: healthyPage,
        lastUsedAt: Date.now(),
        lastHealthCheckAt: Date.now()
      }];
      
      const page = await sessionManager.acquirePage(sessionId, mockContext);
      expect(page).toBeDefined();
      expect(healthyPage.evaluate).not.toHaveBeenCalled();
    });
  });

  describe('Page pool max per session null scenarios', () => {
    let mockBrowser;
    let sessionId;

    beforeEach(() => {
      mockBrowser = { close: vi.fn() };
      sessionId = sessionManager.addSession(mockBrowser);
    });

    it('should allow unlimited pool when pagePoolMaxPerSession is null', async () => {
      sessionManager.pagePoolMaxPerSession = null;
      sessionManager.concurrencyPerBrowser = 10;
      
      const pages = Array.from({ length: 5 }, () => ({
        close: vi.fn(),
        isClosed: vi.fn().mockReturnValue(false),
        evaluate: vi.fn().mockResolvedValue({ documentReady: 'complete', bodyExists: true })
      }));
      
      for (const page of pages) {
        await sessionManager.releasePage(sessionId, page);
      }
      
      expect(sessionManager.sessions[0].pagePool.length).toBeGreaterThanOrEqual(4);
    });

    it('should use concurrencyPerBrowser as default pool limit', async () => {
      sessionManager.pagePoolMaxPerSession = null;
      sessionManager.concurrencyPerBrowser = 2;
      
      const pages = Array.from({ length: 4 }, () => ({
        close: vi.fn(),
        isClosed: vi.fn().mockReturnValue(false),
        evaluate: vi.fn().mockResolvedValue({ documentReady: 'complete', bodyExists: true })
      }));
      
      for (const page of pages) {
        await sessionManager.releasePage(sessionId, page);
      }
      
      expect(sessionManager.sessions[0].pagePool).toHaveLength(2);
    });
  });

  describe('Page isClosed error handling', () => {
    let mockBrowser;
    let sessionId;
    let mockContext;

    beforeEach(() => {
      mockBrowser = { close: vi.fn() };
      mockContext = {
        newPage: vi.fn().mockResolvedValue({
          close: vi.fn(),
          isClosed: vi.fn().mockReturnValue(false),
          evaluate: vi.fn().mockResolvedValue({ documentReady: 'complete', bodyExists: true })
        })
      };
      sessionId = sessionManager.addSession(mockBrowser);
    });

    it('should handle page.isClosed throwing an error by propagating', async () => {
      const pageWithError = {
        close: vi.fn(),
        isClosed: vi.fn(() => { throw new Error('isClosed error'); })
      };
      
      sessionManager.sessions[0].pagePool = [{
        page: pageWithError,
        lastUsedAt: Date.now()
      }];
      
      await expect(sessionManager.acquirePage(sessionId, mockContext)).rejects.toThrow('isClosed error');
    });

    it('should handle release with page.isClosed throwing by propagating', async () => {
      const pageWithError = {
        close: vi.fn(),
        isClosed: vi.fn(() => { throw new Error('isClosed error'); }),
        evaluate: vi.fn().mockResolvedValue({ documentReady: 'complete', bodyExists: true })
      };
      
      await expect(sessionManager.releasePage(sessionId, pageWithError)).rejects.toThrow('isClosed error');
    });
  });

  describe('saveSessionState error handling', () => {
    let mockBrowser;

    beforeEach(() => {
      mockBrowser = { close: vi.fn() };
      sessionManager.addSession(mockBrowser);
      vi.clearAllMocks();
    });

    it('should handle fs.mkdir failure', async () => {
      fs.mkdir.mockRejectedValue(new Error('mkdir failed'));
      
      await sessionManager.saveSessionState();
      
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to save session state:', 'mkdir failed');
    });

    it('should handle fs.writeFile failure', async () => {
      fs.mkdir.mockResolvedValue();
      fs.writeFile.mockRejectedValue(new Error('write failed'));
      
      await sessionManager.saveSessionState();
      
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to save session state:', 'write failed');
    });
  });

  describe('loadSessionState edge cases', () => {
    it('should handle missing sessions array in state', async () => {
      const state = {
        nextSessionId: 5,
        savedAt: Date.now()
      };
      fs.readFile.mockResolvedValue(JSON.stringify(state));
      
      const result = await sessionManager.loadSessionState();
      
      expect(result).toEqual(state);
      expect(sessionManager.sessions).toHaveLength(0);
    });

    it('should not update nextSessionId when sessions is undefined', async () => {
      sessionManager.nextSessionId = 100;
      
      const state = {
        sessions: undefined,
        nextSessionId: 10,
        savedAt: Date.now()
      };
      fs.readFile.mockResolvedValue(JSON.stringify(state));
      
      const result = await sessionManager.loadSessionState();
      
      expect(result).toEqual(state);
      expect(sessionManager.nextSessionId).toBe(100);
    });

    it('should use default concurrency when loading state', async () => {
      const state = {
        sessions: [],
        nextSessionId: 1,
        savedAt: Date.now()
      };
      fs.readFile.mockResolvedValue(JSON.stringify(state));
      
      await sessionManager.loadSessionState();
      
      expect(sessionManager.concurrencyPerBrowser).toBeDefined();
    });
  });

  describe('acquirePage additional edge cases', () => {
    let mockBrowser;
    let sessionId;
    let mockContext;

    beforeEach(() => {
      mockBrowser = { close: vi.fn() };
      mockContext = {
        newPage: vi.fn().mockResolvedValue({
          close: vi.fn(),
          isClosed: vi.fn().mockReturnValue(false),
          evaluate: vi.fn().mockResolvedValue({ documentReady: 'complete', bodyExists: true })
        })
      };
      sessionId = sessionManager.addSession(mockBrowser);
    });

    it('should handle pagePoolIdleTimeoutMs as null', async () => {
      sessionManager.pagePoolIdleTimeoutMs = null;
      
      const oldPage = {
        close: vi.fn(),
        isClosed: vi.fn().mockReturnValue(false)
      };
      sessionManager.sessions[0].pagePool = [{
        page: oldPage,
        lastUsedAt: Date.now() - 1000000
      }];
      
      const page = await sessionManager.acquirePage(sessionId, mockContext);
      expect(page).toBeDefined();
    });
  });

  describe('releasePage additional edge cases', () => {
    let mockBrowser;
    let sessionId;

    beforeEach(() => {
      mockBrowser = { close: vi.fn() };
      sessionId = sessionManager.addSession(mockBrowser);
    });

    it('should handle missing session in releasePage', async () => {
      const page = {
        close: vi.fn(),
        isClosed: vi.fn().mockReturnValue(false)
      };
      
      await sessionManager.releasePage('non-existent-session', page);
      expect(page.close).not.toHaveBeenCalled();
    });

    it('should handle null page in releasePage', async () => {
      await sessionManager.releasePage(sessionId, null);
      expect(mockLogger.error).not.toHaveBeenCalled();
    });
  });

  describe('findAndOccupyIdleWorker additional edge cases', () => {
    let mockBrowser;
    let sessionId;

    beforeEach(() => {
      mockBrowser = { close: vi.fn() };
      sessionManager.concurrencyPerBrowser = 1;
    });

    it('should handle empty workers array', async () => {
      sessionId = sessionManager.addSession(mockBrowser);
      sessionManager.sessions[0].workers = [];
      
      const worker = await sessionManager.findAndOccupyIdleWorker(sessionId);
      expect(worker).toBeNull();
    });
  });

  describe('workerOccupancy additional scenarios', () => {
    it('should get occupancy for non-existent session', () => {
      const occupancy = sessionManager.getWorkerOccupancy('non-existent');
      expect(occupancy).toEqual({});
    });
  });

  describe('removeSession additional edge cases', () => {
    it('should cleanup session maps when removing session', () => {
      const mockBrowser = { close: vi.fn() };
      const cleanupSpy = vi.spyOn(sessionManager, '_cleanupSessionMaps');
      
      const sessionId = sessionManager.addSession(mockBrowser);
      sessionManager.removeSession(sessionId);
      
      expect(cleanupSpy).toHaveBeenCalledWith(sessionId);
    });
  });
});

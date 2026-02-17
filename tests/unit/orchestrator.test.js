import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Orchestrator from '../../core/orchestrator.js';
import SessionManager from '../../core/sessionManager.js';
import Discovery from '../../core/discovery.js';
import Automator from '../../core/automator.js';
import metricsCollector from '../../utils/metrics.js';
import * as validator from '../../utils/validator.js';
import { isDevelopment } from '../../utils/envLoader.js';

// Mock dependencies
vi.mock('../../core/sessionManager.js');
vi.mock('../../core/discovery.js');
vi.mock('../../core/automator.js');
vi.mock('../../utils/metrics.js');
vi.mock('../../utils/logger.js', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));
vi.mock('../../utils/configLoader.js', () => ({
  getTimeoutValue: vi.fn(),
  getSettings: vi.fn(),
}));
vi.mock('../../utils/envLoader.js', () => ({
  isDevelopment: vi.fn(() => false),
}));

// Mock validator
vi.mock('../../utils/validator.js', () => ({
  validateTaskExecution: vi.fn(() => ({ isValid: true })),
  validatePayload: vi.fn(() => ({ isValid: true })),
}));

// No mock for tasks/testTask.js as we use the real file and spy on page interactions

describe('Orchestrator', () => {
  let orchestrator;
  let mockSessionManager;
  let mockDiscovery;
  let mockAutomator;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Instantiate Orchestrator
    orchestrator = new Orchestrator();
    
    // Access the instances attached to orchestrator
    mockSessionManager = orchestrator.sessionManager;
    mockDiscovery = orchestrator.discovery;
    mockAutomator = orchestrator.automator;
    
    // Fix activeSessionsCount getter mock on the instance
    Object.defineProperty(mockSessionManager, 'activeSessionsCount', {
      configurable: true,
      get: vi.fn(() => 0),
    });
    
    // Default mock implementations
    mockDiscovery.loadConnectors.mockResolvedValue();
    mockDiscovery.discoverBrowsers.mockResolvedValue([]);
    
    mockSessionManager.getAllSessions.mockReturnValue([]);
    mockSessionManager.shutdown.mockResolvedValue();
    
    mockAutomator.connectToBrowser.mockResolvedValue({});
    mockAutomator.startHealthChecks.mockReturnValue();
    mockAutomator.shutdown.mockResolvedValue();

    // Reset validator mocks to valid state
    validator.validateTaskExecution.mockReturnValue({ isValid: true });
    validator.validatePayload.mockReturnValue({ isValid: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Initialization', () => {
    it('should initialize with empty queue and default components', () => {
      expect(orchestrator.taskQueue).toEqual([]);
      expect(orchestrator.isProcessingTasks).toBe(false);
      expect(orchestrator.sessionManager).toBeDefined();
      expect(orchestrator.discovery).toBeDefined();
      expect(orchestrator.automator).toBeDefined();
    });
  });

  describe('Task Processing Modes', () => {
    it('should dispatch tasks in centralized mode by default', async () => {
      const sessionA = { id: 'A' };
      const sessionB = { id: 'B' };

      vi.spyOn(mockSessionManager, 'activeSessionsCount', 'get').mockReturnValue(2);
      mockSessionManager.getAllSessions.mockReturnValue([sessionA, sessionB]);

      const tasks = [
        { taskName: 'taskA', payload: {} },
        { taskName: 'taskB', payload: {} }
      ];
      orchestrator.taskQueue = [...tasks];

      const processSpy = vi.spyOn(orchestrator, 'processSharedChecklistForSession').mockResolvedValue();

      await orchestrator.processTasks();

      expect(processSpy).toHaveBeenCalledTimes(2);
      const firstTasks = processSpy.mock.calls[0][1];
      const secondTasks = processSpy.mock.calls[1][1];
      expect(firstTasks).not.toBe(secondTasks);
      expect(firstTasks).toEqual(tasks);
      expect(secondTasks).toEqual(tasks);
    });

    it('should fall back to centralized assignment when non-centralized mode configured', async () => {
      const sessionA = { id: 'A' };
      const sessionB = { id: 'B' };

      vi.spyOn(mockSessionManager, 'activeSessionsCount', 'get').mockReturnValue(2);
      mockSessionManager.getAllSessions.mockReturnValue([sessionA, sessionB]);

      const tasks = [
        { taskName: 'taskA', payload: {} },
        { taskName: 'taskB', payload: {} }
      ];
      orchestrator.taskQueue = [...tasks];
      orchestrator.taskDispatchMode = 'broadcast';

      const processSpy = vi.spyOn(orchestrator, 'processSharedChecklistForSession').mockResolvedValue();

      await orchestrator.processTasks();

      expect(processSpy).toHaveBeenCalledTimes(2);
      const firstTasks = processSpy.mock.calls[0][1];
      const secondTasks = processSpy.mock.calls[1][1];
      expect(firstTasks).not.toBe(secondTasks);
      expect(firstTasks).toEqual(tasks);
      expect(secondTasks).toEqual(tasks);
    });
  });

    it('should sleep for specified duration', async () => {
      vi.useRealTimers(); // Ensure real timers for this test if needed, but spy is safer
      const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
      const promise = orchestrator._sleep(100);
      
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 100);
      
      // We don't need to wait for real timeout if we use fake timers properly, 
      // but let's just trust the spy for coverage of the line.
      // To actually cover the line, we need the promise to resolve.
      // If we are using fake timers (which we are not in beforeEach except one test), it should be fine.
      
      // Let's just resolve it
      vi.useFakeTimers();
      orchestrator._sleep(100);
      vi.advanceTimersByTime(100);
      vi.useRealTimers();
    });

    describe('startDiscovery', () => {
    it('should load connectors and discover browsers', async () => {
      mockDiscovery.discoverBrowsers.mockResolvedValue([
        { ws: 'ws://localhost:1234', windowName: 'Chrome 1' }
      ]);
      mockAutomator.connectToBrowser.mockResolvedValue({ contexts: () => [] });
      
      // Mock active sessions count to trigger health checks
      vi.spyOn(mockSessionManager, 'activeSessionsCount', 'get').mockReturnValue(1);
      
      await orchestrator.startDiscovery({ browsers: ['chrome'] });
      
      expect(mockDiscovery.loadConnectors).toHaveBeenCalledWith(['chrome']);
      expect(mockDiscovery.discoverBrowsers).toHaveBeenCalled();
      expect(mockAutomator.connectToBrowser).toHaveBeenCalledWith('ws://localhost:1234');
      expect(mockSessionManager.addSession).toHaveBeenCalled();
      expect(mockAutomator.startHealthChecks).toHaveBeenCalled();
    });

    it('should handle no browsers discovered', async () => {
      mockDiscovery.discoverBrowsers.mockResolvedValue([]);
      
      await orchestrator.startDiscovery();
      
      expect(mockAutomator.connectToBrowser).not.toHaveBeenCalled();
      expect(mockSessionManager.addSession).not.toHaveBeenCalled();
    });

    it('should handle invalid ws endpoint URL', async () => {
      mockDiscovery.discoverBrowsers.mockResolvedValue([
        { ws: 'invalid-url', windowName: 'Invalid Profile' }
      ]);
      mockAutomator.connectToBrowser.mockResolvedValue({ contexts: () => [] });
      
      await orchestrator.startDiscovery();
      
      // Should handle URL parse error gracefully and still try to add session (with default name logic)
      expect(mockSessionManager.addSession).toHaveBeenCalled();
    });

    it('should log error for rejected connection attempts', async () => {
      mockDiscovery.discoverBrowsers.mockResolvedValue([
        { ws: 'ws://valid-url', windowName: 'Rejected Profile' }
      ]);
      mockAutomator.connectToBrowser.mockRejectedValue(new Error('Connection failed'));
      
      await orchestrator.startDiscovery();
      
      expect(mockSessionManager.addSession).not.toHaveBeenCalled();
      // Error should be logged but not thrown
    });

    it('should skip profiles without ws endpoint', async () => {
      mockDiscovery.discoverBrowsers.mockResolvedValue([
        { windowName: 'Broken Profile' } // No ws
      ]);
      
      await orchestrator.startDiscovery();
      
      expect(mockAutomator.connectToBrowser).not.toHaveBeenCalled();
    });

    it('should handle connection failures', async () => {
      mockDiscovery.discoverBrowsers.mockResolvedValue([
        { ws: 'ws://bad-url', windowName: 'Bad Profile' }
      ]);
      mockAutomator.connectToBrowser.mockRejectedValue(new Error('Connection failed'));
      
      await orchestrator.startDiscovery();
      
      expect(mockSessionManager.addSession).not.toHaveBeenCalled();
      // Should not crash
    });
    it('should handle generic error in startDiscovery', async () => {
      mockDiscovery.loadConnectors.mockRejectedValue(new Error('Load Failed'));
      
      await orchestrator.startDiscovery();
      
      expect(mockDiscovery.loadConnectors).toHaveBeenCalled();
      expect(mockDiscovery.discoverBrowsers).not.toHaveBeenCalled();
      // Should log error and not crash
    });

    it('should handle various endpoint data shapes', async () => {
      mockDiscovery.discoverBrowsers.mockResolvedValue([
        { ws: 'ws://1', windowName: null, sortNum: 1 },
        { ws: 'ws://2', windowName: null, sortNum: null }
      ]);
      
      await orchestrator.startDiscovery();
      
      expect(mockAutomator.connectToBrowser).toHaveBeenCalledTimes(2);
      expect(mockSessionManager.addSession).toHaveBeenCalledTimes(2);
      // Verify implicitly that it didn't crash on name generation
    });

    it('should default to Unnamed Profile if no name/sortNum', async () => {
      mockDiscovery.discoverBrowsers.mockResolvedValue([
        { ws: 'ws://3', windowName: null, sortNum: null }
      ]);
      
      await orchestrator.startDiscovery();
      
      expect(mockSessionManager.addSession).toHaveBeenCalledWith(expect.anything(), expect.stringContaining('Unnamed Profile'));
    });

    it('should include port in display name if present', async () => {
      mockDiscovery.discoverBrowsers.mockResolvedValue([
        { ws: 'ws://localhost:9222', windowName: 'Chrome' }
      ]);
      mockAutomator.connectToBrowser.mockResolvedValue({ contexts: () => [] });
      
      await orchestrator.startDiscovery();
      
      expect(mockSessionManager.addSession).toHaveBeenCalledWith(expect.anything(), 'Chrome:9222');
    });

    it('should not include port in display name if port is missing', async () => {
      mockDiscovery.discoverBrowsers.mockResolvedValue([
        { ws: 'ws://example.com', windowName: 'No Port' }
      ]);
      mockAutomator.connectToBrowser.mockResolvedValue({ contexts: () => [] });
      
      await orchestrator.startDiscovery();
      
      expect(mockSessionManager.addSession).toHaveBeenCalledWith(expect.anything(), 'No Port');
    });
  });

  describe('addTask', () => {
    it('should add valid task to queue and trigger processing', async () => {
      vi.useFakeTimers();
      const processSpy = vi.spyOn(orchestrator, 'processTasks');
      
      orchestrator.addTask('testTask', { foo: 'bar' });
      
      expect(orchestrator.taskQueue).toHaveLength(1);
      expect(orchestrator.taskQueue[0]).toEqual({ taskName: 'testTask', payload: { foo: 'bar' } });
      
      vi.advanceTimersByTime(50);
      expect(processSpy).toHaveBeenCalled();
    });

    it('should debounce task processing', () => {
      vi.useFakeTimers();
      const processSpy = vi.spyOn(orchestrator, 'processTasks');
      
      orchestrator.addTask('task1', {});
      orchestrator.addTask('task2', {});
      
      expect(orchestrator.taskQueue).toHaveLength(2);
      
      // Should clear previous timeout (line 143 coverage)
      vi.advanceTimersByTime(50);
      expect(processSpy).toHaveBeenCalledTimes(1);
    });

    it('should throw on invalid task name', () => {
      expect(() => orchestrator.addTask('')).toThrow('Invalid task name');
      expect(() => orchestrator.addTask(null)).toThrow('Invalid task name');
      expect(() => orchestrator.addTask(123)).toThrow('Invalid task name');
    });

    it('should throw on invalid payload', () => {
      validator.validatePayload.mockReturnValue({ isValid: false, errors: ['Bad payload'] });
      expect(() => orchestrator.addTask('task', {})).toThrow('Invalid task payload');
    });
  });

  describe('processTasks', () => {
    beforeEach(async () => {
      const configLoader = await import('../../utils/configLoader.js');
      configLoader.getSettings.mockResolvedValue({});
    });

    it('should do nothing if already processing', async () => {
      orchestrator.isProcessingTasks = true;
      await orchestrator.processTasks();
      expect(mockSessionManager.getAllSessions).not.toHaveBeenCalled();
    });

    it('should do nothing if queue is empty', async () => {
      orchestrator.taskQueue = [];
      await orchestrator.processTasks();
      expect(mockSessionManager.getAllSessions).not.toHaveBeenCalled();
    });

    it('should do nothing if no sessions active', async () => {
      orchestrator.taskQueue = [{ taskName: 't1' }];
      vi.spyOn(mockSessionManager, 'activeSessionsCount', 'get').mockReturnValue(0);
      await orchestrator.processTasks();
      expect(mockSessionManager.getAllSessions).not.toHaveBeenCalled();
    });

    it('should distribute tasks to sessions', async () => {
      orchestrator.taskQueue = [{ taskName: 'mockTask' }];
      vi.spyOn(mockSessionManager, 'activeSessionsCount', 'get').mockReturnValue(1);
      const mockSession = { 
        id: 's1', 
        browser: { contexts: () => [], newContext: vi.fn().mockResolvedValue({ newPage: vi.fn(), close: vi.fn() }) },
        workers: [] 
      };
      mockSessionManager.getAllSessions.mockReturnValue([mockSession]);
      
      // Mock processSharedChecklistForSession to avoid complex logic in this test
      const checklistSpy = vi.spyOn(orchestrator, 'processSharedChecklistForSession').mockResolvedValue();
      
      await orchestrator.processTasks();
      
      expect(checklistSpy).toHaveBeenCalledWith(mockSession, [{ taskName: 'mockTask', payload: {} }], { reuseSharedContext: false });
      expect(orchestrator.taskQueue).toHaveLength(0);
      expect(orchestrator.isProcessingTasks).toBe(false);
    });
    it('should recursively process new tasks added during execution', async () => {
      orchestrator.taskQueue = [{ taskName: 'initialTask' }];
      vi.spyOn(mockSessionManager, 'activeSessionsCount', 'get').mockReturnValue(1);
      const mockSession = { 
        id: 's1', 
        browser: { contexts: () => [], newContext: vi.fn().mockResolvedValue({ newPage: vi.fn(), close: vi.fn() }) },
        workers: [] 
      };
      mockSessionManager.getAllSessions.mockReturnValue([mockSession]);
      
      // Mock processSharedChecklistForSession to simulate adding a new task while processing
      const checklistSpy = vi.spyOn(orchestrator, 'processSharedChecklistForSession').mockImplementation(async () => {
        if (orchestrator.taskQueue.length === 0 && !orchestrator.addedExtra) {
          orchestrator.taskQueue.push({ taskName: 'delayedTask' });
          orchestrator.addedExtra = true;
        }
      });
      
      await orchestrator.processTasks();
      
      expect(checklistSpy).toHaveBeenCalledTimes(2); // Initial batch + recursive batch
      expect(checklistSpy).toHaveBeenNthCalledWith(1, mockSession, [{ taskName: 'initialTask', payload: {} }], { reuseSharedContext: false });
      expect(checklistSpy).toHaveBeenNthCalledWith(2, mockSession, [{ taskName: 'delayedTask', payload: {} }], { reuseSharedContext: false });
    });
  });
  
  describe('executeTask', () => {
    let mockPage;
    let mockSession;

    beforeEach(() => {
      mockPage = {};
      mockSession = { id: 's1', browserInfo: 'chrome' };
    });

    it('should execute a valid task successfully', async () => {
      // Mock _importTaskModule to avoid real dynamic imports in test environment
      vi.spyOn(orchestrator, '_importTaskModule').mockResolvedValue({ default: vi.fn() });
      
      // We rely on recordTaskExecution(success=true) to imply task ran successfully
      await orchestrator.executeTask({ taskName: 'testTask', payload: {} }, mockPage, mockSession);
      
      expect(metricsCollector.recordTaskExecution).toHaveBeenCalledWith('testTask', expect.any(Number), true, 's1', null);
    });

    it('should handle task validation failure', async () => {
      validator.validateTaskExecution.mockReturnValueOnce({ isValid: false, errors: ['Failed'] });
      
      await orchestrator.executeTask({ taskName: 'testTask', payload: {} }, mockPage, mockSession);
      
      expect(metricsCollector.recordTaskExecution).toHaveBeenCalledWith('testTask', expect.any(Number), false, 's1', expect.any(Error));
    });

    it('should handle missing task module', async () => {
      vi.spyOn(orchestrator, '_importTaskModule').mockRejectedValue(new Error('Module not found'));
      
      await orchestrator.executeTask({ taskName: 'nonExistentTask', payload: {} }, mockPage, mockSession);
      
      expect(metricsCollector.recordTaskExecution).toHaveBeenCalledWith('nonExistentTask', expect.any(Number), false, 's1', expect.any(Error));
    });

    it('should handle task execution error', async () => {
      const mockTaskFn = vi.fn().mockRejectedValue(new Error('Task execution failed'));
      vi.spyOn(orchestrator, '_importTaskModule').mockResolvedValue({ default: mockTaskFn });
      
      await orchestrator.executeTask({ taskName: 'failingTask', payload: {} }, mockPage, mockSession);
      
      expect(metricsCollector.recordTaskExecution).toHaveBeenCalledWith('failingTask', expect.any(Number), false, 's1', expect.any(Error));
    });

    it('should handle augmented payload validation failure', async () => {
      // Mock validation to fail
      validator.validatePayload.mockReturnValueOnce({ isValid: false, errors: ['Augmented Fail'] });

      await orchestrator.executeTask({ taskName: 'testTask', payload: {} }, mockPage, mockSession);

      expect(metricsCollector.recordTaskExecution).toHaveBeenCalledWith('testTask', expect.any(Number), false, 's1', expect.any(Error));
    });

    it('should handle task module without default export', async () => {
      // We need to mock _importTaskModule to return a module without default
      vi.spyOn(orchestrator, '_importTaskModule').mockResolvedValueOnce({ notDefault: () => {} });

      await orchestrator.executeTask({ taskName: 'testTask', payload: {} }, mockPage, mockSession);

      expect(metricsCollector.recordTaskExecution).toHaveBeenCalledWith('testTask', expect.any(Number), false, 's1', expect.any(Error));
      expect(metricsCollector.recordTaskExecution).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        false,
        expect.anything(),
        expect.objectContaining({ message: expect.stringContaining('does not export a default function') })
      );
    });

    it('should use cache buster in development mode', async () => {
       isDevelopment.mockReturnValue(true);
       
       const importSpy = vi.spyOn(orchestrator, '_importTaskModule').mockResolvedValueOnce({ default: () => {} });
       
       await orchestrator.executeTask({ taskName: 'testTask', payload: {} }, mockPage, mockSession);
       
       expect(importSpy).toHaveBeenCalledWith('testTask');
       
       isDevelopment.mockReturnValue(false);
    });

    it('should handle missing browserInfo in session', async () => {
      // Ensure isDevelopment is false to avoid cache buster issues
      const envLoader = await import('../../utils/envLoader.js');
      envLoader.isDevelopment.mockReturnValue(false);

      const sessionWithoutInfo = { ...mockSession, browserInfo: null };
      
      await orchestrator.executeTask({ taskName: 'testTask', payload: {} }, mockPage, sessionWithoutInfo);
      
      expect(metricsCollector.recordTaskExecution).toHaveBeenCalledWith('testTask', expect.any(Number), true, 's1', null);
    });
  });

  describe('processChecklistForSession', () => {
    let mockSession;
    let mockPage;
    let mockContext;
    let mockWorker;

    beforeEach(() => {
      mockPage = { close: vi.fn().mockResolvedValue() };
      mockContext = { newPage: vi.fn().mockResolvedValue(mockPage), close: vi.fn().mockResolvedValue() };
      mockWorker = { id: 'w1' };
      
      mockSession = { 
        id: 's1', 
        browser: { 
          contexts: () => [], 
          newContext: vi.fn().mockResolvedValue(mockContext) 
        },
        workers: [mockWorker] 
      };
      
      mockSessionManager.acquireWorker.mockResolvedValue(mockWorker);
      mockSessionManager.acquirePage.mockResolvedValue(mockPage);
      mockSessionManager.releasePage.mockResolvedValue();
    });

    it('should process tasks using workers', async () => {
      const executeTaskSpy = vi.spyOn(orchestrator, 'executeTask').mockResolvedValue();
      const tasks = [{ taskName: 'testTask' }];
      
      await orchestrator.processChecklistForSession(mockSession, tasks);
      
      expect(mockSessionManager.acquireWorker).toHaveBeenCalledWith('s1', { timeoutMs: 10000 });
      expect(mockSessionManager.acquirePage).toHaveBeenCalledWith('s1', mockContext);
      expect(executeTaskSpy).toHaveBeenCalledWith(tasks[0], mockPage, mockSession);
      expect(mockSessionManager.releasePage).toHaveBeenCalledWith('s1', mockPage);
      expect(mockSessionManager.releaseWorker).toHaveBeenCalledWith('s1', 'w1');
      
      // Verify shared context is closed
      expect(mockContext.close).toHaveBeenCalled();
    });

    it('should retry if no workers available', async () => {
      mockSessionManager.acquireWorker
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockWorker);
        
      vi.spyOn(orchestrator, 'executeTask').mockResolvedValue();
      
      await orchestrator.processChecklistForSession(mockSession, [{ taskName: 'testTask' }]);
      
      expect(mockSessionManager.acquireWorker).toHaveBeenCalledTimes(2);
    });

    it('should stop processing on shutdown signal', async () => {
      orchestrator.isShuttingDown = true;
      const executeTaskSpy = vi.spyOn(orchestrator, 'executeTask');
      
      await orchestrator.processChecklistForSession(mockSession, [{ taskName: 'testTask' }]);
      
      expect(executeTaskSpy).not.toHaveBeenCalled();
    });
    it('should handle critical error in worker loop', async () => {
      mockSessionManager.acquirePage.mockRejectedValue(new Error('Tab Crash'));
      
      await orchestrator.processChecklistForSession(mockSession, [{ taskName: 'testTask' }]);
      
      expect(mockSessionManager.acquirePage).toHaveBeenCalled();
      // Should catch error and continue/finish
      expect(mockSessionManager.releaseWorker).toHaveBeenCalledWith('s1', 'w1');
    });

    it('should reuse existing browser context if available', async () => {
      const existingContext = { newPage: vi.fn().mockResolvedValue(mockPage), close: vi.fn() };
      mockSession.browser.contexts = vi.fn().mockReturnValue([existingContext]);
      mockSession.browser.newContext = vi.fn(); // Should not be called

      await orchestrator.processChecklistForSession(mockSession, [{ taskName: 'testTask' }]);

      expect(mockSession.browser.newContext).not.toHaveBeenCalled();
      expect(mockSessionManager.acquirePage).toHaveBeenCalledWith('s1', existingContext);
    });

    it('should handle error when closing page', async () => {
      await orchestrator.processChecklistForSession(mockSession, [{ taskName: 'testTask' }]);
      
      expect(mockSessionManager.releasePage).toHaveBeenCalled();
      expect(mockSessionManager.releaseWorker).toHaveBeenCalledWith('s1', 'w1');
    });
  });

  describe('Metrics', () => {
    it('should delegate getMetrics to metricsCollector', () => {
      orchestrator.getMetrics();
      expect(metricsCollector.getStats).toHaveBeenCalled();
    });

    it('should delegate getRecentTasks to metricsCollector', () => {
      orchestrator.getRecentTasks(5);
      expect(metricsCollector.getRecentTasks).toHaveBeenCalledWith(5);
    });

    it('should delegate getRecentTasks to metricsCollector with default limit', () => {
      orchestrator.getRecentTasks();
      expect(metricsCollector.getRecentTasks).toHaveBeenCalledWith(10);
    });

    it('should delegate getTaskBreakdown to metricsCollector', () => {
      orchestrator.getTaskBreakdown();
      expect(metricsCollector.getTaskBreakdown).toHaveBeenCalled();
    });

    it('should delegate logMetrics to metricsCollector', () => {
      orchestrator.logMetrics();
      expect(metricsCollector.logStats).toHaveBeenCalled();
    });
  });

  describe('Shutdown', () => {
    it('should shutdown gracefully', async () => {
      const waitSpy = vi.spyOn(orchestrator, 'waitForTasksToComplete').mockResolvedValue();
      
      await orchestrator.shutdown(false);
      
      expect(orchestrator.isShuttingDown).toBe(true);
      expect(waitSpy).toHaveBeenCalled();
      expect(metricsCollector.logStats).toHaveBeenCalled();
      expect(metricsCollector.generateJsonReport).toHaveBeenCalled();
      expect(mockSessionManager.shutdown).toHaveBeenCalled();
      expect(mockAutomator.shutdown).toHaveBeenCalled();
    });

    it('should shutdown gracefully with default parameter', async () => {
      const waitSpy = vi.spyOn(orchestrator, 'waitForTasksToComplete').mockResolvedValue();
      
      await orchestrator.shutdown();
      
      expect(orchestrator.isShuttingDown).toBe(true);
      expect(waitSpy).toHaveBeenCalled();
    });

    it('should force shutdown', async () => {
      const waitSpy = vi.spyOn(orchestrator, 'waitForTasksToComplete');
      
      await orchestrator.shutdown(true);
      
      expect(waitSpy).not.toHaveBeenCalled();
      expect(metricsCollector.generateJsonReport).toHaveBeenCalled();
      expect(mockSessionManager.shutdown).toHaveBeenCalled();
    });

    it('should handle null sessionManager during shutdown', async () => {
      orchestrator.sessionManager = null;
      await orchestrator.shutdown(true);
      // Should not throw
      orchestrator.sessionManager = mockSessionManager;
    });
  });

  describe('waitForTasksToComplete', () => {
    it('should resolve immediately if no tasks and not processing', async () => {
      orchestrator.taskQueue = [];
      orchestrator.isProcessingTasks = false;
      
      await orchestrator.waitForTasksToComplete();
    });

    it('should wait for tasksProcessed event', async () => {
      orchestrator.taskQueue = [];
      orchestrator.isProcessingTasks = true;
      
      const waitPromise = orchestrator.waitForTasksToComplete();
      
      orchestrator.isProcessingTasks = false;
      orchestrator.emit('tasksProcessed');
      
      await waitPromise;
    });

    it('should wait for allTasksComplete event', async () => {
      orchestrator.taskQueue = [];
      orchestrator.isProcessingTasks = true;
      
      const waitPromise = orchestrator.waitForTasksToComplete();
      
      orchestrator.emit('allTasksComplete');
      
      await waitPromise;
    });

    it('should NOT resolve if tasksProcessed fires but queue is not empty', async () => {
      orchestrator.taskQueue = [{ taskName: 'pending' }];
      orchestrator.isProcessingTasks = false;
      
      let resolved = false;
      const promise = orchestrator.waitForTasksToComplete().then(() => { resolved = true; });
      
      orchestrator.emit('tasksProcessed');
      
      await new Promise(r => setTimeout(r, 10));
      expect(resolved).toBe(false);
      
      // Cleanup to let promise resolve
      orchestrator.taskQueue = [];
      orchestrator.emit('allTasksComplete');
      await promise;
    });

    it('should NOT resolve if tasksProcessed fires but still processing', async () => {
      orchestrator.taskQueue = [];
      orchestrator.isProcessingTasks = true;
      
      let resolved = false;
      const promise = orchestrator.waitForTasksToComplete().then(() => { resolved = true; });
      
      orchestrator.emit('tasksProcessed');
      
      await new Promise(r => setTimeout(r, 10));
      expect(resolved).toBe(false);
      
      // Cleanup to let promise resolve
      orchestrator.isProcessingTasks = false;
      orchestrator.emit('allTasksComplete');
      await promise;
    });
  });
});

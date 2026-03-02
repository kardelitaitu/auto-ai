import { describe, it, expect, vi, beforeEach } from 'vitest';
import Orchestrator from '../../api/core/orchestrator.js';
import { TaskTimeoutError } from '../../api/core/errors.js';

// Mock dependencies
vi.mock('../../api/core/sessionManager.js');
vi.mock('../../api/core/discovery.js');
vi.mock('../../api/core/automator.js');
vi.mock('../../api/utils/metrics.js');
vi.mock('../../api/utils/logger.js', () => ({
    createLogger: () => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    }),
}));

vi.mock('../../api/utils/configLoader.js', () => ({
    getSettings: () => ({}),
    getTimeoutValue: () => 100,
}));

describe('Orchestrator Timeout Logic', () => {
    let orchestrator;
    let mockSessionManager;

    beforeEach(() => {
        vi.clearAllMocks();
        orchestrator = new Orchestrator();
        mockSessionManager = orchestrator.sessionManager;
        orchestrator.taskMaxDurationMs = 100; // Set a short timeout for testing
    });

    it('should throw TaskTimeoutError when a task exceeds taskMaxDurationMs', async () => {
        const mockTask = {
            taskName: 'hanging-task',
            modulePath: './tasks/hanging.js',
            payload: {}
        };

        const mockSession = { id: 'session-1' };
        const mockPage = {
            close: vi.fn(),
            isClosed: () => false
        };

        mockSessionManager.acquireWorker.mockResolvedValue(1);
        mockSessionManager.getSession.mockReturnValue(mockSession);
        mockSessionManager.getWorkerPage.mockResolvedValue(mockPage);

        // Mock task module that hangs
        const hangingTaskModule = {
            default: () => new Promise(resolve => setTimeout(resolve, 500))
        };

        orchestrator._importTaskModule = vi.fn().mockResolvedValue(hangingTaskModule);

        await expect(orchestrator.executeTask(mockTask, mockSession)).rejects.toThrow(TaskTimeoutError);
        expect(mockSessionManager.releaseWorker).toHaveBeenCalledWith(mockSession.id, 1);
    });

    it('should succeed when a task completes within taskMaxDurationMs', async () => {
        const mockTask = {
            taskName: 'fast-task',
            modulePath: './tasks/fast.js',
            payload: {}
        };

        const mockSession = { id: 'session-1' };
        const mockPage = {
            close: vi.fn(),
            isClosed: () => false
        };

        mockSessionManager.acquireWorker.mockResolvedValue(1);
        mockSessionManager.getSession.mockReturnValue(mockSession);
        mockSessionManager.getWorkerPage.mockResolvedValue(mockPage);

        // Mock task module that completes fast
        const fastTaskModule = {
            default: vi.fn().mockResolvedValue({ success: true })
        };

        orchestrator._importTaskModule = vi.fn().mockResolvedValue(fastTaskModule);

        await expect(orchestrator.executeTask(mockTask, mockSession)).resolves.not.toThrow();
        expect(fastTaskModule.default).toHaveBeenCalled();
        expect(mockSessionManager.releaseWorker).toHaveBeenCalledWith(mockSession.id, 1);
    });
});

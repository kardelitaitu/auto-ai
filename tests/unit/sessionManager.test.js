import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SessionManager from '../../core/sessionManager.js';

// Mocks
const mockSqlite = {
    pragma: vi.fn(),
    exec: vi.fn(),
    prepare: vi.fn().mockReturnValue({
        run: vi.fn(),
        all: vi.fn().mockReturnValue([]),
        get: vi.fn()
    }),
    transaction: vi.fn(fn => fn)
};

vi.mock('better-sqlite3', () => ({
    default: vi.fn(() => mockSqlite)
}));

vi.mock('../../utils/configLoader.js', () => ({
    getTimeoutValue: vi.fn().mockResolvedValue({}),
    getSettings: vi.fn().mockResolvedValue({ concurrencyPerBrowser: 1 })
}));

vi.mock('../../utils/logger.js', () => ({
    createLogger: vi.fn(() => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }))
}));

import { getTimeoutValue } from '../../utils/configLoader.js';

describe('SessionManager', () => {
    let manager;

    beforeEach(async () => {
        vi.clearAllMocks();
        getTimeoutValue.mockResolvedValue({});
        manager = new SessionManager();
        await new Promise(resolve => setTimeout(resolve, 50));
    });

    afterEach(async () => {
        if (manager) {
            manager.stopCleanupTimer();
        }
    });

    it('should initialize with default values', () => {
        expect(manager.sessions).toEqual([]);
        // loadConfiguration() runs asynchronously and getSettings is mocked to return { concurrencyPerBrowser: 1 }
        expect(manager.concurrencyPerBrowser).toBe(1);
    });

    it('should add a session', () => {
        const browser = { close: vi.fn(), contexts: () => [] };
        const id = manager.addSession(browser, 'test-profile');
        expect(id).toBe('test-profile');
        expect(manager.sessions.length).toBe(1);
    });

    it('should remove a session', () => {
        const browser = { close: vi.fn(), contexts: () => [] };
        const id = manager.addSession(browser, 'test-profile');
        manager.removeSession(id);
        expect(manager.sessions.length).toBe(0);
    });

    it('should acquire and release a worker', async () => {
        const browser = { close: vi.fn(), contexts: () => [] };
        const id = manager.addSession(browser, 'test-profile');
        const worker = await manager.acquireWorker(id);
        expect(worker).toBeDefined();
        expect(worker.status).toBe('busy');
        
        await manager.releaseWorker(id, worker.id);
        expect(worker.status).toBe('idle');
    });

    it('should handle session timeout', async () => {
        const browser = { close: vi.fn(), contexts: () => [] };
        manager.sessionTimeoutMs = 10;
        const id = manager.addSession(browser, 'test-profile');
        
        const session = manager.sessions[0];
        session.lastActivity = Date.now() - 100;
        
        const removedCount = await manager.cleanupTimedOutSessions();
        expect(removedCount).toBe(1);
        expect(manager.sessions.length).toBe(0);
    });
});

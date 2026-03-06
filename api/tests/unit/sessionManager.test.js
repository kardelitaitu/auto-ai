import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SessionManager from '@api/core/sessionManager.js';
import { SimpleSemaphore } from '@api/core/sessionManager.js';

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

vi.mock('../../core/logger.js', () => ({
    createLogger: vi.fn(() => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }))
}));

vi.mock('../../utils/metrics.js', () => ({
    default: {
        increment: vi.fn(),
        decrement: vi.fn(),
        gauge: vi.fn(),
        timing: vi.fn(),
        recordSessionEvent: vi.fn()
    }
}));

import { getTimeoutValue } from '@api/utils/configLoader.js';

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
        const browser = {
            close: vi.fn(),
            contexts: () => [],
            newContext: vi.fn().mockResolvedValue({
                newPage: vi.fn().mockResolvedValue({ on: vi.fn(), close: vi.fn() })
            })
        };
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

    describe('SimpleSemaphore', () => {
        it('should acquire and release permit', async () => {
            const sem = new SimpleSemaphore(1);
            const p1 = await sem.acquire();
            expect(p1).toBe(true);

            let p2Acquired = false;
            sem.acquire().then(() => { p2Acquired = true; });

            expect(p2Acquired).toBe(false);
            sem.release();

            await new Promise(r => setTimeout(r, 10));
            expect(p2Acquired).toBe(true);
        });

        it('should timeout if permit not available', async () => {
            const sem = new SimpleSemaphore(1);
            await sem.acquire();
            const p2 = await sem.acquire(10);
            expect(p2).toBe(false);
        });
    });

    describe('Advanced functionality', () => {
        it('should shutdown all sessions', async () => {
            const browser = { close: vi.fn(), contexts: () => [] };
            manager.addSession(browser, 's1');
            manager.addSession(browser, 's2');

            await manager.shutdown();
            expect(browser.close).toHaveBeenCalledTimes(2);
            expect(manager.sessions.length).toBe(0);
        });

        it('should recover sessions from database', async () => {
            const mockAll = vi.fn()
                .mockReturnValueOnce([{ id: 'db-session', browserInfo: '{}', wsEndpoint: 'ws://', workers: '[]', createdAt: Date.now(), lastActivity: Date.now() }])
                .mockReturnValueOnce([{ key: 'nextSessionId', value: '5' }]);

            manager.db = {
                prepare: vi.fn().mockReturnValue({
                    all: mockAll
                })
            };

            const state = await manager.loadSessionState();
            expect(state).not.toBeNull();
            expect(state.rows.length).toBe(1);
            expect(state.rows[0].id).toBe('db-session');
            expect(state.meta.nextSessionId).toBe('5');
        });
    });
});

/**
 * @fileoverview Unit tests for core/sessionManager.js
 * @module tests/unit/session-manager.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SessionManager from '../../core/sessionManager.js';
import fs from 'fs/promises';
import { getTimeoutValue, getSettings } from '../../utils/configLoader.js';

const mocks = vi.hoisted(() => ({
    fs: {
        writeFile: vi.fn(),
        readFile: vi.fn(),
        mkdir: vi.fn()
    },
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

vi.mock('fs/promises', () => ({
    default: mocks.fs,
    writeFile: mocks.fs.writeFile,
    readFile: mocks.fs.readFile,
    mkdir: mocks.fs.mkdir
}));
vi.mock('../../utils/logger.js', () => ({
    createLogger: vi.fn(() => mocks.logger)
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

describe('core/sessionManager', () => {
    let manager;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();

        getTimeoutValue.mockResolvedValue({ timeoutMs: 1000, cleanupIntervalMs: 500 });
        getSettings.mockResolvedValue({ concurrencyPerBrowser: 2 });

        manager = new SessionManager();
    });

    afterEach(() => {
        manager.stopCleanupTimer();
        vi.useRealTimers();
    });

    describe('Initialization', () => {
        it('should initialize with defaults', () => {
            // Override mock for this specific test to return empty settings
            getSettings.mockResolvedValueOnce({});
            const defaultManager = new SessionManager();
            expect(defaultManager.sessions).toEqual([]);
            // Wait for next tick to ensure loadConfiguration (called in constructor) settles
            // But since we can't await constructor, we might need to check if loadConfiguration updates it
            // However, concurrencyPerBrowser is 1 by default in constructor. 
            // If getSettings returns {}, it stays 1.
            expect(defaultManager.concurrencyPerBrowser).toBe(1);
            defaultManager.stopCleanupTimer();
        });

        it('should load configuration async', async () => {
            await manager.loadConfiguration();
            expect(manager.sessionTimeoutMs).toBe(1000);
            expect(manager.concurrencyPerBrowser).toBe(2);
        });

        it('should restart timer if already running on config load', async () => {
            manager.cleanupInterval = 123;
            await manager.loadConfiguration();
            expect(manager.cleanupInterval).not.toBe(123);
        });

        it('should handle config load error gracefully', async () => {
            getTimeoutValue.mockRejectedValue(new Error('config error'));
            const mgr = new SessionManager();
            await mgr.loadConfiguration();
            expect(mgr.sessionTimeoutMs).toBe(1800000); // default 30min
        });

        it('should initialize via loadConfiguration() and start timer', async () => {
            await manager.loadConfiguration();
            expect(manager.cleanupInterval).toBeDefined();
        });
    });

    describe('Session Management', () => {
        it('should add a session with generated ID', () => {
            const browser = { close: vi.fn() };
            const id = manager.addSession(browser);

            expect(id).toBe('session-1');
            expect(manager.sessions.length).toBe(1);
            // expect 2 because getSettings mock returns concurrencyPerBrowser: 2
            expect(manager.sessions[0].workers.length).toBe(2); 
        });

        it('should add a session with custom browserInfo', () => {
            const browser = { close: vi.fn() };
            const id = manager.addSession(browser, 'profile-1');

            expect(id).toBe('profile-1');
            expect(manager.sessions[0].id).toBe('profile-1');
        });

        it('should register and unregister pages', () => {
            const browser = { close: vi.fn() };
            const id = manager.addSession(browser);
            const page = { close: vi.fn() };

            manager.registerPage(id, page);
            expect(manager.sessions[0].managedPages.has(page)).toBe(true);

            manager.unregisterPage(id, page);
            expect(manager.sessions[0].managedPages.has(page)).toBe(false);
        });

        it('should ignore register/unregister for unknown session', () => {
            manager.registerPage('unknown', {});
            manager.unregisterPage('unknown', {});
        });

        it('should remove session', () => {
            const id = manager.addSession({});
            const result = manager.removeSession(id);
            expect(result).toBe(true);
            expect(manager.sessions.length).toBe(0);
        });

        it('should return false when removing unknown session', () => {
            expect(manager.removeSession('unknown')).toBe(false);
        });
    });

    describe('Page Pooling', () => {
        it('should reuse pages from the pool', async () => {
            const browser = { close: vi.fn() };
            const id = manager.addSession(browser);
            const context = { newPage: vi.fn() };
            const page = { close: vi.fn(), isClosed: vi.fn(() => false) };
            context.newPage.mockResolvedValue(page);

            const firstPage = await manager.acquirePage(id, context);
            await manager.releasePage(id, firstPage);
            const secondPage = await manager.acquirePage(id, context);

            expect(firstPage).toBe(page);
            expect(secondPage).toBe(page);
            expect(context.newPage).toHaveBeenCalledTimes(1);
        });

        it('should create a new page when pooled pages are closed', async () => {
            const browser = { close: vi.fn() };
            const id = manager.addSession(browser);
            const context = { newPage: vi.fn() };
            const closedPage = { close: vi.fn(), isClosed: vi.fn(() => true) };
            const newPage = { close: vi.fn(), isClosed: vi.fn(() => false) };
            context.newPage.mockResolvedValue(newPage);

            manager.sessions[0].pagePool.push(closedPage);
            const page = await manager.acquirePage(id, context);

            expect(page).toBe(newPage);
            expect(context.newPage).toHaveBeenCalledTimes(1);
        });

        it('should close pages when pool is full', async () => {
            const browser = { close: vi.fn() };
            const id = manager.addSession(browser);
            const context = { newPage: vi.fn() };
            const pageA = { close: vi.fn(), isClosed: vi.fn(() => false) };
            const pageB = { close: vi.fn(), isClosed: vi.fn(() => false) };
            context.newPage.mockResolvedValueOnce(pageA).mockResolvedValueOnce(pageB);

            const firstPage = await manager.acquirePage(id, context);
            await manager.releasePage(id, firstPage);
            manager.pagePoolMaxPerSession = 1;
            await manager.releasePage(id, pageB);

            expect(pageB.close).toHaveBeenCalled();
        });
    });

    describe('Worker Allocation', () => {
        it('should occupy and release worker', async () => {
            const id = manager.addSession({});
            const worker = await manager.findAndOccupyIdleWorker(id);

            expect(worker.status).toBe('busy');
            expect(manager.getWorkerOccupancy(id)['0']).toBeDefined();

            await manager.releaseWorker(id, worker.id);
            expect(worker.status).toBe('idle');
            expect(manager.getWorkerOccupancy(id)['0']).toBeUndefined();
        });

        it('should return null if session not found', async () => {
            const worker = await manager.findAndOccupyIdleWorker('unknown');
            expect(worker).toBeNull();
        });

        it('should return null if no idle workers', async () => {
            const id = manager.addSession({});
            await manager.findAndOccupyIdleWorker(id); // Take worker 0
            await manager.findAndOccupyIdleWorker(id); // Take worker 1

            const worker = await manager.findAndOccupyIdleWorker(id);
            expect(worker).toBeNull();
        });

        it('should handle lock timeout', async () => {
            const id = manager.addSession({});
            manager.workerLocks.set(id, new Promise(() => { }));
            const promise = manager.findAndOccupyIdleWorker(id);
            vi.advanceTimersByTime(11000);
            await expect(promise).rejects.toThrow('Worker lock timeout');
        });

        it('should handle releaseWorker for unknown session or worker', async () => {
            await manager.releaseWorker('unknown', 0);
            const id = manager.addSession({});
            await manager.releaseWorker(id, 999);
        });

        it('should handle releaseWorker for idle worker', async () => {
            const id = manager.addSession({});
            await manager.releaseWorker(id, 0); // Already idle
        });

        it('should detect stuck workers', async () => {
            const id = manager.addSession({});
            await manager.findAndOccupyIdleWorker(id);
            manager.sessionTimeoutMs = 120000;
            vi.advanceTimersByTime(70000);
            const stuck = manager.getStuckWorkers(60000);
            expect(stuck.length).toBe(1);
            expect(stuck[0].sessionId).toBe(id);
        });
    });

    describe('Cleanup & Timeout', () => {
        it('should cleanup timed out sessions', async () => {
            const browser = { close: vi.fn() };
            manager.sessionTimeoutMs = 1000;
            manager.addSession(browser);

            vi.setSystemTime(Date.now() + 2000);
            const removed = await manager.cleanupTimedOutSessions();
            expect(removed).toBe(1);
            expect(manager.sessions.length).toBe(0);
            expect(browser.close).toHaveBeenCalled();
        });

        it('should return 0 if no sessions to cleanup', async () => {
            const removed = await manager.cleanupTimedOutSessions();
            expect(removed).toBe(0);
        });

        it('should handle errors in cleanup', async () => {
            const id = manager.addSession({ close: vi.fn().mockRejectedValue(new Error('fail')) });
            const page = { close: vi.fn().mockRejectedValue(new Error('fail')) };
            manager.registerPage(id, page);
            manager.sessionTimeoutMs = -1;

            await manager.cleanupTimedOutSessions();
            expect(page.close).toHaveBeenCalled();
        });
    });

    describe('Persistence', () => {
        it('should save session state', async () => {
            manager.addSession({}, 'p1');
            await manager.saveSessionState();
            expect(fs.writeFile).toHaveBeenCalled();
        });

        it('should handle save error', async () => {
            fs.writeFile.mockRejectedValue(new Error('disk full'));
            await manager.saveSessionState();
        });

        it('should load session state', async () => {
            fs.readFile.mockResolvedValue(JSON.stringify({
                sessions: [{ id: 's1' }],
                nextSessionId: 5
            }));
            const state = await manager.loadSessionState();
            expect(state.sessions.length).toBe(1);
            expect(manager.nextSessionId).toBe(5);
        });

        it('should handle load errors', async () => {
            const e1 = new Error(); e1.code = 'ENOENT';
            fs.readFile.mockRejectedValueOnce(e1);
            expect(await manager.loadSessionState()).toBeNull();

            const e2 = new Error(); e2.code = 'EACCES';
            fs.readFile.mockRejectedValueOnce(e2);
            expect(await manager.loadSessionState()).toBeNull();
        });
    });

    describe('Metadata & Helpers', () => {
        it('should return session metadata', () => {
            manager.addSession({}, 'p1');
            const meta = manager.getSessionMetadata();
            expect(meta.length).toBe(1);
            expect(meta[0].browserInfo).toBe('p1');
            expect(meta[0].age).toBeGreaterThanOrEqual(0);
        });

        it('_getCurrentExecutionContext should handle errors', () => {
            const originalError = global.Error;
            global.Error = function () { return {}; };
            const context = manager._getCurrentExecutionContext();
            expect(context).toBe('unknown');
            global.Error = originalError;
        });
    });

    describe('Shutdown', () => {
        it('should close everything on shutdown', async () => {
            const browser = { close: vi.fn() };
            manager.addSession(browser);
            await manager.shutdown();
            expect(browser.close).toHaveBeenCalled();
        });
    });
});

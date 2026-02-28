import { AsyncLocalStorage } from 'node:async_hooks';
import { GhostCursor } from '../utils/ghostCursor.js';
import { getDefaultState, setContextStore } from './context-state.js';
import { APIEvents } from './events.js';
import { PluginManager } from './plugins/manager.js';
import { loggerContext } from './logger.js';
import { randomUUID } from 'crypto';
import { ContextNotInitializedError, PageClosedError, SessionDisconnectedError } from './errors.js';

const contextStore = new AsyncLocalStorage();
setContextStore(contextStore);

// Global cache for session stores, indexed by Page instance
const sessionCache = new WeakMap();

function createStore(page) {
    if (sessionCache.has(page)) {
        return sessionCache.get(page);
    }

    const events = new APIEvents();
    const plugins = new PluginManager(events);

    const store = {
        page,
        cursor: new GhostCursor(page),
        state: getDefaultState(),
        events,
        plugins,
        intervals: new Map(),
    };

    sessionCache.set(page, store);
    return store;
}

/**
 * Get a session-bound interval.
 * @param {string} name - Interval identifier
 * @returns {number|null}
 */
export function getInterval(name) {
    const store = contextStore.getStore();
    return store?.intervals?.get(name) || null;
}

/**
 * Set a session-bound interval.
 * @param {string} name - Interval identifier
 * @param {Function} fn - Function to execute
 * @param {number} ms - Delay in milliseconds
 */
export function setSessionInterval(name, fn, ms) {
    const store = contextStore.getStore();
    if (!store) return;

    // Clear existing if any
    if (store.intervals.has(name)) {
        clearInterval(store.intervals.get(name));
    }

    const id = setInterval(async () => {
        try {
            // Ensure the callback runs within the specific session context
            await contextStore.run(store, async () => {
                // Only execute if the page is still alive
                if (store.page && !store.page.isClosed()) {
                    await fn();
                } else {
                    // Auto-cleanup if page is dead
                    clearInterval(id);
                    store.intervals.delete(name);
                }
            });
        } catch (e) {
            // Prevent unhandled rejections from crashing the process
            console.debug(`[SessionInterval Error] ${name}:`, e.message || e);
            // If the error is session-related, stop the interval
            if (e.message?.includes('SessionDisconnectedError') || e.message?.includes('closed')) {
                clearInterval(id);
                store.intervals.delete(name);
            }
        }
    }, ms);

    store.intervals.set(name, id);
    return id;
}

/**
 * Clear a session-bound interval.
 * @param {string} name - Interval identifier
 */
export function clearSessionInterval(name) {
    const store = contextStore.getStore();
    if (!store) return;

    const id = store.intervals.get(name);
    if (id) {
        clearInterval(id);
        store.intervals.delete(name);
    }
}

/**
 * Get the current context store.
 * @returns {object|null}
 */
export function getStore() {
    return contextStore.getStore();
}

/**
 * Executes a function within an isolated page context.
 * Best practice for orchestrating multiple concurrent agents.
 * 
 * @param {import('playwright').Page} page - Playwright page instance
 * @param {Function} asyncFn - Async function to execute with this page bound
 * @returns {Promise<any>}
 */
export async function withPage(page, asyncFn) {
    if (!page) throw new Error('withPage requires a valid Playwright page instance.');

    // If we are already in a context for THIS page, just continue
    const existingStore = getStore();
    if (existingStore && existingStore.page === page) {
        return await asyncFn();
    }

    // Logging context integration
    const existingContext = loggerContext.getStore();
    const sessionId = existingContext?.sessionId || `session-${randomUUID().slice(0, 8)}`;
    const traceId = existingContext?.traceId || randomUUID();

    const store = createStore(page);

    return loggerContext.run({ sessionId, traceId }, async () => {
        return contextStore.run(store, asyncFn);
    });
}

/**
 * Checks if the current page and browser are active.
 * @returns {boolean}
 */
export function isSessionActive() {
    const store = contextStore.getStore();
    if (!store || !store.page) return false;
    return !store.page.isClosed() && store.page.context().browser()?.isConnected() !== false;
}

/**
 * Verify session health and throw descriptive error if dead.
 * @throws {ContextNotInitializedError}
 * @throws {PageClosedError}
 * @throws {SessionDisconnectedError}
 */
export function checkSession() {
    const store = contextStore.getStore();
    if (!store || !store.page) {
        throw new ContextNotInitializedError();
    }
    if (store.page.isClosed()) {
        throw new PageClosedError();
    }
    if (store.page.context().browser()?.isConnected() === false) {
        throw new SessionDisconnectedError();
    }
}

/**
 * Get the active Playwright page.
 * @returns {import('playwright').Page}
 * @throws {Error} If page context is uninitialized or dead
 */
export function getPage() {
    checkSession();
    return contextStore.getStore().page;
}

export async function evalPage(pageFunction, ...args) {
    const page = getPage();
    return page.evaluate(pageFunction, ...args);
}

/**
 * Get the GhostCursor tied to the current page.
 * @returns {GhostCursor}
 * @throws {Error} If page context is uninitialized or dead
 */
export function getCursor() {
    checkSession();
    return contextStore.getStore().cursor;
}

/**
 * Get the APIEvents instance tied to the current page.
 * @returns {APIEvents}
 * @throws {Error} If page context is uninitialized or dead
 */
export function getEvents() {
    checkSession();
    return contextStore.getStore().events;
}

/**
 * Get the PluginManager instance tied to the current page.
 * @returns {PluginManager}
 * @throws {Error} If page context is uninitialized or dead
 */
export function getPlugins() {
    checkSession();
    return contextStore.getStore().plugins;
}

/**
 * Tear down the current context.
 * Useful for forceful cleanup, though AsyncLocalStorage garbage collects automatically.
 */
export function clearContext() {
    const store = contextStore.getStore();
    if (store && store.intervals) {
        for (const [_name, id] of store.intervals) {
            clearInterval(id);
        }
        store.intervals.clear();
    }
    // enterWith(null) clears the current execution tree's store
    contextStore.enterWith(null);
}

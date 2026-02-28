/**
 * @fileoverview Lightweight Internal Logger for the api/ module.
 * Provides `createLogger(name)` and `loggerContext` (AsyncLocalStorage).
 * 
 * This is an api/-internal logger. It delegates output to console.* only.
 * The outer application's utils/logger.js handles file I/O and buffering.
 * 
 * @module api/core/logger
 */

import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * AsyncLocalStorage for session/trace context propagation.
 * Used by core/context.js to bind sessionId and traceId to log lines.
 * @type {AsyncLocalStorage<{sessionId: string, traceId: string, taskName?: string}>}
 */
export const loggerContext = new AsyncLocalStorage();

export function runWithContext(context, fn) {
    return loggerContext.run(context, fn);
}

// Minimal ANSI color codes for console output
const C = {
    RESET: '\x1b[0m',
    DIM: '\x1b[2m',
    CYAN: '\x1b[36m',
    GREEN: '\x1b[32m',
    YELLOW: '\x1b[33m',
    RED: '\x1b[31m',
    GRAY: '\x1b[90m',
    ORANGE: '\x1b[38;5;208m',
};

class Logger {
    constructor(scriptName) {
        this.scriptName = scriptName;
    }

    _prefix(icon, color) {
        let sessionPart = '';
        try {
            const ctx = loggerContext.getStore();
            if (ctx?.sessionId) {
                sessionPart = `[${ctx.sessionId}]`;
            }
        } catch (_e) {
            // Fallback to no session info if ALC fails
        }

        const time = new Date().toLocaleTimeString('en-US', { hour12: false });
        return `${C.DIM}${time}${C.RESET} ${color}${icon}${C.RESET} ${C.ORANGE}[${this.scriptName}]${C.RESET}${sessionPart}`;
    }

    info(message, ...args) {
        try {
            console.log(`${this._prefix('🔵', C.CYAN)} ${message}`, ...args);
        } catch { /* Suppress logs during teardown */ }
    }

    success(message, ...args) {
        try {
            console.log(`${this._prefix('🟢', C.GREEN)} ${message}`, ...args);
        } catch { /* Suppress logs during teardown */ }
    }

    warn(message, ...args) {
        try {
            console.warn(`${this._prefix('🟡', C.YELLOW)} ${message}`, ...args);
        } catch { /* Suppress logs during teardown */ }
    }

    error(message, ...args) {
        try {
            console.error(`${this._prefix('🔴', C.RED)} ${message}`, ...args);
        } catch { /* Suppress logs during teardown */ }
    }

    debug(message, ...args) {
        try {
            console.debug(`${this._prefix('⚪', C.GRAY)} ${message}`, ...args);
        } catch { /* Suppress logs during teardown */ }
    }
}

/**
 * Creates a new Logger instance scoped to the given module name.
 * @param {string} scriptName
 * @returns {{ info, success, warn, error, debug }}
 */
export function createLogger(scriptName) {
    return new Logger(scriptName);
}

export default Logger;

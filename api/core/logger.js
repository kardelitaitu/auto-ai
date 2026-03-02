/**
 * @fileoverview Lightweight Internal Logger for the api/ module.
 * Provides `createLogger(name)` and `loggerContext` (AsyncLocalStorage).
 * 
 * This is an api/-internal wrapper for the robust utils/logger.js.
 * It manages AsyncLocalStorage context while delegating output to the utility logger.
 * 
 * @module api/core/logger
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import { createLogger as createUtilLogger } from '../utils/logger.js';

/**
 * AsyncLocalStorage for session/trace context propagation.
 * Used by core/context.js to bind sessionId and traceId to log lines.
 * @type {AsyncLocalStorage<{sessionId: string, traceId: string, taskName?: string}>}
 */
export const loggerContext = new AsyncLocalStorage();

export function runWithContext(context, fn) {
    return loggerContext.run(context, fn);
}

class Logger {
    constructor(scriptName) {
        this.scriptName = scriptName;
        this._logger = createUtilLogger(scriptName);
    }

    _getContext() {
        try {
            return loggerContext.getStore() || {};
        } catch (_e) {
            return {};
        }
    }

    info(message, ...args) {
        this._logger.info(message, ...args);
    }

    success(message, ...args) {
        this._logger.success(message, ...args);
    }

    warn(message, ...args) {
        this._logger.warn(message, ...args);
    }

    error(message, ...args) {
        this._logger.error(message, ...args);
    }

    debug(message, ...args) {
        this._logger.debug(message, ...args);
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

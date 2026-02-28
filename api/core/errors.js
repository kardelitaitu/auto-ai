/**
 * @fileoverview Centralized Error Definitions
 * Provides custom error classes with codes for the automation framework.
 * 
 * @module api/core/errors
 */

/**
 * Base error class for all automation errors
 */
export class AutomationError extends Error {
    /**
     * @param {string} message - Error message
     * @param {string} [code='AUTOMATION_ERROR'] - Error code
     */
    constructor(message, code = 'AUTOMATION_ERROR') {
        super(message);
        this.name = 'AutomationError';
        this.code = code;
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Session-related errors
 */
export class SessionError extends AutomationError {
    constructor(message, code = 'SESSION_ERROR') {
        super(message, code);
        this.name = 'SessionError';
    }
}

export class SessionDisconnectedError extends SessionError {
    constructor(message = 'Session has been disconnected') {
        super(message, 'SESSION_DISCONNECTED');
        this.name = 'SessionDisconnectedError';
    }
}

export class SessionNotFoundError extends SessionError {
    constructor(sessionId) {
        super(`Session not found: ${sessionId}`, 'SESSION_NOT_FOUND');
        this.name = 'SessionNotFoundError';
    }
}

export class SessionTimeoutError extends SessionError {
    constructor(message = 'Session timed out') {
        super(message, 'SESSION_TIMEOUT');
        this.name = 'SessionTimeoutError';
    }
}

/**
 * Page/context errors
 */
export class ContextError extends AutomationError {
    constructor(message, code = 'CONTEXT_ERROR') {
        super(message, code);
        this.name = 'ContextError';
    }
}

export class ContextNotInitializedError extends ContextError {
    constructor(message = 'API context not initialized. Use api.withPage(page, fn) first.') {
        super(message, 'CONTEXT_NOT_INITIALIZED');
        this.name = 'ContextNotInitializedError';
    }
}

export class PageClosedError extends ContextError {
    constructor(message = 'Page has been closed') {
        super(message, 'PAGE_CLOSED');
        this.name = 'PageClosedError';
    }
}

/**
 * Element/selector errors
 */
export class ElementError extends AutomationError {
    constructor(message, code = 'ELEMENT_ERROR') {
        super(message, code);
        this.name = 'ElementError';
    }
}

export class ElementNotFoundError extends ElementError {
    constructor(selector) {
        super(`Element not found: ${selector}`, 'ELEMENT_NOT_FOUND');
        this.name = 'ElementNotFoundError';
    }
}

export class ElementDetachedError extends ElementError {
    constructor(selector = 'element') {
        super(`Element has been detached from DOM: ${selector}`, 'ELEMENT_DETACHED');
        this.name = 'ElementDetachedError';
    }
}

export class ElementObscuredError extends ElementError {
    constructor(selector = 'element') {
        super(`Element is obscured by another element: ${selector}`, 'ELEMENT_OBSCURED');
        this.name = 'ElementObscuredError';
    }
}

export class ElementTimeoutError extends ElementError {
    constructor(selector, timeout) {
        super(`Element not found within timeout (${timeout}ms): ${selector}`, 'ELEMENT_TIMEOUT');
        this.name = 'ElementTimeoutError';
    }
}

/**
 * Action errors
 */
export class ActionError extends AutomationError {
    constructor(message, code = 'ACTION_ERROR') {
        super(message, code);
        this.name = 'ActionError';
    }
}

export class ActionFailedError extends ActionError {
    constructor(action, reason) {
        super(`Action '${action}' failed: ${reason}`, 'ACTION_FAILED');
        this.name = 'ActionFailedError';
        this.action = action;
    }
}

export class NavigationError extends ActionError {
    constructor(url, reason) {
        super(`Navigation to ${url} failed: ${reason}`, 'NAVIGATION_ERROR');
        this.name = 'NavigationError';
        this.url = url;
    }
}

/**
 * Configuration errors
 */
export class ConfigError extends AutomationError {
    constructor(message, code = 'CONFIG_ERROR') {
        super(message, code);
        this.name = 'ConfigError';
    }
}

export class ConfigNotFoundError extends ConfigError {
    constructor(key) {
        super(`Configuration key not found: ${key}`, 'CONFIG_NOT_FOUND');
        this.name = 'ConfigNotFoundError';
    }
}

/**
 * LLM/AI errors
 */
export class LLMError extends AutomationError {
    constructor(message, code = 'LLM_ERROR') {
        super(message, code);
        this.name = 'LLMError';
    }
}

export class LLMTimeoutError extends LLMError {
    constructor(message = 'LLM request timed out') {
        super(message, 'LLM_TIMEOUT');
        this.name = 'LLMTimeoutError';
    }
}

export class LLMRateLimitError extends LLMError {
    constructor(message = 'LLM rate limit exceeded') {
        super(message, 'LLM_RATE_LIMIT');
        this.name = 'LLMRateLimitError';
    }
}

export class LLMCircuitOpenError extends LLMError {
    constructor(modelId, retryAfter) {
        super(`Circuit breaker OPEN for ${modelId}. Retry after ${Math.ceil(retryAfter / 1000)}s`, 'LLM_CIRCUIT_OPEN');
        this.name = 'LLMCircuitOpenError';
        this.modelId = modelId;
        this.retryAfter = retryAfter;
    }
}

/**
 * Validation errors
 */
export class ValidationError extends AutomationError {
    constructor(message, code = 'VALIDATION_ERROR') {
        super(message, code);
        this.name = 'ValidationError';
    }
}

/**
 * Helper to check error type
 * @param {Error} error - Error to check
 * @param {string} code - Error code to match
 * @returns {boolean}
 */
export function isErrorCode(error, code) {
    return error?.code === code || error?.name === code;
}

/**
 * Helper to wrap async functions with error handling
 * @param {Function} fn - Function to wrap
 * @param {string} context - Context description for errors
 * @returns {Promise<any>}
 */
export async function withErrorHandling(fn, context = 'operation') {
    try {
        return await fn();
    } catch (error) {
        if (error instanceof AutomationError) {
            throw error;
        }
        throw new ActionError(`Error during ${context}: ${error.message}`, 'OPERATION_ERROR');
    }
}

export default {
    AutomationError,
    SessionError,
    SessionDisconnectedError,
    SessionNotFoundError,
    SessionTimeoutError,
    ContextError,
    ContextNotInitializedError,
    PageClosedError,
    ElementError,
    ElementNotFoundError,
    ElementDetachedError,
    ElementObscuredError,
    ElementTimeoutError,
    ActionError,
    ActionFailedError,
    NavigationError,
    ConfigError,
    ConfigNotFoundError,
    LLMError,
    LLMTimeoutError,
    LLMRateLimitError,
    LLMCircuitOpenError,
    ValidationError,
    isErrorCode,
    withErrorHandling,
};

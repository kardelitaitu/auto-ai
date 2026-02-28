/**
 * @fileoverview Middleware Pipeline
 * Transform and validate actions before execution.
 * 
 * @module api/middleware
 */

import { createLogger } from './logger.js';
import { getEvents } from './context.js';
import { isErrorCode } from './errors.js';

const logger = createLogger('api/middleware.js');

/**
 * Create a middleware pipeline.
 * Middlewares execute in order, each can transform context or short-circuit.
 * 
 * @param {...Function} middlewares - Middleware functions
 * @returns {Function} Pipeline function
 */
export function createPipeline(...middlewares) {
  return async (action, context) => {
    let index = 0;

    const next = async () => {
      if (index >= middlewares.length) {
        return await action(context);
      }
      const middleware = middlewares[index++];
      return await middleware(context, next);
    };

    return await next();
  };
}

/**
 * Create a sync middleware pipeline.
 * For middlewares that don't need async operations.
 * 
 * @param {...Function} middlewares - Middleware functions
 * @returns {Function} Pipeline function
 */
export function createSyncPipeline(...middlewares) {
  return (action, context) => {
    let index = 0;

    const next = () => {
      if (index >= middlewares.length) {
        return action(context);
      }
      const middleware = middlewares[index++];
      return middleware(context, next);
    };

    return next();
  };
}

// ─── Common Middlewares ───────────────────────────────────────────

/**
 * Logging middleware - logs action execution.
 * @param {object} [options]
 * @param {boolean} [options.logArgs=true] - Log arguments
 * @param {boolean} [options.logResult=true] - Log result
 * @param {boolean} [options.logTime=false] - Log execution time
 * @returns {Function}
 */
export function loggingMiddleware(options = {}) {
  const { logArgs = true, logResult = true, logTime = false } = options;

  return async (context, next) => {
    const { action, selector, options: actionOptions } = context;

    if (logArgs) {
      logger.debug(`[Middleware] ${action}:`, { selector, options: actionOptions });
    }

    const startTime = Date.now();

    try {
      const result = await next();

      if (logTime) {
        logger.debug(`[Middleware] ${action} took ${Date.now() - startTime}ms`);
      }

      if (logResult) {
        logger.debug(`[Middleware] ${action} result:`, result);
      }

      return result;
    } catch (e) {
      logger.debug(`[Middleware] ${action} error:`, e.message);
      throw e;
    }
  };
}

/**
 * Validation middleware - validates selectors and options.
 * @param {object} [rules] - Validation rules
 * @returns {Function}
 */
export function validationMiddleware() {
  return async (context, next) => {
    const { action, selector, options = {} } = context;

    // Validate selector for DOM actions
    if (['click', 'type', 'hover'].includes(action)) {
      if (!selector) {
        throw new Error(`Selector is required for ${action}`);
      }
      const isString = typeof selector === 'string';
      const isLocator = selector && typeof selector === 'object' && selector.constructor.name === 'Locator';

      if (!isString && !isLocator) {
        throw new Error(`Invalid selector type for ${action}: ${typeof selector}. Expected string or Locator.`);
      }

      if (isString && selector.trim() === '') {
        throw new Error(`Empty selector for ${action}`);
      }
    }

    // Validate options
    if (options.timeoutMs !== undefined && options.timeoutMs < 0) {
      throw new Error('timeoutMs must be non-negative');
    }

    if (options.maxRetries !== undefined && options.maxRetries < 0) {
      throw new Error('maxRetries must be non-negative');
    }

    return await next();
  };
}

/**
 * Retry middleware - auto-retry on failure.
 * @param {object} [options]
 * @param {number} [options.maxRetries=3] - Max retry attempts
 * @param {number} [options.backoffMultiplier=2] - Exponential backoff
 * @param {Function} [options.shouldRetry] - Custom retry condition
 * @returns {Function}
 */
export function retryMiddleware(options = {}) {
  const {
    maxRetries = 3,
    backoffMultiplier = 2,
    shouldRetry = () => true
  } = options;

  return async (context, next) => {
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await next();
      } catch (e) {
        lastError = e;

        if (!shouldRetry(e) || attempt >= maxRetries) {
          throw e;
        }

        const delay = Math.pow(backoffMultiplier, attempt) * 100;
        logger.debug(`[Retry] Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }

    throw lastError;
  };
}

/**
 * Recovery middleware - handles common errors with recovery strategies.
 * @param {object} [options]
 * @param {boolean} [options.scrollOnDetached=true] - Scroll when element detached
 * @param {boolean} [options.retryOnObscured=true] - Retry when element obscured
 * @returns {Function}
 */
export function recoveryMiddleware(options = {}) {
  const { scrollOnDetached = true, retryOnObscured = true } = options;

  return async (context, next) => {
    const { action, selector: _selector } = context;

    try {
      return await next();
    } catch (e) {
      // Element detached - focal recovery (wait + retry)
      if (scrollOnDetached && (isErrorCode(e, 'ELEMENT_DETACHED') || isErrorCode(e, 'ELEMENT_NOT_FOUND') || ((e.message || '').toLowerCase().includes('detached') || (e.message || '').toLowerCase().includes('stale')))) {
        logger.warn(`[Recovery] Element detached for ${action}. Retrying...`);
        await new Promise(r => setTimeout(r, 500));
        return await next();
      }

      // Element obscured - retry once with force if it's a click
      if (retryOnObscured && (isErrorCode(e, 'ELEMENT_OBSCURED') || (e.message || '').toLowerCase().includes('obscured'))) {
        logger.warn(`[Recovery] Element obscured during ${action}. Retrying with force...`);
        if (context.options) {
          context.options.force = true;
        }
        return await next();
      }

      throw e;
    }
  };
}

/**
 * Metrics middleware - tracks action timing and success.
 * @param {object} [options]
 * @param {boolean} [options.emitEvents=true] - Emit metrics events
 * @returns {Function}
 */
export function metricsMiddleware(options = {}) {
  const { emitEvents = true } = options;

  return async (context, next) => {
    const { action } = context;
    const startTime = Date.now();
    let success = false;

    try {
      const result = await next();
      success = true;
      return result;
    } finally {
      const duration = Date.now() - startTime;

      const metric = {
        action,
        duration,
        success,
        timestamp: Date.now(),
      };

      if (emitEvents) {
        getEvents().emitSafe('on:metrics', metric);
      }

      logger.debug(`[Metrics] ${action}: ${duration}ms (${success ? 'success' : 'failure'})`);
    }
  };
}

/**
 * Rate limiting middleware.
 * @param {object} [options]
 * @param {number} [options.maxPerSecond=10] - Max actions per second
 * @returns {Function}
 */
export function rateLimitMiddleware(options = {}) {
  const { maxPerSecond = 10 } = options;

  let actionCount = 0;
  let windowStart = Date.now();

  return async (context, next) => {
    const now = Date.now();

    if (now - windowStart >= 1000) {
      actionCount = 0;
      windowStart = now;
    }

    if (actionCount >= maxPerSecond) {
      const waitTime = 1000 - (now - windowStart);
      logger.debug(`[RateLimit] Throttling, waiting ${waitTime}ms`);
      await new Promise(r => setTimeout(r, waitTime));
    }

    actionCount++;
    return await next();
  };
}

export default {
  createPipeline,
  createSyncPipeline,
  loggingMiddleware,
  validationMiddleware,
  retryMiddleware,
  recoveryMiddleware,
  metricsMiddleware,
  rateLimitMiddleware,
};

/**
 * @fileoverview A collection of validation functions for various data structures.
 * @module utils/validator
 */

import { createLogger } from './logger.js';

const logger = createLogger('validator.js');

/**
 * Validates a single value against a set of rules.
 * @param {string} field - The name of the field being validated.
 * @param {any} value - The value to validate.
 * @param {object} rules - The validation rules.
 * @returns {string[]} An array of error messages.
 * @private
 */
function validateField(field, value, rules) {
  const errors = [];

  if (rules.required && (value === undefined || value === null)) {
    errors.push(`Required field '${field}' is missing`);
    return errors;
  }

  if (value === undefined || value === null) {
    return errors;
  }

  if (rules.type && typeof value !== rules.type) {
    errors.push(`Field '${field}' must be of type ${rules.type}, got ${typeof value}`);
    return errors;
  }

  if (rules.type === 'number') {
    if (rules.min !== undefined && value < rules.min) {
      errors.push(`Field '${field}' must be at least ${rules.min}, got ${value}`);
    }
    if (rules.max !== undefined && value > rules.max) {
      errors.push(`Field '${field}' must be at most ${rules.max}, got ${value}`);
    }
  }

  if (rules.type === 'string') {
    if (rules.minLength !== undefined && value.length < rules.minLength) {
      errors.push(`Field '${field}' must be at least ${rules.minLength} characters long`);
    }
    if (rules.maxLength !== undefined && value.length > rules.maxLength) {
      errors.push(`Field '${field}' must be at most ${rules.maxLength} characters long`);
    }
    if (rules.pattern && !new RegExp(rules.pattern).test(value)) {
      errors.push(`Field '${field}' does not match required pattern`);
    }
  }

  if (rules.type === 'array') {
    if (!Array.isArray(value)) {
      errors.push(`Field '${field}' must be an array`);
    } else if (rules.nonEmpty && value.length === 0) {
      errors.push(`Field '${field}' must be a non-empty array`);
    } else if (rules.itemSchema) {
      value.forEach((item, index) => {
        const itemErrors = validate(item, rules.itemSchema);
        if (!itemErrors.isValid) {
          itemErrors.errors.forEach(error => {
            errors.push(`Error in '${field}[${index}]': ${error}`);
          });
        }
      });
    }
  }

  return errors;
}

/**
 * Validates an object against a schema.
 * @param {object} data - The object to validate.
 * @param {object} schema - The validation schema.
 * @returns {{isValid: boolean, errors: string[]}} An object indicating whether the data is valid, and an array of any validation errors.
 * @private
 */
function validate(data, schema) {
  const errors = [];

  if (!data || typeof data !== 'object') {
    errors.push('Data must be a valid object');
    return { isValid: false, errors };
  }

  for (const [field, rules] of Object.entries(schema)) {
    const value = data[field];
    const fieldErrors = validateField(field, value, rules);
    if (fieldErrors.length > 0) {
      errors.push(...fieldErrors);
    }
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Validates the structure and types of a task payload.
 * @param {object} payload - The task payload to validate.
 * @param {object} [schema={}] - Additional validation schema to merge with the default schema.
 * @returns {{isValid: boolean, errors: string[]}} An object indicating whether the payload is valid, and an array of any validation errors.
 */
export function validatePayload(payload, schema = {}) {
  const defaultSchema = {
    browserInfo: { type: 'string', required: false },
    url: { type: 'string', required: false, pattern: '^(http|https)://' },
    duration: { type: 'number', required: false, min: 1, max: 3600 },
  };

  const validationSchema = { ...defaultSchema, ...schema };
  const result = validate(payload, validationSchema);

  if (!result.isValid) {
    logger.warn('Payload validation failed:', result.errors);
  }

  return result;
}

const apiResponseSchemas = {
  roxybrowser: {
    code: { type: 'number', required: true },
    msg: { type: 'string', required: false },
    data: {
      type: 'array',
      required: true,
      itemSchema: {
        ws: { type: 'string', required: false },
        http: { type: 'string', required: false },
        windowName: { type: 'string', required: false },
        sortNum: { type: 'number', required: false },
      },
    },
  },
  ixbrowser: {
    code: { type: 'number', required: true },
  },
  morelogin: {
    code: { type: 'number', required: true },
  },
  localChrome: {
    code: { type: 'number', required: true },
  },
};

/**
 * Validates the structure of an API response.
 * @param {object} response - The API response to validate.
 * @param {string} [apiType='unknown'] - The type of API (e.g., 'roxybrowser').
 * @returns {{isValid: boolean, errors: string[]}} An object indicating whether the response is valid, and an array of any validation errors.
 */
export function validateApiResponse(response, apiType = 'unknown') {
  const schema = apiResponseSchemas[apiType];

  if (!schema) {
    logger.warn(`No specific validation rules for API type: ${apiType}`);
    return { isValid: true, errors: [] };
  }

  const result = validate(response, schema);

  if (!result.isValid) {
    logger.error(`API response validation failed for ${apiType}:`, result.errors);
  } else {
    logger.debug(`API response validation passed for ${apiType}`);
  }

  return result;
}

/**
 * Validates browser connection parameters.
 * @param {string} wsEndpoint - The WebSocket endpoint URL.
 * @returns {{isValid: boolean, errors: string[]}} An object indicating whether the connection parameters are valid, and an array of any validation errors.
 */
export function validateBrowserConnection(wsEndpoint) {
  const schema = {
    wsEndpoint: { type: 'string', required: true, pattern: '^wss?://.+' },
  };
  const result = validate({ wsEndpoint }, schema);

  if (!result.isValid) {
    logger.warn('Browser connection validation failed:', result.errors);
  }

  return result;
}

/**
 * Validates the parameters for a task execution.
 * @param {object} browser - The Playwright browser instance.
 * @param {object} payload - The task payload.
 * @param {object} [schema={}] - Additional validation schema for the payload.
 * @returns {{isValid: boolean, errors: string[]}} An object indicating whether the parameters are valid, and an array of any validation errors.
 */
export function validateTaskExecution(instance, payload, schema = {}) {
  const errors = [];

  if (!instance || typeof instance !== 'object') {
    errors.push('Browser, Context, or Page instance is required');
  } else {
    const isBrowser = typeof instance.newContext === 'function';
    const isContext = typeof instance.newPage === 'function';
    const isPage = typeof instance.goto === 'function'; // Pages have a goto method

    if (!isBrowser && !isContext && !isPage) {
      errors.push('Invalid browser, context, or page instance provided');
    }
  }

  const payloadValidation = validatePayload(payload, schema);
  if (!payloadValidation.isValid) {
    errors.push(...payloadValidation.errors);
  }

  const isValid = errors.length === 0;

  if (!isValid) {
    logger.error('Task execution validation failed:', errors);
  }

  return { isValid, errors };
}

export default {
  validatePayload,
  validateApiResponse,
  validateBrowserConnection,
  validateTaskExecution,
};

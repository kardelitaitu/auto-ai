/**
 * Circuit Breaker
 * Prevents cascade failures by tracking failures per model
 * @module utils/circuit-breaker
 */

import { createLogger } from './logger.js';

const logger = createLogger('circuit-breaker.js');

export class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 60000;
    this.halfOpenSuccessThreshold = options.halfOpenSuccessThreshold || 1;

    this.circuits = new Map();
  }

  getKey(model, apiKey) {
    return `${model}::${apiKey || 'default'}`;
  }

  check(model, apiKey = null) {
    const key = this.getKey(model, apiKey);
    const circuit = this.circuits.get(key);

    if (!circuit) {
      return { allowed: true, state: 'closed' };
    }

    const now = Date.now();

    switch (circuit.state) {
      case 'open':
        if (now - circuit.lastFailure >= this.resetTimeout) {
          circuit.state = 'half-open';
          logger.info(`[CircuitBreaker] ${key} transitioning to half-open`);
          return { allowed: true, state: 'half-open' };
        }
        return { allowed: false, state: 'open', retryAfter: this.resetTimeout - (now - circuit.lastFailure) };

      case 'half-open':
        return { allowed: true, state: 'half-open' };

      case 'closed':
      default:
        return { allowed: true, state: 'closed' };
    }
  }

  recordSuccess(model, apiKey = null) {
    const key = this.getKey(model, apiKey);
    const circuit = this.circuits.get(key);

    if (!circuit) {
      return;
    }

    if (circuit.state === 'half-open') {
      circuit.successes++;

      if (circuit.successes >= this.halfOpenSuccessThreshold) {
        circuit.state = 'closed';
        circuit.failures = 0;
        circuit.successes = 0;
        logger.info(`[CircuitBreaker] ${key} closed (recovered)`);
      }
    }
  }

  recordFailure(model, apiKey = null) {
    const key = this.getKey(model, apiKey);

    let circuit = this.circuits.get(key);

    if (!circuit) {
      circuit = {
        state: 'closed',
        failures: 0,
        successes: 0,
        lastFailure: null,
        firstFailure: null
      };
      this.circuits.set(key, circuit);
    }

    circuit.failures++;
    circuit.lastFailure = Date.now();

    if (!circuit.firstFailure) {
      circuit.firstFailure = circuit.lastFailure;
    }

    if (circuit.state === 'closed' && circuit.failures >= this.failureThreshold) {
      circuit.state = 'open';
      logger.warn(`[CircuitBreaker] ${key} OPENED after ${circuit.failures} failures`);
    }

    if (circuit.state === 'half-open') {
      circuit.state = 'open';
      circuit.successes = 0;
      logger.warn(`[CircuitBreaker] ${key} reopened after failure in half-open state`);
    }
  }

  getState(model, apiKey = null) {
    const key = this.getKey(model, apiKey);
    return this.circuits.get(key) || null;
  }

  getAllStates() {
    const states = {};
    this.circuits.forEach((circuit, key) => {
      states[key] = {
        state: circuit.state,
        failures: circuit.failures,
        successes: circuit.successes,
        lastFailure: circuit.lastFailure
      };
    });
    return states;
  }

  reset(model = null, apiKey = null) {
    if (model) {
      const key = this.getKey(model, apiKey);
      this.circuits.delete(key);
      logger.info(`[CircuitBreaker] Reset circuit for ${key}`);
    } else {
      this.circuits.clear();
      logger.info('[CircuitBreaker] Reset all circuits');
    }
  }

  getStats() {
    let open = 0;
    let halfOpen = 0;
    let closed = 0;

    this.circuits.forEach(circuit => {
      if (circuit.state === 'open') open++;
      else if (circuit.state === 'half-open') halfOpen++;
      else closed++;
    });

    return {
      total: this.circuits.size,
      open,
      halfOpen,
      closed
    };
  }
}

export default CircuitBreaker;

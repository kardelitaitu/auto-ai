/**
 * Auto-AI Framework - Proprietary Software
 * Copyright (c) 2025 gantengmaksimal - All Rights Reserved
 * Unauthorized copying, distribution, or modification prohibited
 */

/**
 * Circuit Breaker - Re-export from core/circuit-breaker
 * @module utils/circuit-breaker
 * @deprecated Use core/circuit-breaker.js instead
 */

import CoreCircuitBreaker, { CircuitOpenError } from '../core/circuit-breaker.js';

const instance = new CoreCircuitBreaker();

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
        return instance.check(model, apiKey);
    }

    recordSuccess(model, apiKey = null) {
        return instance.recordSuccess(model, apiKey);
    }

    recordFailure(model, apiKey = null) {
        return instance.recordFailure(model, apiKey);
    }

    getState(model, apiKey = null) {
        return instance.getState(model, apiKey);
    }

    getAllStates() {
        return instance.getAllStates();
    }

    reset(model = null, apiKey = null) {
        return instance.reset(model, apiKey);
    }

    getStats() {
        return instance.getStats();
    }
}

export { CircuitOpenError };
export default CircuitBreaker;

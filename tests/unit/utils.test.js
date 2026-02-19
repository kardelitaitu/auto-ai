/**
 * @fileoverview Tests for utils.js re-export module
 * @module tests/unit/utils.test
 */

import { describe, it, expect } from 'vitest';
import {
  createRandomScroller,
  createRandomZoomer,
  createLogger,
  ApiHandler,
  metricsCollector,
  MetricsCollector,
  getEnv,
  isDevelopment,
  isProduction
} from '../../utils/utils.js';

describe('utils.js re-exports', () => {
  describe('randomScrolling', () => {
    it('should export createRandomScroller function', () => {
      expect(typeof createRandomScroller).toBe('function');
    });
  });

  describe('randomZoom', () => {
    it('should export createRandomZoomer function', () => {
      expect(typeof createRandomZoomer).toBe('function');
    });
  });

  describe('logger', () => {
    it('should export createLogger function', () => {
      expect(typeof createLogger).toBe('function');
    });
  });

  describe('apiHandler', () => {
    it('should export ApiHandler class', () => {
      expect(typeof ApiHandler).toBe('function');
      // Check if it's a constructor (class)
      expect(ApiHandler.prototype).toBeDefined();
    });
  });

  describe('metrics', () => {
    it('should export metricsCollector as default', () => {
      expect(metricsCollector).toBeDefined();
      expect(typeof metricsCollector).toBe('object');
    });

    it('should export MetricsCollector class', () => {
      expect(typeof MetricsCollector).toBe('function');
      expect(MetricsCollector.prototype).toBeDefined();
    });
  });

  describe('envLoader', () => {
    it('should export getEnv function', () => {
      expect(typeof getEnv).toBe('function');
    });

    it('should export isDevelopment function', () => {
      expect(typeof isDevelopment).toBe('function');
    });

    it('should export isProduction function', () => {
      expect(typeof isProduction).toBe('function');
    });

    it('isDevelopment should return a boolean', () => {
      const result = isDevelopment();
      expect(typeof result).toBe('boolean');
    });

    it('isProduction should return a boolean', () => {
      const result = isProduction();
      expect(typeof result).toBe('boolean');
    });
  });
});

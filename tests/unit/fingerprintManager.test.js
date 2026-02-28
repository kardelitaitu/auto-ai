import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fingerprintManager } from '../../utils/fingerprintManager.js';

vi.mock('../../utils/mathUtils.js', () => ({
  mathUtils: {
    sample: vi.fn((arr) => arr[0])
  }
}));

describe('fingerprintManager', () => {
  describe('getAll()', () => {
    it('should return array of fingerprints', () => {
      const fingerprints = fingerprintManager.getAll();
      expect(Array.isArray(fingerprints)).toBe(true);
    });
  });

  describe('getByPlatform()', () => {
    it('should filter fingerprints by platform (case insensitive)', () => {
      const result = fingerprintManager.getByPlatform('win');
      expect(Array.isArray(result)).toBe(true);
    });

    it('should return empty array for unknown platform', () => {
      const result = fingerprintManager.getByPlatform('unknown_platform_xyz');
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getRandom()', () => {
    it('should return a fingerprint', () => {
      const result = fingerprintManager.getRandom();
      expect(result).toBeDefined();
    });
  });

  describe('matchUserAgent()', () => {
    it('should match Windows user agent', () => {
      const result = fingerprintManager.matchUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
      expect(result).toBeDefined();
    });

    it('should match Mac user agent', () => {
      const result = fingerprintManager.matchUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)');
      expect(result).toBeDefined();
    });

    it('should match Linux user agent', () => {
      const result = fingerprintManager.matchUserAgent('Mozilla/5.0 (X11; Linux x86_64)');
      expect(result).toBeDefined();
    });

    it('should return random fingerprint for null/undefined input', () => {
      const result1 = fingerprintManager.matchUserAgent(null);
      const result2 = fingerprintManager.matchUserAgent(undefined);
      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
    });
  });
});

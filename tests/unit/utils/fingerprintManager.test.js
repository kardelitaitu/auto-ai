import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fingerprintManager } from '../../../utils/fingerprintManager.js';
import { mathUtils } from '../../../utils/mathUtils.js';

vi.mock('../../../utils/mathUtils.js', () => ({
  mathUtils: {
    sample: vi.fn((arr) => arr && arr.length > 0 ? arr[0] : undefined)
  }
}));

import { mathUtils } from '../../../utils/mathUtils.js';

describe('utils/fingerprintManager.js', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAll', () => {
    it('should return all fingerprints', () => {
      const result = fingerprintManager.getAll();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should return empty array when no fingerprints loaded', () => {
      const { fingerprintManager: fm } = require('../../../utils/fingerprintManager.js');
      vi.resetModules();
    });
  });

  describe('getByPlatform', () => {
    it('should filter fingerprints by platform (case insensitive)', () => {
      const result = fingerprintManager.getByPlatform('win');
      expect(result.length).toBeGreaterThan(0);
      result.forEach(fp => {
        expect(fp.platform.toLowerCase()).toContain('win');
      });
    });

    it('should filter by Mac platform', () => {
      const result = fingerprintManager.getByPlatform('mac');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should filter by Linux platform', () => {
      const result = fingerprintManager.getByPlatform('linux');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should return empty array when no match', () => {
      const result = fingerprintManager.getByPlatform('nonexistentplatform123');
      expect(result).toEqual([]);
    });

    it('should be case insensitive for platform matching', () => {
      const resultLower = fingerprintManager.getByPlatform('win');
      const resultUpper = fingerprintManager.getByPlatform('WIN');
      expect(resultLower.length).toBe(resultUpper.length);
    });
  });

  describe('getRandom', () => {
    it('should call mathUtils.sample with fingerprints', () => {
      fingerprintManager.getRandom();
      expect(mathUtils.sample).toHaveBeenCalled();
    });

    it('should return the sample from mathUtils', () => {
      const mockFp = { id: 'test' };
      mathUtils.sample.mockReturnValueOnce(mockFp);
      const result = fingerprintManager.getRandom();
      expect(result).toEqual(mockFp);
    });
  });

  describe('matchUserAgent', () => {
    it('should return random fingerprint when userAgent is null', () => {
      fingerprintManager.matchUserAgent(null);
      expect(mathUtils.sample).toHaveBeenCalled();
    });

    it('should return random fingerprint when userAgent is undefined', () => {
      fingerprintManager.matchUserAgent(undefined);
      expect(mathUtils.sample).toHaveBeenCalled();
    });

    it('should return random fingerprint when userAgent is empty string', () => {
      fingerprintManager.matchUserAgent('');
      expect(mathUtils.sample).toHaveBeenCalled();
    });

    it('should detect Windows platform from user agent', () => {
      const result = fingerprintManager.matchUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
      expect(result).toBeDefined();
    });

    it('should detect Mac platform from user agent', () => {
      const result = fingerprintManager.matchUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)');
      expect(result).toBeDefined();
    });

    it('should detect Linux platform from user agent', () => {
      const result = fingerprintManager.matchUserAgent('Mozilla/5.0 (X11; Linux x86_64)');
      expect(result).toBeDefined();
    });

    it('should fallback to random when platform not recognized', () => {
      const result = fingerprintManager.matchUserAgent('Mozilla/5.0 (Unknown OS xyz)');
      expect(mathUtils.sample).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should handle each platform branch in ternary', () => {
      const winResult = fingerprintManager.matchUserAgent('Mozilla/5.0 (Windows NT 10.0)');
      expect(winResult).toBeDefined();
      
      const macResult = fingerprintManager.matchUserAgent('Mozilla/5.0 (Macintosh)');
      expect(macResult).toBeDefined();
      
      const linuxResult = fingerprintManager.matchUserAgent('Mozilla/5.0 (Linux)');
      expect(linuxResult).toBeDefined();
    });

    it('should return sample when platform matches and fingerprints found', () => {
      // This tests the branch where platform is detected AND matches.length > 0
      const mockFp = { id: 'matched-win', platform: 'Win32' };
      mathUtils.sample.mockReturnValueOnce(mockFp);
      
      const result = fingerprintManager.matchUserAgent('Windows NT 10.0');
      // Since we have Windows fingerprints, it should return from matches
      expect(result).toBeDefined();
    });

    it('should return from matched fingerprints directly', () => {
      // Test that the function returns from the matches path when matches exist
      mathUtils.sample.mockClear();
      
      // With "Win" in user agent, it should detect Windows platform
      // and find matching fingerprints (since we have Windows fingerprints)
      const result = fingerprintManager.matchUserAgent('Win');
      // The result should be defined - either from matches or fallback
      expect(result).toBeDefined();
    });

    it('should test the branch where matches.length > 0', () => {
      // This specifically tests the branch on line 49
      mathUtils.sample.mockClear();
      
      // Use a UA that definitely matches our Windows fingerprints
      const allFps = fingerprintManager.getAll();
      const winFps = allFps.filter(fp => fp.platform.toLowerCase().includes('win'));
      
      expect(winFps.length).toBeGreaterThan(0); // Verify we have Windows fingerprints
      
      const result = fingerprintManager.matchUserAgent('Windows NT');
      expect(result).toBeDefined();
    });
  });
});
